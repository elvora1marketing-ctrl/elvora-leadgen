import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

type Classification = 'interested' | 'not_interested' | 'question' | 'out_of_office' | 'bounce' | 'unsubscribe' | 'unclear';

interface ClassifyRequest {
  message_id?: number;
  subject: string;
  body: string;
  from_name?: string;
  lead_name?: string;
}

interface ClassifyResponse {
  classification: Classification;
  confidence: number;
  summary: string;
  suggested_action: string;
}

const CLASSIFICATION_LABELS: Record<Classification, { label: string; color: string; action: string }> = {
  interested: { label: 'Interesse', color: 'success', action: 'Lead auf "Meeting" setzen, Follow-Ups stoppen' },
  not_interested: { label: 'Absage', color: 'danger', action: 'Lead auf "Verloren" setzen, Follow-Ups stoppen' },
  question: { label: 'Frage', color: 'warning', action: 'Antwort vorbereiten, Follow-Ups pausieren' },
  out_of_office: { label: 'Abwesenheit', color: 'muted', action: 'Follow-Ups pausieren, später erneut kontaktieren' },
  bounce: { label: 'Bounce/Fehler', color: 'danger', action: 'Email-Adresse prüfen' },
  unsubscribe: { label: 'Abmeldung', color: 'danger', action: 'Kontakt nicht mehr anschreiben' },
  unclear: { label: 'Unklar', color: 'muted', action: 'Manuell prüfen' },
};

function getAiSettings() {
  const db = getDb();
  const keys = ['openai_api_key', 'ai_personalization_enabled', 'ai_model', 'ai_classify_enabled'];
  const settings: Record<string, string> = {};
  for (const key of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) settings[key] = row.value;
  }
  return settings;
}

/**
 * POST /api/ai/classify
 * Classifies an inbound email reply using OpenAI.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body: ClassifyRequest = await request.json();
    const settings = getAiSettings();

    if (!settings.openai_api_key) {
      return NextResponse.json({ error: 'OpenAI API-Key nicht konfiguriert' }, { status: 422 });
    }

    const model = settings.ai_model || 'gpt-4o-mini';

    const systemPrompt = `Du bist ein Email-Klassifizierungs-System für eine Webdesign-Agentur.
Du analysierst eingehende Antworten auf Kaltakquise-Emails und klassifizierst sie.

Klassifikationen:
- "interested": Lead zeigt Interesse, möchte mehr erfahren, fragt nach Termin, Preis, oder Details
- "not_interested": Klare Absage, kein Interesse, bittet darum nicht mehr kontaktiert zu werden
- "question": Lead stellt eine Frage (über Preis, Leistung, Ablauf) ohne klares Ja/Nein
- "out_of_office": Automatische Abwesenheitsnotiz, Urlaubsmeldung
- "bounce": Delivery-Fehler, Adresse existiert nicht, Postfach voll
- "unsubscribe": Bittet ausdrücklich, aus dem Verteiler entfernt zu werden
- "unclear": Kann nicht eindeutig zugeordnet werden

Antworte IMMER mit einem JSON-Objekt:
{
  "classification": "interested|not_interested|question|out_of_office|bounce|unsubscribe|unclear",
  "confidence": 0.0-1.0,
  "summary": "Kurze Zusammenfassung der Antwort in 1 Satz (Deutsch)",
  "suggested_action": "Empfohlene nächste Aktion in 1 Satz (Deutsch)"
}`;

    const userPrompt = `Klassifiziere diese eingehende Email-Antwort:

VON: ${body.from_name || 'Unbekannt'}${body.lead_name ? ` (Firma: ${body.lead_name})` : ''}
BETREFF: ${body.subject}

TEXT:
${body.body.substring(0, 1000)}`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      const errMsg = (errData as { error?: { message?: string } }).error?.message || `HTTP ${openaiRes.status}`;
      return NextResponse.json({ error: `OpenAI Fehler: ${errMsg}` }, { status: 500 });
    }

    const openaiData = await openaiRes.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Keine Antwort von OpenAI' }, { status: 500 });
    }

    let parsed: ClassifyResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'Ungültige KI-Antwort' }, { status: 500 });
    }

    // Validate classification
    const validClassifications: Classification[] = ['interested', 'not_interested', 'question', 'out_of_office', 'bounce', 'unsubscribe', 'unclear'];
    if (!validClassifications.includes(parsed.classification)) {
      parsed.classification = 'unclear';
    }

    const tokens = openaiData.usage?.total_tokens || 0;
    const labelInfo = CLASSIFICATION_LABELS[parsed.classification];

    // Update inbox message with classification if message_id provided
    if (body.message_id) {
      const db = getDb();

      // Store classification in the inbox message metadata
      // We use a dedicated column or update metadata via lead_activities
      const msg = db.prepare('SELECT lead_id FROM inbox_messages WHERE id = ?').get(body.message_id) as { lead_id: number | null } | undefined;

      if (msg?.lead_id) {
        // Log classification as activity
        db.prepare(
          "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'note', ?, ?)"
        ).run(
          msg.lead_id,
          `KI-Klassifizierung: ${labelInfo.label} (${Math.round(parsed.confidence * 100)}%) – ${parsed.summary}`,
          JSON.stringify({
            ai: true,
            classification: parsed.classification,
            confidence: parsed.confidence,
            suggested_action: parsed.suggested_action,
            tokens,
            message_id: body.message_id,
          })
        );

        // Auto-actions based on classification
        if (parsed.confidence >= 0.7) {
          if (parsed.classification === 'interested') {
            db.prepare(
              "UPDATE leads SET contact_status = 'meeting', priority = 'high', updated_at = datetime('now') WHERE id = ? AND contact_status IN ('email_sent', 'called', 'not_contacted')"
            ).run(msg.lead_id);
          } else if (parsed.classification === 'not_interested' || parsed.classification === 'unsubscribe') {
            db.prepare(
              "UPDATE leads SET contact_status = 'lost', updated_at = datetime('now') WHERE id = ? AND contact_status IN ('email_sent', 'called', 'not_contacted')"
            ).run(msg.lead_id);
          }
          // For all types: cancel pending follow-ups (already done in webhook, but ensure)
          db.prepare(
            "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
          ).run(msg.lead_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      classification: parsed.classification,
      label: labelInfo.label,
      color: labelInfo.color,
      confidence: parsed.confidence,
      summary: parsed.summary,
      suggested_action: parsed.suggested_action,
      default_action: labelInfo.action,
      tokens,
    });
  } catch (error: unknown) {
    console.error('AI classify error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: `KI-Fehler: ${message}` }, { status: 500 });
  }
}

/**
 * GET /api/ai/classify - Return classification labels
 */
export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  return NextResponse.json({ labels: CLASSIFICATION_LABELS });
}
