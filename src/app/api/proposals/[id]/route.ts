import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { executeWorkflows } from '@/lib/workflows';
import { requireAuth } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const pid = parseInt(id);
    if (isNaN(pid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    for (const k of ['title', 'notes', 'file_url', 'client_message'] as const) {
      if (body[k] !== undefined) { updates.push(`${k} = ?`); values.push(body[k] as string || null); }
    }
    if (body.amount !== undefined) { updates.push('amount = ?'); values.push(body.amount as number); }
    if (body.services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(body.services)); }
    if (body.valid_until !== undefined) { updates.push('valid_until = ?'); values.push(body.valid_until as string || null); }
    if (body.lead_data !== undefined) { updates.push('lead_data = ?'); values.push(typeof body.lead_data === 'string' ? body.lead_data : JSON.stringify(body.lead_data)); }
    if (body.status !== undefined) {
      const valid = ['draft', 'sent', 'viewed', 'accepted', 'rejected'];
      if (valid.includes(body.status as string)) {
        updates.push('status = ?');
        values.push(body.status as string);
        if (body.status === 'sent') {
          updates.push('sent_at = ?');
          values.push(new Date().toISOString());
        }
        if (body.status === 'accepted') { updates.push('accepted_at = ?'); values.push(new Date().toISOString()); }
        if (body.status === 'rejected') { updates.push('rejected_at = ?'); values.push(new Date().toISOString()); }
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    updates.push("updated_at = datetime('now')");
    values.push(pid);
    const db = getDb();
    db.prepare(`UPDATE proposals SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Trigger workflows for proposal events
    if (body.status && ['viewed', 'accepted', 'rejected'].includes(body.status as string)) {
      try {
        const proposal = db.prepare('SELECT lead_id FROM proposals WHERE id = ?').get(pid) as { lead_id: number } | undefined;
        if (proposal?.lead_id) {
          const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(proposal.lead_id);
          if (lead) {
            executeWorkflows(db, 'proposal_event', lead, { event: body.status, proposal_id: pid });
          }
        }
      } catch { /* silent */ }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const pid = parseInt(id);
  if (isNaN(pid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  getDb().prepare('DELETE FROM proposals WHERE id = ?').run(pid);
  return NextResponse.json({ success: true });
}
