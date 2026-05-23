import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // --- By Keyword ---
    // found_via_keywords format: "keyword city" — last word is city, rest is the service keyword
    const allLeadsKeywords = db.prepare(`
      SELECT
        found_via_keywords,
        contact_status,
        COALESCE(deal_value, 0) as deal_value
      FROM leads
      WHERE found_via_keywords IS NOT NULL AND found_via_keywords != ''
    `).all() as Array<{ found_via_keywords: string; contact_status: string; deal_value: number }>;

    const keywordMap: Record<string, { leads_total: number; leads_won: number; revenue: number }> = {};
    const cityMap: Record<string, { leads_total: number; leads_won: number; revenue: number }> = {};

    for (const row of allLeadsKeywords) {
      const parts = row.found_via_keywords.split(',').map(s => s.trim());
      for (const part of parts) {
        const words = part.split(' ');
        let keyword: string;
        let city: string;

        if (words.length > 1) {
          keyword = words.slice(0, -1).join(' ');
          city = words[words.length - 1];
        } else {
          keyword = words[0] || 'Unbekannt';
          city = 'Unbekannt';
        }

        const isWon = row.contact_status === 'won';

        // Keyword aggregation
        if (!keywordMap[keyword]) {
          keywordMap[keyword] = { leads_total: 0, leads_won: 0, revenue: 0 };
        }
        keywordMap[keyword].leads_total++;
        if (isWon) {
          keywordMap[keyword].leads_won++;
          keywordMap[keyword].revenue += row.deal_value;
        }

        // City aggregation
        if (!cityMap[city]) {
          cityMap[city] = { leads_total: 0, leads_won: 0, revenue: 0 };
        }
        cityMap[city].leads_total++;
        if (isWon) {
          cityMap[city].leads_won++;
          cityMap[city].revenue += row.deal_value;
        }
      }
    }

    const byKeyword = Object.entries(keywordMap)
      .map(([keyword, data]) => ({
        keyword,
        leads_total: data.leads_total,
        leads_won: data.leads_won,
        revenue: Math.round(data.revenue * 100) / 100,
        conversion_rate: data.leads_total > 0
          ? Math.round((data.leads_won / data.leads_total) * 100)
          : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const byCity = Object.entries(cityMap)
      .map(([city, data]) => ({
        city,
        leads_total: data.leads_total,
        leads_won: data.leads_won,
        revenue: Math.round(data.revenue * 100) / 100,
        conversion_rate: data.leads_total > 0
          ? Math.round((data.leads_won / data.leads_total) * 100)
          : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // --- By Campaign ---
    let byCampaign: Array<{ campaign_name: string; leads_sent: number; leads_won: number; revenue: number }> = [];
    try {
      byCampaign = db.prepare(`
        SELECT
          oc.name as campaign_name,
          oc.sent as leads_sent,
          COUNT(CASE WHEN l.contact_status = 'won' THEN 1 END) as leads_won,
          COALESCE(SUM(CASE WHEN l.contact_status = 'won' THEN l.deal_value ELSE 0 END), 0) as revenue
        FROM outreach_campaigns oc
        LEFT JOIN outreach_campaign_leads ocl ON ocl.campaign_id = oc.id
        LEFT JOIN leads l ON l.id = ocl.lead_id
        GROUP BY oc.id, oc.name, oc.sent
        ORDER BY revenue DESC
      `).all() as Array<{ campaign_name: string; leads_sent: number; leads_won: number; revenue: number }>;
    } catch { /* outreach_campaigns table may not exist */ }

    // --- ROI per Keyword ---
    const roiPerKeyword = byKeyword
      .filter(k => k.leads_total > 0)
      .map(k => ({
        keyword: k.keyword,
        revenue_per_lead: k.leads_total > 0
          ? Math.round((k.revenue / k.leads_total) * 100) / 100
          : 0,
        leads_total: k.leads_total,
        revenue: k.revenue,
        conversion_rate: k.conversion_rate,
      }))
      .sort((a, b) => b.revenue_per_lead - a.revenue_per_lead);

    // --- Best Score Range ---
    const scoreRanges = db.prepare(`
      SELECT
        CASE
          WHEN score BETWEEN 0 AND 30 THEN '0-30'
          WHEN score BETWEEN 31 AND 50 THEN '31-50'
          WHEN score BETWEEN 51 AND 70 THEN '51-70'
          WHEN score BETWEEN 71 AND 85 THEN '71-85'
          WHEN score BETWEEN 86 AND 100 THEN '86-100'
          ELSE 'unknown'
        END as range,
        COUNT(*) as leads,
        SUM(CASE WHEN contact_status = 'won' THEN 1 ELSE 0 END) as won
      FROM leads
      WHERE contact_status IN ('won', 'lost', 'meeting', 'proposal', 'called', 'email_sent')
      GROUP BY
        CASE
          WHEN score BETWEEN 0 AND 30 THEN '0-30'
          WHEN score BETWEEN 31 AND 50 THEN '31-50'
          WHEN score BETWEEN 51 AND 70 THEN '51-70'
          WHEN score BETWEEN 71 AND 85 THEN '71-85'
          WHEN score BETWEEN 86 AND 100 THEN '86-100'
          ELSE 'unknown'
        END
      ORDER BY
        CASE
          WHEN score BETWEEN 0 AND 30 THEN 1
          WHEN score BETWEEN 31 AND 50 THEN 2
          WHEN score BETWEEN 51 AND 70 THEN 3
          WHEN score BETWEEN 71 AND 85 THEN 4
          WHEN score BETWEEN 86 AND 100 THEN 5
          ELSE 6
        END
    `).all() as Array<{ range: string; leads: number; won: number }>;

    const bestScoreRange = scoreRanges.map(row => ({
      range: row.range,
      leads: row.leads,
      won: row.won,
      rate: row.leads > 0 ? Math.round((row.won / row.leads) * 100) : 0,
    }));

    return NextResponse.json({
      by_keyword: byKeyword,
      by_city: byCity,
      by_campaign: byCampaign,
      roi_per_keyword: roiPerKeyword,
      best_score_range: bestScoreRange,
    });
  } catch (error) {
    console.error('Revenue attribution error:', error);
    return NextResponse.json({ error: 'Revenue attribution error' }, { status: 500 });
  }
}
