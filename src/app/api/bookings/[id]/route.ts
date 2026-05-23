import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const db = getDb();
    const body = await request.json();
    const { status } = body;

    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Ungültiger Status. Erlaubt: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = db.prepare('SELECT id FROM bookings WHERE id = ?').get(parseInt(id));
    if (!existing) {
      return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
    }

    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, parseInt(id));

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(parseInt(id));
    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Booking update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const db = getDb();

    const existing = db.prepare('SELECT id FROM bookings WHERE id = ?').get(parseInt(id));
    if (!existing) {
      return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
    }

    db.prepare('DELETE FROM bookings WHERE id = ?').run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Booking delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
