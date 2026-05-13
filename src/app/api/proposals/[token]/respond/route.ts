import { NextRequest, NextResponse } from 'next/server';
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
