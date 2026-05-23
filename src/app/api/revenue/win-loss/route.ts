import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // Win rate: won vs lost among deals that reached meeting/proposal stage
    const winLossCounts = db.prepare(`
      SELECT
        COUNT(CASE WHEN contact_status = 'won' THEN 1 END) as won_count,
        COUNT(CASE WHEN contact_status = 'lost' THEN 1 END) as lost_count
      FROM leads
      WHERE contact_status IN ('won', 'lost')
    `).get() as { won_count: number; lost_count: number };

    const totalDecided = winLossCounts.won_count + winLossCounts.lost_count;
    const winRate = totalDecided > 0
      ? Math.round((winLossCounts.won_count / totalDecided) * 100)
      : 0;

    // Average lead score for won vs lost
    const avgScores = db.prepare(`
      SELECT
        COALESCE(AVG(CASE WHEN contact_status = 'won' THEN score END), 0) as avg_score_won,
        COALESCE(AVG(CASE WHEN contact_status = 'lost' THEN score END), 0) as avg_score_lost
      FROM leads
      WHERE contact_status IN ('won', 'lost')
    `).get() as { avg_score_won: number; avg_score_lost: number };

    // Top 5 cities by won deals
    const topCitiesWon = db.prepare(`
      SELECT
        city,
        COUNT(*) as count,
        COALESCE(SUM(deal_value), 0) as total_value
      FROM leads
      WHERE contact_status = 'won'
      GROUP BY city
      ORDER BY count DESC
      LIMIT 5
    `).all() as Array<{ city: string; count: number; total_value: number }>;

    // Top 5 keywords by won deals
    const wonLeadsKeywords = db.prepare(`
      SELECT found_via_keywords
      FROM leads
      WHERE contact_status = 'won' AND found_via_keywords IS NOT NULL AND found_via_keywords != ''
    `).all() as Array<{ found_via_keywords: string }>;

    const keywordCounts: Record<string, number> = {};
    for (const row of wonLeadsKeywords) {
      // found_via_keywords typically contains "keyword city" pairs
      const parts = row.found_via_keywords.split(',').map(s => s.trim());
      for (const part of parts) {
        const words = part.split(' ');
        // Last word is city, everything before is keyword
        if (words.length > 1) {
          const keyword = words.slice(0, -1).join(' ');
          keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
        } else if (words.length === 1 && words[0]) {
          keywordCounts[words[0]] = (keywordCounts[words[0]] || 0) + 1;
        }
      }
    }
    const topKeywordsWon = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword, count]) => ({ keyword, count }));

    // Average time to win (created_at to updated_at)
    const avgTimeToWin = db.prepare(`
      SELECT COALESCE(AVG(julianday(updated_at) - julianday(created_at)), 0) as avg_days
      FROM leads
      WHERE contact_status = 'won'
        AND updated_at IS NOT NULL
        AND created_at IS NOT NULL
    `).get() as { avg_days: number };

    // Average time to loss
    const avgTimeToLoss = db.prepare(`
      SELECT COALESCE(AVG(julianday(updated_at) - julianday(created_at)), 0) as avg_days
      FROM leads
      WHERE contact_status = 'lost'
        AND updated_at IS NOT NULL
        AND created_at IS NOT NULL
    `).get() as { avg_days: number };

    // Loss reasons aggregated
    const lossReasons = db.prepare(`
      SELECT
        COALESCE(lost_reason, 'Nicht angegeben') as reason,
        COUNT(*) as count
      FROM leads
      WHERE contact_status = 'lost'
      GROUP BY COALESCE(lost_reason, 'Nicht angegeben')
      ORDER BY count DESC
    `).all() as Array<{ reason: string; count: number }>;

    // Conversion by source (found_via_keywords patterns)
    const conversionBySource = db.prepare(`
      SELECT
        found_via_keywords as source,
        COUNT(*) as total,
        SUM(CASE WHEN contact_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN contact_status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM leads
      WHERE found_via_keywords IS NOT NULL
        AND found_via_keywords != ''
        AND contact_status IN ('won', 'lost', 'meeting', 'proposal', 'called', 'email_sent')
      GROUP BY found_via_keywords
      ORDER BY total DESC
      LIMIT 15
    `).all() as Array<{ source: string; total: number; won: number; lost: number }>;

    const conversionBySourceFormatted = conversionBySource.map(row => ({
      source: row.source,
      total: row.total,
      won: row.won,
      lost: row.lost,
      conversion_rate: row.total > 0 ? Math.round((row.won / row.total) * 100) : 0,
    }));

    return NextResponse.json({
      win_rate: winRate,
      avg_score_won: Math.round(avgScores.avg_score_won),
      avg_score_lost: Math.round(avgScores.avg_score_lost),
      top_cities_won: topCitiesWon,
      top_keywords_won: topKeywordsWon,
      avg_time_to_win: Math.round(avgTimeToWin.avg_days),
      avg_time_to_loss: Math.round(avgTimeToLoss.avg_days),
      loss_reasons: lossReasons,
      conversion_by_source: conversionBySourceFormatted,
      won_count: winLossCounts.won_count,
      lost_count: winLossCounts.lost_count,
    });
  } catch (error) {
    console.error('Win/loss analysis error:', error);
    return NextResponse.json({ error: 'Win/loss analysis error' }, { status: 500 });
  }
}
