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

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(parseInt(id)) as {
      id: number; lead_id: number | null; name: string; email: string | null; phone: string | null;
    };

    // Review Autopilot: when a booking is completed, schedule a review request
    if (status === 'completed') {
      try {
        const getSetting = (k: string) =>
          (db.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined)?.value ?? '';

        if (getSetting('review_autopilot_enabled') === '1') {
          // Don't double-schedule for the same booking
          const already = db.prepare('SELECT id FROM review_requests WHERE booking_id = ?').get(booking.id);

          // Fall back to the linked lead for contact details if the booking lacks them
          let email = booking.email || '';
          let phone = booking.phone || '';
          if ((!email || !phone) && booking.lead_id) {
            const lead = db.prepare('SELECT email, phone, phone_normalized FROM leads WHERE id = ?').get(booking.lead_id) as
              | { email: string; phone: string; phone_normalized: string }
              | undefined;
            if (lead) {
              email = email || lead.email || '';
              phone = phone || lead.phone_normalized || lead.phone || '';
            }
          }

          const channel = getSetting('review_autopilot_channel') || 'email';
          const hasContact = channel === 'whatsapp' ? !!phone : !!email;

          if (!already && hasContact) {
            const delayHours = parseInt(getSetting('review_autopilot_delay_hours') || '24', 10) || 24;
            db.prepare(`
              INSERT INTO review_requests (booking_id, lead_id, customer_name, customer_email, customer_phone, channel, scheduled_at, status)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now', ? || ' hours'), 'pending')
            `).run(
              booking.id,
              booking.lead_id || null,
              booking.name || '',
              email,
              phone,
              channel,
              String(delayHours)
            );
          }
        }
      } catch (e) {
        console.error('[bookings] review request scheduling failed:', e);
      }
    }

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
