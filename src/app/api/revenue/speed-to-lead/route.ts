import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    // Average minutes to first contact
    const avgRow = db.prepare(`
      SELECT AVG((julianday(first_contacted_at) - julianday(created_at)) * 24 * 60) as avg_minutes
      FROM leads
      WHERE first_contacted_at IS NOT NULL AND created_at IS NOT NULL
    `).get() as { avg_minutes: number | null };

    const avg_minutes_to_contact = avgRow?.avg_minutes
      ? Math.round(avgRow.avg_minutes * 10) / 10
      : null;

    // Leads contacted under 1h
    const under1h = db.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE first_contacted_at IS NOT NULL
        AND (julianday(first_contacted_at) - julianday(created_at)) * 24 * 60 < 60
    `).get() as { count: number };

    // Leads contacted under 24h
    const under24h = db.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE first_contacted_at IS NOT NULL
        AND (julianday(first_contacted_at) - julianday(created_at)) * 24 * 60 < 1440
    `).get() as { count: number };

    // Leads contacted after 24h
    const over24h = db.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE first_contacted_at IS NOT NULL
        AND (julianday(first_contacted_at) - julianday(created_at)) * 24 * 60 >= 1440
    `).get() as { count: number };

    // Never contacted qualified leads
    const neverContacted = db.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE first_contacted_at IS NULL
        AND status IN ('qualified', 'akquise')
    `).get() as { count: number };

    // Distribution
    const dist = db.prepare(`
      SELECT
        SUM(CASE WHEN mins < 60 THEN 1 ELSE 0 END) as under_1h,
        SUM(CASE WHEN mins >= 60 AND mins < 240 THEN 1 ELSE 0 END) as h1_4,
        SUM(CASE WHEN mins >= 240 AND mins < 1440 THEN 1 ELSE 0 END) as h4_24,
        SUM(CASE WHEN mins >= 1440 AND mins < 4320 THEN 1 ELSE 0 END) as d1_3,
        SUM(CASE WHEN mins >= 4320 THEN 1 ELSE 0 END) as over_3d
      FROM (
        SELECT (julianday(first_contacted_at) - julianday(created_at)) * 24 * 60 as mins
        FROM leads
        WHERE first_contacted_at IS NOT NULL AND created_at IS NOT NULL
      )
    `).get() as Record<string, number | null>;

    const distribution = [
      { range: '<1h', count: dist?.under_1h || 0 },
      { range: '1-4h', count: dist?.h1_4 || 0 },
      { range: '4-24h', count: dist?.h4_24 || 0 },
      { range: '1-3d', count: dist?.d1_3 || 0 },
      { range: '>3d', count: dist?.over_3d || 0 },
    ];

    // Hot uncontacted leads — high score, qualified/akquise, not yet contacted
    const hot_uncontacted = db.prepare(`
      SELECT
        id, name, city, score, created_at,
        ROUND((julianday('now') - julianday(created_at)) * 24 * 60) as minutes_since_created
      FROM leads
      WHERE score >= 60
        AND status IN ('qualified', 'akquise')
        AND contact_status = 'not_contacted'
      ORDER BY score DESC
      LIMIT 5
    `).all();

    return NextResponse.json({
      avg_minutes_to_contact,
      leads_under_1h: under1h.count,
      leads_under_24h: under24h.count,
      leads_over_24h: over24h.count,
      never_contacted: neverContacted.count,
      distribution,
      hot_uncontacted,
    });
  } catch (error) {
    console.error('Speed-to-lead error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
