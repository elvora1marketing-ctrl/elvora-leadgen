import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const cid = parseInt(id);
    if (isNaN(cid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json() as {
      name?: string; role?: string; email?: string; phone?: string; is_primary?: boolean; notes?: string;
    };
    const db = getDb();
    const existing = db.prepare('SELECT lead_id FROM contacts WHERE id = ?').get(cid) as { lead_id: number } | undefined;
    if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    if (body.is_primary) {
      db.prepare('UPDATE contacts SET is_primary = 0 WHERE lead_id = ?').run(existing.lead_id);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    for (const k of ['name', 'role', 'email', 'phone', 'notes'] as const) {
      if (body[k] !== undefined) { updates.push(`${k} = ?`); values.push(body[k] || null); }
    }
    if (body.is_primary !== undefined) { updates.push('is_primary = ?'); values.push(body.is_primary ? 1 : 0); }
    if (updates.length === 0) return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    values.push(cid);

    db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const cid = parseInt(id);
  if (isNaN(cid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(cid);
  return NextResponse.json({ success: true });
}
