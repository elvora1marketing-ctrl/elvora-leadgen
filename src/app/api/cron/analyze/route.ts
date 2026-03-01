import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { analyzeWebsite } from '@/lib/website-analyzer';

/**
 * POST /api/cron/analyze - Nightly batch website analysis
 *
 * Analyzes all leads that have a website but haven't been scored yet.
 * Designed to be called by a cron job (e.g., every night at 2am).
 *
 * crontab example:
 *   0 2 * * * curl -X POST http://localhost:3000/api/cron/analyze -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get all unanalyzed leads with websites (max 100 per run to avoid timeouts)
    const leads = db.prepare(`
      SELECT id, name, website_original
      FROM leads
      WHERE website_original IS NOT NULL
        AND website_original != ''
        AND score = 0
        AND status != 'rejected'
      ORDER BY created_at DESC
      LIMIT 100
    `).all() as { id: number; name: string; website_original: string }[];

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine unanalysierten Leads gefunden',
        analyzed: 0,
      });
    }

    console.log(`[Cron/Analyze] Starting batch analysis of ${leads.length} leads`);

    const updateStmt = db.prepare(`
      UPDATE leads
      SET score = ?, problems = ?, seo_issues = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    let analyzed = 0;
    let errors = 0;
    const startTime = Date.now();

    for (const lead of leads) {
      try {
        const result = await analyzeWebsite(lead.website_original);

        updateStmt.run(
          result.score,
          JSON.stringify(result.problems),
          JSON.stringify(result.seoIssues),
          lead.id
        );

        analyzed++;
        console.log(`[Cron/Analyze] ${lead.name}: Score ${result.score}/100`);

        // 2 second delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        errors++;
        console.error(`[Cron/Analyze] Error analyzing ${lead.name}:`, err);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`[Cron/Analyze] Done. ${analyzed} analyzed, ${errors} errors in ${duration}s`);

    return NextResponse.json({
      success: true,
      analyzed,
      errors,
      total: leads.length,
      durationSeconds: duration,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[Cron/Analyze]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
