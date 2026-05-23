import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface PersonalizeRequest {
  lead_id?: number;
  lead_name: string;
  ansprechpartner: string;
  website: string;
  city: string;
  score: number;
  problems: { label: string; severity: string }[];
  seo_issues: { label: string; impact: string }[];
}

interface PersonalizeResponse {
  intro: string;
  subject: string;
  pitch: string;
}

function getAiSettings() {
  const db = getDb();
  const keys = ['openai_api_key', 'ai_personalization_enabled', 'ai_model', 'email_from_name'];
  const settings: Record<string, string> = {};
  for (const key of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) settings[key] = row.value;
  }
  return settings;
}

/**
 * POST /api/ai/personalize
 * Generates a personalized email intro, subject, and pitch for a lead using OpenAI.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body: PersonalizeRequest = await request.json();
    const settings = getAiSettings();

    if (settings.ai_personalization_enabled !== 'true') {
      return NextResponse.json({ error: 'KI-Personalisierung ist deaktiviert' }, { status: 422 });
    }

    if (!settings.openai_api_key) {
      return NextResponse.json({ error: 'OpenAI API-Key nicht konfiguriert' }, { status: 422 });
    }

    const senderName = settings.email_from_name || 'Luan von Elvora';
    const model = settings.ai_model || 'gpt-4o-mini';

    // Build the context for the AI
    const criticalProblems = body.problems.filter(p => p.severity === 'critical');
    const majorProblems = body.problems.filter(p => p.severity === 'major');
    const highImpactSeo = body.seo_issues.filter(s => s.impact === 'high');

    const problemSummary = [
      ...criticalProblems.map(p => `KRITISCH: ${p.label}`),
      ...majorProblems.map(p => `WICHTIG: ${p.label}`),
      ...highImpactSeo.map(s => `SEO: ${s.label}`),
    ].slice(0, 5).join('\n');

    // Load competitor data if lead_id is available
    let competitorContext = '';
    if (body.lead_id) {
      try {
        const db = getDb();
        const competitors = db.prepare(`
          SELECT competitor_name, competitor_score, competitor_has_ssl
          FROM competitor_analyses
          WHERE lead_id = ?
          ORDER BY competitor_score DESC
          LIMIT 3
        `).all(body.lead_id) as { competitor_name: string; competitor_score: number; competitor_has_ssl: number }[];

        if (competitors.length > 0) {
          const betterCompetitors = competitors.filter(c => (c.competitor_score ?? 0) > body.score);
          if (betterCompetitors.length > 0) {
            competitorContext = '\nKONKURRENZ-VERGLEICH:\n' +
              betterCompetitors.map(c =>
                `- ${c.competitor_name}: Score ${c.competitor_score}/100${c.competitor_has_ssl ? ', hat SSL' : ', KEIN SSL'}`
              ).join('\n') +
              `\n→ Der Lead (${body.score}/100) liegt HINTER diesen Konkurrenten. Nutze das subtil als Argument.`;
          }
        }
      } catch { /* competitor data is optional */ }
    }

    const systemPrompt = `Du bist ein erfahrener Sales-Texter für eine Webdesign-Agentur namens "Elvora".
Du schreibst personalisierte Kaltakquise-Emails an lokale Unternehmen (Handwerker, Dienstleister, etc.).

REGELN:
- Schreibe auf Deutsch, professionell aber nahbar (Du/Sie-Form: "Sie")
- Keine Floskeln wie "Ich hoffe, diese E-Mail findet Sie gut"
- Beziehe dich KONKRET auf die gefundenen Probleme der Website
- Erwähne den Firmennamen und die Stadt natürlich
- Sei direkt, nicht aufdringlich
- KEIN Emoji, KEINE übertriebenen Versprechen
- Der Absender heißt "${senderName}" und arbeitet bei Elvora
- Maximal 2-3 Sätze pro Abschnitt
- Wenn Konkurrenz-Daten vorhanden: erwähne SUBTIL, dass Mitbewerber online besser aufgestellt sind (z.B. "Während Mitbewerber in ${body.city} bereits moderne Websites nutzen..."). Nenne KEINE Konkurrenten-Namen direkt.

Du gibst IMMER ein JSON-Objekt zurück mit genau diesen 3 Feldern:
{
  "subject": "Personalisierte Betreffzeile (max 60 Zeichen)",
  "intro": "Persönlicher Einstieg (1-2 Sätze, warum wir uns melden)",
  "pitch": "Konkreter Bezug auf die Website-Probleme (2-3 Sätze)"
}`;

    const userPrompt = `Erstelle eine personalisierte E-Mail für dieses Unternehmen:

UNTERNEHMEN: ${body.lead_name}
STADT: ${body.city}
WEBSITE: ${body.website}
WEBSITE-SCORE: ${body.score}/100
ANSPRECHPARTNER: ${body.ansprechpartner || 'Geschäftsführer/in'}

GEFUNDENE PROBLEME:
${problemSummary || 'Allgemein verbesserungswürdige Website'}
${competitorContext}

Generiere die personalisierten Texte als JSON.`;

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
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      const errMsg = (errData as { error?: { message?: string } }).error?.message || `HTTP ${openaiRes.status}`;
      console.error('OpenAI error:', errMsg);
      return NextResponse.json({ error: `OpenAI Fehler: ${errMsg}` }, { status: 500 });
    }

    const openaiData = await openaiRes.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Keine Antwort von OpenAI erhalten' }, { status: 500 });
    }

    let parsed: PersonalizeResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse OpenAI response:', content);
      return NextResponse.json({ error: 'Ungültige KI-Antwort' }, { status: 500 });
    }

    // Validate required fields
    if (!parsed.intro || !parsed.subject || !parsed.pitch) {
      return NextResponse.json({ error: 'Unvollständige KI-Antwort' }, { status: 500 });
    }

    // Log token usage
    const tokens = openaiData.usage?.total_tokens || 0;

    // Store personalized content for the lead if lead_id exists
    if (body.lead_id) {
      const db = getDb();
      db.prepare(`
        INSERT INTO lead_activities (lead_id, type, content, metadata)
        VALUES (?, 'note', ?, ?)
      `).run(
        body.lead_id,
        'KI-Personalisierung generiert',
        JSON.stringify({ ai: true, tokens, model, ...parsed })
      );
    }

    return NextResponse.json({
      success: true,
      ...parsed,
      tokens,
      model,
    });
  } catch (error: unknown) {
    console.error('AI personalization error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: `KI-Fehler: ${message}` }, { status: 500 });
  }
}

/**
 * GET /api/ai/personalize - Check AI status
 */
export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const settings = getAiSettings();
    return NextResponse.json({
      enabled: settings.ai_personalization_enabled === 'true',
      hasApiKey: !!settings.openai_api_key,
      model: settings.ai_model || 'gpt-4o-mini',
    });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
