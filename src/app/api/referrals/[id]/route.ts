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
    const rid = parseInt(id);
    if (isNaN(rid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status !== undefined) {
      const validStatuses = ['pending', 'contacted', 'won', 'lost'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
      }
      updates.push('status = ?');
      values.push(body.status);
    }

    if (body.deal_value !== undefined) {
      updates.push('deal_value = ?');
      values.push(body.deal_value);
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    }

    values.push(rid);
    const db = getDb();
    const result = db.prepare(`UPDATE referrals SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Empfehlung nicht gefunden' }, { status: 404 });
    }

    const referral = db.prepare('SELECT * FROM referrals WHERE id = ?').get(rid);
    return NextResponse.json({ referral });
  } catch (error) {
    console.error('Referral PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const rid = parseInt(id);
    if (isNaN(rid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();
    const result = db.prepare('DELETE FROM referrals WHERE id = ?').run(rid);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Empfehlung nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Referral DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
