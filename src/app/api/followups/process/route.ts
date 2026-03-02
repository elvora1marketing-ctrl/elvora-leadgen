import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';

interface FollowUpSequenceStep {
  step: number;
  days: number;
  subject: string;
  body: string;
}

const DEFAULT_SEQUENCE: FollowUpSequenceStep[] = [
  {
    step: 1,
    days: 3,
    subject: 'Kurze Nachfrage: Website-Analyse für {firmenname}',
    body: 'ich hatte Ihnen vor ein paar Tagen eine Analyse Ihrer Website {website} geschickt. Haben Sie die Mail gesehen?\n\nKurz zusammengefasst: Ihr Website-Score liegt bei {score}/100 – da gibt es ein paar Sachen, die Sie vermutlich Kunden kosten.\n\nFalls Sie Interesse haben, können wir gerne kurz telefonieren. 15 Minuten reichen völlig.',
  },
  {
    step: 2,
    days: 7,
    subject: 'Noch aktuell? Ihre Website-Probleme, {ansprechpartner}',
    body: 'ich melde mich nochmal kurz wegen Ihrer Website. Die Probleme, die wir gefunden haben, sind leider nicht von alleine weggegangen.\n\nAndere Betriebe in {stadt} investieren gerade in ihre Online-Präsenz – das heißt, je länger Sie warten, desto weiter fallen Sie zurück.\n\nSollen wir mal 15 Minuten telefonieren? Ich zeige Ihnen, was wir konkret für {firmenname} tun können.',
  },
  {
    step: 3,
    days: 14,
    subject: 'Letzter Hinweis: {score} Punkte für {firmenname}',
    body: 'letzte Nachricht von mir zu diesem Thema – ich möchte nicht nerven.\n\nIhre Website hat nach wie vor einen Score von {score}/100. Falls Sie in den nächsten Wochen etwas daran ändern möchten, melden Sie sich gerne.\n\nIch wünsche Ihnen alles Gute!',
  },
];

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{firmenname\}/g, vars.firmenname || '')
    .replace(/\{ansprechpartner\}/g, vars.ansprechpartner || '')
    .replace(/\{website\}/g, vars.website || '')
    .replace(/\{stadt\}/g, vars.stadt || '')
    .replace(/\{score\}/g, vars.score || '')
    .replace(/\{absender\}/g, vars.absender || '');
}

function buildFollowUpHtml(
  greeting: string,
  bodyText: string,
  fromName: string,
  calendlyUrl: string,
  stepNumber: number,
  totalSteps: number,
): string {
  const paragraphs = bodyText.split('\n\n').map(p =>
    `<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px 0;">${p.replace(/\n/g, '<br>')}</p>`
  ).join('\n');

  const isLastStep = stepNumber >= totalSteps;

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
        ${greeting}
      </p>

      ${paragraphs}

      ${!isLastStep && calendlyUrl ? `
      <!-- CTA -->
      <div style="text-align:center;padding-top:16px;">
        <a href="${calendlyUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Termin vereinbaren &rarr;
        </a>
        <p style="color:#64748b;font-size:12px;margin:12px 0 0 0;">Kostenlos &amp; unverbindlich &middot; 15 Minuten</p>
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#64748b;font-size:12px;margin:0 0 4px 0;">
        ${fromName} &middot; Elvora &middot; Digitale Lösungen für Handwerksbetriebe
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Check if follow-ups are enabled
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'followup_enabled'").get() as { value: string } | undefined;
    if (enabledRow?.value === 'false') {
      return NextResponse.json({ success: true, message: 'Follow-Ups sind deaktiviert', processed: 0, sent: 0, errors: 0 });
    }

    // Get follow-up sequence configuration
    const seqRow = db.prepare("SELECT value FROM settings WHERE key = 'followup_sequence'").get() as { value: string } | undefined;
    let sequence: FollowUpSequenceStep[] = DEFAULT_SEQUENCE;
    if (seqRow) {
      try { sequence = JSON.parse(seqRow.value); } catch { /* use defaults */ }
    }

    // Get email settings
    const settingKeys = ['resend_api_key', 'email_from_name', 'email_from_email', 'calendly_url'];
    const settings: Record<string, string> = {};
    for (const key of settingKeys) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row) settings[key] = row.value;
    }

    if (!settings.resend_api_key) {
      return NextResponse.json({ error: 'Resend nicht konfiguriert' }, { status: 422 });
    }

    const fromName = settings.email_from_name || 'Luan von Elvora';
    const fromEmail = settings.email_from_email || 'luan@elvora.me';
    const calendlyUrl = settings.calendly_url || '';

    // Get due follow-ups (scheduled_at <= now AND status = pending)
    const dueFollowUps = db.prepare(`
      SELECT f.id, f.lead_id, f.step,
             l.name, l.email, l.website_original, l.city, l.score,
             l.contact_status
      FROM follow_ups f
      JOIN leads l ON f.lead_id = l.id
      WHERE f.status = 'pending'
        AND f.scheduled_at <= datetime('now')
        AND l.status != 'rejected'
      ORDER BY f.scheduled_at ASC
      LIMIT 50
    `).all() as Array<{
      id: number;
      lead_id: number;
      step: number;
      name: string;
      email: string;
      website_original: string;
      city: string;
      score: number;
      contact_status: string;
    }>;

    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const details: Array<{ lead: string; step: number; status: string }> = [];

    for (const fu of dueFollowUps) {
      // Skip if no email
      if (!fu.email) {
        db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE id = ?").run(fu.id);
        skipped++;
        details.push({ lead: fu.name, step: fu.step, status: 'no_email' });
        continue;
      }

      // Auto-stop: if lead moved beyond 'email_sent' → cancel all pending follow-ups
      if (fu.contact_status !== 'email_sent' && fu.contact_status !== 'not_contacted') {
        db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'").run(fu.lead_id);
        skipped++;
        details.push({ lead: fu.name, step: fu.step, status: 'lead_advanced' });

        // Log activity
        db.prepare(
          "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
        ).run(fu.lead_id, `Follow-Up Sequenz gestoppt (Lead ist jetzt: ${fu.contact_status})`, JSON.stringify({ auto: true }));
        continue;
      }

      // Find the matching sequence step template
      const stepTemplate = sequence.find(s => s.step === fu.step) || sequence[Math.min(fu.step - 1, sequence.length - 1)];
      if (!stepTemplate) {
        db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE id = ?").run(fu.id);
        skipped++;
        continue;
      }

      const vars: Record<string, string> = {
        firmenname: fu.name,
        ansprechpartner: fu.name.split(' ')[0] || 'Herr/Frau Geschäftsführer',
        website: fu.website_original || fu.name,
        stadt: fu.city,
        score: String(fu.score),
        absender: fromName,
      };

      const subject = replacePlaceholders(stepTemplate.subject, vars);
      const bodyText = replacePlaceholders(stepTemplate.body, vars);
      const greeting = `Guten Tag ${vars.ansprechpartner},`;

      // Build HTML email
      const html = buildFollowUpHtml(greeting, bodyText, fromName, calendlyUrl, fu.step, sequence.length);

      // Plain text fallback
      const plainText = `${greeting}\n\n${bodyText}\n\n${calendlyUrl ? `Termin vereinbaren: ${calendlyUrl}\n\n` : ''}Mit freundlichen Grüßen,\n${fromName}\nElvora`;

      // Create tracking pixel
      const trackingId = crypto.randomUUID();
      db.prepare('INSERT INTO email_tracking (lead_id, tracking_id) VALUES (?, ?)').run(fu.lead_id, trackingId);
      const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;" alt="" />`;
      const htmlWithTracking = html.replace('</body>', `${trackingPixel}</body>`);

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [fu.email],
            subject,
            html: htmlWithTracking,
            text: plainText,
          }),
        });

        if (res.ok) {
          db.prepare("UPDATE follow_ups SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(fu.id);

          // Log activity
          db.prepare(
            "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
          ).run(
            fu.lead_id,
            `Follow-Up ${fu.step}/${sequence.length} automatisch gesendet`,
            JSON.stringify({ auto: true, step: fu.step, tracking_id: trackingId })
          );

          sent++;
          details.push({ lead: fu.name, step: fu.step, status: 'sent' });
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error(`Follow-up send error for ${fu.name}:`, errData);
          errors++;
          details.push({ lead: fu.name, step: fu.step, status: 'send_error' });
        }
      } catch (err) {
        console.error(`Follow-up network error for ${fu.name}:`, err);
        errors++;
        details.push({ lead: fu.name, step: fu.step, status: 'network_error' });
      }

      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      processed: dueFollowUps.length,
      sent,
      skipped,
      errors,
      details,
    });
  } catch (error: unknown) {
    console.error('Follow-up processing error:', error);
    return NextResponse.json({ error: 'Fehler beim Verarbeiten' }, { status: 500 });
  }
}

/**
 * GET /api/followups/process - Get follow-up statistics
 */
export async function GET() {
  try {
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM follow_ups
    `).get() as { total: number; pending: number; sent: number; cancelled: number };

    const upcoming = db.prepare(`
      SELECT f.id, f.step, f.scheduled_at, l.name, l.email, l.city
      FROM follow_ups f
      JOIN leads l ON f.lead_id = l.id
      WHERE f.status = 'pending'
      ORDER BY f.scheduled_at ASC
      LIMIT 20
    `).all();

    const recentlySent = db.prepare(`
      SELECT f.id, f.step, f.sent_at, l.name, l.email, l.city
      FROM follow_ups f
      JOIN leads l ON f.lead_id = l.id
      WHERE f.status = 'sent'
      ORDER BY f.sent_at DESC
      LIMIT 10
    `).all();

    // Check if follow-ups are enabled
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'followup_enabled'").get() as { value: string } | undefined;

    return NextResponse.json({
      enabled: enabledRow?.value !== 'false',
      stats,
      upcoming,
      recentlySent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
