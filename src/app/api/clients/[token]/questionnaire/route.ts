import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const db = getDb();

    const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Client nicht gefunden' }, { status: 404 });
    }

    db.prepare('UPDATE clients SET questionnaire_data = ? WHERE id = ?').run(
      JSON.stringify(body),
      client.id,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Questionnaire save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
