import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { scrapeGoogleMaps, normalizeWebsite, type ScrapedBusiness } from '@/lib/maps-scraper';

/**
 * GET /api/scraper/maps - Get scraper job history and results
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Get specific job
      const job = db.prepare('SELECT * FROM scraper_jobs WHERE id = ?').get(Number(jobId));
      if (!job) {
        return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
      }
      return NextResponse.json(job);
    }

    // Get all jobs (latest first)
    const jobs = db.prepare(
      'SELECT id, keyword, max_pages, status, businesses_found, businesses_imported, businesses_duplicate, errors, started_at, completed_at FROM scraper_jobs ORDER BY id DESC LIMIT 50'
    ).all();

    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    console.error('Scraper GET error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Scraper-Jobs' }, { status: 500 });
  }
}

/**
 * POST /api/scraper/maps - Start a new scraping job
 *
 * Body: { keyword: string, maxPages?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { keyword, maxPages = 5 } = body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
      return NextResponse.json(
        { error: 'Keyword ist erforderlich (min. 2 Zeichen)' },
        { status: 400 }
      );
    }

    const cleanKeyword = keyword.trim();
    const pages = Math.min(Math.max(1, Number(maxPages) || 5), 20);

    // Create job entry
    const jobResult = db.prepare(
      "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
    ).run(cleanKeyword, pages);
    const jobId = Number(jobResult.lastInsertRowid);

    // Start scraping (runs in the same request for simplicity)
    // For very large scrapes, you'd want to use a background worker
    let scrapeResult;
    try {
      scrapeResult = await scrapeGoogleMaps(cleanKeyword, pages);
    } catch (err) {
      db.prepare(
        "UPDATE scraper_jobs SET status = 'error', errors = ?, completed_at = datetime('now') WHERE id = ?"
      ).run(JSON.stringify([err instanceof Error ? err.message : 'Scraping fehlgeschlagen']), jobId);

      return NextResponse.json({
        jobId,
        error: 'Scraping fehlgeschlagen',
        details: err instanceof Error ? err.message : 'Unbekannter Fehler',
      }, { status: 500 });
    }

    // Import businesses into leads table
    const importResult = importBusinessesToLeads(db, scrapeResult.businesses, cleanKeyword);

    // Update job with results
    db.prepare(
      `UPDATE scraper_jobs SET
        status = 'completed',
        businesses_found = ?,
        businesses_imported = ?,
        businesses_duplicate = ?,
        errors = ?,
        results = ?,
        completed_at = datetime('now')
      WHERE id = ?`
    ).run(
      scrapeResult.totalFound,
      importResult.imported,
      importResult.duplicates,
      JSON.stringify(scrapeResult.errors),
      JSON.stringify(scrapeResult.businesses),
      jobId,
    );

    return NextResponse.json({
      jobId,
      keyword: cleanKeyword,
      pagesScraped: scrapeResult.pagesScraped,
      businessesFound: scrapeResult.totalFound,
      imported: importResult.imported,
      duplicates: importResult.duplicates,
      skipped: importResult.skipped,
      duration: scrapeResult.duration,
      errors: scrapeResult.errors,
      businesses: scrapeResult.businesses,
    });
  } catch (error: unknown) {
    console.error('Scraper POST error:', error);
    return NextResponse.json(
      { error: 'Scraper-Fehler', details: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * Import scraped businesses into the leads table
 */
function importBusinessesToLeads(
  db: ReturnType<typeof getDb>,
  businesses: ScrapedBusiness[],
  keyword: string,
): { imported: number; duplicates: number; skipped: number } {
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;

  const insertLead = db.prepare(`
    INSERT INTO leads (name, website_original, website_normalized, phone, city, status, found_via_keywords, score, rating)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, 'pending')
  `);

  const updateSeen = db.prepare(`
    UPDATE leads SET
      times_found = times_found + 1,
      last_seen_at = datetime('now'),
      found_via_keywords = CASE
        WHEN found_via_keywords NOT LIKE '%' || ? || '%'
        THEN found_via_keywords || ', ' || ?
        ELSE found_via_keywords
      END
    WHERE website_normalized = ?
  `);

  const checkExists = db.prepare(
    'SELECT id, website_normalized FROM leads WHERE website_normalized = ?'
  );

  const importAll = db.transaction(() => {
    for (const biz of businesses) {
      // Skip businesses without a name
      if (!biz.name || biz.name.length < 2) {
        skipped++;
        continue;
      }

      // Normalize website for dedup
      const websiteNorm = biz.website
        ? normalizeWebsite(biz.website)
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.maps-lead';

      // Check if lead already exists
      const existing = checkExists.get(websiteNorm) as { id: number } | undefined;

      if (existing) {
        // Update times_found
        updateSeen.run(keyword, keyword, websiteNorm);
        duplicates++;
      } else {
        try {
          insertLead.run(
            biz.name,
            biz.website || null,
            websiteNorm,
            biz.phone || null,
            biz.city || 'Unbekannt',
            keyword,
          );
          imported++;
        } catch (err) {
          // Unique constraint violation or other DB error
          console.error(`Failed to import "${biz.name}":`, err);
          skipped++;
        }
      }
    }
  });

  importAll();

  return { imported, duplicates, skipped };
}
