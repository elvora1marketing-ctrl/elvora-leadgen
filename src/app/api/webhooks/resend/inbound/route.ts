import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

/**
 * Resend Inbound Email Webhook - empfängt Replies von Leads
 *
 * Setup:
 * 1. Resend Dashboard → Domains → DNS Records hinzufügen (MX Record)
 * 2. Resend Dashboard → Webhooks → Add Endpoint → URL: /api/webhooks/resend/inbound
 * 3. Event: email.received auswählen
 *
 * Alternativ: Resend Inbound Emails API nutzen
 */

interface InboundEmailPayload {
  // Resend inbound format
  type?: string;
  data?: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    headers?: Array<{ name: string; value: string }>;
  };
  // Direct inbound format
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  message_id?: string;
  in_reply_to?: string;
}

function extractEmail(str: string): string {
  const match = str.match(/<([^>]+)>/) || str.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1].toLowerCase() : str.toLowerCase().trim();
}

function extractName(str: string): string {
  const match = str.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : '';
}

function stripQuotedReply(text: string): string {
  // Remove quoted original email (lines starting with > or "On ... wrote:")
  const lines = text.split('\n');
  const cleanLines: string[] = [];
  for (const line of lines) {
    // Stop at common reply delimiters
    if (/^(>|On .+ wrote:|Am .+ schrieb:|Von:|From:|Gesendet:|Sent:|[-]{3,}|[_]{3,})/.test(line.trim())) {
      break;
    }
    cleanLines.push(line);
  }
  return cleanLines.join('\n').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body: InboundEmailPayload = await request.json();

    // Handle both nested (webhook) and flat (direct) format
    const fromRaw = body.data?.from || body.from || '';
    const toRaw = body.data?.to || body.to || '';
    const subject = body.data?.subject || body.subject || '(Kein Betreff)';
    const textBody = body.data?.text || body.text || '';
    const htmlBody = body.data?.html || body.html || '';
    const messageId = body.message_id || '';
    const inReplyTo = body.in_reply_to || '';

    const fromEmail = extractEmail(fromRaw);
    const fromName = extractName(fromRaw) || fromEmail.split('@')[0];

    if (!fromEmail) {
      return NextResponse.json({ error: 'Absender-Email fehlt' }, { status: 400 });
    }

    const db = getDb();

    // Find matching lead by email
    const lead = db.prepare('SELECT id, name, contact_status FROM leads WHERE email = ?').get(fromEmail) as {
      id: number;
      name: string;
      contact_status: string;
    } | undefined;

    // Strip quoted reply text
    const cleanBody = stripQuotedReply(textBody);

    // Store in inbox
    const result = db.prepare(`
      INSERT INTO inbox_messages (lead_id, from_email, from_name, to_email, subject, body_text, body_html, message_id, in_reply_to, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'resend')
    `).run(
      lead?.id || null,
      fromEmail,
      fromName,
      extractEmail(toRaw),
      subject,
      cleanBody || textBody,
      htmlBody,
      messageId,
      inReplyTo,
    );

    const messageDbId = result.lastInsertRowid;

    // If we found a matching lead, update their status and cancel follow-ups
    if (lead) {
      // Cancel all pending follow-ups for this lead
      db.prepare(
        "UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'"
      ).run(lead.id);

      // Update lead: move to 'called' if they were just at 'email_sent'
      if (lead.contact_status === 'email_sent' || lead.contact_status === 'not_contacted') {
        db.prepare(
          "UPDATE leads SET contact_status = 'called', updated_at = datetime('now') WHERE id = ?"
        ).run(lead.id);
      }

      // Log activity
      const preview = (cleanBody || textBody).substring(0, 150);
      db.prepare(
        "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
      ).run(
        lead.id,
        `Antwort erhalten: "${subject}" - ${preview}${preview.length >= 150 ? '...' : ''}`,
        JSON.stringify({ auto: true, inbox_message_id: messageDbId, direction: 'inbound' }),
      );
    }

    // Phase 6: Auto-classify reply using AI (non-blocking)
    if (lead && (cleanBody || textBody)) {
      const aiClassifyRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_classify_enabled'").get() as { value: string } | undefined;
      const aiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'openai_api_key'").get() as { value: string } | undefined;
      if (aiClassifyRow?.value === 'true' && aiKeyRow?.value) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
          fetch(`${baseUrl}/api/ai/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message_id: messageDbId,
              subject,
              body: cleanBody || textBody,
              from_name: fromName,
              lead_name: lead.name,
            }),
          }).catch(() => { /* AI classification failed silently */ });
        } catch {
          // AI classification is optional, don't block webhook
        }
      }
    }

    return NextResponse.json({
      received: true,
      message_id: messageDbId,
      lead_id: lead?.id || null,
      followups_cancelled: !!lead,
    });
  } catch (error) {
    console.error('Inbound email webhook error:', error);
    return NextResponse.json({ error: 'Inbound-Fehler' }, { status: 500 });
  }
}
