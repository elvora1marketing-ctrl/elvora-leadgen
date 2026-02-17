import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // Lead counts by status
    const leadCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM leads
    `).get() as Record<string, number>;

    // Contact status counts
    const contactCounts = db.prepare(`
      SELECT
        SUM(CASE WHEN contact_status = 'not_contacted' THEN 1 ELSE 0 END) as not_contacted,
        SUM(CASE WHEN contact_status = 'email_sent' THEN 1 ELSE 0 END) as email_sent,
        SUM(CASE WHEN contact_status = 'called' THEN 1 ELSE 0 END) as called,
        SUM(CASE WHEN contact_status = 'meeting' THEN 1 ELSE 0 END) as meeting,
        SUM(CASE WHEN contact_status = 'proposal' THEN 1 ELSE 0 END) as proposal,
        SUM(CASE WHEN contact_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN contact_status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM leads WHERE status = 'qualified'
    `).get() as Record<string, number>;

    // Email tracking stats
    const emailStats = db.prepare(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN open_count > 0 THEN 1 ELSE 0 END) as opened,
        SUM(open_count) as total_opens
      FROM email_tracking
    `).get() as { total_sent: number; opened: number; total_opens: number };

    // Pipeline value (deal_value from qualified leads)
    const pipelineValue = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN contact_status IN ('meeting','proposal') THEN deal_value ELSE 0 END), 0) as active_pipeline,
        COALESCE(SUM(CASE WHEN contact_status = 'won' THEN deal_value ELSE 0 END), 0) as won_value,
        COUNT(CASE WHEN contact_status IN ('meeting','proposal') THEN 1 END) as active_deals
      FROM leads WHERE status = 'qualified'
    `).get() as { active_pipeline: number; won_value: number; active_deals: number };

    // Today's new leads
    const todayLeads = db.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE date(created_at) = date('now')
    `).get() as { count: number };

    // This week's qualified
    const weekQualified = db.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE status = 'qualified' AND date(reviewed_at) >= date('now', '-7 days')
    `).get() as { count: number };

    // Recent scans (last 20)
    const recentScans = db.prepare(`
      SELECT keyword, city, leads_found, leads_new, status,
        strftime('%H:%M', started_at) as time,
        started_at
      FROM scan_history
      ORDER BY started_at DESC
      LIMIT 20
    `).all();

    // Audit page stats
    const auditStats = db.prepare(`
      SELECT
        COUNT(*) as total_audits,
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(cta_clicks), 0) as total_cta_clicks
      FROM audit_pages
    `).get() as { total_audits: number; total_views: number; total_cta_clicks: number };

    // Hot leads (audit viewed or CTA clicked recently)
    const hotLeads = db.prepare(`
      SELECT l.id, l.name, l.city, l.score, l.phone, l.email, l.contact_status,
        ap.views as audit_views, ap.cta_clicks, ap.slug as audit_slug
      FROM audit_pages ap
      JOIN leads l ON l.id = ap.lead_id
      WHERE (ap.views > 0 OR ap.cta_clicks > 0)
      ORDER BY ap.cta_clicks DESC, ap.views DESC
      LIMIT 10
    `).all();

    // Pending follow-ups
    const pendingFollowUps = db.prepare(`
      SELECT COUNT(*) as count FROM follow_ups
      WHERE status = 'pending' AND scheduled_at <= datetime('now')
    `).get() as { count: number };

    // Conversion rate
    const openRate = emailStats.total_sent > 0
      ? Math.round((emailStats.opened / emailStats.total_sent) * 100)
      : 0;

    return NextResponse.json({
      leads: {
        total: leadCounts.total || 0,
        pending: leadCounts.pending || 0,
        qualified: leadCounts.qualified || 0,
        rejected: leadCounts.rejected || 0,
        todayNew: todayLeads.count || 0,
        weekQualified: weekQualified.count || 0,
      },
      contact: {
        not_contacted: contactCounts.not_contacted || 0,
        email_sent: contactCounts.email_sent || 0,
        called: contactCounts.called || 0,
        meeting: contactCounts.meeting || 0,
        proposal: contactCounts.proposal || 0,
        won: contactCounts.won || 0,
        lost: contactCounts.lost || 0,
      },
      email: {
        totalSent: emailStats.total_sent || 0,
        opened: emailStats.opened || 0,
        openRate,
      },
      pipeline: {
        activeValue: pipelineValue.active_pipeline || 0,
        wonValue: pipelineValue.won_value || 0,
        activeDeals: pipelineValue.active_deals || 0,
      },
      audits: auditStats,
      hotLeads,
      recentScans,
      pendingFollowUps: pendingFollowUps.count || 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Stats-Fehler' }, { status: 500 });
  }
}
