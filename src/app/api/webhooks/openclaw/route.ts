import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import getDb from '@/lib/db';

interface OpenClawEvent {
  type: 'message_received' | 'lead_replied' | 'appointment_booked' | 'lead_status_change';
  channel: 'whatsapp' | 'email' | 'telegram' | 'webchat';
  lead_id?: number;
  lead_email?: string;
  lead_phone?: string;
  message?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  new_status?: string;
  appointment_date?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const event: OpenClawEvent = await request.json();
    const db = getDb();

    // Find lead by ID, email, or phone
    let leadId = event.lead_id;
    if (!leadId && event.lead_email) {
      const row = db.prepare('SELECT id FROM leads WHERE email = ?').get(event.lead_email) as { id: number } | undefined;
      if (row) leadId = row.id;
    }
    if (!leadId && event.lead_phone) {
      const row = db.prepare('SELECT id FROM leads WHERE phone_normalized = ? OR phone = ?').get(event.lead_phone, event.lead_phone) as { id: number } | undefined;
      if (row) leadId = row.id;
    }

    if (!leadId) {
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    switch (event.type) {
      case 'message_received':
      case 'lead_replied': {
        // Lead hat geantwortet -> Status updaten + Follow-Ups canceln
        const newStatus = event.sentiment === 'positive' ? 'called' : 'email_sent';

        db.prepare(
          "UPDATE leads SET contact_status = ?, notes = COALESCE(notes, '') || ?, updated_at = datetime('now') WHERE id = ?"
        ).run(
          newStatus,
          `\n[${event.channel?.toUpperCase() || 'OPENCLAW'} ${new Date().toISOString().slice(0, 16)}] ${event.message || 'Antwort erhalten'}`,
          leadId
        );

        // Cancel pending follow-ups if lead replied positively
        if (event.sentiment === 'positive' || event.sentiment === 'neutral') {
          db.prepare(
            "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
          ).run(leadId);
        }

        return NextResponse.json({
          success: true,
          action: 'lead_updated',
          lead_id: leadId,
          new_status: newStatus,
          followups_cancelled: event.sentiment !== 'negative',
        });
      }

      case 'appointment_booked': {
        db.prepare(
          "UPDATE leads SET contact_status = 'meeting', followup_date = ?, notes = COALESCE(notes, '') || ?, updated_at = datetime('now') WHERE id = ?"
        ).run(
          event.appointment_date || null,
          `\n[TERMIN ${new Date().toISOString().slice(0, 16)}] Termin gebucht via ${event.channel || 'OpenClaw'}`,
          leadId
        );

        // Cancel all pending follow-ups
        db.prepare(
          "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
        ).run(leadId);

        return NextResponse.json({
          success: true,
          action: 'appointment_recorded',
          lead_id: leadId,
        });
      }

      case 'lead_status_change': {
        if (!event.new_status) {
          return NextResponse.json({ error: 'new_status fehlt' }, { status: 400 });
        }

        const validStatuses = ['not_contacted', 'email_sent', 'called', 'meeting', 'proposal', 'won', 'lost'];
        if (!validStatuses.includes(event.new_status)) {
          return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        db.prepare(
          "UPDATE leads SET contact_status = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(event.new_status, leadId);

        // Cancel follow-ups if lead is won/lost/meeting
        if (['meeting', 'proposal', 'won', 'lost'].includes(event.new_status)) {
          db.prepare(
            "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
          ).run(leadId);
        }

        return NextResponse.json({
          success: true,
          action: 'status_changed',
          lead_id: leadId,
          new_status: event.new_status,
        });
      }

      default:
        return NextResponse.json({ error: `Unbekannter Event-Typ: ${event.type}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('OpenClaw webhook error:', error);
    return NextResponse.json({ error: 'Webhook-Verarbeitung fehlgeschlagen' }, { status: 500 });
  }
}
