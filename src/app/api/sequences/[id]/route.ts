import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sequenceId = parseInt(id);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: 'Invalid sequence ID' }, { status: 400 });
    }

    const db = getDb();

    const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId);
    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const enrollments = db.prepare(`
      SELECT se.*, l.name as lead_name
      FROM sequence_enrollments se
      LEFT JOIN leads l ON se.lead_id = l.id
      WHERE se.sequence_id = ?
      ORDER BY se.started_at DESC
    `).all(sequenceId);

    return NextResponse.json({ sequence, enrollments });
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
    const sequenceId = parseInt(id);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: 'Invalid sequence ID' }, { status: 400 });
    }

    const db = getDb();

    const existing = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId);
    if (!existing) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      steps?: Array<{
        type: 'email' | 'task';
        delay_days: number;
        subject?: string;
        body?: string;
        task_type?: string;
        title?: string;
        use_ai?: boolean;
      }>;
      is_active?: number;
    };

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.steps !== undefined) {
      updates.push('steps = ?');
      values.push(JSON.stringify(body.steps));
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(sequenceId);
    db.prepare(`UPDATE sequences SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId);

    return NextResponse.json({ success: true, sequence });
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
    const sequenceId = parseInt(id);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: 'Invalid sequence ID' }, { status: 400 });
    }

    const db = getDb();

    const existing = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId);
    if (!existing) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM sequence_enrollments WHERE sequence_id = ?').run(sequenceId);
    db.prepare('DELETE FROM sequences WHERE id = ?').run(sequenceId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
