import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get('t');

  if (trackingId) {
    try {
      const db = getDb();
      db.prepare(
        "UPDATE email_tracking SET opened_at = COALESCE(opened_at, datetime('now')), open_count = open_count + 1 WHERE tracking_id = ?"
      ).run(trackingId);
    } catch {
      // Silent fail - don't block pixel response
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
