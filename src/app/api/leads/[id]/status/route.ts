import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { executeWorkflows } from '@/lib/workflows';
import { updateDealHealth } from '@/lib/deal-health';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 });
    }

    const body = await request.json() as {
      contact_status?: string;
      status?: string;
      notes?: string;
      deal_value?: number;
      followup_date?: string;
      expected_close_date?: string;
      win_probability?: number;
      lost_reason?: string;
    };

    const db = getDb();

    // Check lead exists
    const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.contact_status) {
      const validStatuses = ['not_contacted', 'email_sent', 'called', 'meeting', 'proposal', 'won', 'lost'];
      if (!validStatuses.includes(body.contact_status)) {
        return NextResponse.json({ error: `Ungültiger contact_status. Erlaubt: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updates.push('contact_status = ?');
      values.push(body.contact_status);
    }

    if (body.status) {
      const validStatuses = ['pending', 'qualified', 'rejected', 'archived', 'akquise'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Ungültiger status. Erlaubt: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updates.push('status = ?');
      values.push(body.status);
    }

    if (body.notes !== undefined) {
      updates.push("notes = COALESCE(notes, '') || ?");
      values.push('\n' + body.notes);
    }

    if (body.deal_value !== undefined) {
      updates.push('deal_value = ?');
      values.push(body.deal_value);
    }

    if (body.followup_date !== undefined) {
      updates.push('followup_date = ?');
      values.push(body.followup_date);
    }

    if (body.expected_close_date !== undefined) {
      updates.push('expected_close_date = ?');
      values.push(body.expected_close_date || null);
    }

    if (body.win_probability !== undefined) {
      updates.push('win_probability = ?');
      values.push(Math.min(100, Math.max(0, body.win_probability)));
    }

    if (body.lost_reason !== undefined) {
      updates.push('lost_reason = ?');
      values.push(body.lost_reason || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(leadId);

    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Cancel follow-ups if lead moved past email stage
    if (body.contact_status && ['meeting', 'proposal', 'won', 'lost'].includes(body.contact_status)) {
      db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'").run(leadId);
    }

    // Auto-create client when lead is won
    if (body.contact_status === 'won') {
      const existingClient = db.prepare('SELECT id FROM clients WHERE lead_id = ?').get(leadId) as { id: number } | undefined;
      if (!existingClient) {
        const token = crypto.randomUUID();
        const leadData = db.prepare('SELECT name, email, city, deal_value FROM leads WHERE id = ?').get(leadId) as { name: string; email: string | null; city: string; deal_value: number | null } | undefined;
        if (leadData) {
          db.prepare(`
            INSERT INTO clients (lead_id, token, company_name, contact_email, project_value)
            VALUES (?, ?, ?, ?, ?)
          `).run(leadId, token, leadData.name, leadData.email, leadData.deal_value);
        }
      }
    }

    // Track stage entry time and last activity
    if (body.contact_status) {
      db.prepare("UPDATE leads SET stage_entered_at = datetime('now'), last_activity_at = datetime('now') WHERE id = ?").run(leadId);

      const fullLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
      // Log status change as activity
      db.prepare(
        "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'status_change', ?, ?)"
      ).run(leadId, `Status → ${body.contact_status}`, JSON.stringify({ from: '', to: body.contact_status }));

      // Trigger workflows
      try { executeWorkflows(db, 'status_change', fullLead, { to_status: body.contact_status }); } catch {}

      // Stop active sequence enrollments if won/lost
      if (['won', 'lost'].includes(body.contact_status)) {
        try { db.prepare("UPDATE sequence_enrollments SET status = 'completed', completed_at = datetime('now') WHERE lead_id = ? AND status = 'active'").run(leadId); } catch {}
      }
    }

    // Recalculate deal health
    try { updateDealHealth(db, leadId); } catch {}

    return NextResponse.json({ success: true, lead_id: leadId });
  } catch (error: unknown) {
    console.error('Lead status update error:', error);
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
  }
}
