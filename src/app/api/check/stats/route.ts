import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = db.prepare(
      'SELECT COALESCE(SUM(submissions), 0) as total FROM check_page_stats'
    ).get() as { total: number };

    // Also count leads analyzed via outbound
    const leadsAnalyzed = db.prepare(
      'SELECT COUNT(*) as count FROM leads WHERE score > 0'
    ).get() as { count: number };

    return NextResponse.json({
      checkSubmissions: result.total,
      totalAnalyzed: leadsAnalyzed.count + result.total,
    });
  } catch {
    return NextResponse.json({ checkSubmissions: 0, totalAnalyzed: 0 });
  }
}
