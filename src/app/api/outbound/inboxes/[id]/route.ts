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
    const inboxId = parseInt(id);
    if (isNaN(inboxId)) {
      return NextResponse.json({ error: 'Ungültige Postfach-ID' }, { status: 400 });
    }

    const db = getDb();
    const body = await request.json();

    const inbox = db.prepare('SELECT * FROM sending_inboxes WHERE id = ?').get(inboxId);
    if (!inbox) {
      return NextResponse.json({ error: 'Postfach nicht gefunden' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
    if (body.display_name !== undefined) { updates.push('display_name = ?'); values.push(body.display_name); }
    if (body.daily_limit !== undefined) { updates.push('daily_limit = ?'); values.push(body.daily_limit); }
    if (body.html_signature !== undefined) { updates.push('html_signature = ?'); values.push(body.html_signature); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(inboxId);

    db.prepare(`UPDATE sending_inboxes SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inbox update error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Postfachs' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const inboxId = parseInt(id);
    if (isNaN(inboxId)) {
      return NextResponse.json({ error: 'Ungültige Postfach-ID' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM sending_inboxes WHERE id = ?').run(inboxId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inbox delete error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Postfachs' }, { status: 500 });
  }
}
