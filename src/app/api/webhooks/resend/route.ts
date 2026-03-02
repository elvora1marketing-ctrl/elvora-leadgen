import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

/**
 * Resend Webhook for outbound email events
 * Configure in Resend Dashboard → Webhooks → Add Endpoint
 * Events: email.delivered, email.opened, email.clicked, email.bounced, email.complained
 */

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // bounce-specific
    bounce?: { message: string; type: string };
    // click-specific
    click?: { link: string; timestamp: string };
  };
}

const EVENT_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'failed',
};

export async function POST(request: NextRequest) {
  try {
    const body: ResendWebhookPayload = await request.json();

    const eventType = EVENT_MAP[body.type];
    if (!eventType) {
      // Unknown event type, acknowledge but ignore
      return NextResponse.json({ received: true });
    }

    const db = getDb();
    const recipientEmail = body.data.to?.[0];

    // Find lead by email
    let leadId: number | null = null;
    if (recipientEmail) {
      const lead = db.prepare('SELECT id FROM leads WHERE email = ?').get(recipientEmail) as { id: number } | undefined;
      if (lead) leadId = lead.id;
    }

    // Store event
    db.prepare(
      'INSERT INTO email_events (lead_id, event_type, payload) VALUES (?, ?, ?)'
    ).run(leadId, eventType, JSON.stringify(body.data));

    // Handle specific events
    if (eventType === 'bounced' && leadId) {
      // Mark lead email as bounced - cancel follow-ups
      db.prepare(
        "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
      ).run(leadId);

      db.prepare(
        "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
      ).run(leadId, 'Email Bounce - Follow-Ups gestoppt', JSON.stringify({ auto: true, bounce: body.data.bounce }));
    }

    if (eventType === 'complained' && leadId) {
      // Spam complaint - cancel follow-ups, mark lead
      db.prepare(
        "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
      ).run(leadId);

      db.prepare(
        "UPDATE leads SET contact_status = 'lost', notes = COALESCE(notes, '') || '\n[SPAM] Lead hat Email als Spam markiert', updated_at = datetime('now') WHERE id = ?"
      ).run(leadId);

      db.prepare(
        "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
      ).run(leadId, 'Spam-Beschwerde - Lead als verloren markiert', JSON.stringify({ auto: true }));
    }

    return NextResponse.json({ received: true, event: eventType, lead_id: leadId });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ error: 'Webhook-Fehler' }, { status: 500 });
  }
}
