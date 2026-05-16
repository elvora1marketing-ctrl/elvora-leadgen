import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { searchBusinesses, enrichSearchResults } from '@/lib/google-search-scraper';
import { normalizeWebsite } from '@/lib/utils';
import { type ScrapedBusiness } from '@/lib/maps-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function importBusinessesToLeads(
  db: ReturnType<typeof getDb>,
  businesses: ScrapedBusiness[],
  source: string,
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
          insertLead.run(biz.name, biz.website || null, websiteNorm, biz.phone || null, biz.email || null, biz.city || 'Unbekannt', source);
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
  const { keyword, city, maxResults = 100, autoEnrich = true } = body as {
    keyword: string;
    city: string;
    maxResults?: number;
    autoEnrich?: boolean;
  };

  if (!keyword || !city) {
    return Response.json({ error: 'Keyword und Stadt erforderlich' }, { status: 400 });
  }

  const db = getDb();
  const jobLabel = `Websuche: ${keyword} in ${city}`;
  const jobResult = db.prepare(
    "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
  ).run(jobLabel, 1);
  const jobId = Number(jobResult.lastInsertRowid);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('searxng_url', 'brave_search_api_key')").all() as { key: string; value: string }[];
        const cfg: Record<string, string> = {};
        for (const r of settingsRows) cfg[r.key] = r.value;

        send({ type: 'status', message: 'Suche läuft...' });

        const searchResult = await searchBusinesses(keyword, city, maxResults, {
          searxngUrl: cfg.searxng_url || undefined,
          braveApiKey: cfg.brave_search_api_key || undefined,
        });

        send({ type: 'status', message: `${searchResult.searchResults.length} Websites gefunden` });

        let businesses = searchResult.businesses;

        // Enrichment: visit each website for contact details
        if (autoEnrich && searchResult.searchResults.length > 0) {
          send({ type: 'status', message: `Impressum-Analyse: 0/${searchResult.searchResults.length}` });

          const enriched: ScrapedBusiness[] = [];
          const concurrency = 3;

          for (let i = 0; i < searchResult.searchResults.length; i += concurrency) {
            const batch = searchResult.searchResults.slice(i, i + concurrency);
            const settled = await Promise.allSettled(
              batch.map(async (sr) => {
                const { enrichSearchResults } = await import('@/lib/google-search-scraper');
                const results = await enrichSearchResults([sr], city, 1);
                return results[0] || null;
              }),
            );

            for (const outcome of settled) {
              if (outcome.status === 'fulfilled' && outcome.value) enriched.push(outcome.value);
            }

            const done = Math.min(i + concurrency, searchResult.searchResults.length);
            send({ type: 'status', message: `Impressum-Analyse: ${done}/${searchResult.searchResults.length}` });
          }

          if (enriched.length > 0) businesses = enriched;
        }

        const importResult = importBusinessesToLeads(db, businesses, jobLabel);

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
          JSON.stringify(searchResult.errors),
          JSON.stringify(businesses),
          jobId,
        );

        send({
          type: 'complete',
          success: true,
          jobId,
          totalFound: businesses.length,
          searchResults: searchResult.searchResults.length,
          imported: importResult.imported,
          duplicates: importResult.duplicates,
          skipped: importResult.skipped,
          errors: searchResult.errors,
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
