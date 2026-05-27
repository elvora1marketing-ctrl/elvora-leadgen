import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { buildWhereClause } from '../../route';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

interface SmartListRule {
  field: string;
  op: string;
  value: string | number | string[];
}

interface SmartListRow {
  id: number;
  name: string;
  rules: string;
  match_type: 'all' | 'any';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const listId = parseInt(id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid smart list ID' }, { status: 400 });
    }

    const db = getDb();

    const smartList = db.prepare('SELECT * FROM smart_lists WHERE id = ?').get(listId) as SmartListRow | undefined;
    if (!smartList) {
      return NextResponse.json({ error: 'Smart list not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const rules: SmartListRule[] = JSON.parse(smartList.rules);
    const { sql, params: queryParams } = buildWhereClause(rules, smartList.match_type);

    const leads = db.prepare(`
      SELECT * FROM leads
      WHERE ${sql}
      ORDER BY score DESC, created_at DESC
      LIMIT ?
    `).all(...queryParams, limit);

    // Update lead_count on the smart list
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE ${sql}`).get(...queryParams) as { count: number };
    db.prepare("UPDATE smart_lists SET lead_count = ?, updated_at = datetime('now') WHERE id = ?")
      .run(countResult.count, listId);

    return NextResponse.json({ leads, total: countResult.count });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
