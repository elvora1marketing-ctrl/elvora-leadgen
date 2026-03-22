import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { scrapeGoogleMapsFree } from '@/lib/maps-scraper-free';
import { normalizeWebsite, deduplicateBusinesses, type ScrapedBusiness } from '@/lib/maps-scraper';
import { expandCityToStadtteile } from '@/lib/stadtteile';
import { findCitiesInRadius } from '@/lib/umkreis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scraper/maps-free/stream - Free scraping (Puppeteer, no API key)
 *
 * Body: { keywords: string[], cities: string[], deepScan?: boolean, radiusSearch?: boolean, radiusKm?: number }
 *
 * Returns SSE stream with progress updates. No maxPages needed - gets ALL results.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, cities, deepScan = false, radiusSearch = false, radiusKm = 0 } = body as {
    keywords: string[];
    cities: string[];
    deepScan?: boolean;
    radiusSearch?: boolean;
    radiusKm?: number;
  };

  if (!keywords?.length || !cities?.length) {
    return new Response(JSON.stringify({ error: 'Keywords und Städte erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Umkreissuche: expand selected cities with nearby cities within radius
  const effectiveCities: string[] = radiusSearch && radiusKm > 0
    ? findCitiesInRadius(cities, radiusKm)
    : cities;

  // Tiefenscan: expand cities into their Stadtteile
  const searchLocations: string[] = deepScan
    ? effectiveCities.flatMap(city => expandCityToStadtteile(city))
    : effectiveCities;

  const db = getDb();
  const totalSearches = keywords.length * searchLocations.length;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed
        }
      }

      const allBusinesses: ScrapedBusiness[] = [];
      let totalImported = 0;
      let totalDuplicates = 0;
      let totalSkipped = 0;
      let searchIndex = 0;
      const allErrors: string[] = [];
      const startTime = Date.now();

      // Create a batch job entry
      const radiusLabel = radiusSearch && radiusKm > 0 ? ` +${radiusKm}km Umkreis` : '';
      const jobLabel = deepScan
        ? `Free-Scan: ${keywords.join(', ')} × ${cities.join(', ')}${radiusLabel} (${searchLocations.length} Stadtteile)`
        : `Free-Batch: ${keywords.join(', ')} × ${effectiveCities.join(', ')}${radiusLabel}`;
      const jobResult = db.prepare(
        "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, 0, 'running', datetime('now'))"
      ).run(jobLabel);
      const jobId = Number(jobResult.lastInsertRowid);

      send({
        type: 'batch_start',
        jobId,
        totalSearches,
        keywords,
        cities,
        searchLocations,
        deepScan,
        maxPages: 0,
        mode: 'free',
      });

      for (const kw of keywords) {
        for (const location of searchLocations) {
          searchIndex++;
          const fullKeyword = `${kw.trim()} ${location}`;

          send({
            type: 'search_start',
            keyword: fullKeyword,
            currentSearch: searchIndex,
            totalSearches,
            totalFound: allBusinesses.length,
            totalImported,
            totalDuplicates,
          });

          try {
            const result = await scrapeGoogleMapsFree(fullKeyword, (progress) => {
              send({
                type: 'page_progress',
                keyword: fullKeyword,
                currentSearch: searchIndex,
                totalSearches,
                currentPage: progress.currentPage,
                totalPages: progress.totalPages,
                pageResults: progress.businessesFound,
                totalFound: allBusinesses.length + progress.businessesFound,
                totalImported,
                totalDuplicates,
              });
            });

            // Import results
            const importResult = importBusinessesToLeads(db, result.businesses, fullKeyword);
            totalImported += importResult.imported;
            totalDuplicates += importResult.duplicates;
            totalSkipped += importResult.skipped;
            allBusinesses.push(...result.businesses);

            if (result.errors.length > 0) {
              allErrors.push(...result.errors.map(e => `${fullKeyword}: ${e}`));
            }

            send({
              type: 'search_complete',
              keyword: fullKeyword,
              currentSearch: searchIndex,
              totalSearches,
              searchFound: result.totalFound,
              searchImported: importResult.imported,
              searchDuplicates: importResult.duplicates,
              searchPages: result.pagesScraped,
              searchDuration: result.duration,
              totalFound: allBusinesses.length,
              totalImported,
              totalDuplicates,
              errors: result.errors,
            });
          } catch (err) {
            const errMsg = `${fullKeyword}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`;
            allErrors.push(errMsg);
            send({
              type: 'error',
              keyword: fullKeyword,
              currentSearch: searchIndex,
              totalSearches,
              error: errMsg,
              totalFound: allBusinesses.length,
              totalImported,
              totalDuplicates,
            });
          }

          // Delay between searches to avoid detection
          if (searchIndex < totalSearches) {
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
          }
        }
      }

      // Deduplicate final count
      const uniqueBusinesses = deduplicateBusinesses(allBusinesses);
      const totalDuration = Date.now() - startTime;

      // Update job
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
        uniqueBusinesses.length,
        totalImported,
        totalDuplicates,
        JSON.stringify(allErrors),
        JSON.stringify(uniqueBusinesses),
        jobId,
      );

      send({
        type: 'batch_complete',
        jobId,
        totalSearches,
        totalFound: uniqueBusinesses.length,
        totalImported,
        totalDuplicates,
        totalSkipped,
        totalPages: 0,
        duration: totalDuration,
        errors: allErrors,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
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
      if (!biz.name || biz.name.length < 2) {
        skipped++;
        continue;
      }

      const websiteNorm = biz.website
        ? normalizeWebsite(biz.website)
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.maps-lead';

      const existing = checkExists.get(websiteNorm) as { id: number } | undefined;

      if (existing) {
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
          console.error(`Failed to import "${biz.name}":`, err);
          skipped++;
        }
      }
    }
  });

  importAll();
  return { imported, duplicates, skipped };
}
