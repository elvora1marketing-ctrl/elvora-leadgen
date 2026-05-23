import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scoring - Recalculate engagement scores for all leads
 * GET /api/scoring - Get top engaged leads
 * POST /api/scoring?lead_id=123 - Recalculate for a single lead
 */

interface EngagementWeights {
  email_opened: number;
  email_opened_multiple: number;
  audit_viewed: number;
  audit_cta_clicked: number;
  replied: number;
  replied_positive: number;
  website_score_bad: number;
  has_phone: number;
  has_email: number;
  multiple_found: number;
}

const DEFAULT_WEIGHTS: EngagementWeights = {
  email_opened: 15,
  email_opened_multiple: 25,
  audit_viewed: 20,
  audit_cta_clicked: 35,
  replied: 40,
  replied_positive: 50,
  website_score_bad: 10,
  has_phone: 5,
  has_email: 5,
  multiple_found: 5,
};

function getWeights(db: ReturnType<typeof getDb>): EngagementWeights {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'engagement_weights'").get() as { value: string } | undefined;
  if (row) {
    try { return { ...DEFAULT_WEIGHTS, ...JSON.parse(row.value) }; } catch { /* use defaults */ }
  }
  return DEFAULT_WEIGHTS;
}

interface LeadEngagementData {
  lead_id: number;
  // Email tracking
  email_open_count: number;
  total_opens: number;
  // Audit page
  audit_views: number;
  audit_cta_clicks: number;
  // Inbox replies
  reply_count: number;
  // Lead data
  score: number;
  has_phone: boolean;
  has_email: boolean;
  times_found: number;
  contact_status: string;
}

function calculateEngagement(data: LeadEngagementData, weights: EngagementWeights): { score: number; signals: Record<string, boolean> } {
  let total = 0;
  const signals: Record<string, boolean> = {};

  // Email opened at least once
  if (data.email_open_count > 0) {
    total += weights.email_opened;
    signals.email_opened = true;
  }

  // Email opened multiple times (shows high interest)
  if (data.total_opens >= 3) {
    total += weights.email_opened_multiple;
    signals.email_opened_multiple = true;
  }

  // Audit page viewed
  if (data.audit_views > 0) {
    total += weights.audit_viewed;
    signals.audit_viewed = true;
  }

  // CTA clicked on audit page (strongest signal)
  if (data.audit_cta_clicks > 0) {
    total += weights.audit_cta_clicked;
    signals.audit_cta_clicked = true;
  }

  // Lead replied to email
  if (data.reply_count > 0) {
    total += weights.replied;
    signals.replied = true;
  }

  // Lead has advanced in pipeline (positive engagement)
  if (['called', 'meeting', 'proposal'].includes(data.contact_status)) {
    total += weights.replied_positive;
    signals.pipeline_advanced = true;
  }

  // Website score is bad (= high sales potential, score inverted)
  if (data.score >= 70) {
    total += weights.website_score_bad;
    signals.bad_website = true;
  }

  // Has phone number (easier to reach)
  if (data.has_phone) {
    total += weights.has_phone;
    signals.has_phone = true;
  }

  // Has email (can be contacted)
  if (data.has_email) {
    total += weights.has_email;
    signals.has_email = true;
  }

  // Found multiple times in scrapes (established business)
  if (data.times_found >= 2) {
    total += weights.multiple_found;
    signals.multiple_found = true;
  }

  // Cap at 100
  return { score: Math.min(total, 100), signals };
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const weights = getWeights(db);
    const leadIdParam = request.nextUrl.searchParams.get('lead_id');

    let whereClause = "WHERE l.status IN ('qualified', 'akquise')";
    const params: unknown[] = [];

    if (leadIdParam) {
      whereClause = 'WHERE l.id = ?';
      params.push(parseInt(leadIdParam));
    }

    // Fetch all relevant data in one query
    const leads = db.prepare(`
      SELECT
        l.id as lead_id,
        l.score,
        l.phone,
        l.email,
        l.times_found,
        l.contact_status,
        COALESCE(et.open_count_sum, 0) as email_open_count,
        COALESCE(et.total_opens, 0) as total_opens,
        COALESCE(ap.views, 0) as audit_views,
        COALESCE(ap.cta_clicks, 0) as audit_cta_clicks,
        COALESCE(im.reply_count, 0) as reply_count
      FROM leads l
      LEFT JOIN (
        SELECT lead_id,
          COUNT(CASE WHEN open_count > 0 THEN 1 END) as open_count_sum,
          COALESCE(SUM(open_count), 0) as total_opens
        FROM email_tracking GROUP BY lead_id
      ) et ON et.lead_id = l.id
      LEFT JOIN (
        SELECT lead_id,
          COALESCE(SUM(views), 0) as views,
          COALESCE(SUM(cta_clicks), 0) as cta_clicks
        FROM audit_pages GROUP BY lead_id
      ) ap ON ap.lead_id = l.id
      LEFT JOIN (
        SELECT lead_id, COUNT(*) as reply_count
        FROM inbox_messages WHERE lead_id IS NOT NULL GROUP BY lead_id
      ) im ON im.lead_id = l.id
      ${whereClause}
    `).all(...params) as Array<{
      lead_id: number;
      score: number;
      phone: string | null;
      email: string | null;
      times_found: number;
      contact_status: string;
      email_open_count: number;
      total_opens: number;
      audit_views: number;
      audit_cta_clicks: number;
      reply_count: number;
    }>;

    const updateStmt = db.prepare(
      "UPDATE leads SET engagement_score = ?, engagement_signals = ?, priority = CASE WHEN ? >= 50 THEN 'high' WHEN ? >= 25 THEN 'medium' ELSE priority END, updated_at = datetime('now') WHERE id = ?"
    );

    const updateAll = db.transaction(() => {
      for (const lead of leads) {
        const { score: engScore, signals } = calculateEngagement({
          lead_id: lead.lead_id,
          email_open_count: lead.email_open_count,
          total_opens: lead.total_opens,
          audit_views: lead.audit_views,
          audit_cta_clicks: lead.audit_cta_clicks,
          reply_count: lead.reply_count,
          score: lead.score,
          has_phone: !!lead.phone,
          has_email: !!lead.email,
          times_found: lead.times_found,
          contact_status: lead.contact_status,
        }, weights);

        updateStmt.run(engScore, JSON.stringify(signals), engScore, engScore, lead.lead_id);
      }
    });

    updateAll();

    return NextResponse.json({
      success: true,
      updated: leads.length,
    });
  } catch (error) {
    console.error('Scoring error:', error);
    return NextResponse.json({ error: 'Scoring-Fehler' }, { status: 500 });
  }
}

/**
 * GET /api/scoring - Top engaged leads
 */
export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const topLeads = db.prepare(`
      SELECT l.id, l.name, l.city, l.email, l.phone, l.score, l.engagement_score, l.engagement_signals,
             l.contact_status, l.priority,
             COALESCE(ap.views, 0) as audit_views,
             COALESCE(ap.cta_clicks, 0) as audit_cta_clicks
      FROM leads l
      LEFT JOIN (
        SELECT lead_id, SUM(views) as views, SUM(cta_clicks) as cta_clicks
        FROM audit_pages GROUP BY lead_id
      ) ap ON ap.lead_id = l.id
      WHERE l.status IN ('qualified', 'akquise')
        AND l.engagement_score > 0
        AND l.contact_status NOT IN ('won', 'lost')
      ORDER BY l.engagement_score DESC
      LIMIT 20
    `).all();

    // Distribution
    const distribution = db.prepare(`
      SELECT
        SUM(CASE WHEN engagement_score >= 50 THEN 1 ELSE 0 END) as hot,
        SUM(CASE WHEN engagement_score >= 25 AND engagement_score < 50 THEN 1 ELSE 0 END) as warm,
        SUM(CASE WHEN engagement_score > 0 AND engagement_score < 25 THEN 1 ELSE 0 END) as cool,
        SUM(CASE WHEN engagement_score = 0 OR engagement_score IS NULL THEN 1 ELSE 0 END) as cold
      FROM leads
      WHERE status IN ('qualified', 'akquise')
    `).get() as { hot: number; warm: number; cool: number; cold: number };

    return NextResponse.json({
      topLeads,
      distribution,
    });
  } catch (error) {
    console.error('Scoring GET error:', error);
    return NextResponse.json({ error: 'Scoring-Fehler' }, { status: 500 });
  }
}
