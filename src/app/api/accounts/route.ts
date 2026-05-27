import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getAccountStats, generatePortalToken } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const withStats = url.searchParams.get('stats') === '1';

  let query = 'SELECT * FROM accounts';
  const params: string[] = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';

  const accounts = db.prepare(query).all(...params) as Record<string, unknown>[];

  if (withStats) {
    return NextResponse.json(accounts.map(a => ({
      ...a,
      stats: getAccountStats(a.id as number),
    })));
  }

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { name, company, contact_name, contact_email, contact_phone, monthly_fee, notes, icp_description } = body;

  if (!name) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 });
  }

  const db = getDb();
  const portalToken = generatePortalToken();

  const result = db.prepare(`
    INSERT INTO accounts (name, company, contact_name, contact_email, contact_phone, monthly_fee, notes, icp_description, portal_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, company || null, contact_name || null, contact_email || null, contact_phone || null, monthly_fee || 0, notes || null, icp_description || null, portalToken);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(account, { status: 201 });
}
