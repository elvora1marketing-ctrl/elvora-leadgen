import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 });
    }

    const db = getDb();

    const lead = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM email_tracking WHERE lead_id = l.id AND open_count > 0) as email_opens,
        (SELECT SUM(open_count) FROM email_tracking WHERE lead_id = l.id) as total_opens,
        (SELECT COUNT(*) FROM inbox_messages WHERE lead_id = l.id) as replies_count,
        (SELECT COUNT(*) FROM follow_ups WHERE lead_id = l.id AND status = 'sent') as followups_sent,
        (SELECT COUNT(*) FROM follow_ups WHERE lead_id = l.id AND status = 'pending') as followups_pending
      FROM leads l
      WHERE l.id = ?
    `).get(leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    const tags = db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN lead_tags lt ON t.id = lt.tag_id
      WHERE lt.lead_id = ?
      ORDER BY t.name ASC
    `).all(leadId);

    const tasks = db.prepare(`
      SELECT * FROM tasks
      WHERE lead_id = ?
      ORDER BY is_completed ASC, due_date ASC NULLS LAST, created_at DESC
      LIMIT 20
    `).all(leadId);

    const audit = db.prepare(`
      SELECT id, slug, views, cta_clicks, created_at
      FROM audit_pages
      WHERE lead_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(leadId);

    const contacts = db.prepare(`
      SELECT * FROM contacts WHERE lead_id = ? ORDER BY is_primary DESC, name ASC
    `).all(leadId);

    const competitors = db.prepare(`
      SELECT * FROM competitor_analyses WHERE lead_id = ? ORDER BY competitor_score DESC
    `).all(leadId);

    const proposals = db.prepare(`
      SELECT * FROM proposals WHERE lead_id = ? ORDER BY created_at DESC
    `).all(leadId);

    const reviews = db.prepare(`
      SELECT * FROM review_snapshots WHERE lead_id = ? ORDER BY checked_at DESC LIMIT 10
    `).all(leadId);

    const client = db.prepare('SELECT * FROM clients WHERE lead_id = ?').get(leadId) || null;

    return NextResponse.json({ lead, tags, tasks, audit, contacts, competitors, proposals, reviews, client });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
