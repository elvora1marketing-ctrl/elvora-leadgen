import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface RouteParams {
  params: { id: string };
}

// GET /api/leads/[id]/notes – Activities für einen Lead
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const db = getDb();
    const leadId = parseInt(params.id);

    const activities = db.prepare(`
      SELECT id, type, content, metadata, created_at
      FROM lead_activities
      WHERE lead_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(leadId);

    return NextResponse.json({ activities });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

// POST /api/leads/[id]/notes – Neue Aktivität erstellen
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const db = getDb();
    const leadId = parseInt(params.id);
    const { type, content, metadata } = await request.json() as {
      type: 'note' | 'call' | 'email' | 'meeting' | 'status_change' | 'whatsapp';
      content: string;
      metadata?: Record<string, unknown>;
    };

    if (!type || !content) {
      return NextResponse.json({ error: 'type und content sind erforderlich' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO lead_activities (lead_id, type, content, metadata, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(leadId, type, content, JSON.stringify(metadata || {}));

    // If it's a call, update the lead's contact_status
    if (type === 'call') {
      db.prepare(`
        UPDATE leads SET contact_status = 'called', contacted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND contact_status IN ('not_contacted', 'email_sent')
      `).run(leadId);
    }

    // If it's a meeting, update status
    if (type === 'meeting') {
      db.prepare(`
        UPDATE leads SET contact_status = 'meeting', updated_at = datetime('now')
        WHERE id = ? AND contact_status IN ('not_contacted', 'email_sent', 'called')
      `).run(leadId);
    }

    return NextResponse.json({
      id: result.lastInsertRowid,
      type,
      content,
      created_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
