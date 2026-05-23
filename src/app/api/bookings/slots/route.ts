import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = request.nextUrl;
    const date = url.searchParams.get('date');

    if (!date) {
      // Return all slots for admin
      const slots = db.prepare('SELECT * FROM booking_slots ORDER BY day_of_week, start_time').all();
      return NextResponse.json({ slots });
    }

    // Calculate day_of_week from date (0=Mon in our schema)
    const dateObj = new Date(date + 'T00:00:00');
    // JS: 0=Sun, 1=Mon...6=Sat  ->  Our schema: 0=Mon...4=Fri
    const jsDay = dateObj.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert: Sun=6, Mon=0, Tue=1, etc.

    // Get active slots for this day
    const slots = db.prepare(
      'SELECT * FROM booking_slots WHERE day_of_week = ? AND is_active = 1 ORDER BY start_time'
    ).all(dayOfWeek) as { id: number; day_of_week: number; start_time: string; end_time: string; is_active: number }[];

    // Get already-booked time_slots for this date
    const booked = db.prepare(
      "SELECT time_slot FROM bookings WHERE date = ? AND status = 'confirmed'"
    ).all(date) as { time_slot: string }[];
    const bookedSet = new Set(booked.map(b => b.time_slot));

    // Filter out booked slots
    const available = slots.filter(s => !bookedSet.has(s.start_time));

    // Get booking settings
    const settingKeys = ['booking_enabled', 'booking_duration', 'booking_buffer', 'booking_advance_days', 'booking_page_title', 'booking_page_description'];
    const settings: Record<string, string> = {};
    for (const key of settingKeys) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row) settings[key] = row.value;
    }

    return NextResponse.json({ slots: available, settings });
  } catch (error) {
    console.error('Slots fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { day_of_week, start_time, end_time } = body;
      if (day_of_week === undefined || !start_time || !end_time) {
        return NextResponse.json({ error: 'day_of_week, start_time und end_time sind erforderlich' }, { status: 400 });
      }
      const result = db.prepare(
        'INSERT INTO booking_slots (day_of_week, start_time, end_time, is_active) VALUES (?, ?, ?, 1)'
      ).run(day_of_week, start_time, end_time);
      const slot = db.prepare('SELECT * FROM booking_slots WHERE id = ?').get(result.lastInsertRowid);
      return NextResponse.json({ slot }, { status: 201 });
    }

    if (action === 'update') {
      const { id, is_active, start_time, end_time } = body;
      if (!id) {
        return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 });
      }
      const fields: string[] = [];
      const values: (string | number)[] = [];
      if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
      if (start_time) { fields.push('start_time = ?'); values.push(start_time); }
      if (end_time) { fields.push('end_time = ?'); values.push(end_time); }
      if (fields.length === 0) {
        return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 });
      }
      values.push(id);
      db.prepare(`UPDATE booking_slots SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      const slot = db.prepare('SELECT * FROM booking_slots WHERE id = ?').get(id);
      return NextResponse.json({ slot });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 });
      }
      db.prepare('DELETE FROM booking_slots WHERE id = ?').run(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error) {
    console.error('Slots manage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
