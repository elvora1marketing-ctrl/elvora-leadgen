import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getAccountStats } from '@/lib/accounts';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(params.id);
  if (!account) {
    return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 });
  }

  const stats = getAccountStats(Number(params.id));

  const campaigns = db.prepare(`
    SELECT id, name, status, sent_count, open_count, reply_count, bounce_count, created_at
    FROM outreach_campaigns WHERE account_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(params.id);

  const domains = db.prepare(`
    SELECT id, domain, status, health_score, warm_current_day, sent_today, daily_limit, sent_total, created_at
    FROM sending_domains WHERE account_id = ?
    ORDER BY created_at DESC
  `).all(params.id);

  const recentLeads = db.prepare(`
    SELECT id, name, email, company, city, contact_status, score, created_at
    FROM leads WHERE account_id = ?
    ORDER BY created_at DESC LIMIT 15
  `).all(params.id);

  const sequences = db.prepare(`
    SELECT s.id, s.name, s.status,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_count,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'completed') as completed_count,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'replied') as replied_count
    FROM sequences s WHERE s.account_id = ?
    ORDER BY s.created_at DESC
  `).all(params.id);

  // Daily send volume for last 7 days (from campaign leads)
  const dailySends = db.prepare(`
    SELECT DATE(sent_at) as day, COUNT(*) as count
    FROM outreach_campaign_leads ocl
    JOIN outreach_campaigns oc ON ocl.campaign_id = oc.id
    WHERE oc.account_id = ? AND ocl.status = 'sent' AND sent_at >= date('now', '-7 days')
    GROUP BY DATE(sent_at)
    ORDER BY day ASC
  `).all(params.id);

  return NextResponse.json({ account, stats, campaigns, domains, recentLeads, sequences, dailySends });
}
