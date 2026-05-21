import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = getDb();

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(sent), 0) as total_sent,
        COALESCE(SUM(opened), 0) as total_opened,
        COALESCE(SUM(replied), 0) as total_replied,
        COALESCE(SUM(bounced), 0) as total_bounced,
        COALESCE(SUM(clicked), 0) as total_clicked,
        COALESCE(SUM(failed), 0) as total_failed,
        COALESCE(SUM(skipped), 0) as total_skipped,
        COUNT(*) as total_campaigns
      FROM outreach_campaigns
    `).get() as Record<string, number>;

    const emailTracking = db.prepare(`
      SELECT
        COUNT(*) as total_tracked,
        SUM(CASE WHEN open_count > 0 THEN 1 ELSE 0 END) as tracked_opened
      FROM email_tracking
    `).get() as { total_tracked: number; tracked_opened: number };

    const emailEvents = db.prepare(`
      SELECT
        event_type,
        COUNT(*) as count
      FROM email_events
      GROUP BY event_type
    `).all() as { event_type: string; count: number }[];

    const eventMap: Record<string, number> = {};
    emailEvents.forEach(e => { eventMap[e.event_type] = e.count; });

    const recentCampaigns = db.prepare(`
      SELECT id, name, status, lead_count, sent, opened, replied, bounced, mails_per_hour,
        schedule_type, subject_variant_b, ab_split, created_at, started_at, completed_at
      FROM outreach_campaigns
      ORDER BY created_at DESC
      LIMIT 10
    `).all() as Array<Record<string, unknown>>;

    const dailySends = db.prepare(`
      SELECT
        date(created_at) as day,
        COUNT(*) as count
      FROM email_tracking
      WHERE date(created_at) >= date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all() as { day: string; count: number }[];

    const contactStatusDist = db.prepare(`
      SELECT contact_status, COUNT(*) as count
      FROM leads
      WHERE contact_status IN ('email_sent','called','meeting','proposal','won','lost')
      GROUP BY contact_status
    `).all() as { contact_status: string; count: number }[];

    const blacklistCount = (db.prepare('SELECT COUNT(*) as c FROM email_blacklist').get() as { c: number }).c;

    const totalSent = totals.total_sent || emailTracking.total_tracked || 0;
    const totalOpened = totals.total_opened || emailTracking.tracked_opened || 0;
    const totalReplied = totals.total_replied || eventMap['replied'] || 0;
    const totalBounced = totals.total_bounced || eventMap['bounced'] || 0;

    return NextResponse.json({
      overview: {
        totalSent,
        totalOpened,
        totalReplied,
        totalBounced,
        totalCampaigns: totals.total_campaigns || 0,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
        replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
        bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0,
        blacklisted: blacklistCount,
      },
      events: eventMap,
      recentCampaigns: recentCampaigns.map(c => ({
        ...c,
        ab_split: !!(c.ab_split as number),
        openRate: (c.sent as number) > 0 ? Math.round(((c.opened as number) / (c.sent as number)) * 100) : 0,
        replyRate: (c.sent as number) > 0 ? Math.round(((c.replied as number) / (c.sent as number)) * 100) : 0,
      })),
      dailySends,
      contactStatusDist,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
