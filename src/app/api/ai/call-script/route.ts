import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';

/**
 * POST /api/ai/call-script
 * Body: { lead_id }
 * Generates a personalized call script (Einstieg, Problem, Lösung, CTA + Einwand-Antworten)
 */
export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { lead_id } = await request.json() as { lead_id: number };
    if (!lead_id) return NextResponse.json({ error: 'lead_id erforderlich' }, { status: 400 });

    const db = getDb();
    const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'ai_model', 'email_from_name')").all() as Array<{ key: string; value: string }>;
    const apiKey = settings.find(s => s.key === 'openai_api_key')?.value;
    const model = settings.find(s => s.key === 'ai_model')?.value || 'gpt-4o-mini';
    const fromName = settings.find(s => s.key === 'email_from_name')?.value || 'Elvora';

    if (!apiKey) return NextResponse.json({ error: 'OpenAI API-Key fehlt' }, { status: 422 });

    const lead = db.prepare(`
      SELECT id, name, city, score, problems, seo_issues, engagement_score, found_via_keywords, company
      FROM leads WHERE id = ?
    `).get(lead_id) as Record<string, unknown> | undefined;

    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });

    const problems = JSON.parse(((lead.problems as string) || '[]')) as Array<{ label: string; severity?: string }>;
    const top = problems.filter(p => p.severity === 'critical' || p.severity === 'major').slice(0, 3);

    const systemPrompt = `Du bist ein Sales-Coach fur eine Web-Design/SEO-Agentur (${fromName}). Du erstellst kurze, natuerliche Anruf-Skripte auf Deutsch (Du-Form NICHT! Sie-Form benutzen).

Antworte AUSSCHLIESSLICH als JSON:
{
  "einstieg": "1-2 Saetze, freundlich, professionell",
  "problem": "1-2 Saetze, das Hauptproblem klar benennen",
  "loesung": "1-2 Saetze, was wir konkret tun",
  "cta": "1 Satz, sanfte Frage nach 15 Min Termin",
  "einwand_kein_interesse": "Antwort auf 'Kein Interesse'",
  "einwand_zu_teuer": "Antwort auf 'Zu teuer'",
  "einwand_keine_zeit": "Antwort auf 'Keine Zeit'"
}`;

    const userPrompt = `LEAD: ${lead.name} (${lead.city})
Branche: ${lead.found_via_keywords || 'unbekannt'}
Website-Score: ${lead.score}/100
Engagement: ${lead.engagement_score}/100

TOP-PROBLEME:
${top.map(p => `- ${p.label} (${p.severity})`).join('\n') || '- Allgemein veraltete Website'}

Erstelle das Skript fuer diesen Lead.`;

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
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      return NextResponse.json({ error: `OpenAI: ${(errData as { error?: { message?: string } }).error?.message || openaiRes.status}` }, { status: 500 });
    }

    const data = await openaiRes.json() as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens: number } };
    const script = JSON.parse(data.choices[0].message.content);

    return NextResponse.json({ success: true, script, tokens: data.usage?.total_tokens });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
