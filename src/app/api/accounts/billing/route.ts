import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();

  const accounts = db.prepare(`
    SELECT a.id, a.name, a.company, a.status, a.monthly_fee, a.contract_start, a.contract_end
    FROM accounts a
    ORDER BY a.monthly_fee DESC
  `).all() as {
    id: number; name: string; company: string | null; status: string;
    monthly_fee: number; contract_start: string | null; contract_end: string | null;
  }[];

  const accountBilling = accounts.map(a => {
    const invoiceStats = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as paid_total,
        COALESCE(SUM(CASE WHEN status = 'sent' OR status = 'draft' THEN total ELSE 0 END), 0) as outstanding,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN total ELSE 0 END), 0) as overdue
      FROM invoices WHERE account_id = ?
    `).get(a.id) as { total_invoices: number; paid_total: number; outstanding: number; overdue: number };

    const campaignStats = db.prepare(`
      SELECT
        COALESCE(SUM(sent_count), 0) as emails_sent,
        COALESCE(SUM(reply_count), 0) as replies
      FROM outreach_campaigns WHERE account_id = ?
    `).get(a.id) as { emails_sent: number; replies: number };

    const leadCount = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE account_id = ?').get(a.id) as { c: number }).c;

    const costPerLead = leadCount > 0 ? invoiceStats.paid_total / leadCount : 0;
    const costPerReply = campaignStats.replies > 0 ? invoiceStats.paid_total / campaignStats.replies : 0;

    return {
      ...a,
      ...invoiceStats,
      emails_sent: campaignStats.emails_sent,
      replies: campaignStats.replies,
      lead_count: leadCount,
      cost_per_lead: Math.round(costPerLead * 100) / 100,
      cost_per_reply: Math.round(costPerReply * 100) / 100,
    };
  });

  const totalMRR = accounts.filter(a => a.status === 'active').reduce((s, a) => s + a.monthly_fee, 0);
  const totalPaid = accountBilling.reduce((s, a) => s + a.paid_total, 0);
  const totalOutstanding = accountBilling.reduce((s, a) => s + a.outstanding, 0);
  const totalOverdue = accountBilling.reduce((s, a) => s + a.overdue, 0);
  const activeAccounts = accounts.filter(a => a.status === 'active').length;
  const arr = totalMRR * 12;

  return NextResponse.json({
    accounts: accountBilling,
    summary: { totalMRR, arr, totalPaid, totalOutstanding, totalOverdue, activeAccounts, totalAccounts: accounts.length },
  });
}
