import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pid = parseInt(id);
    if (isNaN(pid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    const body = await request.json() as {
      title?: string; amount?: number; status?: string; notes?: string; file_url?: string;
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    for (const k of ['title', 'notes', 'file_url'] as const) {
      if (body[k] !== undefined) { updates.push(`${k} = ?`); values.push(body[k] || null); }
    }
    if (body.amount !== undefined) { updates.push('amount = ?'); values.push(body.amount); }
    if (body.status !== undefined) {
      const valid = ['draft', 'sent', 'viewed', 'accepted', 'rejected'];
      if (valid.includes(body.status)) {
        updates.push('status = ?');
        values.push(body.status);
        if (body.status === 'sent') {
          updates.push('sent_at = ?');
          values.push(new Date().toISOString());
        }
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    updates.push("updated_at = datetime('now')");
    values.push(pid);
    getDb().prepare(`UPDATE proposals SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pid = parseInt(id);
  if (isNaN(pid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  getDb().prepare('DELETE FROM proposals WHERE id = ?').run(pid);
  return NextResponse.json({ success: true });
}
