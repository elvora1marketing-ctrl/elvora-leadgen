import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM leads WHERE account_id = ?').get(params.id) as { cnt: number }).cnt;
  const leads = db.prepare('SELECT * FROM leads WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(params.id, limit, offset);

  return NextResponse.json({ leads, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const body = await request.json();
  const { leadIds } = body as { leadIds: number[] };

  if (!leadIds?.length) {
    return NextResponse.json({ error: 'Lead-IDs erforderlich' }, { status: 400 });
  }

  const stmt = db.prepare('UPDATE leads SET account_id = ? WHERE id = ?');
  let updated = 0;
  for (const id of leadIds) {
    const r = stmt.run(params.id, id);
    updated += r.changes;
  }

  return NextResponse.json({ updated });
}
