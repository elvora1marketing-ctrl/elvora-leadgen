import getDb from '@/lib/db';
import crypto from 'crypto';

export interface Account {
  id: number;
  name: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: 'onboarding' | 'active' | 'paused' | 'churned';
  icp_description: string | null;
  icp_industries: string;
  icp_locations: string;
  icp_company_sizes: string;
  onboarding_completed: number;
  monthly_fee: number;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  portal_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountStats {
  totalLeads: number;
  leadsWithEmail: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalBounced: number;
  activeDomains: number;
  activeSequences: number;
  blacklistCount: number;
  sentToday: number;
  dailyCapacity: number;
}

export function getAccountStats(accountId: number): AccountStats {
  const db = getDb();

  const leadStats = db.prepare(`
    SELECT
      COUNT(*) as totalLeads,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as leadsWithEmail
    FROM leads WHERE account_id = ?
  `).get(accountId) as { totalLeads: number; leadsWithEmail: number };

  const campaignStats = db.prepare(`
    SELECT
      COUNT(*) as totalCampaigns,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeCampaigns
    FROM outreach_campaigns WHERE account_id = ?
  `).get(accountId) as { totalCampaigns: number; activeCampaigns: number };

  const emailStats = db.prepare(`
    SELECT
      COALESCE(SUM(sent_count), 0) as totalSent,
      COALESCE(SUM(open_count), 0) as totalOpened,
      COALESCE(SUM(reply_count), 0) as totalReplied,
      COALESCE(SUM(bounce_count), 0) as totalBounced
    FROM outreach_campaigns WHERE account_id = ?
  `).get(accountId) as { totalSent: number; totalOpened: number; totalReplied: number; totalBounced: number };

  const domainStats = db.prepare(`
    SELECT COUNT(*) as activeDomains
    FROM sending_domains WHERE account_id = ? AND status = 'active'
  `).get(accountId) as { activeDomains: number };

  const sequenceStats = db.prepare(`
    SELECT COUNT(*) as activeSequences
    FROM sequences WHERE account_id = ?
  `).get(accountId) as { activeSequences: number };

  const blacklistCount = (db.prepare(`
    SELECT COUNT(*) as cnt FROM account_blacklists WHERE account_id = ?
  `).get(accountId) as { cnt: number }).cnt;

  const inboxStats = db.prepare(`
    SELECT
      COALESCE(SUM(sent_today), 0) as sentToday,
      COALESCE(SUM(daily_limit), 0) as dailyCapacity
    FROM sending_inboxes
    WHERE domain_id IN (SELECT id FROM sending_domains WHERE account_id = ?)
      AND status = 'active'
  `).get(accountId) as { sentToday: number; dailyCapacity: number };

  return {
    ...leadStats,
    ...campaignStats,
    ...emailStats,
    ...domainStats,
    ...sequenceStats,
    blacklistCount,
    sentToday: inboxStats.sentToday,
    dailyCapacity: inboxStats.dailyCapacity,
  };
}

export function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
