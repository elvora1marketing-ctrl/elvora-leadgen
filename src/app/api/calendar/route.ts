import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar?month=2026-04
 * Returns unified events for the month: tasks, follow-ups, meeting activities.
 */
export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, '0')}`;

    const db = getDb();

    const tasks = db.prepare(`
      SELECT t.id, t.title, t.type, t.due_date, t.due_time, t.is_completed,
             t.lead_id, l.name as lead_name
      FROM tasks t LEFT JOIN leads l ON t.lead_id = l.id
      WHERE t.due_date BETWEEN ? AND ?
    `).all(start, end);

    const followups = db.prepare(`
      SELECT f.id, f.step, f.scheduled_at, f.status,
             l.id as lead_id, l.name as lead_name
      FROM follow_ups f INNER JOIN leads l ON f.lead_id = l.id
      WHERE f.status = 'pending' AND date(f.scheduled_at) BETWEEN ? AND ?
    `).all(start, end);

    const meetings = db.prepare(`
      SELECT a.id, a.content, a.created_at, a.lead_id,
             l.name as lead_name
      FROM lead_activities a INNER JOIN leads l ON a.lead_id = l.id
      WHERE a.type = 'meeting' AND date(a.created_at) BETWEEN ? AND ?
    `).all(start, end);

    return NextResponse.json({ tasks, followups, meetings, month });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
