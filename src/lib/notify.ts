import getDb from '@/lib/db';

// ---------------------------------------------------------------------------
// Shared notification helpers (WhatsApp via OpenClaw, E-Mail via Resend).
// Everything here is fire-and-forget safe — functions never throw, so they
// can be awaited inside request handlers without risking the main response.
// ---------------------------------------------------------------------------

function getSetting(key: string): string {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? '';
  } catch {
    return '';
  }
}

/** Normalize a phone number to international WhatsApp format (no +). */
export function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  else if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('0')) p = '49' + p.slice(1);
  return p;
}

/** Send a WhatsApp message via the configured OpenClaw gateway. Returns success. */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const url = getSetting('openclaw_url').replace(/\/$/, '');
    if (!url || !phone || !message) return false;
    const key = getSetting('openclaw_api_key');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const res = await fetch(`${url}/api/whatsapp/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    });
    return res.ok;
  } catch (e) {
    console.error('[notify] WhatsApp send failed:', e);
    return false;
  }
}

/** Send a transactional e-mail via Resend. Returns success. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const apiKey = getSetting('resend_api_key');
    if (!apiKey || !to) return false;
    const fromName = getSetting('email_from_name') || 'Elvora';
    const fromEmail = getSetting('email_from_email') || 'noreply@elvora.me';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('[notify] Email send failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Speed-to-Lead — instantly notify the agency when a new lead comes in.
// ---------------------------------------------------------------------------

export type LeadSource = 'form' | 'chat' | 'booking';

interface NewLeadInput {
  source: LeadSource;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  pageUrl?: string;
  extra?: Record<string, string>;
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  form: 'Kontaktformular',
  chat: 'Live-Chat',
  booking: 'Terminbuchung',
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Notify the agency about a brand-new lead. Respects the Speed-to-Lead
 * settings (enabled, which sources, which channels). Safe to await; never
 * throws and silently no-ops when disabled or unconfigured.
 */
export async function notifyNewLead(input: NewLeadInput): Promise<void> {
  try {
    if (getSetting('speedlead_enabled') !== '1') return;

    // Source filter
    let sources: string[] = ['form', 'chat', 'booking'];
    try {
      const raw = getSetting('speedlead_sources');
      if (raw) sources = JSON.parse(raw);
    } catch {
      /* use default */
    }
    if (!sources.includes(input.source)) return;

    const label = SOURCE_LABELS[input.source];
    const parts: string[] = [];
    if (input.name) parts.push(`Name: ${input.name}`);
    if (input.email) parts.push(`E-Mail: ${input.email}`);
    if (input.phone) parts.push(`Telefon: ${input.phone}`);
    if (input.extra) {
      for (const [k, v] of Object.entries(input.extra)) {
        if (v) parts.push(`${k}: ${v}`);
      }
    }
    if (input.message) parts.push(`Nachricht: ${input.message}`);
    if (input.pageUrl) parts.push(`Seite: ${input.pageUrl}`);

    // WhatsApp
    if (getSetting('speedlead_whatsapp_enabled') === '1') {
      const phone = getSetting('speedlead_phone');
      if (phone) {
        const waMsg =
          `🔔 Neuer Lead (${label})!\n\n` +
          parts.join('\n') +
          `\n\n⚡ Schnell antworten = mehr Abschlüsse.`;
        await sendWhatsApp(phone, waMsg);
      }
    }

    // E-Mail
    if (getSetting('speedlead_email_enabled') === '1') {
      const email = getSetting('speedlead_email');
      if (email) {
        const rows = parts
          .map(
            (p) =>
              `<tr><td style="padding:6px 0;color:#334155;font-size:14px;">${escapeHtml(p)}</td></tr>`
          )
          .join('');
        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#8B5CF6,#EC4899);padding:24px;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;font-size:18px;margin:0;">🔔 Neuer Lead — ${escapeHtml(label)}</h1>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
              <table style="width:100%;border-collapse:collapse;">${rows}</table>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;">⚡ Wer in unter 5 Minuten antwortet, hat eine bis zu 21× höhere Abschlussquote. Jetzt melden!</p>
            </div>
          </div>`;
        await sendEmail(email, `🔔 Neuer Lead (${label})${input.name ? ': ' + input.name : ''}`, html);
      }
    }
  } catch (e) {
    console.error('[notify] notifyNewLead failed:', e);
  }
}
