import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Ungültige Task-ID' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!existing) {
      return NextResponse.json({ error: 'Task nicht gefunden' }, { status: 404 });
    }

    const body = await request.json() as {
      title?: string;
      description?: string;
      type?: string;
      due_date?: string;
      due_time?: string;
      is_completed?: boolean;
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title.trim());
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description?.trim() || null);
    }
    if (body.type !== undefined) {
      const validTypes = ['todo', 'call', 'email', 'meeting', 'follow_up'];
      if (validTypes.includes(body.type)) {
        updates.push('type = ?');
        values.push(body.type);
      }
    }
    if (body.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(body.due_date || null);
    }
    if (body.due_time !== undefined) {
      updates.push('due_time = ?');
      values.push(body.due_time || null);
    }
    if (body.is_completed !== undefined) {
      updates.push('is_completed = ?');
      values.push(body.is_completed ? 1 : 0);
      updates.push('completed_at = ?');
      values.push(body.is_completed ? new Date().toISOString() : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(taskId);

    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    return NextResponse.json({ success: true, task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Ungültige Task-ID' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Task nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
