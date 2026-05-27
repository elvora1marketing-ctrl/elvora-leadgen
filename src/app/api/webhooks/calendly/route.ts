import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const event = body.event as string | undefined;
  const payload = body.payload as Record<string, unknown> | undefined;

  if (!event || !payload) {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  const db = getDb();

  if (event === 'invitee.created') {
    const email = (payload.email as string || '').toLowerCase();
    const name = payload.name as string || '';
    const scheduledAt = payload.scheduled_event?.start_time as string || '';
    const eventName = payload.scheduled_event?.name as string || 'Meeting';

    if (!email) {
      return NextResponse.json({ ok: true, skipped: 'no email' });
    }

    // Find lead by email
    const lead = db.prepare(`
      SELECT id, name, contact_status FROM leads
      WHERE LOWER(email) = ? OR LOWER(entscheider_email) = ?
      LIMIT 1
    `).get(email, email) as { id: number; name: string; contact_status: string } | undefined;

    if (lead) {
      db.prepare(`
        UPDATE leads SET
          contact_status = 'meeting',
          updated_at = datetime('now')
        WHERE id = ?
      `).run(lead.id);

      // Log activity
      try {
        db.prepare(`
          INSERT INTO lead_activities (lead_id, type, description, created_at)
          VALUES (?, 'meeting_booked', ?, datetime('now'))
        `).run(lead.id, `${eventName} gebucht${scheduledAt ? ' am ' + new Date(scheduledAt).toLocaleDateString('de-DE') : ''}`);
      } catch {}

      // Create task for the meeting
      try {
        db.prepare(`
          INSERT INTO tasks (title, description, due_date, priority, status, lead_id, created_at)
          VALUES (?, ?, ?, 'high', 'pending', ?, datetime('now'))
        `).run(
          `Meeting: ${lead.name}`,
          `${eventName} mit ${name} (${email})`,
          scheduledAt ? scheduledAt.split('T')[0] : null,
          lead.id,
        );
      } catch {}

      return NextResponse.json({ ok: true, leadId: lead.id, action: 'updated' });
    }

    return NextResponse.json({ ok: true, skipped: 'lead not found', email });
  }

  if (event === 'invitee.canceled') {
    const email = (payload.email as string || '').toLowerCase();

    if (email) {
      const lead = db.prepare(`
        SELECT id FROM leads
        WHERE LOWER(email) = ? OR LOWER(entscheider_email) = ?
        LIMIT 1
      `).get(email, email) as { id: number } | undefined;

      if (lead) {
        db.prepare(`
          UPDATE leads SET
            contact_status = 'email_sent',
            updated_at = datetime('now')
          WHERE id = ? AND contact_status = 'meeting'
        `).run(lead.id);

        try {
          db.prepare(`
            INSERT INTO lead_activities (lead_id, type, description, created_at)
            VALUES (?, 'meeting_cancelled', 'Meeting wurde storniert', datetime('now'))
          `).run(lead.id);
        } catch {}

        return NextResponse.json({ ok: true, leadId: lead.id, action: 'cancelled' });
      }
    }

    return NextResponse.json({ ok: true, skipped: 'lead not found' });
  }

  return NextResponse.json({ ok: true, event, ignored: true });
}
