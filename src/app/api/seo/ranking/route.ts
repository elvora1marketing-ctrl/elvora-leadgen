import { NextRequest, NextResponse } from 'next/server';
import { checkLocalRanking } from '@/lib/seo-analyzer';

/**
 * POST /api/seo/ranking - Check local SERP ranking for a keyword + city
 * Body: { keyword: string, city: string, website: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { keyword?: string; city?: string; website?: string };

    if (!body.keyword || !body.city || !body.website) {
      return NextResponse.json({ error: 'keyword, city und website sind erforderlich' }, { status: 400 });
    }

    const result = await checkLocalRanking(body.keyword, body.city, body.website);

    return NextResponse.json({
      success: true,
      ranking: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[SEO Ranking API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
