import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(params.id);
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const logs = db.prepare(
      'SELECT wl.*, l.name as lead_name FROM workflow_logs wl LEFT JOIN leads l ON wl.lead_id = l.id WHERE wl.workflow_id = ? ORDER BY wl.created_at DESC LIMIT 50'
    ).all(params.id);

    return NextResponse.json({ ...workflow as any, logs });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const body = await request.json();
    const fields: string[] = [];
    const values: any[] = [];

    for (const key of ['name', 'trigger_type']) {
      if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(body[key]); }
    }
    for (const key of ['trigger_config', 'conditions', 'actions']) {
      if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(JSON.stringify(body[key])); }
    }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(params.id);
    db.prepare(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(params.id);
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    db.prepare('DELETE FROM workflows WHERE id = ?').run(params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
