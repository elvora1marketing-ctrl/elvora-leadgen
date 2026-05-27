import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

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
