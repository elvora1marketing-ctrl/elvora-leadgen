import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { sendEmail } from '@/lib/notify';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? '';
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface DueRequest {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  channel: string;
}

async function processDue(): Promise<{ processed: number; sent: number; skipped: number }> {
  const db = getDb();
  const googleUrl = getSetting('review_google_url').trim();
  const subject = getSetting('review_autopilot_subject') || 'Wie war Ihr Termin bei uns?';
  const template =
    getSetting('review_autopilot_message') ||
    'Hallo {{name}},\n\nvielen Dank für Ihren Besuch! Über eine kurze Google-Bewertung würden wir uns sehr freuen:\n\n{{link}}\n\nVielen Dank!';

  const due = db.prepare(
    "SELECT id, customer_name, customer_email, customer_phone, channel FROM review_requests WHERE status = 'pending' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 50"
  ).all() as DueRequest[];

  let sent = 0;
  let skipped = 0;

  for (const r of due) {
    // No review link configured → skip (can't send a meaningful request)
    if (!googleUrl) {
      db.prepare("UPDATE review_requests SET status = 'skipped', sent_at = datetime('now') WHERE id = ?").run(r.id);
      skipped++;
      continue;
    }

    const name = r.customer_name || 'Kunde';
    const body = template.replace(/\{\{\s*name\s*\}\}/g, name).replace(/\{\{\s*link\s*\}\}/g, googleUrl);

    let ok = false;
    if (r.customer_email) {
      const html = `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#334155;font-size:15px;line-height:1.6;">
          ${escapeHtml(body)
            .replace(/\n/g, '<br>')
            .replace(
              escapeHtml(googleUrl),
              `<a href="${escapeHtml(googleUrl)}" style="display:inline-block;margin:8px 0;padding:12px 24px;background:linear-gradient(135deg,#8B5CF6,#EC4899);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">⭐ Jetzt bewerten</a>`
            )}
        </div>`;
      ok = await sendEmail(r.customer_email, subject, html);
    } else {
      db.prepare("UPDATE review_requests SET status = 'skipped', sent_at = datetime('now') WHERE id = ?").run(r.id);
      skipped++;
      continue;
    }

    if (ok) {
      db.prepare("UPDATE review_requests SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(r.id);
      sent++;
    } else {
      db.prepare("UPDATE review_requests SET status = 'failed', sent_at = datetime('now') WHERE id = ?").run(r.id);
    }
  }

  return { processed: due.length, sent, skipped };
}

// Accept either a valid admin session or the CRON_SECRET bearer token.
function authorize(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return requireAuth(request) === null;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await processDue();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('[cron/review-requests] error:', e);
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
