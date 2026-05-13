import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('onboarding','active') THEN monthly_value ELSE 0 END), 0) as current_mrr,
        COUNT(CASE WHEN status IN ('onboarding','active') THEN 1 END) as active_clients,
        COUNT(CASE WHEN status = 'churned' THEN 1 END) as churned_clients,
        COUNT(*) as total_clients
      FROM clients
    `).get() as { current_mrr: number; active_clients: number; churned_clients: number; total_clients: number };

    const churnRate = stats.total_clients > 0 ? (stats.churned_clients / stats.total_clients) * 100 : 0;
    const annualProjection = stats.current_mrr * 12;

    // MRR by client
    const mrrByClient = db.prepare(`
      SELECT c.id, c.company_name, c.monthly_value, c.status, c.progress_phase, l.city
      FROM clients c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.monthly_value > 0 AND c.status IN ('onboarding', 'active')
      ORDER BY c.monthly_value DESC
    `).all();

    // Won revenue (one-time)
    const wonStats = db.prepare(`
      SELECT COALESCE(SUM(deal_value), 0) as won_value
      FROM leads WHERE contact_status = 'won' AND deal_value > 0
    `).get() as { won_value: number };

    // Auto-insert snapshot for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existingSnapshot = db.prepare('SELECT id FROM mrr_snapshots WHERE month = ?').get(currentMonth);
    if (!existingSnapshot) {
      db.prepare('INSERT INTO mrr_snapshots (month, mrr, active_clients, churned_clients) VALUES (?, ?, ?, ?)').run(
        currentMonth, stats.current_mrr, stats.active_clients, stats.churned_clients
      );
    } else {
      db.prepare('UPDATE mrr_snapshots SET mrr = ?, active_clients = ?, churned_clients = ? WHERE month = ?').run(
        stats.current_mrr, stats.active_clients, stats.churned_clients, currentMonth
      );
    }

    const trends = db.prepare('SELECT * FROM mrr_snapshots ORDER BY month DESC LIMIT 6').all();

    // 50k goal projection
    const monthsToGoal = (() => {
      const target = new Date('2027-05-31');
      const now = new Date();
      return Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
    })();

    const projectedTotal = wonStats.won_value + (stats.current_mrr * monthsToGoal);
    const goalProgress = Math.min(100, (projectedTotal / 50000) * 100);

    return NextResponse.json({
      current_mrr: stats.current_mrr,
      active_clients: stats.active_clients,
      churned_clients: stats.churned_clients,
      churn_rate: Math.round(churnRate * 10) / 10,
      annual_projection: annualProjection,
      mrr_by_client: mrrByClient,
      won_value: wonStats.won_value,
      trends: trends.reverse(),
      goal: {
        target: 50000,
        won_value: wonStats.won_value,
        projected_mrr_total: stats.current_mrr * monthsToGoal,
        projected_total: projectedTotal,
        progress: Math.round(goalProgress * 10) / 10,
        months_left: monthsToGoal,
        on_track: goalProgress >= 100,
      },
    });
  } catch (error) {
    console.error('MRR fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
