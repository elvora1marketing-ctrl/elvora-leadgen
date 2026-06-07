import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ClientRow {
  id: number;
  lead_id: number | null;
  company_name: string;
  dashboard_enabled: number;
  lead_value: number;
  form_slugs: string;
  chat_widget_ids: string;
  track_bookings: number;
}

function parseArr(s: string): (string | number)[] {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Last N months as 'YYYY-MM' keys, oldest first
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getDb();

    const client = db.prepare('SELECT * FROM clients WHERE token = ?').get(token) as ClientRow | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    }
    if (!client.dashboard_enabled) {
      return NextResponse.json({ enabled: false });
    }

    const formSlugs = parseArr(client.form_slugs) as string[];
    const chatWidgetIds = parseArr(client.chat_widget_ids) as number[];
    const leadValue = Number(client.lead_value) || 0;

    // ---- Counts per month (last 6) ----
    const months = lastMonths(6);
    const monthCounts: Record<string, { form: number; chat: number }> = {};
    for (const m of months) monthCounts[m] = { form: 0, chat: 0 };

    if (formSlugs.length) {
      const ph = formSlugs.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT strftime('%Y-%m', cs.created_at) as month, COUNT(*) as c
         FROM contact_submissions cs JOIN contact_forms cf ON cs.form_id = cf.id
         WHERE cf.slug IN (${ph}) GROUP BY month`
      ).all(...formSlugs) as { month: string; c: number }[];
      for (const r of rows) if (monthCounts[r.month]) monthCounts[r.month].form = r.c;
    }

    if (chatWidgetIds.length) {
      const ph = chatWidgetIds.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as c
         FROM chat_conversations WHERE widget_id IN (${ph}) GROUP BY month`
      ).all(...chatWidgetIds) as { month: string; c: number }[];
      for (const r of rows) if (monthCounts[r.month]) monthCounts[r.month].chat = r.c;
    }

    const monthly = months.map((m) => {
      const c = monthCounts[m];
      const total = c.form + c.chat;
      return { month: m, form: c.form, chat: c.chat, total, value: total * leadValue };
    });

    const thisKey = months[months.length - 1];
    const lastKey = months[months.length - 2];
    const thisMonth = monthCounts[thisKey].form + monthCounts[thisKey].chat;
    const lastMonth = lastKey ? monthCounts[lastKey].form + monthCounts[lastKey].chat : 0;

    // ---- All-time totals ----
    let totalForm = 0;
    let totalChat = 0;
    if (formSlugs.length) {
      const ph = formSlugs.map(() => '?').join(',');
      const row = db.prepare(
        `SELECT COUNT(*) as c FROM contact_submissions cs JOIN contact_forms cf ON cs.form_id = cf.id WHERE cf.slug IN (${ph})`
      ).get(...formSlugs) as { c: number };
      totalForm = row.c;
    }
    if (chatWidgetIds.length) {
      const ph = chatWidgetIds.map(() => '?').join(',');
      const row = db.prepare(
        `SELECT COUNT(*) as c FROM chat_conversations WHERE widget_id IN (${ph})`
      ).get(...chatWidgetIds) as { c: number };
      totalChat = row.c;
    }
    const totalLeads = totalForm + totalChat;

    // ---- Recent leads (mix of form + chat, newest first) ----
    type Recent = { name: string; email: string; source: string; created_at: string };
    let recent: Recent[] = [];
    if (formSlugs.length) {
      const ph = formSlugs.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT cs.data as data, cs.created_at as created_at
         FROM contact_submissions cs JOIN contact_forms cf ON cs.form_id = cf.id
         WHERE cf.slug IN (${ph}) ORDER BY cs.created_at DESC LIMIT 10`
      ).all(...formSlugs) as { data: string; created_at: string }[];
      for (const r of rows) {
        let name = '';
        let email = '';
        try {
          const d = JSON.parse(r.data);
          name = d.name || '';
          email = d.email || '';
        } catch { /* ignore */ }
        recent.push({ name, email, source: 'Formular', created_at: r.created_at });
      }
    }
    if (chatWidgetIds.length) {
      const ph = chatWidgetIds.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT visitor_name, visitor_email, created_at FROM chat_conversations
         WHERE widget_id IN (${ph}) ORDER BY created_at DESC LIMIT 10`
      ).all(...chatWidgetIds) as { visitor_name: string; visitor_email: string; created_at: string }[];
      for (const r of rows) {
        recent.push({ name: r.visitor_name || '', email: r.visitor_email || '', source: 'Chat', created_at: r.created_at });
      }
    }
    recent = recent
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 10);

    return NextResponse.json({
      enabled: true,
      company_name: client.company_name,
      lead_value: leadValue,
      summary: {
        total_leads: totalLeads,
        this_month: thisMonth,
        last_month: lastMonth,
        total_value: totalLeads * leadValue,
        this_month_value: thisMonth * leadValue,
        form_leads: totalForm,
        chat_leads: totalChat,
      },
      monthly,
      recent,
    });
  } catch (error) {
    console.error('[client dashboard] error:', error);
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}
