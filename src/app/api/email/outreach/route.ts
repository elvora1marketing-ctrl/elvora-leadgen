import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { createJob, listJobs, runJob } from '@/lib/outreach-jobs';
import { renderLeadEmail } from '@/lib/email-sender';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json() as {
      leadIds?: number[];
      filter?: {
        city?: string;
        minScore?: number;
        maxScore?: number;
        keyword?: string;
        contactStatus?: string;
        onlyWithEmail?: boolean;
      };
      throttleSecondsPerMail?: number;
      mailsPerHour?: number;
      preferEntscheider?: boolean;
      preview?: { leadId: number };
    };

    // Preview mode: render one lead's email without sending
    if (body.preview) {
      const rendered = renderLeadEmail(body.preview.leadId, body.preferEntscheider !== false);
      return NextResponse.json(rendered);
    }

    const db = getDb();
    let leadIds: number[] = body.leadIds || [];

    // If no explicit IDs given, derive from filter
    if (leadIds.length === 0 && body.filter) {
      const conditions: string[] = ["status != 'rejected'"];
      const params: (string | number)[] = [];

      // Email must exist (either main, entscheider, or all_emails)
      if (body.filter.onlyWithEmail !== false) {
        conditions.push("((email IS NOT NULL AND email != '') OR (entscheider_email IS NOT NULL AND entscheider_email != '') OR (all_emails IS NOT NULL AND all_emails != '' AND all_emails != '[]'))");
      }

      if (body.filter.city) {
        conditions.push("(city = ? OR city LIKE ? || ' %' OR city LIKE ? || '-%')");
        params.push(body.filter.city, body.filter.city, body.filter.city);
      }
      if (typeof body.filter.minScore === 'number') {
        conditions.push("score >= ?");
        params.push(body.filter.minScore);
      }
      if (typeof body.filter.maxScore === 'number') {
        conditions.push("score <= ?");
        params.push(body.filter.maxScore);
      }
      if (body.filter.keyword) {
        conditions.push("(found_via_keywords LIKE '%' || ? || '%' OR category LIKE '%' || ? || '%')");
        params.push(body.filter.keyword, body.filter.keyword);
      }
      if (body.filter.contactStatus) {
        conditions.push("contact_status = ?");
        params.push(body.filter.contactStatus);
      }

      const rows = db.prepare(`SELECT id FROM leads WHERE ${conditions.join(' AND ')} ORDER BY score ASC, created_at DESC`).all(...params) as { id: number }[];
      leadIds = rows.map(r => r.id);
    }

    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'Keine Leads für den Versand gefunden' }, { status: 400 });
    }

    // Determine throttle
    let throttleMs = 60_000; // default 1 mail per minute = 60/hour
    if (typeof body.throttleSecondsPerMail === 'number' && body.throttleSecondsPerMail > 0) {
      throttleMs = body.throttleSecondsPerMail * 1000;
    } else if (typeof body.mailsPerHour === 'number' && body.mailsPerHour > 0) {
      throttleMs = Math.floor(3_600_000 / body.mailsPerHour);
    }

    const job = createJob({
      leadIds,
      throttleMs,
      preferEntscheider: body.preferEntscheider !== false,
    });

    // Fire-and-forget background processing
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    runJob(job.id, baseUrl).catch(err => {
      console.error('[Outreach Job]', job.id, err);
    });

    return NextResponse.json({ success: true, job });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[Outreach POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // List all jobs (history)
    if (action === 'history') {
      return NextResponse.json({ jobs: listJobs() });
    }

    // Preview filter: just count leads that match
    if (action === 'count') {
      const db = getDb();
      const city = searchParams.get('city') || '';
      const minScore = searchParams.get('minScore');
      const maxScore = searchParams.get('maxScore');
      const keyword = searchParams.get('keyword') || '';
      const contactStatus = searchParams.get('contactStatus') || '';
      const onlyWithEmail = searchParams.get('onlyWithEmail') !== 'false';

      const conditions: string[] = ["status != 'rejected'"];
      const params: (string | number)[] = [];

      if (onlyWithEmail) {
        conditions.push("((email IS NOT NULL AND email != '') OR (entscheider_email IS NOT NULL AND entscheider_email != '') OR (all_emails IS NOT NULL AND all_emails != '' AND all_emails != '[]'))");
      }
      if (city) {
        conditions.push("(city = ? OR city LIKE ? || ' %' OR city LIKE ? || '-%')");
        params.push(city, city, city);
      }
      if (minScore) { conditions.push("score >= ?"); params.push(parseInt(minScore)); }
      if (maxScore) { conditions.push("score <= ?"); params.push(parseInt(maxScore)); }
      if (keyword) {
        conditions.push("(found_via_keywords LIKE '%' || ? || '%' OR category LIKE '%' || ? || '%')");
        params.push(keyword, keyword);
      }
      if (contactStatus) { conditions.push("contact_status = ?"); params.push(contactStatus); }

      const totalRow = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE ${conditions.join(' AND ')}`).get(...params) as { c: number };
      const sampleRows = db.prepare(`
        SELECT id, name, city, score, email, entscheider_email, entscheider_name, contact_status
        FROM leads WHERE ${conditions.join(' AND ')}
        ORDER BY score ASC, created_at DESC
        LIMIT 50
      `).all(...params);

      return NextResponse.json({ count: totalRow.c, sample: sampleRows });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
