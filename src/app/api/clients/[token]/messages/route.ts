import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getDb();
    const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Client nicht gefunden' }, { status: 404 });
    }
    const messages = db.prepare('SELECT * FROM client_messages WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { content, sender } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Nachricht darf nicht leer sein' }, { status: 400 });
    }

    const db = getDb();
    const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Client nicht gefunden' }, { status: 404 });
    }

    const validSender = sender === 'agency' ? 'agency' : 'client';
    db.prepare('INSERT INTO client_messages (client_id, sender, content) VALUES (?, ?, ?)').run(
      client.id, validSender, content.trim(),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
