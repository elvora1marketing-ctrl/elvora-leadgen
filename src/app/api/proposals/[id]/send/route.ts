import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pid = parseInt(id);
    if (isNaN(pid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();

    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(pid) as Record<string, unknown> | undefined;
    if (!proposal) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 });

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(proposal.lead_id) as Record<string, unknown> | undefined;
    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    if (!lead.email) return NextResponse.json({ error: 'Lead hat keine E-Mail-Adresse' }, { status: 400 });

    const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('resend_api_key', 'email_from_name', 'email_from_email', 'agency_name')").all() as { key: string; value: string }[];
    const cfg: Record<string, string> = {};
    for (const s of settings) cfg[s.key] = s.value;

    if (!cfg.resend_api_key) {
      return NextResponse.json({ error: 'Resend API-Key nicht konfiguriert' }, { status: 400 });
    }

    const fromName = cfg.email_from_name || cfg.agency_name || 'Elvora';
    const fromEmail = cfg.email_from_email || 'noreply@elvora.de';
    const agencyName = cfg.agency_name || 'Elvora';
    const token = proposal.token as string;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const proposalUrl = `${baseUrl}/proposal/${token}`;
    const amount = proposal.amount as number;
    const leadName = lead.name as string;

    const subject = `Ihr Angebot von ${agencyName}: ${proposal.title}`;

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0a0a0f;color:#c8ccd4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .container{max-width:560px;margin:0 auto;padding:40px 24px}
  .card{background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px}
  .logo{text-align:center;margin-bottom:24px}
  h1{color:#fff;font-size:20px;margin:0 0 8px}
  .subtitle{color:#8a8f98;font-size:14px;margin:0 0 24px}
  .price{background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.2);border-radius:12px;padding:20px;text-align:center;margin:20px 0}
  .price-amount{color:#fff;font-size:28px;font-weight:700}
  .price-label{color:#8a8f98;font-size:12px;margin-top:4px}
  .cta{display:block;background:#7c5cfc;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:600;margin:24px 0}
  .cta:hover{background:#6b4ce0}
  .footer{text-align:center;color:#555;font-size:11px;margin-top:32px}
</style></head>
<body><div class="container"><div class="card">
  <div class="logo"><img src="${baseUrl}/elvora-icon.svg" width="36" height="36" alt="${agencyName}"></div>
  <h1>Ihr individuelles Angebot</h1>
  <p class="subtitle">Hallo${leadName ? ` ${leadName.split(' ')[0]}` : ''}, wir haben ein Angebot für Sie vorbereitet.</p>
  <div class="price">
    <div class="price-amount">${amount ? amount.toLocaleString('de-DE') + ' €' : 'Auf Anfrage'}</div>
    <div class="price-label">${proposal.title} · zzgl. MwSt.</div>
  </div>
  <p style="color:#8a8f98;font-size:13px;line-height:1.6">
    Auf der Angebotsseite finden Sie alle Details: Ihre aktuelle Situation, unsere Lösung und die enthaltenen Leistungen.
    Sie können das Angebot direkt online annehmen oder ablehnen.
  </p>
  <a href="${proposalUrl}" class="cta">Angebot ansehen →</a>
  <p style="color:#555;font-size:11px;text-align:center">
    ${proposal.valid_until ? `Gültig bis ${new Date(proposal.valid_until as string).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}
  </p>
</div>
<div class="footer">
  ${agencyName}<br>
  Diese E-Mail wurde automatisch generiert.
</div></div></body></html>`;

    const text = `Ihr Angebot von ${agencyName}: ${proposal.title}\n\nHallo${leadName ? ` ${leadName.split(' ')[0]}` : ''},\n\nwir haben ein Angebot über ${amount ? amount.toLocaleString('de-DE') + ' €' : 'auf Anfrage'} für Sie vorbereitet.\n\nAngebot ansehen: ${proposalUrl}\n\nMit freundlichen Grüßen\n${agencyName}`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.resend_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [lead.email as string],
        subject,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      return NextResponse.json({ error: `Resend Fehler: ${(err as { message?: string }).message || resendRes.status}` }, { status: 500 });
    }

    db.prepare("UPDATE proposals SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(pid);

    return NextResponse.json({ success: true, sent_to: lead.email });
  } catch (error) {
    console.error('Proposal send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
