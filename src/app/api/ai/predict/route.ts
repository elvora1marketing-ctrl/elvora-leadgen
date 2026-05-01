import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const runtime = 'nodejs';

interface LeadStat {
  contact_status: string;
  count: number;
}

/**
 * POST /api/ai/predict
 * Body: { lead_id }
 * Predicts close probability for a lead using OpenAI based on lead data + historical patterns.
 */
export async function POST(request: NextRequest) {
  try {
    const { lead_id } = await request.json() as { lead_id: number };
    if (!lead_id) return NextResponse.json({ error: 'lead_id erforderlich' }, { status: 400 });

    const db = getDb();
    const settings = db.prepare("SELECT key, value FROM settings WHERE key = 'openai_api_key' OR key = 'ai_model'").all() as Array<{ key: string; value: string }>;
    const apiKey = settings.find(s => s.key === 'openai_api_key')?.value;
    const model = settings.find(s => s.key === 'ai_model')?.value || 'gpt-4o-mini';

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API-Key fehlt' }, { status: 422 });
    }

    const lead = db.prepare(`
      SELECT id, name, city, score, contact_status, priority, deal_value,
             engagement_score, engagement_signals, problems, seo_issues,
             times_found, found_via_keywords, created_at, updated_at,
             (SELECT COUNT(*) FROM email_tracking WHERE lead_id = leads.id) as emails_sent,
             (SELECT SUM(open_count) FROM email_tracking WHERE lead_id = leads.id) as total_opens,
             (SELECT COUNT(*) FROM inbox_messages WHERE lead_id = leads.id) as replies
      FROM leads WHERE id = ?
    `).get(lead_id) as Record<string, unknown> | undefined;

    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });

    // Historical context: counts of won/lost
    const stats = db.prepare(`
      SELECT contact_status, COUNT(*) as count FROM leads
      WHERE contact_status IN ('won', 'lost')
      GROUP BY contact_status
    `).all() as LeadStat[];
    const won = stats.find(s => s.contact_status === 'won')?.count || 0;
    const lost = stats.find(s => s.contact_status === 'lost')?.count || 0;
    const totalClosed = won + lost;

    if (totalClosed < 5) {
      return NextResponse.json({
        success: false,
        message: `Zu wenig Trainingsdaten (${totalClosed} abgeschlossene Deals). Mindestens 5 benoetigt.`,
      });
    }

    const systemPrompt = `Du bist ein Sales-Analyst fur eine Web-Design/SEO-Agentur. Du bewertest Leads und sagst die Wahrscheinlichkeit eines Abschlusses voraus.

Antworte AUSSCHLIESSLICH als JSON:
{
  "probability": <0-100 Zahl>,
  "reasons": [
    "Kurzer Grund 1",
    "Kurzer Grund 2",
    "Kurzer Grund 3"
  ],
  "estimated_days_to_close": <Zahl oder null>
}

Faktoren die beruecksichtigt werden:
- Hoher Engagement-Score = besser
- Mehrere Email-Opens, Replies = sehr gut
- Niedriger Website-Score (<50) = grosse Chance, Hilfe wird gebraucht
- Bereits in Pipeline (meeting/proposal) = sehr nah am Abschluss
- Hohe Priority = hohe Chance
- Lead alt + keine Bewegung = niedrige Chance`;

    const userPrompt = `LEAD-DATEN:
Name: ${lead.name}
Stadt: ${lead.city}
Status: ${lead.contact_status} (Priority: ${lead.priority})
Deal-Wert: ${lead.deal_value || 'unbekannt'} EUR
Website-Score: ${lead.score}/100
Engagement-Score: ${lead.engagement_score}/100
Probleme: ${(lead.problems as string)?.substring(0, 200) || 'unbekannt'}
Emails gesendet: ${lead.emails_sent}, Opens: ${lead.total_opens || 0}, Antworten: ${lead.replies}
Erstellt: ${lead.created_at}, zuletzt aktualisiert: ${lead.updated_at}

HISTORISCHE DATEN:
- ${won} Deals gewonnen, ${lost} verloren (Win-Rate: ${(won / totalClosed * 100).toFixed(0)}%)`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      return NextResponse.json({ error: `OpenAI: ${(errData as { error?: { message?: string } }).error?.message || openaiRes.status}` }, { status: 500 });
    }

    const data = await openaiRes.json() as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens: number } };
    const parsed = JSON.parse(data.choices[0].message.content) as {
      probability: number;
      reasons: string[];
      estimated_days_to_close: number | null;
    };

    db.prepare("UPDATE leads SET predicted_close_probability = ?, predicted_reasons = ? WHERE id = ?")
      .run(parsed.probability, JSON.stringify(parsed.reasons), lead_id);

    return NextResponse.json({ success: true, ...parsed, tokens: data.usage?.total_tokens });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
