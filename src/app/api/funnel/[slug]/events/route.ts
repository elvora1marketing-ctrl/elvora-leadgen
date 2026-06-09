import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = getDb();
    const funnel = db.prepare('SELECT id FROM funnel_configs WHERE slug = ?').get(slug) as { id: number } | undefined;
    if (!funnel) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: cors() });

    const { sessionId, step, eventType } = await request.json();
    if (!sessionId || !step || !['view', 'complete', 'drop'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid' }, { status: 400, headers: cors() });
    }

    db.prepare(
      'INSERT INTO funnel_events (funnel_id, session_id, step, event_type) VALUES (?, ?, ?, ?)'
    ).run(funnel.id, sessionId, step, eventType);

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500, headers: cors() });
  }
}
