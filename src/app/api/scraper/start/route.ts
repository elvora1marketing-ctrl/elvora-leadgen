import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { jobRunner } from '@/lib/scraper-job-runner';
import { normalizeWebsite } from '@/lib/utils';
import { detectCategory } from '@/lib/lead-categories';
import { type ScrapedBusiness } from '@/lib/maps-scraper';
import { searchBusinesses, enrichSearchResults } from '@/lib/google-search-scraper';
import { scrapeGelbeSeiten, scrape11880 } from '@/lib/branchenportal-scraper';
import { parseImpressum } from '@/lib/impressum-parser';
import { getDistricts } from '@/lib/german-districts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function importBusinessesToLeads(
  db: ReturnType<typeof getDb>,
  businesses: ScrapedBusiness[],
  source: string,
  keyword: string,
): { imported: number; duplicates: number; skipped: number } {
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;

  const category = detectCategory(keyword);

  const insertLead = db.prepare(`
    INSERT INTO leads (name, website_original, website_normalized, phone, email, city, status, found_via_keywords, score, rating, category)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 'pending', ?)
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

  const checkExists = db.prepare('SELECT id, website_normalized FROM leads WHERE website_normalized = ?');

  const importAll = db.transaction(() => {
    for (const biz of businesses) {
      if (!biz.name || biz.name.length < 2) { skipped++; continue; }

      const websiteNorm = biz.website
        ? normalizeWebsite(biz.website)
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.bg-lead';

      const existing = checkExists.get(websiteNorm) as { id: number } | undefined;

      if (existing) {
        updateSeen.run(source, source, websiteNorm);
        if (biz.email) {
          db.prepare(`UPDATE leads SET email = COALESCE(NULLIF(email, ''), ?) WHERE id = ?`).run(biz.email, existing.id);
        }
        if (biz.phone) {
          db.prepare(`UPDATE leads SET phone = COALESCE(NULLIF(phone, ''), ?) WHERE id = ?`).run(biz.phone, existing.id);
        }
        duplicates++;
      } else {
        try {
          insertLead.run(biz.name, biz.website || null, websiteNorm, biz.phone || null, biz.email || null, biz.city || 'Unbekannt', source, category);
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

async function runScrapeJob(
  jobId: number,
  keywords: string[],
  cities: string[],
  sources: string[],
  options: { autoEnrich: boolean; deepScan: boolean },
) {
  const db = getDb();
  const signal = jobRunner.getAbortSignal(jobId);

  const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('searxng_url', 'brave_search_api_key')").all() as { key: string; value: string }[];
  const cfg: Record<string, string> = {};
  for (const r of settingsRows) cfg[r.key] = r.value;

  const totalSteps = keywords.length * cities.length * sources.length;
  let currentStep = 0;

  jobRunner.addLog(jobId, 'System', `Scraping: ${keywords.length} Keywords × ${cities.length} Städte × ${sources.length} Quellen`, 'info');
  if (options.deepScan) jobRunner.addLog(jobId, 'System', 'Tiefenscan aktiv — alle Seiten + Stadtteile', 'info');
  jobRunner.updateProgress(jobId, 0, totalSteps, 'Starte...');

  for (let ki = 0; ki < keywords.length; ki++) {
    if (signal?.aborted) break;
    const kw = keywords[ki];
    jobRunner.addLog(jobId, 'System', `━━━ Keyword ${ki + 1}/${keywords.length}: "${kw}" ━━━`, 'info');

    for (let ci = 0; ci < cities.length; ci++) {
      if (signal?.aborted) break;
      const ct = cities[ci];
      if (cities.length > 1) {
        jobRunner.addLog(jobId, 'System', `[${ci + 1}/${cities.length}] ${ct}`, 'info');
      }

      for (const sourceId of sources) {
        if (signal?.aborted) break;
        currentStep++;
        jobRunner.updateProgress(jobId, currentStep, totalSteps, `${kw} — ${ct} — ${sourceId}`);

        try {
          if (sourceId === 'maps') {
            await scrapeGoogleMaps(jobId, db, kw, ct, options.deepScan);
          } else if (sourceId === 'branchenportal') {
            await scrapeBranchenportale(jobId, db, kw, ct, options.autoEnrich, options.deepScan);
          } else if (sourceId === 'websearch') {
            await scrapeWebSearch(jobId, db, kw, ct, cfg, options.autoEnrich, options.deepScan);
          }
        } catch (err) {
          if (signal?.aborted) break;
          const msg = err instanceof Error ? err.message : 'Fehler';
          jobRunner.addLog(jobId, sourceId, `${ct}: ${msg}`, 'error');
        }
      }
    }
  }

  const stats = jobRunner.getJob(jobId)?.stats;
  if (!signal?.aborted) {
    jobRunner.addLog(jobId, 'System', `Fertig: ${stats?.totalFound || 0} gefunden, ${stats?.imported || 0} importiert, ${stats?.duplicates || 0} Duplikate`, 'success');
  }

  db.prepare(`
    UPDATE scraper_jobs SET
      status = ?,
      businesses_found = ?,
      businesses_imported = ?,
      businesses_duplicate = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(
    signal?.aborted ? 'aborted' : 'completed',
    stats?.totalFound || 0,
    stats?.imported || 0,
    stats?.duplicates || 0,
    jobId,
  );

  jobRunner.complete(jobId, !signal?.aborted);
}

async function scrapeGoogleMaps(jobId: number, db: ReturnType<typeof getDb>, keyword: string, city: string, deepScan: boolean) {
  const signal = jobRunner.getAbortSignal(jobId);
  const maxPages = deepScan ? 10 : 3;

  const apiKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'google_maps_api_key'").get() as { value: string } | undefined;
  const googleApiKey = apiKeySetting?.value || '';

  if (!googleApiKey) {
    jobRunner.addLog(jobId, 'Maps', `${city}: Google Maps API-Key fehlt`, 'error');
    return;
  }

  const { scrapeGoogleMaps: scrapeMaps } = await import('@/lib/maps-scraper');
  const searchQuery = `${keyword} ${city}`;

  jobRunner.addLog(jobId, 'Maps', `${city}: Suche "${searchQuery}"...`, 'info');

  if (signal?.aborted) return;

  const result = await scrapeMaps(searchQuery, maxPages, (progress) => {
    jobRunner.addLog(jobId, 'Maps', `${city}: Seite ${progress.currentPage}/${progress.totalPages} — ${progress.businessesFound} Firmen`, 'info');
  }, googleApiKey);

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      jobRunner.addLog(jobId, 'Maps', `${city}: ${err}`, 'error');
    }
  }

  if (result.businesses.length > 0) {
    const importResult = importBusinessesToLeads(db, result.businesses, `Maps: ${keyword} in ${city}`, keyword);
    const job = jobRunner.getJob(jobId);
    if (job) {
      job.stats.totalFound += result.businesses.length;
      job.stats.imported += importResult.imported;
      job.stats.duplicates += importResult.duplicates;
      job.stats.skipped += importResult.skipped;
    }
    jobRunner.addLog(jobId, 'Maps', `${city}: ${result.businesses.length} gefunden, +${importResult.imported} neu`, 'success');
    jobRunner.updateStats(jobId, job!.stats);
  }
}

async function scrapeBranchenportale(jobId: number, db: ReturnType<typeof getDb>, keyword: string, city: string, autoEnrich: boolean, deepScan: boolean) {
  const signal = jobRunner.getAbortSignal(jobId);
  const maxPages = deepScan ? 999 : 50;
  const allBiz: ScrapedBusiness[] = [];

  // Gelbe Seiten
  jobRunner.addLog(jobId, 'Portal', `${city}: Gelbe Seiten...`, 'info');
  try {
    const gs = await scrapeGelbeSeiten(keyword, city, maxPages);
    allBiz.push(...gs.businesses);
    jobRunner.addLog(jobId, 'Portal', `${city}: Gelbe Seiten — ${gs.businesses.length} Ergebnisse`, 'info');
  } catch (err) {
    jobRunner.addLog(jobId, 'Portal', `${city}: Gelbe Seiten Fehler — ${err instanceof Error ? err.message : 'Fehler'}`, 'error');
  }

  if (signal?.aborted) return;

  // 11880
  jobRunner.addLog(jobId, 'Portal', `${city}: 11880.com...`, 'info');
  try {
    const el = await scrape11880(keyword, city, maxPages);
    allBiz.push(...el.businesses);
    jobRunner.addLog(jobId, 'Portal', `${city}: 11880.com — ${el.businesses.length} Ergebnisse`, 'info');
  } catch (err) {
    jobRunner.addLog(jobId, 'Portal', `${city}: 11880 Fehler — ${err instanceof Error ? err.message : 'Fehler'}`, 'error');
  }

  if (signal?.aborted) return;

  // Enrichment
  if (autoEnrich && allBiz.length > 0) {
    const withWebsite = allBiz.filter(b => b.website && !b.email);
    if (withWebsite.length > 0) {
      jobRunner.addLog(jobId, 'Portal', `${city}: E-Mail-Enrichment ${withWebsite.length} Firmen...`, 'info');
      const concurrency = 15;
      let done = 0;
      for (let i = 0; i < withWebsite.length; i += concurrency) {
        if (signal?.aborted) break;
        const batch = withWebsite.slice(i, i + concurrency);
        const results = await Promise.allSettled(
          batch.map(async biz => {
            const imp = await parseImpressum(biz.website!);
            return { email: imp.emails[0] || null, phone: imp.phones[0] || null };
          })
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled') {
            if (r.value.email) batch[j].email = r.value.email;
            if (r.value.phone && !batch[j].phone) batch[j].phone = r.value.phone;
          }
        }
        done += batch.length;
        jobRunner.addLog(jobId, 'Portal', `${city}: Enrichment ${done}/${withWebsite.length}`, 'info');
      }
    }
  }

  if (allBiz.length > 0) {
    const result = importBusinessesToLeads(db, allBiz, `Branchenportal: ${keyword} in ${city}`, keyword);
    const job = jobRunner.getJob(jobId);
    if (job) {
      job.stats.totalFound += allBiz.length;
      job.stats.imported += result.imported;
      job.stats.duplicates += result.duplicates;
      job.stats.skipped += result.skipped;
    }
    jobRunner.addLog(jobId, 'Portal', `${city}: ${allBiz.length} gefunden, +${result.imported} neu`, 'success');
    jobRunner.updateStats(jobId, job!.stats);
  }
}

async function scrapeWebSearch(
  jobId: number, db: ReturnType<typeof getDb>, keyword: string, city: string,
  cfg: Record<string, string>, autoEnrich: boolean, deepScan: boolean,
) {
  const signal = jobRunner.getAbortSignal(jobId);
  const searchOpts = {
    searxngUrl: cfg.searxng_url || undefined,
    braveApiKey: cfg.brave_search_api_key || undefined,
  };

  // Multiple query variations to find more unique domains
  const searchQueries: Array<{ query: string; label: string }> = [
    { query: city, label: city },
  ];

  if (deepScan) {
    searchQueries.push(
      { query: `${city} in der Nähe`, label: `${city} (Nähe)` },
      { query: `${city} Bewertung`, label: `${city} (Bewertung)` },
      { query: `${city} Empfehlung`, label: `${city} (Empfehlung)` },
      { query: `${city} günstig`, label: `${city} (günstig)` },
      { query: `${city} Termin`, label: `${city} (Termin)` },
      { query: `bester ${keyword} ${city}`, label: `${city} (bester)` },
      { query: `${keyword} Firma ${city}`, label: `${city} (Firma)` },
    );
  }

  const allSearchResults: Array<{ title: string; url: string; snippet: string }> = [];
  const seenDomains = new Set<string>();
  let zeroResultsInRow = 0;

  for (let qi = 0; qi < searchQueries.length; qi++) {
    if (signal?.aborted) break;
    const sq = searchQueries[qi];
    const perQueryMax = 500;

    jobRunner.addLog(jobId, 'Web', `[${qi + 1}/${searchQueries.length}] "${keyword} ${sq.query}"`, 'info');

    const searchResult = await searchBusinesses(keyword, sq.query, perQueryMax, searchOpts);

    let newCount = 0;
    for (const sr of searchResult.searchResults) {
      const domain = normalizeWebsite(sr.url);
      if (!domain || seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      allSearchResults.push(sr);
      newCount++;
    }

    jobRunner.addLog(jobId, 'Web', `[${qi + 1}/${searchQueries.length}] ${sq.label}: +${newCount} neu (gesamt: ${allSearchResults.length})`, newCount > 0 ? 'info' : 'warn');

    // Stop early if 3 queries in a row returned nothing new
    if (newCount === 0) {
      zeroResultsInRow++;
      if (zeroResultsInRow >= 3 && qi > 0) {
        jobRunner.addLog(jobId, 'Web', `${city}: 3× keine neuen — überspringe Rest`, 'warn');
        break;
      }
    } else {
      zeroResultsInRow = 0;
    }
  }

  if (signal?.aborted) return;

  let businesses: ScrapedBusiness[] = allSearchResults.map(sr => ({
    name: sr.title || normalizeWebsite(sr.url),
    address: city, city, phone: null, website: sr.url, email: null,
    rating: null, reviews: null, category: keyword, placeId: null,
  }));

  // Enrichment
  if (autoEnrich && allSearchResults.length > 0) {
    jobRunner.addLog(jobId, 'Web', `${city}: Impressum-Analyse ${allSearchResults.length} Websites...`, 'info');
    const concurrency = 15;
    const enriched: ScrapedBusiness[] = [];

    for (let i = 0; i < allSearchResults.length; i += concurrency) {
      if (signal?.aborted) break;
      const batch = allSearchResults.slice(i, i + concurrency);
      const settled = await Promise.allSettled(
        batch.map(async (sr) => {
          const results = await enrichSearchResults([sr], city, 1);
          return results[0] || null;
        }),
      );
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled' && outcome.value) enriched.push(outcome.value);
      }
      const done = Math.min(i + concurrency, allSearchResults.length);
      jobRunner.addLog(jobId, 'Web', `${city}: Impressum ${done}/${allSearchResults.length}`, 'info');
    }

    if (enriched.length > 0) businesses = enriched;
  }

  if (businesses.length > 0) {
    const result = importBusinessesToLeads(db, businesses, `Websuche: ${keyword} in ${city}`, keyword);
    const job = jobRunner.getJob(jobId);
    if (job) {
      job.stats.totalFound += businesses.length;
      job.stats.imported += result.imported;
      job.stats.duplicates += result.duplicates;
      job.stats.skipped += result.skipped;
    }
    jobRunner.addLog(jobId, 'Web', `${city}: ${businesses.length} gefunden, +${result.imported} neu`, 'success');
    jobRunner.updateStats(jobId, job!.stats);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, cities, sources, autoEnrich = true, deepScan = false } = body as {
    keywords: string[];
    cities: string[];
    sources: string[];
    autoEnrich?: boolean;
    deepScan?: boolean;
  };

  if (!keywords?.length || !cities?.length || !sources?.length) {
    return Response.json({ error: 'Keywords, Cities und Sources erforderlich' }, { status: 400 });
  }

  const db = getDb();
  const jobLabel = `Hub: ${keywords.length} Keywords × ${cities.length} Städte`;
  const jobResult = db.prepare(
    "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
  ).run(jobLabel, keywords.length);
  const jobId = Number(jobResult.lastInsertRowid);

  jobRunner.createJob(jobId);

  // Fire and forget — runs in background regardless of HTTP connection
  runScrapeJob(jobId, keywords, cities, sources, { autoEnrich, deepScan }).catch(err => {
    console.error('Background scrape job error:', err);
    jobRunner.addLog(jobId, 'System', `Kritischer Fehler: ${err}`, 'error');
    jobRunner.complete(jobId, false);
  });

  return Response.json({ jobId, message: 'Job gestartet' });
}
