import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const db = getDb();

    const entries = db.prepare(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    const totalRow = db.prepare(
      'SELECT COUNT(*) as total FROM audit_log'
    ).get() as { total: number };

    return NextResponse.json({
      entries,
      total: totalRow.total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[DSGVO] Audit-Log Abfrage fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Audit-Log konnte nicht geladen werden.' },
      { status: 500 }
    );
  }
}
