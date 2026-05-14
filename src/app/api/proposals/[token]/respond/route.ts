import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { action, message } = body;

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
    }

    const db = getDb();
    const proposal = db.prepare('SELECT * FROM proposals WHERE token = ?').get(token) as Record<string, unknown> | undefined;

    if (!proposal) {
      return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 });
    }

    if (proposal.accepted_at || proposal.rejected_at) {
      return NextResponse.json({ error: 'Angebot wurde bereits beantwortet' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === 'accept') {
      db.prepare(`
        UPDATE proposals SET status = 'accepted', accepted_at = ?, client_message = ?, updated_at = datetime('now')
        WHERE token = ?
      `).run(now, message || null, token);

      // Auto-move lead to "won" and create client
      const leadId = proposal.lead_id as number;
      db.prepare("UPDATE leads SET contact_status = 'won', updated_at = datetime('now') WHERE id = ?").run(leadId);

      // Set deal_value from proposal amount if not already set
      if (proposal.amount) {
        db.prepare("UPDATE leads SET deal_value = COALESCE(NULLIF(deal_value, 0), ?) WHERE id = ?").run(proposal.amount, leadId);
      }

      // Auto-create client if not exists
      const existingClient = db.prepare('SELECT id FROM clients WHERE lead_id = ?').get(leadId) as { id: number } | undefined;
      if (!existingClient) {
        const clientToken = crypto.randomUUID();
        const leadData = db.prepare('SELECT name, email, city, deal_value FROM leads WHERE id = ?').get(leadId) as { name: string; email: string | null; city: string; deal_value: number | null } | undefined;
        if (leadData) {
          db.prepare(`
            INSERT INTO clients (lead_id, token, company_name, contact_email, project_value)
            VALUES (?, ?, ?, ?, ?)
          `).run(leadId, clientToken, leadData.name, leadData.email, leadData.deal_value);
        }
      }
    } else {
      db.prepare(`
        UPDATE proposals SET status = 'rejected', rejected_at = ?, client_message = ?, updated_at = datetime('now')
        WHERE token = ?
      `).run(now, message || null, token);
    }

    return NextResponse.json({ success: true, status: action === 'accept' ? 'accepted' : 'rejected' });
  } catch (error) {
    console.error('Proposal respond error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
