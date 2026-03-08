import { NextRequest, NextResponse } from 'next/server';
import { runLocalSeoResearch } from '@/lib/dataforseo';

/**
 * POST /api/local-seo/research
 * Body: { branche: string, stadt: string }
 * Returns: keywords, SERP, maps, competitors (with 24h cache)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { branche?: string; stadt?: string };

    if (!body.branche?.trim() || !body.stadt?.trim()) {
      return NextResponse.json(
        { error: 'Branche und Stadt sind erforderlich' },
        { status: 400 }
      );
    }

    const { data, cached } = await runLocalSeoResearch(
      body.branche.trim(),
      body.stadt.trim()
    );

    return NextResponse.json({
      success: true,
      data,
      cached,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[Local SEO API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
