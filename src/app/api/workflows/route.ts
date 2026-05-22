import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const workflows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all();
    return NextResponse.json(workflows);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, trigger_type, trigger_config, conditions, actions } = body;

    if (!name || !trigger_type) {
      return NextResponse.json({ error: 'Name und Trigger-Typ erforderlich' }, { status: 400 });
    }

    const result = db.prepare(
      'INSERT INTO workflows (name, trigger_type, trigger_config, conditions, actions) VALUES (?, ?, ?, ?, ?)'
    ).run(
      name,
      trigger_type,
      JSON.stringify(trigger_config || {}),
      JSON.stringify(conditions || []),
      JSON.stringify(actions || [])
    );

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(workflow, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}
