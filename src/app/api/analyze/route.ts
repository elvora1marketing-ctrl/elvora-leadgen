import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { analyzeWebsite } from '@/lib/website-analyzer';

/**
 * POST /api/analyze - Analyze website(s)
 * Body: { leadId: number } - analyze single lead
 *   OR: { batch: true, limit?: number } - analyze all unscored leads with websites
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      leadId?: number;
      batch?: boolean;
      limit?: number;
    };

    const db = getDb();

    // Single lead analysis
    if (body.leadId) {
      const lead = db.prepare('SELECT id, name, website_original, score FROM leads WHERE id = ?').get(body.leadId) as {
        id: number; name: string; website_original: string | null; score: number;
      } | undefined;

      if (!lead) {
        return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
      }

      if (!lead.website_original) {
        return NextResponse.json({ error: 'Lead hat keine Website' }, { status: 400 });
      }

      const result = await analyzeWebsite(lead.website_original);

      // Update lead in DB - also save first found email if lead has no email yet
      const firstEmail = result.contactEmails.length > 0 ? result.contactEmails[0] : null;
      if (firstEmail) {
        db.prepare(`
          UPDATE leads
          SET score = ?, problems = ?, seo_issues = ?, email = COALESCE(NULLIF(email, ''), ?), updated_at = datetime('now')
          WHERE id = ?
        `).run(
          result.score,
          JSON.stringify(result.problems),
          JSON.stringify(result.seoIssues),
          firstEmail,
          lead.id
        );
      } else {
        db.prepare(`
          UPDATE leads
          SET score = ?, problems = ?, seo_issues = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          result.score,
          JSON.stringify(result.problems),
          JSON.stringify(result.seoIssues),
          lead.id
        );
      }

      return NextResponse.json({
        success: true,
        lead: { id: lead.id, name: lead.name },
        analysis: result,
      });
    }

    // Batch analysis
    if (body.batch) {
      const limit = body.limit || 50;

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

      const results: { id: number; name: string; score: number; error?: string }[] = [];

      const updateStmt = db.prepare(`
        UPDATE leads
        SET score = ?, problems = ?, seo_issues = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      const updateWithEmailStmt = db.prepare(`
        UPDATE leads
        SET score = ?, problems = ?, seo_issues = ?, email = COALESCE(NULLIF(email, ''), ?), updated_at = datetime('now')
        WHERE id = ?
      `);

      for (const lead of leads) {
        try {
          const result = await analyzeWebsite(lead.website_original);

          const firstEmail = result.contactEmails.length > 0 ? result.contactEmails[0] : null;
          if (firstEmail) {
            updateWithEmailStmt.run(
              result.score,
              JSON.stringify(result.problems),
              JSON.stringify(result.seoIssues),
              firstEmail,
              lead.id
            );
          } else {
            updateStmt.run(
              result.score,
              JSON.stringify(result.problems),
              JSON.stringify(result.seoIssues),
              lead.id
            );
          }

          results.push({ id: lead.id, name: lead.name, score: result.score });

          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
          results.push({ id: lead.id, name: lead.name, score: 0, error: errMsg });
        }
      }

      const analyzed = results.filter(r => !r.error).length;
      const avgScore = analyzed > 0
        ? Math.round(results.filter(r => !r.error).reduce((sum, r) => sum + r.score, 0) / analyzed)
        : 0;

      return NextResponse.json({
        success: true,
        analyzed,
        errors: results.filter(r => r.error).length,
        total: leads.length,
        averageScore: avgScore,
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

/**
 * GET /api/analyze - Get analysis statistics & pending IDs
 * Supports optional filters: ?status=...&city=...&keyword=...
 * Without filters: returns ALL pending leads (no limit)
 * With filters: returns only pending leads matching the filter
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || '';
    const filterCity = searchParams.get('city') || '';
    const filterKeyword = searchParams.get('keyword') || '';

    // Build WHERE conditions for filters
    const conditions: string[] = [
      "website_original IS NOT NULL",
      "website_original != ''",
      "score = 0",
      "status != 'rejected'",
    ];
    const params: (string | number)[] = [];

    if (filterStatus) {
      conditions.push("status = ?");
      params.push(filterStatus);
    }

    if (filterCity) {
      conditions.push("(city = ? OR city LIKE ? || ' %' OR city LIKE ? || '-%')");
      params.push(filterCity, filterCity, filterCity);
    }

    if (filterKeyword) {
      conditions.push("found_via_keywords LIKE '%' || ? || '%'");
      params.push(filterKeyword);
    }

    const whereClause = conditions.join(' AND ');

    // Stats (unfiltered, for overview)
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

    // Score distribution
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

    // Get ALL pending IDs matching the filter (NO LIMIT)
    const pendingIds = db.prepare(`
      SELECT id FROM leads
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `).all(...params) as { id: number }[];

    return NextResponse.json({
      stats,
      distribution,
      pendingIds: pendingIds.map(r => r.id),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
