import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    // Revenue won this month
    const currentMonth = db.prepare(`
      SELECT COALESCE(SUM(deal_value), 0) as revenue
      FROM leads
      WHERE contact_status = 'won'
        AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
    `).get() as { revenue: number };

    // Revenue won last month
    const lastMonth = db.prepare(`
      SELECT COALESCE(SUM(deal_value), 0) as revenue
      FROM leads
      WHERE contact_status = 'won'
        AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now', '-1 month')
    `).get() as { revenue: number };

    // Pipeline weighted: SUM(deal_value * win_probability / 100) for meeting/proposal
    const pipelineWeighted = db.prepare(`
      SELECT
        COALESCE(SUM(deal_value * COALESCE(win_probability, 50) / 100.0), 0) as weighted,
        COALESCE(SUM(deal_value), 0) as total
      FROM leads
      WHERE contact_status IN ('meeting', 'proposal')
        AND status IN ('qualified', 'akquise')
    `).get() as { weighted: number; total: number };

    // Average deal value of won deals
    const avgDeal = db.prepare(`
      SELECT
        COALESCE(AVG(deal_value), 0) as avg_value,
        COUNT(*) as won_count
      FROM leads
      WHERE contact_status = 'won' AND deal_value > 0
    `).get() as { avg_value: number; won_count: number };

    // Average days to close (created_at to updated_at when won)
    const avgDaysToClose = db.prepare(`
      SELECT COALESCE(AVG(julianday(updated_at) - julianday(created_at)), 0) as avg_days
      FROM leads
      WHERE contact_status = 'won'
        AND updated_at IS NOT NULL
        AND created_at IS NOT NULL
    `).get() as { avg_days: number };

    // Historical close rate: won / (won + lost) for leads that reached meeting/proposal
    const closeRateData = db.prepare(`
      SELECT
        COUNT(CASE WHEN contact_status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN contact_status = 'lost' THEN 1 END) as lost
      FROM leads
      WHERE contact_status IN ('won', 'lost')
    `).get() as { won: number; lost: number };

    const historicalCloseRate = (closeRateData.won + closeRateData.lost) > 0
      ? closeRateData.won / (closeRateData.won + closeRateData.lost)
      : 0;

    // Forecast next month: pipeline weighted + historical close rate applied to pipeline
    const forecastNextMonth = pipelineWeighted.weighted + (pipelineWeighted.total * historicalCloseRate * 0.3);

    // Monthly trend: last 6 months revenue
    const monthlyTrend = db.prepare(`
      SELECT
        strftime('%Y-%m', updated_at) as month,
        COALESCE(SUM(deal_value), 0) as revenue,
        COUNT(*) as deals_won
      FROM leads
      WHERE contact_status = 'won'
        AND updated_at >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', updated_at)
      ORDER BY month ASC
    `).all() as Array<{ month: string; revenue: number; deals_won: number }>;

    // By stage: count + value per pipeline stage
    const byStage = db.prepare(`
      SELECT
        contact_status as stage,
        COUNT(*) as count,
        COALESCE(SUM(deal_value), 0) as value
      FROM leads
      WHERE status IN ('qualified', 'akquise')
      GROUP BY contact_status
      ORDER BY
        CASE contact_status
          WHEN 'not_contacted' THEN 1
          WHEN 'email_sent' THEN 2
          WHEN 'called' THEN 3
          WHEN 'meeting' THEN 4
          WHEN 'proposal' THEN 5
          WHEN 'won' THEN 6
          WHEN 'lost' THEN 7
        END
    `).all() as Array<{ stage: string; count: number; value: number }>;

    return NextResponse.json({
      current_month: currentMonth.revenue,
      last_month: lastMonth.revenue,
      pipeline_weighted: Math.round(pipelineWeighted.weighted * 100) / 100,
      pipeline_total: pipelineWeighted.total,
      forecast_next_month: Math.round(forecastNextMonth * 100) / 100,
      avg_deal_value: Math.round(avgDeal.avg_value * 100) / 100,
      avg_days_to_close: Math.round(avgDaysToClose.avg_days),
      historical_close_rate: Math.round(historicalCloseRate * 100),
      monthly_trend: monthlyTrend,
      by_stage: byStage,
    });
  } catch (error) {
    console.error('Revenue forecast error:', error);
    return NextResponse.json({ error: 'Revenue forecast error' }, { status: 500 });
  }
}
