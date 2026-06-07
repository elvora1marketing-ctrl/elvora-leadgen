import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — list recent review requests + counts
export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const db = getDb();
    const requests = db.prepare(
      `SELECT id, booking_id, customer_name, customer_email, customer_phone, channel, scheduled_at, sent_at, status, created_at
       FROM review_requests ORDER BY created_at DESC LIMIT 100`
    ).all();

    const countRow = (s: string) =>
      (db.prepare('SELECT COUNT(*) as c FROM review_requests WHERE status = ?').get(s) as { c: number }).c;

    return NextResponse.json({
      requests,
      counts: {
        pending: countRow('pending'),
        sent: countRow('sent'),
        skipped: countRow('skipped'),
        failed: countRow('failed'),
      },
    });
  } catch (e) {
    console.error('[review-autopilot] GET error:', e);
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}
