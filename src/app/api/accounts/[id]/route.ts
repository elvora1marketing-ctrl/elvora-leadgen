import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getAccountStats } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(params.id);
  if (!account) {
    return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 });
  }

  const stats = getAccountStats(Number(params.id));
  const blacklistCount = (db.prepare('SELECT COUNT(*) as cnt FROM account_blacklists WHERE account_id = ?').get(params.id) as { cnt: number }).cnt;

  return NextResponse.json({ ...account, stats, blacklistCount });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM accounts WHERE id = ?').get(params.id);
  if (!existing) {
    return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 });
  }

  const body = await request.json();
  const allowed = ['name', 'company', 'contact_name', 'contact_email', 'contact_phone', 'status',
    'icp_description', 'icp_industries', 'icp_locations', 'icp_company_sizes',
    'onboarding_completed', 'monthly_fee', 'contract_start', 'contract_end', 'notes'];

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(params.id);

  db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(params.id);
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM accounts WHERE id = ?').get(params.id);
  if (!existing) {
    return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 });
  }

  db.prepare('UPDATE leads SET account_id = NULL WHERE account_id = ?').run(params.id);
  db.prepare('UPDATE outreach_campaigns SET account_id = NULL WHERE account_id = ?').run(params.id);
  db.prepare('UPDATE sending_domains SET account_id = NULL WHERE account_id = ?').run(params.id);
  db.prepare('UPDATE sequences SET account_id = NULL WHERE account_id = ?').run(params.id);
  db.prepare('UPDATE invoices SET account_id = NULL WHERE account_id = ?').run(params.id);
  db.prepare('DELETE FROM account_blacklists WHERE account_id = ?').run(params.id);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(params.id);

  return NextResponse.json({ success: true });
}
