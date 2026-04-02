import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { scrapeGoogleMaps, normalizeWebsite, deduplicateBusinesses, type ScrapedBusiness } from '@/lib/maps-scraper';
import { extractEmails } from '@/lib/website-analyzer';
import { expandCityToStadtteile } from '@/lib/stadtteile';
import { findCitiesInRadius } from '@/lib/umkreis';

const EMAIL_FETCH_TIMEOUT = 8000;
const EMAIL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMAIL_FETCH_TIMEOUT);
    let url = websiteUrl;
    if (!url.startsWith('http')) url = 'https://' + url;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': EMAIL_USER_AGENT },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    const emails = extractEmails(html);
    return emails.length > 0 ? emails[0] : null;
  } catch {
    return null;
  }
}

async function scrapeEmailsForBusinesses(
  businesses: ScrapedBusiness[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const withWebsite = businesses.filter(b => b.website && !b.email);
  let done = 0;
  for (const biz of withWebsite) {
    const email = await scrapeEmailFromWebsite(biz.website!);
    if (email) biz.email = email;
    done++;
    if (done % 5 === 0) onProgress?.(done, withWebsite.length);
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scraper/maps/stream - Start batch scraping with SSE live progress
 *
 * Body: { keywords: string[], cities: string[], maxPages?: number }
 *
 * Returns a Server-Sent Events stream with progress updates.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, cities, maxPages = 3, deepScan = false, radiusSearch = false, radiusKm = 0 } = body as {
    keywords: string[];
    cities: string[];
    maxPages?: number;
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

  // Load API key
  const apiKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'google_maps_api_key'").get() as { value: string } | undefined;
  const googleApiKey = apiKeySetting?.value || '';

  if (!googleApiKey) {
    return new Response(JSON.stringify({ error: 'Google Maps API-Key fehlt. Bitte unter Einstellungen hinterlegen.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pages = Math.min(Math.max(1, Number(maxPages) || 3), 3);
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
        ? `Tiefenscan: ${keywords.join(', ')} × ${cities.join(', ')}${radiusLabel} (${searchLocations.length} Stadtteile)`
        : `Batch: ${keywords.join(', ')} × ${effectiveCities.join(', ')}${radiusLabel}`;
      const jobResult = db.prepare(
        "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
      ).run(jobLabel, pages);
      const jobId = Number(jobResult.lastInsertRowid);

      send({
        type: 'batch_start',
        jobId,
        totalSearches,
        keywords,
        cities,
        searchLocations,
        deepScan,
        maxPages: pages,
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
            const result = await scrapeGoogleMaps(fullKeyword, pages, (progress) => {
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
            }, googleApiKey);

            // Scrape emails from business websites
            const bizWithWebsite = result.businesses.filter(b => b.website);
            if (bizWithWebsite.length > 0) {
              send({
                type: 'email_scrape_start',
                keyword: fullKeyword,
                totalWebsites: bizWithWebsite.length,
              });

              await scrapeEmailsForBusinesses(result.businesses, (done, total) => {
                send({
                  type: 'email_scrape_progress',
                  keyword: fullKeyword,
                  emailsDone: done,
                  emailsTotal: total,
                  emailsFound: result.businesses.filter(b => b.email).length,
                });
              });

              const emailsFound = result.businesses.filter(b => b.email).length;
              send({
                type: 'email_scrape_complete',
                keyword: fullKeyword,
                emailsFound,
                totalWebsites: bizWithWebsite.length,
              });
            }

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

          // Delay between searches to avoid rate limiting
          if (searchIndex < totalSearches) {
            await new Promise(resolve => setTimeout(resolve, 1000));
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
        totalPages: searchIndex * pages,
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
    INSERT INTO leads (name, website_original, website_normalized, phone, email, city, status, found_via_keywords, score, rating)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 'pending')
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
        if (biz.email) {
          db.prepare(`UPDATE leads SET email = COALESCE(NULLIF(email, ''), ?) WHERE id = ?`).run(biz.email, existing.id);
        }
        duplicates++;
      } else {
        try {
          insertLead.run(
            biz.name,
            biz.website || null,
            websiteNorm,
            biz.phone || null,
            biz.email || null,
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
