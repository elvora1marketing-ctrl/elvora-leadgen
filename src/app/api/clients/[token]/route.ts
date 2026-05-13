import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getDb();

    const client = db.prepare('SELECT * FROM clients WHERE token = ?').get(token) as Record<string, unknown> | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Client nicht gefunden' }, { status: 404 });
    }

    const messages = db.prepare('SELECT * FROM client_messages WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
    const files = db.prepare('SELECT id, client_id, filename, uploaded_by, created_at FROM client_files WHERE client_id = ? ORDER BY created_at DESC').all(client.id);

    const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'agency_%'").all() as { key: string; value: string }[];
    const agency: Record<string, string> = {};
    for (const row of settingsRows) {
      agency[row.key] = row.value;
    }

    return NextResponse.json({ client, messages, files, agency });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
