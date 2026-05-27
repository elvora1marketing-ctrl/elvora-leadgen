import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const playbookId = parseInt(id);
    if (isNaN(playbookId)) {
      return NextResponse.json({ error: 'Ungültige Playbook-ID' }, { status: 400 });
    }

    const db = getDb();
    const playbook = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(playbookId);
    if (!playbook) {
      return NextResponse.json({ error: 'Playbook nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ playbook });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
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
    const playbookId = parseInt(id);
    if (isNaN(playbookId)) {
      return NextResponse.json({ error: 'Ungültige Playbook-ID' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM playbooks WHERE id = ?').get(playbookId);
    if (!existing) {
      return NextResponse.json({ error: 'Playbook nicht gefunden' }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      stage?: string;
      content?: {
        checklist?: string[];
        questions?: string[];
        objections?: { objection: string; response: string }[];
        materials?: string[];
        next_step?: string;
      };
      is_active?: boolean;
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.stage !== undefined) {
      updates.push('stage = ?');
      values.push(body.stage.trim());
    }
    if (body.content !== undefined) {
      updates.push('content = ?');
      values.push(JSON.stringify(body.content));
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
    }

    values.push(playbookId);
    db.prepare(`UPDATE playbooks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const playbook = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(playbookId);
    return NextResponse.json({ success: true, playbook });
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
    const playbookId = parseInt(id);
    if (isNaN(playbookId)) {
      return NextResponse.json({ error: 'Ungültige Playbook-ID' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare('DELETE FROM playbooks WHERE id = ?').run(playbookId);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Playbook nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
