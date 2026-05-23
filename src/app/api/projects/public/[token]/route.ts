import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE token = ?').get(token) as Record<string, unknown> | undefined;
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const updates = db.prepare(
      'SELECT * FROM project_updates WHERE project_id = ? AND is_public = 1 ORDER BY created_at ASC'
    ).all(project.id as number);

    const agencySettings: Record<string, string> = {};
    const settingsKeys = ['agency_name', 'agency_email', 'agency_phone', 'agency_address'];
    for (const key of settingsKeys) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row) agencySettings[key] = row.value;
    }

    return NextResponse.json({
      project: {
        title: project.title,
        description: project.description,
        client_name: project.client_name,
        current_phase: project.current_phase,
        phases: project.phases,
        status: project.status,
        start_date: project.start_date,
        estimated_end_date: project.estimated_end_date,
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
      updates,
      agency: agencySettings,
    });
  } catch (error) {
    console.error('Public project error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}
