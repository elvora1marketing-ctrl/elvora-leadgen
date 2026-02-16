import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import getDb from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

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
      const validStatuses = ['pending', 'qualified', 'rejected', 'archived'];
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

    return NextResponse.json({ success: true, lead_id: leadId });
  } catch (error: unknown) {
    console.error('Lead status update error:', error);
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
  }
}
