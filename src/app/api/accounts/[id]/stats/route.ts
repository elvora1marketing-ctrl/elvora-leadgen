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
    SELECT id, domain, status, created_at
    FROM sending_domains WHERE account_id = ?
    ORDER BY created_at DESC
  `).all(params.id);

  return NextResponse.json({ account, stats, campaigns, domains });
}
