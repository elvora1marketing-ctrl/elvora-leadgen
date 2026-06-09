import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { sendEmail } from '@/lib/notify';
import { generateICS } from '@/lib/funnel-ics';
import { resolveTemplate, type FunnelConfig } from '@/lib/funnel-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = getDb();
    const funnel = db.prepare('SELECT * FROM funnel_configs WHERE slug = ? AND is_active = 1').get(slug) as Record<string, unknown> | undefined;
    if (!funnel) return NextResponse.json({ error: 'Funnel nicht gefunden' }, { status: 404, headers: cors() });

    let config: FunnelConfig;
    try { config = JSON.parse(funnel.config as string); } catch { return NextResponse.json({ error: 'Config defekt' }, { status: 500, headers: cors() }); }

    const body = await request.json();
    const { answers, name, email, phone, preferredTime, _start, _honey } = body;

    // Honeypot
    if (config.spam?.honeypot && _honey) {
      return NextResponse.json({ ok: true }, { headers: cors() });
    }

    // Timing bot-check
    if (config.spam?.minSubmitTimeMs && _start) {
      const elapsed = Date.now() - Number(_start);
      if (elapsed < config.spam.minSubmitTimeMs) {
        return NextResponse.json({ ok: true }, { headers: cors() });
      }
    }

    // Rate limit
    if (config.spam?.rateLimit) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ipHash = crypto.createHash('sha256').update(ip + slug).digest('hex').slice(0, 16);
      const { maxPerHour, maxPerDay } = config.spam.rateLimit;
      if (maxPerHour) {
        const row = db.prepare(
          "SELECT COUNT(*) as c FROM funnel_leads WHERE funnel_id = ? AND ip_hash = ? AND created_at > datetime('now', '-1 hour')"
        ).get(funnel.id, ipHash) as { c: number };
        if (row.c >= maxPerHour) return NextResponse.json({ error: 'Zu viele Anfragen' }, { status: 429, headers: cors() });
      }
      if (maxPerDay) {
        const row = db.prepare(
          "SELECT COUNT(*) as c FROM funnel_leads WHERE funnel_id = ? AND ip_hash = ? AND created_at > datetime('now', '-1 day')"
        ).get(funnel.id, ipHash) as { c: number };
        if (row.c >= maxPerDay) return NextResponse.json({ error: 'Tageslimit erreicht' }, { status: 429, headers: cors() });
      }
    }

    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-Mail ungültig' }, { status: 400, headers: cors() });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const ipHash = crypto.createHash('sha256').update(ip + slug).digest('hex').slice(0, 16);

    const result = db.prepare(
      "INSERT INTO funnel_leads (funnel_id, answers, name, email, phone, preferred_time, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      funnel.id,
      JSON.stringify(answers || {}),
      name || '',
      email,
      phone || '',
      preferredTime || '',
      ipHash
    );

    // Notifications (fire-and-forget)
    const leadId = result.lastInsertRowid;
    const answersFormatted = Object.entries(answers || {})
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');

    // Email to customer
    if (config.notify.email) {
      const rows = Object.entries(answers || {})
        .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#64748b;font-size:13px;">${escHtml(k)}</td><td style="padding:4px 8px;font-size:13px;">${escHtml(Array.isArray(v) ? v.join(', ') : String(v))}</td></tr>`)
        .join('');
      const html = `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;">
          <div style="background:${escHtml(config.branding.primaryColor)};padding:20px 24px;border-radius:12px 12px 0 0;">
            <h1 style="color:#fff;font-size:17px;margin:0;">Neue Anfrage — ${escHtml(config.branding.companyName)}</h1>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:14px;"><strong>${escHtml(name || '—')}</strong></p>
            <p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escHtml(email)}${phone ? ' · ' + escHtml(phone) : ''}</p>
            ${preferredTime ? `<p style="margin:0 0 12px;font-size:13px;color:#64748b;">Wunschzeit: ${escHtml(preferredTime)}</p>` : ''}
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>
          </div>
        </div>`;
      sendEmail(config.notify.email, `Neue Anfrage: ${name || email} (${config.branding.companyName})`, html).catch(() => {});
    }

    // Webhook
    if (config.notify.webhookUrl) {
      fetch(config.notify.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'new_lead', funnel: slug, lead: { id: Number(leadId), name, email, phone, preferredTime, answers } }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    // Confirmation email to lead
    if (config.notify.confirmationEmail && email) {
      const subj = resolveTemplate(config.notify.confirmationEmail.subject, { name, email, ...answers });
      let bodyHtml = resolveTemplate(config.notify.confirmationEmail.body, { name, email, ...answers });
      bodyHtml = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;font-size:15px;line-height:1.6;color:#334155;">${bodyHtml.replace(/\n/g, '<br>')}</div>`;

      // Attach ICS if preferred time
      if (preferredTime) {
        const icsContent = generateICS({
          summary: `Termin — ${config.branding.companyName}`,
          description: `Anfrage von ${name || email}`,
          dateStr: preferredTime,
          organizer: config.notify.email,
          attendee: email,
        });
        bodyHtml += `<p style="margin-top:20px;font-size:13px;color:#94a3b8;">Eine Kalender-Einladung ist angehängt.</p>`;
        // Note: ICS as email attachment requires MIME. For now, include as data-URI link.
        const icsB64 = Buffer.from(icsContent).toString('base64');
        bodyHtml += `<p><a href="data:text/calendar;base64,${icsB64}" download="termin.ics" style="color:${escHtml(config.branding.primaryColor)};">📅 Termin herunterladen</a></p>`;
      }

      sendEmail(email, subj, bodyHtml).catch(() => {});
    }

    return NextResponse.json({ ok: true, id: Number(leadId) }, { headers: cors() });
  } catch (e) {
    console.error('[funnel/lead] error:', e);
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500, headers: cors() });
  }
}
