import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ensureDailyReset } from '@/lib/outbound';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    ensureDailyReset(db);

    const totalDomains = db.prepare('SELECT COUNT(*) as c FROM sending_domains').get() as { c: number };
    const activeDomains = db.prepare("SELECT COUNT(*) as c FROM sending_domains WHERE status = 'active'").get() as { c: number };
    const warmingDomains = db.prepare("SELECT COUNT(*) as c FROM sending_domains WHERE status = 'warming'").get() as { c: number };
    const burnedDomains = db.prepare("SELECT COUNT(*) as c FROM sending_domains WHERE status = 'burned'").get() as { c: number };
    const totalInboxes = db.prepare("SELECT COUNT(*) as c FROM sending_inboxes WHERE status = 'active'").get() as { c: number };
    const sentToday = db.prepare('SELECT COALESCE(SUM(sent_today), 0) as c FROM sending_domains').get() as { c: number };
    const dailyCapacity = db.prepare("SELECT COALESCE(SUM(daily_limit), 0) as c FROM sending_domains WHERE status IN ('active', 'warming')").get() as { c: number };
    const totalSent = db.prepare('SELECT COALESCE(SUM(sent_total), 0) as c FROM sending_domains').get() as { c: number };
    const avgHealth = db.prepare("SELECT COALESCE(AVG(health_score), 100) as c FROM sending_domains WHERE status != 'burned'").get() as { c: number };

    return NextResponse.json({
      total_domains: totalDomains.c,
      active_domains: activeDomains.c,
      warming_domains: warmingDomains.c,
      burned_domains: burnedDomains.c,
      total_inboxes: totalInboxes.c,
      sent_today: sentToday.c,
      daily_capacity: dailyCapacity.c,
      total_sent: totalSent.c,
      avg_health: avgHealth.c,
    });
  } catch (error) {
    console.error('Outbound stats error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Statistiken' }, { status: 500 });
  }
}
