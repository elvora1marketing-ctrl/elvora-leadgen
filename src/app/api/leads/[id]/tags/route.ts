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
    const tags = db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN lead_tags lt ON t.id = lt.tag_id
      WHERE lt.lead_id = ?
      ORDER BY t.name ASC
    `).all(leadId);

    return NextResponse.json({ tags });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 });
    }

    const db = getDb();
    const body = await request.json() as { tag_id: number };

    if (!body.tag_id) {
      return NextResponse.json({ error: 'tag_id erforderlich' }, { status: 400 });
    }

    db.prepare('INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?, ?)').run(leadId, body.tag_id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
