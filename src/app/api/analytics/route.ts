import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // Funnel: leads per contact_status
    const funnel = db.prepare(`
      SELECT contact_status, COUNT(*) as count
      FROM leads
      WHERE status NOT IN ('rejected', 'archived')
      GROUP BY contact_status
    `).all() as Array<{ contact_status: string; count: number }>;

    // Pipeline value per stage
    const pipelineValue = db.prepare(`
      SELECT contact_status, SUM(deal_value) as total, COUNT(*) as count
      FROM leads
      WHERE deal_value > 0 AND contact_status NOT IN ('won', 'lost')
      GROUP BY contact_status
    `).all() as Array<{ contact_status: string; total: number; count: number }>;

    // Weighted forecast
    const forecast = db.prepare(`
      SELECT
        SUM(deal_value * COALESCE(win_probability, 50) / 100.0) as weighted,
        SUM(deal_value) as total,
        COUNT(*) as count
      FROM leads
      WHERE deal_value > 0 AND contact_status IN ('meeting', 'proposal')
    `).get() as { weighted: number | null; total: number | null; count: number };

    // Won/lost
    const wonLost = db.prepare(`
      SELECT contact_status, COUNT(*) as count, SUM(deal_value) as total
      FROM leads
      WHERE contact_status IN ('won', 'lost')
      GROUP BY contact_status
    `).all() as Array<{ contact_status: string; count: number; total: number }>;

    // Activities last 8 weeks per type
    const activityTrend = db.prepare(`
      SELECT
        strftime('%Y-%W', created_at) as week,
        type,
        COUNT(*) as count
      FROM lead_activities
      WHERE created_at >= datetime('now', '-56 days')
      GROUP BY week, type
      ORDER BY week DESC
    `).all() as Array<{ week: string; type: string; count: number }>;

    // Response rate (replies / emails sent)
    const emailStats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM email_tracking) as total_sent,
        (SELECT COUNT(*) FROM inbox_messages WHERE lead_id IS NOT NULL) as total_replies,
        (SELECT COUNT(*) FROM email_tracking WHERE open_count > 0) as total_opened
    `).get() as { total_sent: number; total_replies: number; total_opened: number };

    // Avg deal cycle
    const cycle = db.prepare(`
      SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
      FROM leads
      WHERE contact_status = 'won'
    `).get() as { avg_days: number | null };

    // Monthly trends (12 months)
    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as new_leads,
        SUM(CASE WHEN contact_status = 'won' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN contact_status = 'won' THEN deal_value ELSE 0 END) as revenue
      FROM leads
      WHERE created_at >= datetime('now', '-12 months')
      GROUP BY month
      ORDER BY month ASC
    `).all() as Array<{ month: string; new_leads: number; wins: number; revenue: number }>;

    return NextResponse.json({
      funnel,
      pipelineValue,
      forecast,
      wonLost,
      activityTrend,
      emailStats,
      cycle,
      monthly,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
