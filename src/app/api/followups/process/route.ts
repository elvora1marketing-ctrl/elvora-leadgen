import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

const FOLLOWUP_SUBJECTS = [
  'Kurze Nachfrage: Website-Analyse für {firmenname}',
  'Noch aktuell? Ihre Website-Probleme, {ansprechpartner}',
  'Letzter Hinweis: {score} Punkte für {firmenname}',
];

const FOLLOWUP_TEXTS = [
  // Step 1 (3 days)
  `Guten Tag {ansprechpartner},

ich hatte Ihnen vor ein paar Tagen eine Analyse Ihrer Website {website} geschickt. Haben Sie die Mail gesehen?

Kurz zusammengefasst: Ihr Website-Score liegt bei {score}/100 – da gibt es ein paar Sachen, die Sie vermutlich Kunden kosten.

Falls Sie Interesse haben, können wir gerne kurz telefonieren. 15 Minuten reichen völlig.

Beste Grüße,
{absender}
Elvora`,

  // Step 2 (7 days)
  `Guten Tag {ansprechpartner},

ich melde mich nochmal kurz wegen Ihrer Website. Die Probleme, die wir gefunden haben, sind leider nicht von alleine weggegangen 😉

Andere Betriebe in {stadt} investieren gerade in ihre Online-Präsenz – das heißt, je länger Sie warten, desto weiter fallen Sie zurück.

Sollen wir mal 15 Minuten telefonieren? Ich zeige Ihnen, was wir konkret für {firmenname} tun können.

Beste Grüße,
{absender}
Elvora`,

  // Step 3 (14 days)
  `Guten Tag {ansprechpartner},

letzte Nachricht von mir zu diesem Thema – ich möchte nicht nerven.

Ihre Website hat nach wie vor einen Score von {score}/100. Falls Sie in den nächsten Wochen etwas daran ändern möchten, melden Sie sich gerne.

Ich wünsche Ihnen alles Gute!

{absender}
Elvora`,
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

export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get email settings
    const settingKeys = ['resend_api_key', 'email_from_name', 'email_from_email'];
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

    // Get due follow-ups (scheduled_at <= now AND status = pending)
    const dueFollowUps = db.prepare(`
      SELECT f.id, f.lead_id, f.step, l.name, l.email, l.city, l.score, l.problems, l.seo_issues,
             COALESCE(json_extract(l.problems, '$[0].label'), '') as ansprechpartner_raw
      FROM follow_ups f
      JOIN leads l ON f.lead_id = l.id
      WHERE f.status = 'pending'
        AND f.scheduled_at <= datetime('now')
        AND l.contact_status = 'email_sent'
      ORDER BY f.scheduled_at ASC
      LIMIT 50
    `).all() as Array<{
      id: number;
      lead_id: number;
      step: number;
      name: string;
      email: string;
      city: string;
      score: number;
      problems: string;
      seo_issues: string;
    }>;

    let sent = 0;
    let errors = 0;

    for (const fu of dueFollowUps) {
      if (!fu.email) {
        db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE id = ?").run(fu.id);
        continue;
      }

      // Check if lead already replied/advanced (contact_status changed)
      const lead = db.prepare('SELECT contact_status FROM leads WHERE id = ?').get(fu.lead_id) as { contact_status: string } | undefined;
      if (lead && lead.contact_status !== 'email_sent') {
        // Lead moved forward - cancel remaining follow-ups
        db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'").run(fu.lead_id);
        continue;
      }

      const stepIndex = Math.min(fu.step - 1, FOLLOWUP_TEXTS.length - 1);
      const vars = {
        firmenname: fu.name,
        ansprechpartner: 'Herr/Frau Geschäftsführer',
        website: fu.name,
        stadt: fu.city,
        score: String(fu.score),
        absender: fromName,
      };

      const subject = replacePlaceholders(FOLLOWUP_SUBJECTS[stepIndex], vars);
      const text = replacePlaceholders(FOLLOWUP_TEXTS[stepIndex], vars);

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
            text,
          }),
        });

        if (res.ok) {
          db.prepare("UPDATE follow_ups SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(fu.id);
          sent++;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: dueFollowUps.length,
      sent,
      errors,
    });
  } catch (error: unknown) {
    console.error('Follow-up processing error:', error);
    return NextResponse.json({ error: 'Fehler beim Verarbeiten' }, { status: 500 });
  }
}
