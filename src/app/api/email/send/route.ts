import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface EmailPayload {
  lead_id?: number;
  lead_name: string;
  lead_email: string;
  ansprechpartner: string;
  website: string;
  city: string;
  score: number;
  problems: { label: string; severity: string }[];
  seo_issues: { label: string; impact: string }[];
  audit_url?: string;
}

function getEmailSettings() {
  const db = getDb();
  const keys = ['resend_api_key', 'email_from_name', 'email_from_email', 'calendly_url'];
  const settings: Record<string, string> = {};

  for (const key of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) settings[key] = row.value;
  }

  return settings;
}

function buildEmailHtml(data: EmailPayload, calendlyUrl: string, fromName: string): string {
  const topProblems = data.problems.slice(0, 3);
  const topSeo = data.seo_issues.slice(0, 2);
  const auditLink = data.audit_url ? `${data.audit_url}` : null;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:800;background:linear-gradient(135deg,#8B5CF6,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
        ELVORA
      </div>
    </div>

    <!-- Main Card -->
    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:32px;margin-bottom:24px;">

      <p style="color:#e2e8f0;font-size:16px;line-height:1.6;margin:0 0 16px 0;">
        Guten Tag ${data.ansprechpartner},
      </p>

      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
        mein Name ist ${fromName} von <strong style="color:#8B5CF6;">Elvora</strong>. Wir helfen SHK-Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.
      </p>

      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
        Ich habe mir Ihre Website <strong style="color:#e2e8f0;">${data.website}</strong> angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:
      </p>

      <!-- Score Badge -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${data.score >= 85 ? 'linear-gradient(135deg,#ef4444,#f97316)' : data.score >= 70 ? 'linear-gradient(135deg,#f97316,#eab308)' : 'linear-gradient(135deg,#64748b,#94a3b8)'};border-radius:12px;padding:12px 24px;">
          <span style="color:#fff;font-size:13px;font-weight:600;">Website-Score: </span>
          <span style="color:#fff;font-size:24px;font-weight:800;">${data.score}/100</span>
        </div>
      </div>

      <!-- Problems -->
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="color:#ef4444;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          Gefundene Probleme
        </div>
        ${topProblems.map(p => `
        <div style="display:flex;align-items:center;margin-bottom:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${p.severity === 'critical' ? '#ef4444' : p.severity === 'major' ? '#f97316' : '#64748b'};margin-right:10px;flex-shrink:0;"></div>
          <span style="color:#e2e8f0;font-size:14px;">${p.label}</span>
        </div>`).join('')}
      </div>

      <!-- SEO Issues -->
      ${topSeo.length > 0 ? `
      <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="color:#f97316;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          SEO-Probleme
        </div>
        ${topSeo.map(s => `
        <div style="display:flex;align-items:center;margin-bottom:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${s.impact === 'high' ? '#ef4444' : '#f97316'};margin-right:10px;flex-shrink:0;"></div>
          <span style="color:#e2e8f0;font-size:14px;">${s.label}</span>
        </div>`).join('')}
      </div>` : ''}

      <!-- What we offer -->
      <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          Was wir f&uuml;r Sie tun k&ouml;nnen
        </div>
        <div style="color:#94a3b8;font-size:14px;line-height:1.7;">
          <div style="margin-bottom:6px;">&#10003; Moderne, mobiloptimierte Website</div>
          <div style="margin-bottom:6px;">&#10003; Google-Optimierung f&uuml;r ${data.city}</div>
          <div style="margin-bottom:6px;">&#10003; SSL-Zertifikat &amp; Sicherheits-Setup</div>
          <div style="margin-bottom:6px;">&#10003; Google Business Profil optimieren</div>
          <div>&#10003; Automatische Kundenanfragen generieren</div>
        </div>
      </div>

      ${auditLink ? `
      <!-- Audit Link -->
      <div style="text-align:center;margin-bottom:24px;">
        <p style="color:#94a3b8;font-size:14px;margin:0 0 12px 0;">
          Ihren vollst&auml;ndigen Website-Audit finden Sie hier:
        </p>
        <a href="${auditLink}" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#EC4899);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Kostenlosen Audit ansehen &rarr;
        </a>
      </div>` : ''}

      <!-- CTA -->
      <div style="text-align:center;padding-top:8px;">
        <p style="color:#e2e8f0;font-size:15px;font-weight:600;margin:0 0 12px 0;">
          Lassen Sie uns kurz sprechen &ndash; 15 Minuten, die sich lohnen.
        </p>
        ${calendlyUrl ? `
        <a href="${calendlyUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Termin vereinbaren &rarr;
        </a>
        <p style="color:#64748b;font-size:12px;margin:12px 0 0 0;">Kostenlos &amp; unverbindlich</p>
        ` : `
        <p style="color:#94a3b8;font-size:14px;margin:0;">
          Antworten Sie einfach auf diese E-Mail oder rufen Sie mich an &ndash; ich melde mich innerhalb von 24 Stunden.
        </p>
        `}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#64748b;font-size:12px;margin:0 0 4px 0;">
        ${fromName} &middot; Elvora &middot; Digitale L&ouml;sungen f&uuml;r Handwerksbetriebe
      </p>
      <p style="color:#475569;font-size:11px;margin:0;">
        Diese E-Mail wurde gesendet, weil wir Verbesserungspotenzial auf Ihrer Website gefunden haben.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildPlainText(data: EmailPayload, calendlyUrl: string, fromName: string): string {
  const problems = data.problems.slice(0, 3).map(p => `- ${p.label}`).join('\n');
  const seo = data.seo_issues.slice(0, 2).map(s => `- ${s.label}`).join('\n');

  return `Guten Tag ${data.ansprechpartner},

mein Name ist ${fromName} von Elvora. Wir helfen SHK-Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.

Ich habe mir Ihre Website ${data.website} angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:

Website-Score: ${data.score}/100

GEFUNDENE PROBLEME:
${problems}

${seo ? `SEO-PROBLEME:\n${seo}\n` : ''}
WAS WIR FÜR SIE TUN KÖNNEN:
- Moderne, mobiloptimierte Website
- Google-Optimierung für ${data.city}
- SSL-Zertifikat & Sicherheits-Setup
- Google Business Profil optimieren
- Automatische Kundenanfragen generieren

${data.audit_url ? `Ihren vollständigen Website-Audit finden Sie hier: ${data.audit_url}\n` : ''}
Lassen Sie uns kurz sprechen – 15 Minuten, die sich lohnen.
${calendlyUrl ? `Termin vereinbaren: ${calendlyUrl}` : 'Antworten Sie einfach auf diese E-Mail – ich melde mich innerhalb von 24 Stunden.'}

Mit freundlichen Grüßen,
${fromName}
Elvora – Digitale Lösungen für Handwerksbetriebe`;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailPayload = await request.json();

    if (!body.lead_email) {
      return NextResponse.json({ error: 'E-Mail-Adresse fehlt bei diesem Lead' }, { status: 400 });
    }

    if (!body.lead_name || !body.ansprechpartner) {
      return NextResponse.json({ error: 'Lead-Daten unvollständig' }, { status: 400 });
    }

    const settings = getEmailSettings();

    if (!settings.resend_api_key) {
      return NextResponse.json(
        { error: 'Resend API-Key nicht konfiguriert. Bitte unter Einstellungen hinterlegen.' },
        { status: 422 }
      );
    }

    const fromName = settings.email_from_name || 'Elvora';
    const fromEmail = settings.email_from_email || 'onboarding@resend.dev';
    const calendlyUrl = settings.calendly_url || '';

    const subject = `Website-Analyse für ${body.lead_name} – ${body.score}/100 Punkte`;
    const html = buildEmailHtml(body, calendlyUrl, fromName);
    const text = buildPlainText(body, calendlyUrl, fromName);

    // Send via Resend REST API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [body.lead_email],
        subject,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({}));
      const errorMsg = (errorData as { message?: string }).message || `HTTP ${resendResponse.status}`;
      return NextResponse.json(
        { error: `Resend Fehler: ${errorMsg}` },
        { status: 500 }
      );
    }

    // Update contact_status in DB if lead exists
    if (body.lead_id) {
      const db = getDb();
      db.prepare(
        "UPDATE leads SET contact_status = 'email_sent', contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
      ).run(body.lead_id);
    }

    return NextResponse.json({ success: true, message: `E-Mail an ${body.lead_email} gesendet` });
  } catch (error: unknown) {
    console.error('Email send error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: `E-Mail konnte nicht gesendet werden: ${message}` }, { status: 500 });
  }
}
