import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const inboxes = db.prepare(`
      SELECT i.*, d.domain, d.status as domain_status
      FROM sending_inboxes i
      JOIN sending_domains d ON i.domain_id = d.id
      ORDER BY i.created_at DESC
    `).all();

    return NextResponse.json({ inboxes });
  } catch (error) {
    console.error('Inboxes list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Postfächer' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json();

    if (!body.domain_id) {
      return NextResponse.json({ error: 'Domain-ID ist erforderlich' }, { status: 400 });
    }

    if (!body.email || !body.email.trim()) {
      return NextResponse.json({ error: 'E-Mail-Adresse ist erforderlich' }, { status: 400 });
    }

    const domain = db.prepare('SELECT * FROM sending_domains WHERE id = ?').get(body.domain_id) as { id: number; domain: string } | undefined;
    if (!domain) {
      return NextResponse.json({ error: 'Domain nicht gefunden' }, { status: 404 });
    }

    const email = body.email.trim();

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
    }

    const emailDomain = email.split('@')[1];
    if (emailDomain !== domain.domain) {
      return NextResponse.json({ error: `E-Mail-Domain muss ${domain.domain} entsprechen` }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO sending_inboxes (domain_id, email, display_name, daily_limit)
      VALUES (?, ?, ?, ?)
    `).run(
      body.domain_id,
      email,
      body.display_name ?? null,
      body.daily_limit ?? 25
    );

    const inbox = db.prepare('SELECT * FROM sending_inboxes WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ success: true, inbox });
  } catch (error) {
    console.error('Inbox create error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen des Postfachs' }, { status: 500 });
  }
}
