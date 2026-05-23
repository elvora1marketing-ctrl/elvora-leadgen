import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export interface EmailPayload {
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
  is_followup?: boolean;
  followup_step?: number;
  // KI-Personalisierung (Phase 5)
  personalized_subject?: string;
  personalized_intro?: string;
  personalized_pitch?: string;
}

function getEmailSettings() {
  const db = getDb();
  const keys = ['resend_api_key', 'email_from_name', 'email_from_email', 'calendly_url', 'tpl_subject', 'tpl_intro', 'tpl_pitch', 'tpl_leistungen', 'tpl_cta'];
  const settings: Record<string, string> = {};

  for (const key of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) settings[key] = row.value;
  }

  return settings;
}

interface TemplateVars {
  tpl_subject: string;
  tpl_intro: string;
  tpl_pitch: string;
  tpl_leistungen: string;
  tpl_cta: string;
}

const DEFAULTS: TemplateVars = {
  tpl_subject: 'Website-Analyse für {firmenname} – {score}/100 Punkte',
  tpl_intro: 'mein Name ist {absender} von Elvora. Wir helfen Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.',
  tpl_pitch: 'Ich habe mir Ihre Website {website} angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:',
  tpl_leistungen: 'Moderne, mobiloptimierte Website\nGoogle-Optimierung für {stadt}\nSSL-Zertifikat & Sicherheits-Setup\nGoogle Business Profil optimieren\nAutomatische Kundenanfragen generieren',
  tpl_cta: 'Lassen Sie uns kurz sprechen – 15 Minuten, die sich lohnen.',
};

function replacePlaceholders(text: string, data: EmailPayload, fromName: string): string {
  return text
    .replace(/\{firmenname\}/g, data.lead_name)
    .replace(/\{ansprechpartner\}/g, data.ansprechpartner)
    .replace(/\{website\}/g, data.website)
    .replace(/\{stadt\}/g, data.city)
    .replace(/\{score\}/g, String(data.score))
    .replace(/\{absender\}/g, fromName);
}

function buildEmailHtml(data: EmailPayload, calendlyUrl: string, fromName: string, tpl: TemplateVars): string {
  const topProblems = data.problems.slice(0, 3);
  const topSeo = data.seo_issues.slice(0, 2);
  const auditLink = data.audit_url ? `${data.audit_url}` : null;

  const intro = replacePlaceholders(tpl.tpl_intro, data, fromName);
  const pitch = replacePlaceholders(tpl.tpl_pitch, data, fromName);
  const leistungen = replacePlaceholders(tpl.tpl_leistungen, data, fromName).split('\n').filter(l => l.trim());
  const cta = replacePlaceholders(tpl.tpl_cta, data, fromName);

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
        ${intro}
      </p>

      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
        ${pitch}
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
          ${leistungen.map((l, i) => `<div${i < leistungen.length - 1 ? ' style="margin-bottom:6px;"' : ''}>&#10003; ${l}</div>`).join('\n          ')}
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
          ${cta}
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

function buildPlainText(data: EmailPayload, calendlyUrl: string, fromName: string, tpl: TemplateVars): string {
  const problems = data.problems.slice(0, 3).map(p => `- ${p.label}`).join('\n');
  const seo = data.seo_issues.slice(0, 2).map(s => `- ${s.label}`).join('\n');

  const intro = replacePlaceholders(tpl.tpl_intro, data, fromName);
  const pitch = replacePlaceholders(tpl.tpl_pitch, data, fromName);
  const leistungen = replacePlaceholders(tpl.tpl_leistungen, data, fromName).split('\n').filter(l => l.trim()).map(l => `- ${l}`).join('\n');
  const cta = replacePlaceholders(tpl.tpl_cta, data, fromName);

  return `Guten Tag ${data.ansprechpartner},

${intro}

${pitch}

Website-Score: ${data.score}/100

GEFUNDENE PROBLEME:
${problems}

${seo ? `SEO-PROBLEME:\n${seo}\n` : ''}
WAS WIR FÜR SIE TUN KÖNNEN:
${leistungen}

${data.audit_url ? `Ihren vollständigen Website-Audit finden Sie hier: ${data.audit_url}\n` : ''}
${cta}
${calendlyUrl ? `Termin vereinbaren: ${calendlyUrl}` : 'Antworten Sie einfach auf diese E-Mail – ich melde mich innerhalb von 24 Stunden.'}

Mit freundlichen Grüßen,
${fromName}
Elvora – Digitale Lösungen für Handwerksbetriebe`;
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

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

    const fromName = settings.email_from_name || 'Luan von Elvora';
    const fromEmail = settings.email_from_email || 'luan@elvora.me';
    const calendlyUrl = settings.calendly_url || '';

    const tpl: TemplateVars = {
      tpl_subject: settings.tpl_subject || DEFAULTS.tpl_subject,
      tpl_intro: settings.tpl_intro || DEFAULTS.tpl_intro,
      tpl_pitch: settings.tpl_pitch || DEFAULTS.tpl_pitch,
      tpl_leistungen: settings.tpl_leistungen || DEFAULTS.tpl_leistungen,
      tpl_cta: settings.tpl_cta || DEFAULTS.tpl_cta,
    };

    // Use AI-personalized content if provided, otherwise use template
    if (body.personalized_intro) {
      tpl.tpl_intro = body.personalized_intro;
    }
    if (body.personalized_pitch) {
      tpl.tpl_pitch = body.personalized_pitch;
    }

    const subject = body.personalized_subject || replacePlaceholders(tpl.tpl_subject, body, fromName);
    const html = buildEmailHtml(body, calendlyUrl, fromName, tpl);
    const text = buildPlainText(body, calendlyUrl, fromName, tpl);

    // Create tracking pixel if lead_id exists
    let trackingId: string | null = null;
    if (body.lead_id) {
      trackingId = crypto.randomUUID();
      const db = getDb();
      db.prepare(
        'INSERT INTO email_tracking (lead_id, tracking_id) VALUES (?, ?)'
      ).run(body.lead_id, trackingId);
    }

    // Inject tracking pixel into HTML
    const trackingPixel = trackingId
      ? `<img src="${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;" alt="" />`
      : '';
    const htmlWithTracking = html.replace('</body>', `${trackingPixel}</body>`);

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
        html: htmlWithTracking,
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

    const db = getDb();

    // Update contact_status in DB if lead exists
    if (body.lead_id) {
      db.prepare(
        "UPDATE leads SET contact_status = 'email_sent', contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
      ).run(body.lead_id);

      // Schedule follow-up emails based on configurable sequence - only for initial email
      if (!body.is_followup) {
        const fuEnabledRow = db.prepare("SELECT value FROM settings WHERE key = 'followup_enabled'").get() as { value: string } | undefined;
        const fuEnabled = fuEnabledRow?.value !== 'false';

        if (fuEnabled) {
          const seqRow = db.prepare("SELECT value FROM settings WHERE key = 'followup_sequence'").get() as { value: string } | undefined;
          let sequence: { step: number; days: number }[] = [{ step: 1, days: 3 }, { step: 2, days: 7 }, { step: 3, days: 14 }];
          if (seqRow) {
            try { sequence = JSON.parse(seqRow.value); } catch { /* use defaults */ }
          }

          // Cancel any existing pending follow-ups for this lead
          db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'").run(body.lead_id);

          const insertFollowUp = db.prepare(
            "INSERT INTO follow_ups (lead_id, step, scheduled_at) VALUES (?, ?, datetime('now', ? || ' days'))"
          );
          for (const s of sequence) {
            insertFollowUp.run(body.lead_id, s.step, String(s.days));
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `E-Mail an ${body.lead_email} gesendet` });
  } catch (error: unknown) {
    console.error('Email send error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: `E-Mail konnte nicht gesendet werden: ${message}` }, { status: 500 });
  }
}
