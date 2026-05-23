import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');
    const dueBefore = searchParams.get('due_before');
    const completed = searchParams.get('completed');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (leadId) {
      conditions.push('t.lead_id = ?');
      params.push(parseInt(leadId));
    }
    if (dueBefore) {
      conditions.push('t.due_date <= ?');
      params.push(dueBefore);
    }
    if (completed === '0') {
      conditions.push('t.is_completed = 0');
    } else if (completed === '1') {
      conditions.push('t.is_completed = 1');
    }
    if (type) {
      conditions.push('t.type = ?');
      params.push(type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const tasks = db.prepare(`
      SELECT t.*, l.name as lead_name, l.city as lead_city
      FROM tasks t
      LEFT JOIN leads l ON t.lead_id = l.id
      ${where}
      ORDER BY t.is_completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC
      LIMIT ?
    `).all(...params);

    const counts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN is_completed = 0 AND due_date <= date('now') AND due_date IS NOT NULL THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN is_completed = 0 AND due_date = date('now') THEN 1 ELSE 0 END) as due_today
      FROM tasks
    `).get() as { total: number; open: number; overdue: number; due_today: number };

    return NextResponse.json({ tasks, counts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as {
      lead_id?: number;
      title: string;
      description?: string;
      type?: string;
      due_date?: string;
      due_time?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 });
    }

    const validTypes = ['todo', 'call', 'email', 'meeting', 'follow_up'];
    const type = body.type && validTypes.includes(body.type) ? body.type : 'todo';

    const result = db.prepare(`
      INSERT INTO tasks (lead_id, title, description, type, due_date, due_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      body.lead_id || null,
      body.title.trim(),
      body.description?.trim() || null,
      type,
      body.due_date || null,
      body.due_time || null,
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
