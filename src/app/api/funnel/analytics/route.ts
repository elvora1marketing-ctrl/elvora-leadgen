import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const funnelId = request.nextUrl.searchParams.get('funnelId');
  if (!funnelId) return NextResponse.json({ error: 'funnelId required' }, { status: 400 });

  const db = getDb();
  const rows = db.prepare(`
    SELECT step,
      SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
      SUM(CASE WHEN event_type = 'complete' THEN 1 ELSE 0 END) as completes,
      SUM(CASE WHEN event_type = 'drop' THEN 1 ELSE 0 END) as drops
    FROM funnel_events
    WHERE funnel_id = ?
    GROUP BY step
    ORDER BY MIN(rowid)
  `).all(Number(funnelId));

  return NextResponse.json({ steps: rows });
}
