import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const sequences = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_count,
        (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'completed') as completed_count_live,
        (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'replied') as reply_count_live
      FROM sequences s
      ${accountId ? 'WHERE s.account_id = ?' : ''}
      ORDER BY s.created_at DESC
    `).all(...(accountId ? [accountId] : []));

    return NextResponse.json({ sequences });
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
      name: string;
      steps: Array<{
        type: 'email' | 'task';
        delay_days: number;
        subject?: string;
        body?: string;
        task_type?: string;
        title?: string;
        use_ai?: boolean;
      }>;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json({ error: 'At least one step is required' }, { status: 400 });
    }

    for (const step of body.steps) {
      if (!['email', 'task'].includes(step.type)) {
        return NextResponse.json({ error: 'Step type must be "email" or "task"' }, { status: 400 });
      }
      if (typeof step.delay_days !== 'number' || step.delay_days < 0) {
        return NextResponse.json({ error: 'delay_days must be a non-negative number' }, { status: 400 });
      }
    }

    const result = db.prepare(`
      INSERT INTO sequences (name, steps, account_id)
      VALUES (?, ?, ?)
    `).run(body.name.trim(), JSON.stringify(body.steps), (body as Record<string, unknown>).accountId || null);

    const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(Number(result.lastInsertRowid));

    return NextResponse.json({ success: true, sequence }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
