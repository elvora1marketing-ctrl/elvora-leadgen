import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

/**
 * GET /api/inbox - Liste aller Inbox-Nachrichten
 * Query params: ?unread=1&limit=50&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get('unread') === '1';
    const archived = searchParams.get('archived') === '1';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let where = 'WHERE m.is_archived = ?';
    const params: (number | string)[] = [archived ? 1 : 0];

    if (unreadOnly) {
      where += ' AND m.is_read = 0';
    }

    const messages = db.prepare(`
      SELECT m.id, m.lead_id, m.from_email, m.from_name, m.subject, m.body_text,
             m.is_read, m.is_archived, m.source, m.created_at,
             l.name as lead_name, l.city as lead_city, l.contact_status, l.score as lead_score
      FROM inbox_messages m
      LEFT JOIN leads l ON m.lead_id = l.id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM inbox_messages WHERE is_read = 0 AND is_archived = 0'
    ).get() as { count: number };

    const totalCount = db.prepare(
      `SELECT COUNT(*) as count FROM inbox_messages ${where}`
    ).get(...params) as { count: number };

    return NextResponse.json({
      messages,
      unreadCount: unreadCount.count,
      total: totalCount.count,
    });
  } catch (error) {
    console.error('Inbox error:', error);
    return NextResponse.json({ error: 'Inbox-Fehler' }, { status: 500 });
  }
}

/**
 * PATCH /api/inbox - Batch-Update (mark read, archive)
 * Body: { ids: number[], action: 'read' | 'unread' | 'archive' | 'unarchive' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { ids, action } = await request.json() as { ids: number[]; action: string };
    const db = getDb();

    if (!ids?.length || !action) {
      return NextResponse.json({ error: 'ids und action sind erforderlich' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');

    switch (action) {
      case 'read':
        db.prepare(`UPDATE inbox_messages SET is_read = 1 WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'unread':
        db.prepare(`UPDATE inbox_messages SET is_read = 0 WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'archive':
        db.prepare(`UPDATE inbox_messages SET is_archived = 1, is_read = 1 WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'unarchive':
        db.prepare(`UPDATE inbox_messages SET is_archived = 0 WHERE id IN (${placeholders})`).run(...ids);
        break;
      default:
        return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
    }

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error('Inbox update error:', error);
    return NextResponse.json({ error: 'Update-Fehler' }, { status: 500 });
  }
}
