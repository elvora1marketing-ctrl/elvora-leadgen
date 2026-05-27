import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { website } = body;

    if (!website) {
      return NextResponse.json({ error: 'website is required' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('UPDATE audit_pages SET cta_clicks = cta_clicks + 1 WHERE website = ?').run(website);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
