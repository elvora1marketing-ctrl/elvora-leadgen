import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Ungültige Projekt-ID' }, { status: 400 });
    }
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }
    const updates = db.prepare('SELECT * FROM project_updates WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return NextResponse.json({ project, updates });
  } catch (error) {
    console.error('Project detail error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Ungültige Projekt-ID' }, { status: 400 });
    }
    const db = getDb();
    const body = await request.json();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
    if (body.client_name !== undefined) { updates.push('client_name = ?'); values.push(body.client_name); }
    if (body.client_email !== undefined) { updates.push('client_email = ?'); values.push(body.client_email); }
    if (body.client_phone !== undefined) { updates.push('client_phone = ?'); values.push(body.client_phone); }
    if (body.status !== undefined) {
      const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updates.push('status = ?'); values.push(body.status);
    }
    if (body.current_phase !== undefined) { updates.push('current_phase = ?'); values.push(body.current_phase); }
    if (body.phases !== undefined) { updates.push('phases = ?'); values.push(JSON.stringify(body.phases)); }
    if (body.total_value !== undefined) { updates.push('total_value = ?'); values.push(body.total_value); }
    if (body.start_date !== undefined) { updates.push('start_date = ?'); values.push(body.start_date); }
    if (body.estimated_end_date !== undefined) { updates.push('estimated_end_date = ?'); values.push(body.estimated_end_date); }
    if (body.notes !== undefined) { updates.push('notes = ?'); values.push(body.notes); }

    if (body.status === 'completed') {
      updates.push("completed_at = datetime('now')");
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(projectId);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Project update error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Ungültige Projekt-ID' }, { status: 400 });
    }
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Project delete error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
