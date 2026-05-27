import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const triggerId = parseInt(id);
    if (isNaN(triggerId)) {
      return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    }

    const body = await request.json() as { is_acted_on?: boolean; is_dismissed?: boolean };
    const db = getDb();

    const updates: string[] = [];
    const values: number[] = [];

    if (body.is_acted_on !== undefined) {
      updates.push('is_acted_on = ?');
      values.push(body.is_acted_on ? 1 : 0);
    }
    if (body.is_dismissed !== undefined) {
      updates.push('is_dismissed = ?');
      values.push(body.is_dismissed ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    }

    values.push(triggerId);
    db.prepare(`UPDATE trigger_events SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
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
    const triggerId = parseInt(id);
    if (isNaN(triggerId)) {
      return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM trigger_events WHERE id = ?').run(triggerId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
