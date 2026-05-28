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
import { requireAuth } from '@/lib/auth';
import { configureSearXNGProxies } from '@/lib/searxng-proxy';

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
    INSERT INTO leads (name, website_original, website_normalized, phone, email, city, status, found_via_keywords, score, rating, category, lead_type)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 'pending', ?, 'business')
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
  options: { autoEnrich: boolean; deepScan: boolean; proxies?: string },
  completedSteps: string[] = [],
) {
  const db = getDb();
  const signal = jobRunner.getAbortSignal(jobId);
  const isResume = completedSteps.length > 0;
  const completedSet = new Set(completedSteps);

  if (options.proxies && options.proxies.trim()) {
    jobRunner.addLog(jobId, 'System', 'Proxy-Konfiguration fuer SearXNG...', 'info');
    const proxyResult = configureSearXNGProxies(options.proxies);
    if (proxyResult.error) {
      jobRunner.addLog(jobId, 'System', `Proxy-Fehler: ${proxyResult.error}`, 'error');
    } else {
      jobRunner.addLog(jobId, 'System', `${proxyResult.count.toLocaleString('de-DE')} Proxies in SearXNG konfiguriert — Neustart...`, 'success');
      await new Promise(r => setTimeout(r, 8000));
      jobRunner.addLog(jobId, 'System', 'SearXNG bereit', 'info');
    }
  }

  const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('searxng_url', 'brave_search_api_key')").all() as { key: string; value: string }[];
  const cfg: Record<string, string> = {};
  for (const r of settingsRows) cfg[r.key] = r.value;

  const totalSteps = keywords.length * cities.length;
  const alreadyDone = completedSteps.length;
  let currentStep = alreadyDone;

  if (isResume) {
    jobRunner.addLog(jobId, 'System', `Fortsetzen: ${alreadyDone} Schritte erledigt, ${totalSteps - alreadyDone} verbleibend`, 'info');
  }
  jobRunner.addLog(jobId, 'System', `Scraping: ${keywords.length} Keywords × ${cities.length} Städte × ${sources.length} Quellen`, 'info');
  if (options.deepScan) jobRunner.addLog(jobId, 'System', 'Tiefenscan aktiv — alle Seiten + Stadtteile', 'info');
  jobRunner.updateProgress(jobId, currentStep, totalSteps, isResume ? 'Fortsetzen...' : 'Starte...');

  let stopped = false;

  for (let ki = 0; ki < keywords.length; ki++) {
    if (signal?.aborted) { stopped = true; break; }
    const kw = keywords[ki];
    jobRunner.addLog(jobId, 'System', `━━━ Keyword ${ki + 1}/${keywords.length}: "${kw}" ━━━`, 'info');

    for (let ci = 0; ci < cities.length; ci++) {
      if (signal?.aborted) { stopped = true; break; }
      const ct = cities[ci];
      const stepKey = `${kw}||${ct}`;

      if (completedSet.has(stepKey)) {
        currentStep++;
        continue;
      }

      if (cities.length > 1) {
        jobRunner.addLog(jobId, 'System', `[${ci + 1}/${cities.length}] ${ct}`, 'info');
      }

      const sourcePromises = sources.map(async (sourceId) => {
        if (signal?.aborted) return;
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
          if (signal?.aborted) return;
          const msg = err instanceof Error ? err.message : 'Fehler';
          jobRunner.addLog(jobId, sourceId, `${ct}: Fehler — ${msg}`, 'error');
        }
      });
      await Promise.allSettled(sourcePromises);

      currentStep++;
      completedSteps.push(stepKey);
      completedSet.add(stepKey);

      const stats = jobRunner.getJob(jobId)?.stats;
      db.prepare(
        "UPDATE scraper_jobs SET completed_keywords = ?, businesses_found = ?, businesses_imported = ?, businesses_duplicate = ? WHERE id = ?"
      ).run(JSON.stringify(completedSteps), stats?.totalFound || 0, stats?.imported || 0, stats?.duplicates || 0, jobId);
    }

    if (stopped) break;
  }

  const stats = jobRunner.getJob(jobId)?.stats;
  const dbStatus = stopped ? 'stopped' : 'completed';

  if (!stopped) {
    jobRunner.addLog(jobId, 'System', `Fertig: ${stats?.totalFound || 0} gefunden, ${stats?.imported || 0} importiert, ${stats?.duplicates || 0} Duplikate`, 'success');
  } else {
    jobRunner.addLog(jobId, 'System', `Gestoppt bei ${currentStep}/${totalSteps} — kann fortgesetzt werden`, 'warn');
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
    dbStatus,
    stats?.totalFound || 0,
    stats?.imported || 0,
    stats?.duplicates || 0,
    jobId,
  );

  jobRunner.complete(jobId, !stopped);
}

async function scrapeGoogleMaps(jobId: number, db: ReturnType<typeof getDb>, keyword: string, city: string, deepScan: boolean) {
  const signal = jobRunner.getAbortSignal(jobId);

  const apiKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'google_maps_api_key'").get() as { value: string } | undefined;
  const googleApiKey = apiKeySetting?.value || '';

  if (!googleApiKey) {
    jobRunner.addLog(jobId, 'Maps', `${city}: Google Maps API-Key fehlt`, 'error');
    return;
  }

  const { scrapeGoogleMaps: scrapeMaps, deduplicateBusinesses } = await import('@/lib/maps-scraper');

  const queries: string[] = [`${keyword} ${city}`];

  if (deepScan) {
    const districts = getDistricts(city);
    const topDistricts = districts.slice(0, 5);
    for (const d of topDistricts) {
      queries.push(`${keyword} ${city} ${d}`);
    }
  }

  const allBiz: ScrapedBusiness[] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    if (signal?.aborted) break;
    const q = queries[qi];
    jobRunner.addLog(jobId, 'Maps', `${city}: Suche "${q}" [${qi + 1}/${queries.length}]`, 'info');

    const result = await scrapeMaps(q, 3, (progress) => {
      jobRunner.addLog(jobId, 'Maps', `${city}: Seite ${progress.currentPage}/${progress.totalPages} — ${progress.businessesFound} Firmen`, 'info');
    }, googleApiKey);

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        jobRunner.addLog(jobId, 'Maps', `${city}: ${err}`, 'error');
      }
    }

    allBiz.push(...result.businesses);
  }

  if (allBiz.length > 0) {
    const deduped = deduplicateBusinesses(allBiz);
    const importResult = importBusinessesToLeads(db, deduped, `Maps: ${keyword} in ${city}`, keyword);
    const job = jobRunner.getJob(jobId);
    if (job) {
      job.stats.totalFound += deduped.length;
      job.stats.imported += importResult.imported;
      job.stats.duplicates += importResult.duplicates;
      job.stats.skipped += importResult.skipped;
    }
    jobRunner.addLog(jobId, 'Maps', `${city}: ${deduped.length} gefunden, +${importResult.imported} neu`, 'success');
    jobRunner.updateStats(jobId, job!.stats);
  }
}

async function scrapeBranchenportale(jobId: number, db: ReturnType<typeof getDb>, keyword: string, city: string, autoEnrich: boolean, deepScan: boolean) {
  const signal = jobRunner.getAbortSignal(jobId);
  const maxPages = deepScan ? 999 : 50;
  const allBiz: ScrapedBusiness[] = [];

  // Gelbe Seiten + 11880 parallel
  jobRunner.addLog(jobId, 'Portal', `${city}: Gelbe Seiten + 11880 parallel...`, 'info');
  const [gsResult, elResult] = await Promise.allSettled([
    scrapeGelbeSeiten(keyword, city, maxPages),
    scrape11880(keyword, city, maxPages),
  ]);

  if (gsResult.status === 'fulfilled') {
    allBiz.push(...gsResult.value.businesses);
    jobRunner.addLog(jobId, 'Portal', `${city}: Gelbe Seiten — ${gsResult.value.businesses.length} Ergebnisse`, 'info');
  } else {
    jobRunner.addLog(jobId, 'Portal', `${city}: Gelbe Seiten Fehler — ${gsResult.reason}`, 'error');
  }

  if (elResult.status === 'fulfilled') {
    allBiz.push(...elResult.value.businesses);
    jobRunner.addLog(jobId, 'Portal', `${city}: 11880 — ${elResult.value.businesses.length} Ergebnisse`, 'info');
  } else {
    jobRunner.addLog(jobId, 'Portal', `${city}: 11880 Fehler — ${elResult.reason}`, 'error');
  }

  if (signal?.aborted) return;

  // Enrichment
  if (autoEnrich && allBiz.length > 0) {
    const withWebsite = allBiz.filter(b => b.website && !b.email);
    if (withWebsite.length > 0) {
      jobRunner.addLog(jobId, 'Portal', `${city}: E-Mail-Enrichment ${withWebsite.length} Firmen...`, 'info');
      const concurrency = 30;
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

  const allSearchResults: Array<{ title: string; url: string; snippet: string }> = [];
  const seenDomains = new Set<string>();

  function collectResults(searchResults: Array<{ title: string; url: string; snippet: string }>): number {
    let newCount = 0;
    for (const sr of searchResults) {
      const domain = normalizeWebsite(sr.url);
      if (!domain || seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      allSearchResults.push(sr);
      newCount++;
    }
    return newCount;
  }

  // === PHASE 1: Main query — deepest search, full depth, all sources ===
  const mainQuery = `${keyword} ${city}`;
  jobRunner.addLog(jobId, 'Web', `${city}: Hauptsuche "${mainQuery}"...`, 'info');
  const mainResult = await searchBusinesses(mainQuery, '', 500, searchOpts);
  const mainNew = collectResults(mainResult.searchResults);
  jobRunner.addLog(jobId, 'Web', `${city}: Hauptsuche — ${mainNew} unique`, 'info');

  if (signal?.aborted) return;

  // === PHASE 2: Variation queries — 3 at a time, fast mode (fewer SearXNG pages) ===
  const variationQueries = [
    `bester ${keyword} ${city}`,
    `${keyword} in ${city}`,
    `top ${keyword} ${city}`,
    `${keyword} ${city} Bewertung`,
    `${keyword} ${city} Empfehlung`,
    `${keyword} ${city} Kontakt`,
    `${keyword} Verzeichnis ${city}`,
    `${keyword} Liste ${city}`,
    `${keyword} ${city} Firma`,
    `${keyword} ${city} Adresse Telefon`,
    `${keyword} ${city} Termin`,
    `${keyword} ${city} Preise`,
    `${keyword} ${city} Öffnungszeiten`,
    `${keyword} ${city} in der Nähe`,
  ];

  const fastOpts = { ...searchOpts, fast: true };
  for (let i = 0; i < variationQueries.length; i += 3) {
    if (signal?.aborted) break;
    const batch = variationQueries.slice(i, i + 3);
    await Promise.allSettled(
      batch.map(async (q) => {
        const result = await searchBusinesses(q, '', 100, fastOpts);
        const newCount = collectResults(result.searchResults);
        if (newCount > 0) {
          jobRunner.addLog(jobId, 'Web', `${q.replace(`${keyword} `, '').replace(` ${city}`, '').replace(city, '').trim()}: +${newCount} (gesamt: ${allSearchResults.length})`, 'info');
        }
      })
    );
  }
  jobRunner.addLog(jobId, 'Web', `${city}: Core fertig — ${allSearchResults.length} unique`, 'info');

  // === PHASE 3: District queries (deep scan) — 5 at a time, fast mode ===
  if (deepScan) {
    const districts = getDistricts(city);
    if (districts.length > 0) {
      jobRunner.addLog(jobId, 'Web', `${city}: ${districts.length} Stadtteile...`, 'info');
      let districtZeros = 0;

      for (let i = 0; i < districts.length; i += 5) {
        if (signal?.aborted) break;
        if (districtZeros >= 15) {
          jobRunner.addLog(jobId, 'Web', `${city}: Stadtteile liefern nichts mehr — fertig`, 'warn');
          break;
        }
        const batch = districts.slice(i, i + 5);
        let batchNew = 0;
        await Promise.allSettled(
          batch.map(async (d) => {
            const r1 = await searchBusinesses(`${keyword} ${d} ${city}`, '', 50, fastOpts);
            const r2 = await searchBusinesses(`${keyword} ${d}`, '', 50, fastOpts);
            const n1 = collectResults(r1.searchResults);
            const n2 = collectResults(r2.searchResults);
            const total = n1 + n2;
            batchNew += total;
            if (total > 0) {
              jobRunner.addLog(jobId, 'Web', `${d}: +${total} (gesamt: ${allSearchResults.length})`, 'info');
            }
          })
        );
        if (batchNew === 0) {
          districtZeros += batch.length;
        } else {
          districtZeros = 0;
        }
      }
    }
  }

  jobRunner.addLog(jobId, 'Web', `${city}: ${allSearchResults.length} unique Websites gefunden`, 'success');

  if (signal?.aborted) return;

  let businesses: ScrapedBusiness[] = allSearchResults.map(sr => ({
    name: sr.title || normalizeWebsite(sr.url),
    address: city, city, phone: null, website: sr.url, email: null,
    rating: null, reviews: null, category: keyword, placeId: null,
  }));

  // Enrichment — 30 concurrent
  if (autoEnrich && allSearchResults.length > 0) {
    jobRunner.addLog(jobId, 'Web', `${city}: Impressum-Analyse ${allSearchResults.length} Websites...`, 'info');
    const enriched: ScrapedBusiness[] = [];

    for (let i = 0; i < allSearchResults.length; i += 30) {
      if (signal?.aborted) break;
      const batch = allSearchResults.slice(i, i + 30);
      const settled = await Promise.allSettled(
        batch.map(async (sr) => {
          const results = await enrichSearchResults([sr], city, 1);
          return results[0] || null;
        }),
      );
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled' && outcome.value) enriched.push(outcome.value);
      }
      const done = Math.min(i + 30, allSearchResults.length);
      if (done % 60 === 0 || done >= allSearchResults.length) {
        jobRunner.addLog(jobId, 'Web', `${city}: Impressum ${done}/${allSearchResults.length}`, 'info');
      }
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
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { keywords: rawKeywords, cities: rawCities, sources: rawSources, autoEnrich = true, deepScan = false, proxies, resumeJobId } = body as {
    keywords?: string[];
    cities?: string[];
    sources?: string[];
    autoEnrich?: boolean;
    deepScan?: boolean;
    proxies?: string;
    resumeJobId?: number;
  };

  const db = getDb();

  let keywords: string[];
  let cities: string[];
  let sources: string[];
  let options: { autoEnrich: boolean; deepScan: boolean; proxies?: string };
  let jobId: number;
  let completedSteps: string[] = [];

  if (resumeJobId) {
    const job = db.prepare('SELECT * FROM scraper_jobs WHERE id = ?').get(resumeJobId) as {
      id: number; config: string | null; completed_keywords: string | null;
      status: string; businesses_found: number; businesses_imported: number; businesses_duplicate: number;
    } | undefined;

    if (!job || !job.config) {
      return Response.json({ error: 'Job nicht gefunden oder keine Config gespeichert' }, { status: 400 });
    }

    const config = JSON.parse(job.config);
    keywords = config.keywords || [];
    cities = config.cities || [];
    sources = config.sources || [];
    options = {
      autoEnrich: config.autoEnrich ?? true,
      deepScan: config.deepScan ?? false,
      proxies: proxies || config.proxies,
    };
    completedSteps = JSON.parse(job.completed_keywords || '[]');

    db.prepare("UPDATE scraper_jobs SET status = 'running', completed_at = NULL WHERE id = ?").run(resumeJobId);
    jobId = resumeJobId;
  } else {
    keywords = rawKeywords || [];
    cities = rawCities || [];
    sources = rawSources || [];
    options = { autoEnrich, deepScan, proxies };

    if (!keywords.length || !cities.length || !sources.length) {
      return Response.json({ error: 'Keywords, Cities und Sources erforderlich' }, { status: 400 });
    }

    const jobLabel = `Hub: ${keywords.length} Keywords × ${cities.length} Städte`;
    const jobConfig = JSON.stringify({ keywords, cities, sources, autoEnrich, deepScan, proxies: proxies || undefined });
    const jobResult = db.prepare(
      "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at, config, completed_keywords) VALUES (?, ?, 'running', datetime('now'), ?, '[]')"
    ).run(jobLabel, keywords.length, jobConfig);
    jobId = Number(jobResult.lastInsertRowid);
  }

  jobRunner.createJob(jobId);

  const job = jobRunner.getJob(jobId)!;
  if (resumeJobId) {
    const prevJob = db.prepare('SELECT businesses_found, businesses_imported, businesses_duplicate FROM scraper_jobs WHERE id = ?').get(jobId) as {
      businesses_found: number; businesses_imported: number; businesses_duplicate: number;
    };
    job.stats.totalFound = prevJob.businesses_found || 0;
    job.stats.imported = prevJob.businesses_imported || 0;
    job.stats.duplicates = prevJob.businesses_duplicate || 0;
  }

  runScrapeJob(jobId, keywords, cities, sources, options, completedSteps).catch(err => {
    console.error('Background scrape job error:', err);
    jobRunner.addLog(jobId, 'System', `Kritischer Fehler: ${err instanceof Error ? err.message : err}`, 'error');
    db.prepare("UPDATE scraper_jobs SET status = 'error', completed_at = datetime('now') WHERE id = ?").run(jobId);
    jobRunner.complete(jobId, false);
  });

  return Response.json({ jobId, message: resumeJobId ? 'Job fortgesetzt' : 'Job gestartet' });
}
