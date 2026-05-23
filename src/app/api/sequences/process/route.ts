import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface SequenceStep {
  type: 'email' | 'task';
  delay_days: number;
  subject?: string;
  body?: string;
  task_type?: string;
  title?: string;
  use_ai?: boolean;
}

interface EnrollmentRow {
  id: number;
  sequence_id: number;
  lead_id: number;
  current_step: number;
  status: string;
  next_action_at: string;
}

interface SequenceRow {
  id: number;
  name: string;
  steps: string;
  is_active: number;
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const dueEnrollments = db.prepare(`
      SELECT se.*
      FROM sequence_enrollments se
      WHERE se.status = 'active' AND se.next_action_at <= datetime('now')
    `).all() as EnrollmentRow[];

    let processed = 0;
    let errors = 0;

    for (const enrollment of dueEnrollments) {
      try {
        const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?')
          .get(enrollment.sequence_id) as SequenceRow | undefined;

        if (!sequence || !sequence.is_active) {
          continue;
        }

        const steps: SequenceStep[] = JSON.parse(sequence.steps);
        const currentStep = steps[enrollment.current_step];

        if (!currentStep) {
          // No more steps, mark as completed
          db.prepare(`
            UPDATE sequence_enrollments
            SET status = 'completed', completed_at = datetime('now'), next_action_at = NULL
            WHERE id = ?
          `).run(enrollment.id);
          db.prepare('UPDATE sequences SET completed_count = completed_count + 1 WHERE id = ?')
            .run(enrollment.sequence_id);
          processed++;
          continue;
        }

        if (currentStep.type === 'email') {
          db.prepare(`
            INSERT INTO lead_activities (lead_id, type, content, metadata)
            VALUES (?, 'email', ?, '{}')
          `).run(
            enrollment.lead_id,
            `Sequence Email: ${currentStep.subject || 'No Subject'}`
          );
        } else if (currentStep.type === 'task') {
          db.prepare(`
            INSERT INTO tasks (lead_id, title, type, due_date)
            VALUES (?, ?, ?, date('now'))
          `).run(
            enrollment.lead_id,
            currentStep.title || `Sequence Task: ${sequence.name}`,
            currentStep.task_type || 'todo'
          );
        }

        const nextStepIndex = enrollment.current_step + 1;

        if (nextStepIndex < steps.length) {
          const nextStep = steps[nextStepIndex];
          db.prepare(`
            UPDATE sequence_enrollments
            SET current_step = ?, next_action_at = datetime('now', '+' || ? || ' days')
            WHERE id = ?
          `).run(nextStepIndex, nextStep.delay_days, enrollment.id);
        } else {
          db.prepare(`
            UPDATE sequence_enrollments
            SET current_step = ?, status = 'completed', completed_at = datetime('now'), next_action_at = NULL
            WHERE id = ?
          `).run(nextStepIndex, enrollment.id);
          db.prepare('UPDATE sequences SET completed_count = completed_count + 1 WHERE id = ?')
            .run(enrollment.sequence_id);
        }

        processed++;
      } catch (e) {
        console.error(`[Sequences] Error processing enrollment ${enrollment.id}:`, e);
        errors++;
      }
    }

    return NextResponse.json({ processed, errors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
