import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    // Proposals viewed in last 48h that haven't been notified yet
    const recently_viewed = db.prepare(`
      SELECT
        p.id, p.title, p.amount, p.status, p.last_viewed_at, p.views, p.token,
        l.name as lead_name, l.city as lead_city, l.phone as lead_phone
      FROM proposals p
      LEFT JOIN leads l ON p.lead_id = l.id
      WHERE p.last_viewed_at IS NOT NULL
        AND p.view_notified = 0
        AND p.last_viewed_at >= datetime('now', '-48 hours')
      ORDER BY p.last_viewed_at DESC
    `).all();

    // Count of unread notifications
    const unreadRow = db.prepare(`
      SELECT COUNT(*) as count FROM proposals
      WHERE view_notified = 0 AND last_viewed_at IS NOT NULL
    `).get() as { count: number };

    return NextResponse.json({
      recently_viewed,
      unread_notifications: unreadRow.count,
    });
  } catch (error) {
    console.error('Proposal tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { proposal_id } = body;

    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id ist erforderlich' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare('UPDATE proposals SET view_notified = 1 WHERE id = ?').run(proposal_id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Proposal tracking POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
