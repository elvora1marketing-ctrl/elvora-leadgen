import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { analyzeWebsite } from '@/lib/website-analyzer';
import { requireAuth } from '@/lib/auth';

const BATCH_CONCURRENCY = 10;

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json() as {
      leadId?: number;
      batch?: boolean;
      limit?: number;
      concurrency?: number;
    };

    const db = getDb();

    if (body.leadId) {
      const lead = db.prepare('SELECT id, name, website_original, score FROM leads WHERE id = ?').get(body.leadId) as {
        id: number; name: string; website_original: string | null; score: number;
      } | undefined;

      if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
      if (!lead.website_original) return NextResponse.json({ error: 'Lead hat keine Website' }, { status: 400 });

      const result = await analyzeWebsite(lead.website_original);
      const bestEmail = result.contactEmails.length > 0 ? result.contactEmails[0] : null;
      const allEmailsJson = result.contactEmails.length > 0 ? JSON.stringify(result.contactEmails) : null;

      db.prepare(`
        UPDATE leads
        SET score = ?, problems = ?, seo_issues = ?,
            email = COALESCE(NULLIF(email, ''), ?),
            all_emails = ?,
            entscheider_name = COALESCE(?, entscheider_name),
            entscheider_email = COALESCE(?, entscheider_email),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        result.score,
        JSON.stringify(result.problems),
        JSON.stringify(result.seoIssues),
        bestEmail,
        allEmailsJson,
        result.entscheiderName,
        result.entscheiderEmail,
        lead.id
      );

      return NextResponse.json({
        success: true,
        lead: { id: lead.id, name: lead.name },
        analysis: result,
      });
    }

    if (body.batch) {
      const limit = body.limit || 50;
      const concurrency = body.concurrency || BATCH_CONCURRENCY;

      const leads = db.prepare(`
        SELECT id, name, website_original
        FROM leads
        WHERE website_original IS NOT NULL
          AND website_original != ''
          AND score = 0
          AND status != 'rejected'
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit) as { id: number; name: string; website_original: string }[];

      if (leads.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Keine unanalysierten Leads mit Website gefunden',
          analyzed: 0,
          total: 0,
        });
      }

      const results: { id: number; name: string; score: number; emails: number; entscheider: string | null; error?: string }[] = [];

      const updateStmt = db.prepare(`
        UPDATE leads
        SET score = ?, problems = ?, seo_issues = ?,
            email = COALESCE(NULLIF(email, ''), ?),
            all_emails = ?,
            entscheider_name = COALESCE(?, entscheider_name),
            entscheider_email = COALESCE(?, entscheider_email),
            updated_at = datetime('now')
        WHERE id = ?
      `);

      const analyzeLead = async (lead: { id: number; name: string; website_original: string }) => {
        try {
          const result = await analyzeWebsite(lead.website_original);
          const bestEmail = result.contactEmails.length > 0 ? result.contactEmails[0] : null;
          const allEmailsJson = result.contactEmails.length > 0 ? JSON.stringify(result.contactEmails) : null;

          updateStmt.run(
            result.score,
            JSON.stringify(result.problems),
            JSON.stringify(result.seoIssues),
            bestEmail,
            allEmailsJson,
            result.entscheiderName,
            result.entscheiderEmail,
            lead.id
          );

          results.push({
            id: lead.id,
            name: lead.name,
            score: result.score,
            emails: result.contactEmails.length,
            entscheider: result.entscheiderName,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
          results.push({ id: lead.id, name: lead.name, score: 0, emails: 0, entscheider: null, error: errMsg });
        }
      };

      // Process in parallel chunks
      for (let i = 0; i < leads.length; i += concurrency) {
        const chunk = leads.slice(i, i + concurrency);
        await Promise.allSettled(chunk.map(lead => analyzeLead(lead)));
      }

      const analyzed = results.filter(r => !r.error).length;
      const totalEmails = results.reduce((sum, r) => sum + r.emails, 0);
      const avgScore = analyzed > 0
        ? Math.round(results.filter(r => !r.error).reduce((sum, r) => sum + r.score, 0) / analyzed)
        : 0;

      return NextResponse.json({
        success: true,
        analyzed,
        errors: results.filter(r => r.error).length,
        total: leads.length,
        averageScore: avgScore,
        totalEmails,
        entscheiderFound: results.filter(r => r.entscheider).length,
        results,
      });
    }

    return NextResponse.json({ error: 'leadId oder batch: true angeben' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[Analyze API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || '';
    const filterCity = searchParams.get('city') || '';
    const filterKeyword = searchParams.get('keyword') || '';
    const forceAll = searchParams.get('force') === '1';

    const conditions: string[] = [
      "website_original IS NOT NULL",
      "website_original != ''",
      "status != 'rejected'",
    ];
    if (!forceAll) conditions.push("score = 0");
    const params: (string | number)[] = [];

    if (filterStatus) { conditions.push("status = ?"); params.push(filterStatus); }
    if (filterCity) { conditions.push("(city = ? OR city LIKE ? || ' %' OR city LIKE ? || '-%')"); params.push(filterCity, filterCity, filterCity); }
    if (filterKeyword) { conditions.push("found_via_keywords LIKE '%' || ? || '%'"); params.push(filterKeyword); }

    const whereClause = conditions.join(' AND ');

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN website_original IS NOT NULL AND website_original != '' THEN 1 ELSE 0 END) as with_website,
        SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END) as analyzed,
        SUM(CASE WHEN website_original IS NOT NULL AND website_original != '' AND score = 0 THEN 1 ELSE 0 END) as pending,
        ROUND(AVG(CASE WHEN score > 0 THEN score ELSE NULL END), 1) as avg_score
      FROM leads
      WHERE status != 'rejected'
    `).get() as {
      total: number; with_website: number; analyzed: number; pending: number; avg_score: number | null;
    };

    const distribution = db.prepare(`
      SELECT
        CASE
          WHEN score = 0 THEN 'nicht_analysiert'
          WHEN score < 30 THEN 'schlecht'
          WHEN score < 50 THEN 'maessig'
          WHEN score < 70 THEN 'durchschnitt'
          WHEN score < 85 THEN 'gut'
          ELSE 'sehr_gut'
        END as category,
        COUNT(*) as count
      FROM leads
      WHERE website_original IS NOT NULL AND website_original != ''
        AND status != 'rejected'
      GROUP BY category
      ORDER BY
        CASE category
          WHEN 'nicht_analysiert' THEN 0
          WHEN 'schlecht' THEN 1
          WHEN 'maessig' THEN 2
          WHEN 'durchschnitt' THEN 3
          WHEN 'gut' THEN 4
          WHEN 'sehr_gut' THEN 5
        END
    `).all();

    const pendingIds = db.prepare(`
      SELECT id FROM leads
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `).all(...params) as { id: number }[];

    const categoryConditions: string[] = ["status != 'rejected'"];
    const categoryParams: (string | number)[] = [];
    if (filterStatus) { categoryConditions.push("status = ?"); categoryParams.push(filterStatus); }
    if (filterCity) { categoryConditions.push("(city = ? OR city LIKE ? || ' %' OR city LIKE ? || '-%')"); categoryParams.push(filterCity, filterCity, filterCity); }
    if (filterKeyword) { categoryConditions.push("found_via_keywords LIKE '%' || ? || '%'"); categoryParams.push(filterKeyword); }
    const categoryTotal = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN website_original IS NOT NULL AND website_original != '' THEN 1 ELSE 0 END) as with_website,
        SUM(CASE WHEN website_original IS NOT NULL AND website_original != '' AND score > 0 THEN 1 ELSE 0 END) as already_analyzed
      FROM leads
      WHERE ${categoryConditions.join(' AND ')}
    `).get(...categoryParams) as { total: number; with_website: number; already_analyzed: number };

    return NextResponse.json({
      stats,
      distribution,
      pendingIds: pendingIds.map(r => r.id),
      categoryInfo: {
        total: categoryTotal.total,
        withWebsite: categoryTotal.with_website,
        alreadyAnalyzed: categoryTotal.already_analyzed,
        noWebsite: categoryTotal.total - categoryTotal.with_website,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
