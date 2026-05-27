import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getAccountStats, type Account } from '@/lib/accounts';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const db = getDb();

  const account = db.prepare('SELECT * FROM accounts WHERE portal_token = ?').get(params.token) as Account | undefined;
  if (!account) {
    return NextResponse.json({ error: 'Portal nicht gefunden' }, { status: 404 });
  }

  const stats = getAccountStats(account.id);

  const campaigns = db.prepare(`
    SELECT id, name, status, sent_count, open_count, reply_count, bounce_count, created_at
    FROM outreach_campaigns WHERE account_id = ?
    ORDER BY created_at DESC LIMIT 10
  `).all(account.id);

  return NextResponse.json({
    account: {
      name: account.name,
      company: account.company,
      status: account.status,
    },
    stats,
    campaigns,
  });
}
