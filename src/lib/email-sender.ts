import crypto from 'crypto';
import getDb from './db';

export interface SendResult {
  success: boolean;
  recipient: string | null;
  recipientType: 'entscheider' | 'main' | 'fallback' | null;
  error?: string;
  trackingId?: string;
}

export interface SendOptions {
  leadId: number;
  preferEntscheider?: boolean;
  usePersonalization?: boolean;
  baseUrl?: string;
  isFollowup?: boolean;
}

interface LeadRow {
  id: number;
  name: string;
  email: string | null;
  entscheider_email: string | null;
  entscheider_name: string | null;
  all_emails: string | null;
  website_original: string | null;
  city: string;
  score: number;
  problems: string | null;
  seo_issues: string | null;
  contact_status: string;
}

interface SettingsBundle {
  resend_api_key: string;
  email_from_name: string;
  email_from_email: string;
  calendly_url: string;
  tpl_subject: string;
  tpl_intro: string;
  tpl_pitch: string;
  tpl_leistungen: string;
  tpl_cta: string;
  ai_personalization_enabled: string;
  followup_enabled: string;
}

const DEFAULTS = {
  tpl_subject: 'Website-Analyse für {firmenname} – {score}/100 Punkte',
  tpl_intro: 'mein Name ist {absender} von Elvora. Wir helfen Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.',
  tpl_pitch: 'Ich habe mir Ihre Website {website} angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:',
  tpl_leistungen: 'Moderne, mobiloptimierte Website\nGoogle-Optimierung für {stadt}\nSSL-Zertifikat & Sicherheits-Setup\nGoogle Business Profil optimieren\nAutomatische Kundenanfragen generieren',
  tpl_cta: 'Lassen Sie uns kurz sprechen – 15 Minuten, die sich lohnen.',
};

function loadSettings(): SettingsBundle {
  const db = getDb();
  const keys = [
    'resend_api_key', 'email_from_name', 'email_from_email', 'calendly_url',
    'tpl_subject', 'tpl_intro', 'tpl_pitch', 'tpl_leistungen', 'tpl_cta',
    'ai_personalization_enabled', 'followup_enabled',
  ];
  const out = {} as Record<string, string>;
  for (const k of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined;
    out[k] = row?.value || '';
  }
  return out as unknown as SettingsBundle;
}

function pickRecipient(lead: LeadRow, preferEntscheider: boolean): { email: string | null; type: 'entscheider' | 'main' | 'fallback' | null } {
  if (preferEntscheider && lead.entscheider_email) return { email: lead.entscheider_email, type: 'entscheider' };
  if (lead.email && lead.email.trim()) return { email: lead.email, type: 'main' };
  if (lead.entscheider_email) return { email: lead.entscheider_email, type: 'entscheider' };
  if (lead.all_emails) {
    try {
      const arr = JSON.parse(lead.all_emails) as string[];
      if (arr.length > 0) return { email: arr[0], type: 'fallback' };
    } catch { /* ignore */ }
  }
  return { email: null, type: null };
}

function buildAnsprechpartner(lead: LeadRow): string {
  if (lead.entscheider_name && lead.entscheider_name.trim()) {
    const parts = lead.entscheider_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      return `Herr/Frau ${last}`;
    }
    return lead.entscheider_name;
  }
  return 'Herr/Frau Geschäftsführer';
}

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{firmenname\}/g, vars.firmenname || '')
    .replace(/\{ansprechpartner\}/g, vars.ansprechpartner || '')
    .replace(/\{website\}/g, vars.website || '')
    .replace(/\{stadt\}/g, vars.stadt || '')
    .replace(/\{score\}/g, vars.score || '0')
    .replace(/\{absender\}/g, vars.absender || '');
}

function buildEmailHtml(
  data: { lead_name: string; ansprechpartner: string; website: string; city: string; score: number; problems: { label: string; severity: string }[]; seo_issues: { label: string; impact: string }[]; audit_url?: string | null },
  calendlyUrl: string,
  fromName: string,
  tpl: { tpl_intro: string; tpl_pitch: string; tpl_leistungen: string; tpl_cta: string },
  unsubscribeUrl: string | null,
): string {
  const vars = {
    firmenname: data.lead_name,
    ansprechpartner: data.ansprechpartner,
    website: data.website,
    stadt: data.city,
    score: String(data.score),
    absender: fromName,
  };
  const intro = replacePlaceholders(tpl.tpl_intro, vars);
  const pitch = replacePlaceholders(tpl.tpl_pitch, vars);
  const leistungen = replacePlaceholders(tpl.tpl_leistungen, vars).split('\n').filter(l => l.trim());
  const cta = replacePlaceholders(tpl.tpl_cta, vars);
  const topProblems = data.problems.slice(0, 3);
  const topSeo = data.seo_issues.slice(0, 2);
  const auditLink = data.audit_url || null;

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:800;background:linear-gradient(135deg,#8B5CF6,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">ELVORA</div>
    </div>
    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:32px;margin-bottom:24px;">
      <p style="color:#e2e8f0;font-size:16px;line-height:1.6;margin:0 0 16px 0;">Guten Tag ${data.ansprechpartner},</p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px 0;">${intro}</p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">${pitch}</p>
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${data.score >= 85 ? 'linear-gradient(135deg,#ef4444,#f97316)' : data.score >= 70 ? 'linear-gradient(135deg,#f97316,#eab308)' : 'linear-gradient(135deg,#64748b,#94a3b8)'};border-radius:12px;padding:12px 24px;">
          <span style="color:#fff;font-size:13px;font-weight:600;">Website-Score: </span><span style="color:#fff;font-size:24px;font-weight:800;">${data.score}/100</span>
        </div>
      </div>
      ${topProblems.length > 0 ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="color:#ef4444;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Gefundene Probleme</div>
        ${topProblems.map(p => `<div style="display:flex;align-items:center;margin-bottom:8px;"><div style="width:8px;height:8px;border-radius:50%;background:${p.severity === 'critical' ? '#ef4444' : p.severity === 'major' ? '#f97316' : '#64748b'};margin-right:10px;flex-shrink:0;"></div><span style="color:#e2e8f0;font-size:14px;">${p.label}</span></div>`).join('')}
      </div>` : ''}
      ${topSeo.length > 0 ? `<div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="color:#f97316;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">SEO-Probleme</div>
        ${topSeo.map(s => `<div style="display:flex;align-items:center;margin-bottom:8px;"><div style="width:8px;height:8px;border-radius:50%;background:${s.impact === 'high' ? '#ef4444' : '#f97316'};margin-right:10px;flex-shrink:0;"></div><span style="color:#e2e8f0;font-size:14px;">${s.label}</span></div>`).join('')}
      </div>` : ''}
      <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Was wir f&uuml;r Sie tun k&ouml;nnen</div>
        <div style="color:#94a3b8;font-size:14px;line-height:1.7;">${leistungen.map((l, i) => `<div${i < leistungen.length - 1 ? ' style="margin-bottom:6px;"' : ''}>&#10003; ${l}</div>`).join('')}</div>
      </div>
      ${auditLink ? `<div style="text-align:center;margin-bottom:24px;">
        <p style="color:#94a3b8;font-size:14px;margin:0 0 12px 0;">Ihren vollst&auml;ndigen Website-Audit finden Sie hier:</p>
        <a href="${auditLink}" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#EC4899);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">Kostenlosen Audit ansehen &rarr;</a>
      </div>` : ''}
      <div style="text-align:center;padding-top:8px;">
        <p style="color:#e2e8f0;font-size:15px;font-weight:600;margin:0 0 12px 0;">${cta}</p>
        ${calendlyUrl ? `<a href="${calendlyUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">Termin vereinbaren &rarr;</a><p style="color:#64748b;font-size:12px;margin:12px 0 0 0;">Kostenlos &amp; unverbindlich</p>` : `<p style="color:#94a3b8;font-size:14px;margin:0;">Antworten Sie einfach auf diese E-Mail oder rufen Sie mich an &ndash; ich melde mich innerhalb von 24 Stunden.</p>`}
      </div>
    </div>
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#64748b;font-size:12px;margin:0 0 4px 0;">${fromName} &middot; Elvora &middot; Digitale L&ouml;sungen f&uuml;r Handwerksbetriebe</p>
      <p style="color:#475569;font-size:11px;margin:0 0 6px 0;">Diese E-Mail wurde gesendet, weil wir Verbesserungspotenzial auf Ihrer Website gefunden haben.</p>
      ${unsubscribeUrl ? `<p style="color:#475569;font-size:11px;margin:0;"><a href="${unsubscribeUrl}" style="color:#64748b;">Keine weiteren E-Mails wünschen</a></p>` : ''}
    </div>
  </div>
</body></html>`;
}

function buildPlainText(
  data: { lead_name: string; ansprechpartner: string; website: string; city: string; score: number; problems: { label: string; severity: string }[]; seo_issues: { label: string; impact: string }[]; audit_url?: string | null },
  calendlyUrl: string,
  fromName: string,
  tpl: { tpl_intro: string; tpl_pitch: string; tpl_leistungen: string; tpl_cta: string },
): string {
  const vars = {
    firmenname: data.lead_name, ansprechpartner: data.ansprechpartner, website: data.website,
    stadt: data.city, score: String(data.score), absender: fromName,
  };
  const intro = replacePlaceholders(tpl.tpl_intro, vars);
  const pitch = replacePlaceholders(tpl.tpl_pitch, vars);
  const leistungen = replacePlaceholders(tpl.tpl_leistungen, vars).split('\n').filter(l => l.trim()).map(l => `- ${l}`).join('\n');
  const cta = replacePlaceholders(tpl.tpl_cta, vars);
  const problems = data.problems.slice(0, 3).map(p => `- ${p.label}`).join('\n');
  const seo = data.seo_issues.slice(0, 2).map(s => `- ${s.label}`).join('\n');

  return `Guten Tag ${data.ansprechpartner},

${intro}

${pitch}

Website-Score: ${data.score}/100

GEFUNDENE PROBLEME:
${problems}

${seo ? `SEO-PROBLEME:\n${seo}\n\n` : ''}WAS WIR FÜR SIE TUN KÖNNEN:
${leistungen}

${data.audit_url ? `Vollständiger Audit: ${data.audit_url}\n\n` : ''}${cta}
${calendlyUrl ? `Termin vereinbaren: ${calendlyUrl}` : ''}

Mit freundlichen Grüßen,
${fromName}
Elvora – Digitale Lösungen für Handwerksbetriebe`;
}

export interface RenderedEmail {
  recipient: string | null;
  recipientType: 'entscheider' | 'main' | 'fallback' | null;
  ansprechpartner: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
  error?: string;
}

export function renderLeadEmail(leadId: number, preferEntscheider: boolean = true): RenderedEmail {
  const db = getDb();
  const lead = db.prepare(`
    SELECT id, name, email, entscheider_email, entscheider_name, all_emails,
           website_original, city, score, problems, seo_issues, contact_status
    FROM leads WHERE id = ?
  `).get(leadId) as LeadRow | undefined;

  if (!lead) {
    return { recipient: null, recipientType: null, ansprechpartner: '', subject: '', html: '', text: '', fromName: '', fromEmail: '', error: 'Lead nicht gefunden' };
  }

  const { email: recipient, type: recipientType } = pickRecipient(lead, preferEntscheider);
  const settings = loadSettings();
  const fromName = settings.email_from_name || 'Luan von Elvora';
  const fromEmail = settings.email_from_email || 'luan@elvora.me';
  const calendlyUrl = settings.calendly_url || '';

  const tpl = {
    tpl_subject: settings.tpl_subject || DEFAULTS.tpl_subject,
    tpl_intro: settings.tpl_intro || DEFAULTS.tpl_intro,
    tpl_pitch: settings.tpl_pitch || DEFAULTS.tpl_pitch,
    tpl_leistungen: settings.tpl_leistungen || DEFAULTS.tpl_leistungen,
    tpl_cta: settings.tpl_cta || DEFAULTS.tpl_cta,
  };

  const ansprechpartner = buildAnsprechpartner(lead);
  const website = lead.website_original || '';
  const problems = lead.problems ? (JSON.parse(lead.problems) as { label: string; severity: string }[]) : [];
  const seoIssues = lead.seo_issues ? (JSON.parse(lead.seo_issues) as { label: string; impact: string }[]) : [];

  const data = { lead_name: lead.name, ansprechpartner, website, city: lead.city, score: lead.score, problems, seo_issues: seoIssues };
  const subject = replacePlaceholders(tpl.tpl_subject, {
    firmenname: lead.name, ansprechpartner, website, stadt: lead.city, score: String(lead.score), absender: fromName,
  });

  return {
    recipient,
    recipientType,
    ansprechpartner,
    subject,
    html: buildEmailHtml(data, calendlyUrl, fromName, tpl, null),
    text: buildPlainText(data, calendlyUrl, fromName, tpl),
    fromName,
    fromEmail,
  };
}

export async function sendLeadEmail(opts: SendOptions): Promise<SendResult> {
  const { leadId, preferEntscheider = true, baseUrl = '', isFollowup = false } = opts;

  const db = getDb();
  const lead = db.prepare(`
    SELECT id, name, email, entscheider_email, entscheider_name, all_emails,
           website_original, city, score, problems, seo_issues, contact_status
    FROM leads WHERE id = ?
  `).get(leadId) as LeadRow | undefined;

  if (!lead) return { success: false, recipient: null, recipientType: null, error: 'Lead nicht gefunden' };

  const { email: recipient, type: recipientType } = pickRecipient(lead, preferEntscheider);
  if (!recipient) return { success: false, recipient: null, recipientType: null, error: 'Keine E-Mail-Adresse vorhanden' };

  const settings = loadSettings();
  if (!settings.resend_api_key) return { success: false, recipient, recipientType, error: 'Resend API-Key nicht konfiguriert' };

  const fromName = settings.email_from_name || 'Luan von Elvora';
  const fromEmail = settings.email_from_email || 'luan@elvora.me';
  const calendlyUrl = settings.calendly_url || '';

  const tpl = {
    tpl_subject: settings.tpl_subject || DEFAULTS.tpl_subject,
    tpl_intro: settings.tpl_intro || DEFAULTS.tpl_intro,
    tpl_pitch: settings.tpl_pitch || DEFAULTS.tpl_pitch,
    tpl_leistungen: settings.tpl_leistungen || DEFAULTS.tpl_leistungen,
    tpl_cta: settings.tpl_cta || DEFAULTS.tpl_cta,
  };

  const ansprechpartner = buildAnsprechpartner(lead);
  const website = lead.website_original || '';
  const problems = lead.problems ? (JSON.parse(lead.problems) as { label: string; severity: string }[]) : [];
  const seoIssues = lead.seo_issues ? (JSON.parse(lead.seo_issues) as { label: string; impact: string }[]) : [];

  const data = { lead_name: lead.name, ansprechpartner, website, city: lead.city, score: lead.score, problems, seo_issues: seoIssues };

  const trackingId = crypto.randomUUID();
  db.prepare('INSERT INTO email_tracking (lead_id, tracking_id) VALUES (?, ?)').run(leadId, trackingId);

  const emailTrackingEnabled = (db.prepare("SELECT value FROM settings WHERE key = 'email_tracking_enabled'").get() as { value: string } | undefined)?.value !== '0';
  const trackingPixel = emailTrackingEnabled
    ? (baseUrl
      ? `<img src="${baseUrl}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;" alt="" />`
      : `<img src="/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;" alt="" />`)
    : '';

  const subject = replacePlaceholders(tpl.tpl_subject, {
    firmenname: lead.name, ansprechpartner, website, stadt: lead.city, score: String(lead.score), absender: fromName,
  });

  const html = buildEmailHtml(data, calendlyUrl, fromName, tpl, null).replace('</body>', `${trackingPixel}</body>`);
  const text = buildPlainText(data, calendlyUrl, fromName, tpl);

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${settings.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [recipient], subject, html, text }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.json().catch(() => ({}));
      const errMsg = (err as { message?: string }).message || `HTTP ${resendResponse.status}`;
      return { success: false, recipient, recipientType, error: `Resend: ${errMsg}`, trackingId };
    }

    // Update contact_status
    db.prepare("UPDATE leads SET contact_status = 'email_sent', contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(leadId);

    // Schedule follow-ups (only for initial sends, not for follow-up sends themselves)
    if (!isFollowup && settings.followup_enabled !== 'false') {
      const seqRow = db.prepare("SELECT value FROM settings WHERE key = 'followup_sequence'").get() as { value: string } | undefined;
      let sequence: { step: number; days: number }[] = [{ step: 1, days: 3 }, { step: 2, days: 7 }, { step: 3, days: 14 }];
      if (seqRow) {
        try { sequence = JSON.parse(seqRow.value); } catch { /* defaults */ }
      }
      db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'").run(leadId);
      const ins = db.prepare("INSERT INTO follow_ups (lead_id, step, scheduled_at) VALUES (?, ?, datetime('now', ? || ' days'))");
      for (const s of sequence) ins.run(leadId, s.step, String(s.days));
    }

    return { success: true, recipient, recipientType, trackingId };
  } catch (err: unknown) {
    return {
      success: false,
      recipient,
      recipientType,
      error: err instanceof Error ? err.message : 'Netzwerkfehler',
      trackingId,
    };
  }
}
