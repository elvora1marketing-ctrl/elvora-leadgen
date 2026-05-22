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

    // Follow-up stats
    const followUpStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' AND scheduled_at <= datetime('now') THEN 1 ELSE 0 END) as due_now,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'sent' AND date(sent_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as sent_this_week
      FROM follow_ups
    `).get() as { total: number; due_now: number; pending: number; sent: number; cancelled: number; sent_this_week: number };

    // Next scheduled follow-ups
    const nextFollowUps = db.prepare(`
      SELECT f.step, f.scheduled_at, l.name, l.city
      FROM follow_ups f
      JOIN leads l ON f.lead_id = l.id
      WHERE f.status = 'pending'
      ORDER BY f.scheduled_at ASC
      LIMIT 5
    `).all();

    // Inbox stats
    const inboxStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 AND is_archived = 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN date(created_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as this_week
      FROM inbox_messages
    `).get() as { total: number; unread: number; this_week: number };

    const recentReplies = db.prepare(`
      SELECT m.id, m.from_name, m.from_email, m.subject, m.body_text, m.is_read, m.created_at,
             l.name as lead_name, l.city as lead_city
      FROM inbox_messages m
      LEFT JOIN leads l ON m.lead_id = l.id
      WHERE m.is_archived = 0
      ORDER BY m.created_at DESC
      LIMIT 5
    `).all();

    // Engagement scoring distribution
    const engagementDist = db.prepare(`
      SELECT
        SUM(CASE WHEN engagement_score >= 50 THEN 1 ELSE 0 END) as hot,
        SUM(CASE WHEN engagement_score >= 25 AND engagement_score < 50 THEN 1 ELSE 0 END) as warm,
        SUM(CASE WHEN engagement_score > 0 AND engagement_score < 25 THEN 1 ELSE 0 END) as cool,
        SUM(CASE WHEN engagement_score = 0 OR engagement_score IS NULL THEN 1 ELSE 0 END) as cold
      FROM leads
      WHERE status IN ('qualified', 'akquise')
    `).get() as { hot: number; warm: number; cool: number; cold: number };

    // Top engaged leads
    const topEngaged = db.prepare(`
      SELECT l.id, l.name, l.city, l.email, l.phone, l.engagement_score, l.engagement_signals,
             l.contact_status
      FROM leads l
      WHERE l.status IN ('qualified', 'akquise')
        AND l.engagement_score > 0
        AND l.contact_status NOT IN ('won', 'lost')
      ORDER BY l.engagement_score DESC
      LIMIT 5
    `).all() as Array<{
      id: number; name: string; city: string; email: string; phone: string;
      engagement_score: number; engagement_signals: string; contact_status: string;
    }>;

    // Conversion rate
    const openRate = emailStats.total_sent > 0
      ? Math.round((emailStats.opened / emailStats.total_sent) * 100)
      : 0;

    // Outreach campaign stats
    let outreachStats = { totalCampaigns: 0, activeCampaigns: 0, totalSent: 0, totalOpened: 0, totalReplied: 0, openRate: 0, replyRate: 0 };
    try {
      const oRow = db.prepare(`
        SELECT
          COUNT(*) as total_campaigns,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as active_campaigns,
          COALESCE(SUM(sent), 0) as total_sent,
          COALESCE(SUM(opened), 0) as total_opened,
          COALESCE(SUM(replied), 0) as total_replied
        FROM outreach_campaigns
      `).get() as Record<string, number>;
      outreachStats = {
        totalCampaigns: oRow.total_campaigns || 0,
        activeCampaigns: oRow.active_campaigns || 0,
        totalSent: oRow.total_sent || 0,
        totalOpened: oRow.total_opened || 0,
        totalReplied: oRow.total_replied || 0,
        openRate: oRow.total_sent > 0 ? Math.round((oRow.total_opened / oRow.total_sent) * 100) : 0,
        replyRate: oRow.total_sent > 0 ? Math.round((oRow.total_replied / oRow.total_sent) * 100) : 0,
      };
    } catch { /* table may not exist yet */ }

    // MRR stats
    const mrrStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN status IN ('onboarding','active') THEN 1 END) as active_projects,
        COALESCE(SUM(CASE WHEN status IN ('onboarding','active') THEN monthly_value ELSE 0 END), 0) as mrr
      FROM clients
    `).get() as { active_projects: number; mrr: number };

    // Deal health overview
    let dealHealthOverview = { healthy: 0, warning: 0, critical: 0, stale: 0 };
    try {
      const healthCounts = db.prepare(`
        SELECT
          SUM(CASE WHEN deal_health_score >= 80 THEN 1 ELSE 0 END) as healthy,
          SUM(CASE WHEN deal_health_score >= 50 AND deal_health_score < 80 THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN deal_health_score < 50 THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN last_activity_at IS NOT NULL AND julianday('now') - julianday(last_activity_at) > 7 THEN 1 ELSE 0 END) as stale
        FROM leads
        WHERE status IN ('qualified', 'akquise') AND contact_status NOT IN ('won', 'lost')
      `).get() as Record<string, number>;
      dealHealthOverview = {
        healthy: healthCounts.healthy || 0,
        warning: healthCounts.warning || 0,
        critical: healthCounts.critical || 0,
        stale: healthCounts.stale || 0,
      };
    } catch { /* columns may not exist yet */ }

    // Open invoices count
    let openInvoices = { count: 0, totalAmount: 0 };
    try {
      const invStats = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total_amount
        FROM invoices WHERE status IN ('sent', 'viewed', 'overdue')
      `).get() as { count: number; total_amount: number };
      openInvoices = { count: invStats.count || 0, totalAmount: invStats.total_amount || 0 };
    } catch { /* table may not exist yet */ }

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
      inbox: {
        total: inboxStats.total || 0,
        unread: inboxStats.unread || 0,
        thisWeek: inboxStats.this_week || 0,
        recent: recentReplies,
      },
      hotLeads,
      recentScans,
      followUps: {
        dueNow: followUpStats.due_now || 0,
        pending: followUpStats.pending || 0,
        sent: followUpStats.sent || 0,
        cancelled: followUpStats.cancelled || 0,
        sentThisWeek: followUpStats.sent_this_week || 0,
        next: nextFollowUps,
      },
      pendingFollowUps: followUpStats.due_now || 0,
      mrr: {
        activeProjects: mrrStats.active_projects || 0,
        currentMrr: mrrStats.mrr || 0,
        annualProjection: (mrrStats.mrr || 0) * 12,
      },
      outreach: outreachStats,
      engagement: {
        distribution: {
          hot: engagementDist.hot || 0,
          warm: engagementDist.warm || 0,
          cool: engagementDist.cool || 0,
          cold: engagementDist.cold || 0,
        },
        topLeads: topEngaged.map(l => ({
          ...l,
          engagement_signals: (() => { try { return JSON.parse(l.engagement_signals); } catch { return {}; } })(),
        })),
      },
      dealHealth: dealHealthOverview,
      openInvoices,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Stats-Fehler' }, { status: 500 });
  }
}
