import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface SequenceStep {
  type: 'email' | 'task';
  delay_days: number;
  subject?: string;
  body?: string;
  task_type?: string;
  title?: string;
  use_ai?: boolean;
}

interface SequenceRow {
  id: number;
  name: string;
  steps: string;
  is_active: number;
  enrolled_count: number;
}

interface EnrollmentRow {
  id: number;
  sequence_id: number;
  lead_id: number;
  status: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sequenceId = parseInt(id);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: 'Invalid sequence ID' }, { status: 400 });
    }

    const db = getDb();

    const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId) as SequenceRow | undefined;
    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    if (!sequence.is_active) {
      return NextResponse.json({ error: 'Sequence is not active' }, { status: 400 });
    }

    const steps: SequenceStep[] = JSON.parse(sequence.steps);
    if (steps.length === 0) {
      return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 });
    }

    const body = await request.json() as { lead_ids: number[] };

    if (!Array.isArray(body.lead_ids) || body.lead_ids.length === 0) {
      return NextResponse.json({ error: 'lead_ids array is required' }, { status: 400 });
    }

    let enrolled = 0;
    let skipped = 0;

    const checkStmt = db.prepare(
      'SELECT id FROM sequence_enrollments WHERE sequence_id = ? AND lead_id = ? AND status = ?'
    );
    const insertStmt = db.prepare(`
      INSERT INTO sequence_enrollments (sequence_id, lead_id, current_step, status, next_action_at)
      VALUES (?, ?, 0, 'active', datetime('now', '+' || ? || ' days'))
    `);

    const enrollAll = db.transaction(() => {
      for (const leadId of body.lead_ids) {
        const existing = checkStmt.get(sequenceId, leadId, 'active') as EnrollmentRow | undefined;
        if (existing) {
          skipped++;
          continue;
        }

        const firstDelay = steps[0].delay_days;
        insertStmt.run(sequenceId, leadId, firstDelay);
        enrolled++;
      }

      if (enrolled > 0) {
        db.prepare('UPDATE sequences SET enrolled_count = enrolled_count + ? WHERE id = ?')
          .run(enrolled, sequenceId);
      }
    });

    enrollAll();

    return NextResponse.json({
      success: true,
      enrolled,
      skipped,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
