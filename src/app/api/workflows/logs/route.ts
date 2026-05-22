import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '100'), 500);
    const workflowId = searchParams.get('workflow_id');

    let query = 'SELECT wl.*, l.name as lead_name, w.name as workflow_name FROM workflow_logs wl LEFT JOIN leads l ON wl.lead_id = l.id LEFT JOIN workflows w ON wl.workflow_id = w.id';
    const params: any[] = [];

    if (workflowId) {
      query += ' WHERE wl.workflow_id = ?';
      params.push(workflowId);
    }

    query += ' ORDER BY wl.created_at DESC LIMIT ?';
    params.push(limit);

    const logs = db.prepare(query).all(...params);
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
