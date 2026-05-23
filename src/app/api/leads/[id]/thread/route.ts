import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/leads/[id]/thread
 * Returns the full email conversation thread for a lead:
 * - Sent emails (initial + follow-ups) with tracking status
 * - Received replies from inbox
 * All merged and sorted chronologically
 */
export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 });
    }

    const db = getDb();

    // Check lead exists
    const lead = db.prepare('SELECT id, name, email, contact_status FROM leads WHERE id = ?').get(leadId) as {
      id: number; name: string; email: string; contact_status: string;
    } | undefined;

    if (!lead) {
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    // Get email tracking entries (= sent emails)
    const sentEmails = db.prepare(`
      SELECT et.id, et.tracking_id, et.opened_at, et.open_count, et.created_at,
             'sent' as direction
      FROM email_tracking et
      WHERE et.lead_id = ?
      ORDER BY et.created_at ASC
    `).all(leadId) as Array<{
      id: number;
      tracking_id: string;
      opened_at: string | null;
      open_count: number;
      created_at: string;
      direction: string;
    }>;

    // Get follow-up entries
    const followUps = db.prepare(`
      SELECT id, step, scheduled_at, sent_at, status, created_at
      FROM follow_ups
      WHERE lead_id = ?
      ORDER BY step ASC
    `).all(leadId) as Array<{
      id: number;
      step: number;
      scheduled_at: string;
      sent_at: string | null;
      status: string;
      created_at: string;
    }>;

    // Get received replies
    const replies = db.prepare(`
      SELECT id, from_email, from_name, subject, body_text, is_read, created_at,
             'received' as direction
      FROM inbox_messages
      WHERE lead_id = ?
      ORDER BY created_at ASC
    `).all(leadId) as Array<{
      id: number;
      from_email: string;
      from_name: string;
      subject: string;
      body_text: string;
      is_read: number;
      created_at: string;
      direction: string;
    }>;

    // Get email-related activities for extra context
    const emailActivities = db.prepare(`
      SELECT id, type, content, metadata, created_at
      FROM lead_activities
      WHERE lead_id = ? AND type = 'email'
      ORDER BY created_at ASC
    `).all(leadId) as Array<{
      id: number;
      type: string;
      content: string;
      metadata: string;
      created_at: string;
    }>;

    // Get email events (delivered, bounced, etc.)
    const emailEvents = db.prepare(`
      SELECT id, event_type, payload, created_at
      FROM email_events
      WHERE lead_id = ?
      ORDER BY created_at ASC
    `).all(leadId) as Array<{
      id: number;
      event_type: string;
      payload: string;
      created_at: string;
    }>;

    // Build unified timeline
    type ThreadItem = {
      id: string;
      type: 'initial_email' | 'followup_sent' | 'followup_scheduled' | 'followup_cancelled' | 'reply' | 'event' | 'activity';
      timestamp: string;
      data: Record<string, unknown>;
    };

    const thread: ThreadItem[] = [];

    // Add initial email(s)
    for (const se of sentEmails) {
      thread.push({
        id: `sent-${se.id}`,
        type: 'initial_email',
        timestamp: se.created_at,
        data: {
          tracking_id: se.tracking_id,
          opened: !!se.opened_at,
          opened_at: se.opened_at,
          open_count: se.open_count,
        },
      });
    }

    // Add follow-ups
    for (const fu of followUps) {
      if (fu.status === 'sent') {
        thread.push({
          id: `followup-${fu.id}`,
          type: 'followup_sent',
          timestamp: fu.sent_at || fu.scheduled_at,
          data: { step: fu.step, sent_at: fu.sent_at },
        });
      } else if (fu.status === 'pending') {
        thread.push({
          id: `followup-pending-${fu.id}`,
          type: 'followup_scheduled',
          timestamp: fu.scheduled_at,
          data: { step: fu.step, scheduled_at: fu.scheduled_at },
        });
      } else if (fu.status === 'cancelled') {
        thread.push({
          id: `followup-cancelled-${fu.id}`,
          type: 'followup_cancelled',
          timestamp: fu.created_at,
          data: { step: fu.step },
        });
      }
    }

    // Add replies
    for (const r of replies) {
      thread.push({
        id: `reply-${r.id}`,
        type: 'reply',
        timestamp: r.created_at,
        data: {
          from_email: r.from_email,
          from_name: r.from_name,
          subject: r.subject,
          body_text: r.body_text,
          is_read: r.is_read,
        },
      });
    }

    // Add email events (bounce, complaint, delivery)
    for (const ev of emailEvents) {
      thread.push({
        id: `event-${ev.id}`,
        type: 'event',
        timestamp: ev.created_at,
        data: { event_type: ev.event_type, payload: ev.payload },
      });
    }

    // Add manual email activities (not auto-generated ones)
    for (const act of emailActivities) {
      let meta: Record<string, unknown> = {};
      try { meta = JSON.parse(act.metadata); } catch { /* ignore */ }
      if (!meta.auto) {
        thread.push({
          id: `activity-${act.id}`,
          type: 'activity',
          timestamp: act.created_at,
          data: { content: act.content },
        });
      }
    }

    // Sort by timestamp
    thread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({
      lead: { id: lead.id, name: lead.name, email: lead.email, contact_status: lead.contact_status },
      thread,
      stats: {
        totalSent: sentEmails.length,
        followUpsSent: followUps.filter(f => f.status === 'sent').length,
        followUpsPending: followUps.filter(f => f.status === 'pending').length,
        repliesReceived: replies.length,
        opened: sentEmails.some(e => e.open_count > 0),
        bounced: emailEvents.some(e => e.event_type === 'bounced'),
      },
    });
  } catch (error) {
    console.error('Thread error:', error);
    return NextResponse.json({ error: 'Thread-Fehler' }, { status: 500 });
  }
}
