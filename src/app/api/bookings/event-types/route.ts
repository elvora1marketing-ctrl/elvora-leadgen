import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = request.nextUrl;
    const slug = url.searchParams.get('slug');
    const activeOnly = url.searchParams.get('active');

    if (slug) {
      const et = db.prepare('SELECT * FROM booking_event_types WHERE slug = ?').get(slug);
      if (!et) return NextResponse.json({ error: 'Event-Typ nicht gefunden' }, { status: 404 });
      return NextResponse.json({ eventType: et });
    }

    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const eventTypes = db.prepare(`SELECT * FROM booking_event_types ${where} ORDER BY sort_order, id`).all();
    return NextResponse.json({ eventTypes });
  } catch (error) {
    console.error('Event types fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const db = getDb();
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { name, slug, description, duration, color, location } = body;
      if (!name || !slug) return NextResponse.json({ error: 'Name und Slug sind erforderlich' }, { status: 400 });
      const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM booking_event_types').get() as { m: number | null };
      const result = db.prepare(
        'INSERT INTO booking_event_types (name, slug, description, duration, color, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(name, slug, description || '', duration || 30, color || '#8B5CF6', location || 'Video-Call', (maxOrder.m || 0) + 1);
      const et = db.prepare('SELECT * FROM booking_event_types WHERE id = ?').get(result.lastInsertRowid);
      return NextResponse.json({ eventType: et }, { status: 201 });
    }

    if (action === 'update') {
      const { id, name, slug, description, duration, color, location, is_active, sort_order } = body;
      if (!id) return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 });
      const fields: string[] = [];
      const values: (string | number)[] = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (slug !== undefined) { fields.push('slug = ?'); values.push(slug); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description); }
      if (duration !== undefined) { fields.push('duration = ?'); values.push(duration); }
      if (color !== undefined) { fields.push('color = ?'); values.push(color); }
      if (location !== undefined) { fields.push('location = ?'); values.push(location); }
      if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
      if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
      if (fields.length === 0) return NextResponse.json({ error: 'Keine Felder' }, { status: 400 });
      values.push(id);
      db.prepare(`UPDATE booking_event_types SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      const et = db.prepare('SELECT * FROM booking_event_types WHERE id = ?').get(id);
      return NextResponse.json({ eventType: et });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 });
      db.prepare('DELETE FROM booking_event_types WHERE id = ?').run(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'block-date') {
      const { date, reason } = body;
      if (!date) return NextResponse.json({ error: 'Datum erforderlich' }, { status: 400 });
      db.prepare('INSERT OR IGNORE INTO booking_blocked_dates (date, reason) VALUES (?, ?)').run(date, reason || null);
      return NextResponse.json({ success: true });
    }

    if (action === 'unblock-date') {
      const { date } = body;
      if (!date) return NextResponse.json({ error: 'Datum erforderlich' }, { status: 400 });
      db.prepare('DELETE FROM booking_blocked_dates WHERE date = ?').run(date);
      return NextResponse.json({ success: true });
    }

    if (action === 'blocked-dates') {
      const blocked = db.prepare('SELECT * FROM booking_blocked_dates ORDER BY date').all();
      return NextResponse.json({ blockedDates: blocked });
    }

    return NextResponse.json({ error: 'Ungueltige Aktion' }, { status: 400 });
  } catch (error) {
    console.error('Event types manage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
