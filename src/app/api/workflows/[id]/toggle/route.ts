import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const wf = db.prepare('SELECT is_active FROM workflows WHERE id = ?').get(params.id) as any;
    if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const newState = wf.is_active ? 0 : 1;
    db.prepare('UPDATE workflows SET is_active = ? WHERE id = ?').run(newState, params.id);

    return NextResponse.json({ id: Number(params.id), is_active: newState });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
