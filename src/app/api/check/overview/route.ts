import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // All check page stats
    const stats = db.prepare(
      'SELECT * FROM check_page_stats ORDER BY submissions DESC, views DESC'
    ).all();

    // Inbound leads (most recent 20)
    const inboundLeads = db.prepare(`
      SELECT id, name, website_original as website, city, score, created_at, phone, email
      FROM leads
      WHERE source = 'inbound_check'
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    // Totals
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(views), 0) as views,
        COALESCE(SUM(submissions), 0) as submissions
      FROM check_page_stats
    `).get() as { views: number; submissions: number };

    const inboundCount = db.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE source = 'inbound_check'"
    ).get() as { count: number };

    return NextResponse.json({
      stats,
      inboundLeads,
      totals: {
        views: totals.views,
        submissions: totals.submissions,
        inboundLeads: inboundCount.count,
      },
    });
  } catch (error) {
    console.error('[Check Overview] Error:', error);
    return NextResponse.json({ stats: [], inboundLeads: [], totals: { views: 0, submissions: 0, inboundLeads: 0 } });
  }
}
