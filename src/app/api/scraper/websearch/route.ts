import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { searchBusinesses, enrichSearchResults } from '@/lib/google-search-scraper';
import { normalizeWebsite } from '@/lib/utils';
import { type ScrapedBusiness } from '@/lib/maps-scraper';
import { getDistricts } from '@/lib/german-districts';
import { detectCategory } from '@/lib/lead-categories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

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
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.search-lead';

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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keyword, city, maxResults = 100, autoEnrich = true, deepScan = false } = body as {
    keyword: string;
    city: string;
    maxResults?: number;
    autoEnrich?: boolean;
    deepScan?: boolean;
  };

  if (!keyword || !city) {
    return Response.json({ error: 'Keyword und Stadt erforderlich' }, { status: 400 });
  }

  const db = getDb();
  const jobLabel = `Websuche${deepScan ? ' (Tiefenscan)' : ''}: ${keyword} in ${city}`;
  const jobResult = db.prepare(
    "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
  ).run(jobLabel, 1);
  const jobId = Number(jobResult.lastInsertRowid);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      }

      try {
        const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('searxng_url', 'brave_search_api_key')").all() as { key: string; value: string }[];
        const cfg: Record<string, string> = {};
        for (const r of settingsRows) cfg[r.key] = r.value;

        const searchOpts = {
          searxngUrl: cfg.searxng_url || undefined,
          braveApiKey: cfg.brave_search_api_key || undefined,
        };

        // Build search queries: city + districts (deep scan)
        const searchQueries: Array<{ query: string; label: string }> = [
          { query: city, label: city },
        ];

        if (deepScan) {
          const districts = getDistricts(city);
          if (districts.length > 0) {
            send({ type: 'status', message: `Tiefenscan: ${city} + ${districts.length} Stadtteile werden durchsucht` });
            for (const d of districts) {
              searchQueries.push({ query: `${city} ${d}`, label: d });
            }
          } else {
            send({ type: 'status', message: `Keine Stadtteile für "${city}" hinterlegt — nur Stadtsuche` });
          }
        }

        // Search all queries, deduplicate across all
        const allSearchResults: Array<{ title: string; url: string; snippet: string }> = [];
        const seenDomains = new Set<string>();
        const allErrors: string[] = [];

        for (let qi = 0; qi < searchQueries.length; qi++) {
          const sq = searchQueries[qi];
          const perQueryMax = deepScan ? Math.max(50, Math.floor(maxResults / searchQueries.length * 2)) : maxResults;

          send({ type: 'status', message: `[${qi + 1}/${searchQueries.length}] Suche: "${keyword} ${sq.query}"` });

          const searchResult = await searchBusinesses(keyword, sq.query, perQueryMax, searchOpts);

          if (searchResult.errors.length > 0) allErrors.push(...searchResult.errors);

          let newCount = 0;
          for (const sr of searchResult.searchResults) {
            const domain = normalizeWebsite(sr.url);
            if (!domain || seenDomains.has(domain)) continue;
            seenDomains.add(domain);
            allSearchResults.push(sr);
            newCount++;
          }

          send({ type: 'status', message: `[${qi + 1}/${searchQueries.length}] ${sq.label}: +${newCount} neue Firmen (gesamt: ${allSearchResults.length})` });
        }

        send({ type: 'status', message: `${allSearchResults.length} einzigartige Websites gefunden` });

        let businesses: ScrapedBusiness[] = allSearchResults.map((sr) => ({
          name: sr.title || normalizeWebsite(sr.url),
          address: city,
          city,
          phone: null,
          website: sr.url,
          email: null,
          rating: null,
          reviews: null,
          category: keyword,
          placeId: null,
        }));

        // Enrichment: visit each website for contact details
        if (autoEnrich && allSearchResults.length > 0) {
          send({ type: 'status', message: `Impressum-Analyse: 0/${allSearchResults.length}` });

          const enriched: ScrapedBusiness[] = [];
          const concurrency = 3;

          for (let i = 0; i < allSearchResults.length; i += concurrency) {
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
            send({ type: 'status', message: `Impressum-Analyse: ${done}/${allSearchResults.length}` });
          }

          if (enriched.length > 0) businesses = enriched;
        }

        const importResult = importBusinessesToLeads(db, businesses, jobLabel, keyword);

        db.prepare(`
          UPDATE scraper_jobs SET
            status = 'completed',
            businesses_found = ?,
            businesses_imported = ?,
            businesses_duplicate = ?,
            errors = ?,
            results = ?,
            completed_at = datetime('now')
          WHERE id = ?
        `).run(
          businesses.length,
          importResult.imported,
          importResult.duplicates,
          JSON.stringify(allErrors),
          JSON.stringify(businesses),
          jobId,
        );

        send({
          type: 'complete',
          success: true,
          jobId,
          totalFound: businesses.length,
          searchResults: allSearchResults.length,
          imported: importResult.imported,
          duplicates: importResult.duplicates,
          skipped: importResult.skipped,
          errors: allErrors,
        });
      } catch (error) {
        db.prepare("UPDATE scraper_jobs SET status = 'error', errors = ?, completed_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify([String(error)]), jobId);
        console.error('Web search scraper error:', error);
        send({ type: 'complete', success: false, totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [String(error)] });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
