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
    const stage = searchParams.get('stage');

    let playbooks;
    if (stage) {
      playbooks = db.prepare(
        'SELECT * FROM playbooks WHERE is_active = 1 AND stage = ? ORDER BY id ASC'
      ).all(stage);
    } else {
      playbooks = db.prepare(
        'SELECT * FROM playbooks WHERE is_active = 1 ORDER BY id ASC'
      ).all();
    }

    return NextResponse.json({ playbooks });
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
      name: string;
      stage: string;
      content: {
        checklist?: string[];
        questions?: string[];
        objections?: { objection: string; response: string }[];
        materials?: string[];
        next_step?: string;
      };
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 });
    }
    if (!body.stage?.trim()) {
      return NextResponse.json({ error: 'Stage erforderlich' }, { status: 400 });
    }
    if (!body.content) {
      return NextResponse.json({ error: 'Content erforderlich' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO playbooks (name, stage, content) VALUES (?, ?, ?)
    `).run(
      body.name.trim(),
      body.stage.trim(),
      JSON.stringify(body.content),
    );

    const playbook = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, playbook }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
