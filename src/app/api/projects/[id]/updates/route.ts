import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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
    const updates = db.prepare('SELECT * FROM project_updates WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Project updates list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const projectId = parseInt(id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as { id: number; phases: string } | undefined;
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const phase = body.phase || 'update';
    const title = body.title || 'Status-Update';

    db.prepare(
      "INSERT INTO project_updates (project_id, phase, title, description, is_public) VALUES (?, ?, ?, ?, ?)"
    ).run(projectId, phase, title, body.description || null, body.is_public !== undefined ? (body.is_public ? 1 : 0) : 1);

    if (body.phase && body.update_phase !== false) {
      db.prepare("UPDATE projects SET current_phase = ?, updated_at = datetime('now') WHERE id = ?").run(body.phase, projectId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Project update create error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 });
  }
}
