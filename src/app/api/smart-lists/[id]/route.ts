import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { buildWhereClause } from '../route';

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
  lead_count: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Refresh lead count
    const rules: SmartListRule[] = JSON.parse(smartList.rules);
    const { sql, params: queryParams } = buildWhereClause(rules, smartList.match_type);
    const result = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE ${sql}`).get(...queryParams) as { count: number };
    const leadCount = result.count;

    db.prepare("UPDATE smart_lists SET lead_count = ?, updated_at = datetime('now') WHERE id = ?")
      .run(leadCount, listId);

    return NextResponse.json({ smart_list: { ...smartList, lead_count: leadCount } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listId = parseInt(id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid smart list ID' }, { status: 400 });
    }

    const db = getDb();

    const existing = db.prepare('SELECT * FROM smart_lists WHERE id = ?').get(listId);
    if (!existing) {
      return NextResponse.json({ error: 'Smart list not found' }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      rules?: SmartListRule[];
      match_type?: 'all' | 'any';
      icon?: string;
      color?: string;
      is_pinned?: boolean;
    };

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.rules !== undefined) {
      updates.push('rules = ?');
      values.push(JSON.stringify(body.rules));
    }
    if (body.match_type !== undefined) {
      updates.push('match_type = ?');
      values.push(body.match_type);
    }
    if (body.icon !== undefined) {
      updates.push('icon = ?');
      values.push(body.icon);
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      values.push(body.color);
    }
    if (body.is_pinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(body.is_pinned ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(listId);

    db.prepare(`UPDATE smart_lists SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Refresh lead count with latest rules
    const updated = db.prepare('SELECT * FROM smart_lists WHERE id = ?').get(listId) as SmartListRow;
    const rules: SmartListRule[] = JSON.parse(updated.rules);
    const { sql, params: queryParams } = buildWhereClause(rules, updated.match_type);
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE ${sql}`).get(...queryParams) as { count: number };

    db.prepare('UPDATE smart_lists SET lead_count = ? WHERE id = ?').run(countResult.count, listId);

    const smartList = db.prepare('SELECT * FROM smart_lists WHERE id = ?').get(listId);

    return NextResponse.json({ success: true, smart_list: smartList });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listId = parseInt(id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid smart list ID' }, { status: 400 });
    }

    const db = getDb();

    const existing = db.prepare('SELECT * FROM smart_lists WHERE id = ?').get(listId);
    if (!existing) {
      return NextResponse.json({ error: 'Smart list not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM smart_lists WHERE id = ?').run(listId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
