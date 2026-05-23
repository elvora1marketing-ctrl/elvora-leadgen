import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/leads/[id]/reviews - Returns all review snapshots for a lead
 * POST /api/leads/[id]/reviews - Triggers a new Google Maps lookup for the lead
 *   and creates a snapshot. If rating dropped vs last snapshot, creates a trigger event.
 */
export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  const snapshots = getDb().prepare(`
    SELECT * FROM review_snapshots WHERE lead_id = ? ORDER BY checked_at DESC LIMIT 20
  `).all(leadId);
  return NextResponse.json({ snapshots });
}

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();
    const lead = db.prepare('SELECT id, name, city FROM leads WHERE id = ?').get(leadId) as { id: number; name: string; city: string } | undefined;
    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });

    // Lookup via Google Maps
    const { scrapeGoogleMapsFree } = await import('@/lib/maps-scraper-free');
    const result = await scrapeGoogleMapsFree(`${lead.name} ${lead.city}`, undefined, 3);

    // Find best match by name similarity
    const lname = lead.name.toLowerCase();
    const match = result.businesses.find(b => b.name.toLowerCase() === lname)
      || result.businesses.find(b => b.name.toLowerCase().includes(lname.split(' ')[0]))
      || result.businesses[0];

    if (!match || match.rating === null) {
      return NextResponse.json({ success: false, message: 'Keine Bewertungsdaten gefunden' });
    }

    // Get last snapshot to detect changes
    const last = db.prepare(`
      SELECT rating, review_count FROM review_snapshots WHERE lead_id = ? ORDER BY checked_at DESC LIMIT 1
    `).get(leadId) as { rating: number; review_count: number } | undefined;

    // Save new snapshot
    db.prepare(`
      INSERT INTO review_snapshots (lead_id, rating, review_count) VALUES (?, ?, ?)
    `).run(leadId, match.rating, match.reviews || 0);

    // Detect rating drop -> trigger
    if (last && match.rating < last.rating - 0.1) {
      db.prepare(`
        INSERT INTO trigger_events (lead_id, trigger_type, severity, title, details)
        VALUES (?, 'negative_review', 'high', ?, ?)
      `).run(
        leadId,
        `Google-Bewertung gesunken: ${last.rating} → ${match.rating}`,
        JSON.stringify({ previous: last.rating, current: match.rating, review_count: match.reviews }),
      );
    }

    return NextResponse.json({
      success: true,
      snapshot: { rating: match.rating, review_count: match.reviews },
      previous: last,
      changed: !!last && match.rating !== last.rating,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
