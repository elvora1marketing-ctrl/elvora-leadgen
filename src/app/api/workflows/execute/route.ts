import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { executeWorkflows } from '@/lib/workflows';

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { trigger_type, lead_id, event_data } = body;

    if (!trigger_type || !lead_id) {
      return NextResponse.json({ error: 'trigger_type and lead_id required' }, { status: 400 });
    }

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const result = executeWorkflows(db, trigger_type, lead, event_data || {});
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
