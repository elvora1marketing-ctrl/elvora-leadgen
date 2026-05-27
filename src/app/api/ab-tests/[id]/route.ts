import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const tid = parseInt(id);
    if (isNaN(tid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();
    const test = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(tid) as Record<string, unknown> | undefined;

    if (!test) {
      return NextResponse.json({ error: 'A/B-Test nicht gefunden' }, { status: 404 });
    }

    const aSent = (test.variant_a_sent as number) || 0;
    const bSent = (test.variant_b_sent as number) || 0;
    const aOpened = (test.variant_a_opened as number) || 0;
    const bOpened = (test.variant_b_opened as number) || 0;
    const aClicked = (test.variant_a_clicked as number) || 0;
    const bClicked = (test.variant_b_clicked as number) || 0;
    const aReplied = (test.variant_a_replied as number) || 0;
    const bReplied = (test.variant_b_replied as number) || 0;

    return NextResponse.json({
      test: {
        ...test,
        open_rate_a: aSent > 0 ? Math.round((aOpened / aSent) * 1000) / 10 : 0,
        open_rate_b: bSent > 0 ? Math.round((bOpened / bSent) * 1000) / 10 : 0,
        click_rate_a: aSent > 0 ? Math.round((aClicked / aSent) * 1000) / 10 : 0,
        click_rate_b: bSent > 0 ? Math.round((bClicked / bSent) * 1000) / 10 : 0,
        reply_rate_a: aSent > 0 ? Math.round((aReplied / aSent) * 1000) / 10 : 0,
        reply_rate_b: bSent > 0 ? Math.round((bReplied / bSent) * 1000) / 10 : 0,
      },
    });
  } catch (error) {
    console.error('AB Test GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const tid = parseInt(id);
    if (isNaN(tid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(tid);
    if (!existing) {
      return NextResponse.json({ error: 'A/B-Test nicht gefunden' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    // Updatable text fields
    for (const field of ['name', 'subject_a', 'subject_b', 'body_a', 'body_b'] as const) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Status
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'running', 'completed'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
      }
      updates.push('status = ?');
      values.push(body.status);
    }

    // Winner
    if (body.winner !== undefined) {
      if (body.winner !== null && body.winner !== 'A' && body.winner !== 'B') {
        return NextResponse.json({ error: 'Winner muss A, B oder null sein' }, { status: 400 });
      }
      updates.push('winner = ?');
      values.push(body.winner);
    }

    // Counter increments
    const counterFields = [
      'variant_a_sent', 'variant_a_opened', 'variant_a_clicked', 'variant_a_replied',
      'variant_b_sent', 'variant_b_opened', 'variant_b_clicked', 'variant_b_replied',
    ] as const;

    for (const field of counterFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'number') {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }
      // Support increment_<field> for convenience
      const incKey = `increment_${field}`;
      if (body[incKey] !== undefined) {
        updates.push(`${field} = ${field} + ?`);
        values.push(body[incKey] as number);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    }

    values.push(tid);
    db.prepare(`UPDATE ab_tests SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(tid);
    return NextResponse.json({ test: updated });
  } catch (error) {
    console.error('AB Test PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const tid = parseInt(id);
    if (isNaN(tid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();
    const result = db.prepare('DELETE FROM ab_tests WHERE id = ?').run(tid);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'A/B-Test nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AB Test DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
