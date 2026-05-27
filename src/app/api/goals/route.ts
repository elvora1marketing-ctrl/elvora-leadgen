import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const goals = db.prepare('SELECT * FROM activity_goals ORDER BY activity_type, period').all();
    return NextResponse.json({ goals });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as {
      activity_type: string;
      period: string;
      target: number;
    };

    if (!body.activity_type || !body.period || !body.target) {
      return NextResponse.json({ error: 'activity_type, period, and target are required' }, { status: 400 });
    }

    const validTypes = ['email', 'call', 'meeting', 'note', 'whatsapp'];
    if (!validTypes.includes(body.activity_type)) {
      return NextResponse.json({ error: `Invalid activity_type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const validPeriods = ['daily', 'weekly', 'monthly'];
    if (!validPeriods.includes(body.period)) {
      return NextResponse.json({ error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` }, { status: 400 });
    }

    if (typeof body.target !== 'number' || body.target < 1) {
      return NextResponse.json({ error: 'target must be a positive number' }, { status: 400 });
    }

    // Upsert: update if same activity_type+period exists, otherwise insert
    const existing = db.prepare(
      'SELECT id FROM activity_goals WHERE activity_type = ? AND period = ?'
    ).get(body.activity_type, body.period) as { id: number } | undefined;

    let goal;
    if (existing) {
      db.prepare(
        'UPDATE activity_goals SET target = ? WHERE id = ?'
      ).run(body.target, existing.id);
      goal = db.prepare('SELECT * FROM activity_goals WHERE id = ?').get(existing.id);
    } else {
      const result = db.prepare(
        'INSERT INTO activity_goals (activity_type, period, target) VALUES (?, ?, ?)'
      ).run(body.activity_type, body.period, body.target);
      goal = db.prepare('SELECT * FROM activity_goals WHERE id = ?').get(Number(result.lastInsertRowid));
    }

    return NextResponse.json({ success: true, goal }, { status: existing ? 200 : 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
