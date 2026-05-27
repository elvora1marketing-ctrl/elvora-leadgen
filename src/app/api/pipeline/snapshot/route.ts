import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    // Skip if snapshot for today already exists
    const existing = db.prepare(
      'SELECT id FROM pipeline_snapshots WHERE snapshot_date = ? LIMIT 1'
    ).get(today);
    if (existing) {
      return NextResponse.json({ message: 'Snapshot für heute existiert bereits', date: today });
    }

    const stages = ['not_contacted', 'email_sent', 'called', 'meeting', 'proposal', 'won', 'lost'];

    const insert = db.prepare(
      'INSERT INTO pipeline_snapshots (snapshot_date, stage, lead_count, total_value) VALUES (?, ?, ?, ?)'
    );

    const createSnapshots = db.transaction(() => {
      for (const stage of stages) {
        const row = db.prepare(
          'SELECT COUNT(*) as count, COALESCE(SUM(deal_value), 0) as value FROM leads WHERE contact_status = ?'
        ).get(stage) as { count: number; value: number };
        insert.run(today, stage, row.count, row.value);
      }
    });

    createSnapshots();

    return NextResponse.json({ message: 'Pipeline-Snapshot erstellt', date: today });
  } catch (error) {
    console.error('[API] Pipeline snapshot error:', error);
    return NextResponse.json({ error: 'Snapshot-Erstellung fehlgeschlagen' }, { status: 500 });
  }
}
