import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { quickCheck } from '@/lib/website-analyzer';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { leadId } = await params;
  const id = parseInt(leadId);
  if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  const db = getDb();
  const competitors = db.prepare(`
    SELECT * FROM competitor_analyses WHERE lead_id = ? ORDER BY competitor_score DESC
  `).all(id);
  return NextResponse.json({ competitors });
}

interface ScrapedBusinessLite {
  name: string;
  website: string | null;
}

/**
 * POST /api/competitors/[leadId]
 * Findet Konkurrenten via Maps-Scraper und analysiert deren Websites.
 * Body: { keyword?: string } - optional, sonst aus Lead abgeleitet
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { leadId } = await params;
    const id = parseInt(leadId);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const customKeyword = (body as { keyword?: string }).keyword;

    const db = getDb();
    const lead = db.prepare(`
      SELECT id, name, city, website_normalized, found_via_keywords FROM leads WHERE id = ?
    `).get(id) as { id: number; name: string; city: string; website_normalized: string; found_via_keywords: string | null } | undefined;

    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });

    // Keyword aus found_via_keywords ableiten oder custom
    let keyword = customKeyword;
    if (!keyword && lead.found_via_keywords) {
      const first = lead.found_via_keywords.split(',')[0].trim();
      // Strip city if present
      keyword = first.replace(new RegExp(`\\s+${lead.city}\\s*$`, 'i'), '').trim();
      keyword = `${keyword} ${lead.city}`;
    }
    if (!keyword) keyword = `Firmen ${lead.city}`;

    // Use Free Maps scraper to find competitors
    const { scrapeGoogleMapsFree } = await import('@/lib/maps-scraper-free');
    const result = await scrapeGoogleMapsFree(keyword, undefined, 10);

    // Filter: nicht der Lead selbst, hat Website
    const competitors: ScrapedBusinessLite[] = result.businesses
      .filter(b => b.website && b.name !== lead.name)
      .slice(0, 3);

    if (competitors.length === 0) {
      return NextResponse.json({ success: true, competitors: [], message: 'Keine Konkurrenten mit Website gefunden' });
    }

    // Clear old analyses
    db.prepare('DELETE FROM competitor_analyses WHERE lead_id = ?').run(id);

    const insert = db.prepare(`
      INSERT INTO competitor_analyses (lead_id, competitor_name, competitor_website, competitor_score, competitor_has_ssl, competitor_response_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Quick-check each competitor
    for (const comp of competitors) {
      try {
        const check = await quickCheck(comp.website!);
        // Score grob berechnen: hat SSL=40pt, schnell<2s=30pt, erreichbar=30pt
        let score = 0;
        if (check.isReachable) score += 30;
        if (check.hasSSL) score += 40;
        if (check.responseTimeMs < 2000) score += 30;
        else if (check.responseTimeMs < 4000) score += 15;

        insert.run(id, comp.name, comp.website, score, check.hasSSL ? 1 : 0, check.responseTimeMs);
      } catch { /* skip */ }
    }

    const saved = db.prepare(`
      SELECT * FROM competitor_analyses WHERE lead_id = ? ORDER BY competitor_score DESC
    `).all(id);

    return NextResponse.json({ success: true, competitors: saved, keyword });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[Competitors API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
