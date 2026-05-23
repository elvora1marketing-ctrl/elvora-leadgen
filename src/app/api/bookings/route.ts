import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = request.nextUrl;
    const status = url.searchParams.get('status');
    const date = url.searchParams.get('date');

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (status) {
      conditions.push('b.status = ?');
      values.push(status);
    }
    if (date) {
      conditions.push('b.date = ?');
      values.push(date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const bookings = db.prepare(`
      SELECT b.*, l.name as lead_name, l.city as lead_city
      FROM bookings b
      LEFT JOIN leads l ON b.lead_id = l.id
      ${where}
      ORDER BY b.date DESC, b.time_slot ASC
    `).all(...values);

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, email, phone, date, time_slot, message, lead_id } = body;

    if (!name || !date || !time_slot) {
      return NextResponse.json(
        { error: 'Name, Datum und Zeitslot sind erforderlich' },
        { status: 400 }
      );
    }

    // Check slot is available (no existing confirmed booking for same date+time_slot)
    const existing = db.prepare(
      "SELECT id FROM bookings WHERE date = ? AND time_slot = ? AND status = 'confirmed'"
    ).get(date, time_slot) as { id: number } | undefined;

    if (existing) {
      return NextResponse.json(
        { error: 'Dieser Zeitslot ist bereits gebucht' },
        { status: 409 }
      );
    }

    // Get duration from settings
    const durationSetting = db.prepare(
      "SELECT value FROM settings WHERE key = 'booking_duration'"
    ).get() as { value: string } | undefined;
    const duration = durationSetting ? parseInt(durationSetting.value) : 30;

    const token = crypto.randomUUID();

    const result = db.prepare(`
      INSERT INTO bookings (lead_id, name, email, phone, date, time_slot, duration, message, status, token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(
      lead_id || null,
      name,
      email || null,
      phone || null,
      date,
      time_slot,
      duration,
      message || null,
      token
    );

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error('Booking create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
