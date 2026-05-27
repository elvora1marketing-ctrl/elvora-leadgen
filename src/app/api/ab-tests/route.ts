import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const tests = db.prepare(
      accountId
        ? 'SELECT * FROM ab_tests WHERE account_id = ? ORDER BY created_at DESC'
        : 'SELECT * FROM ab_tests ORDER BY created_at DESC'
    ).all(...(accountId ? [accountId] : [])) as Record<string, unknown>[];

    const testsWithMetrics = tests.map((test) => {
      const aSent = (test.variant_a_sent as number) || 0;
      const bSent = (test.variant_b_sent as number) || 0;
      const aOpened = (test.variant_a_opened as number) || 0;
      const bOpened = (test.variant_b_opened as number) || 0;
      const aReplied = (test.variant_a_replied as number) || 0;
      const bReplied = (test.variant_b_replied as number) || 0;

      const open_rate_a = aSent > 0 ? Math.round((aOpened / aSent) * 1000) / 10 : 0;
      const open_rate_b = bSent > 0 ? Math.round((bOpened / bSent) * 1000) / 10 : 0;
      const reply_rate_a = aSent > 0 ? Math.round((aReplied / aSent) * 1000) / 10 : 0;
      const reply_rate_b = bSent > 0 ? Math.round((bReplied / bSent) * 1000) / 10 : 0;

      // Suggest winner based on reply rate first, then open rate
      let winner_suggestion: string | null = null;
      const minSample = 5;
      if (aSent >= minSample && bSent >= minSample) {
        if (reply_rate_a !== reply_rate_b) {
          winner_suggestion = reply_rate_a > reply_rate_b ? 'A' : 'B';
        } else if (open_rate_a !== open_rate_b) {
          winner_suggestion = open_rate_a > open_rate_b ? 'A' : 'B';
        }
      }

      return {
        ...test,
        open_rate_a,
        open_rate_b,
        reply_rate_a,
        reply_rate_b,
        winner_suggestion,
      };
    });

    return NextResponse.json({ tests: testsWithMetrics });
  } catch (error) {
    console.error('AB Tests GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { name, subject_a, subject_b, body_a, body_b } = body;

    if (!name || !subject_a || !subject_b) {
      return NextResponse.json(
        { error: 'name, subject_a und subject_b sind erforderlich' },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO ab_tests (name, subject_a, subject_b, body_a, body_b, account_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, subject_a, subject_b, body_a || null, body_b || null, body.account_id || null);

    const test = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    console.error('AB Tests POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
