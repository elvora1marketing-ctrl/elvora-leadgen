import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { scrapeGelbeSeiten, scrape11880, type BranchenportalResult } from '@/lib/branchenportal-scraper';
import { normalizeWebsite } from '@/lib/utils';
import { parseImpressum } from '@/lib/impressum-parser';
import { type ScrapedBusiness } from '@/lib/maps-scraper';
import { detectCategory } from '@/lib/lead-categories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const EMAIL_CONCURRENCY = 5;

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
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.portal-lead';

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
  const { keyword, city, maxPages = 50, autoEnrich = true } = body as {
    keyword: string;
    city: string;
    maxPages?: number;
    autoEnrich?: boolean;
  };

  if (!keyword || !city) {
    return Response.json({ error: 'Keyword und Stadt erforderlich' }, { status: 400 });
  }

  const db = getDb();
  const jobLabel = `Branchenportal: ${keyword} in ${city}`;
  const jobResult = db.prepare(
    "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
  ).run(jobLabel, maxPages);
  const jobId = Number(jobResult.lastInsertRowid);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const allBusinesses: ScrapedBusiness[] = [];
        const allErrors: string[] = [];

        // Gelbe Seiten
        send({ type: 'status', message: 'Gelbe Seiten: Suche läuft...' });
        let gsResult: BranchenportalResult;
        try {
          gsResult = await scrapeGelbeSeiten(keyword, city, maxPages);
          allBusinesses.push(...gsResult.businesses);
          allErrors.push(...gsResult.errors.map(e => `gelbeseiten: ${e}`));
          send({ type: 'status', message: `Gelbe Seiten: ${gsResult.businesses.length} Ergebnisse (${(gsResult.duration / 1000).toFixed(1)}s)` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Fehler';
          allErrors.push(`gelbeseiten: ${msg}`);
          send({ type: 'status', message: `Gelbe Seiten: Fehler — ${msg}` });
        }

        // 11880
        send({ type: 'status', message: '11880.com: Suche läuft...' });
        let elResult: BranchenportalResult;
        try {
          elResult = await scrape11880(keyword, city, maxPages);
          allBusinesses.push(...elResult.businesses);
          allErrors.push(...elResult.errors.map(e => `11880: ${e}`));
          send({ type: 'status', message: `11880.com: ${elResult.businesses.length} Ergebnisse (${(elResult.duration / 1000).toFixed(1)}s)` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Fehler';
          allErrors.push(`11880: ${msg}`);
          send({ type: 'status', message: `11880.com: Fehler — ${msg}` });
        }

        send({ type: 'status', message: `Gesamt: ${allBusinesses.length} Firmen gefunden` });

        // Enrichment
        if (autoEnrich && allBusinesses.length > 0) {
          const withWebsite = allBusinesses.filter(b => b.website && !b.email);
          if (withWebsite.length > 0) {
            send({ type: 'status', message: `E-Mail-Enrichment: 0/${withWebsite.length}` });
            let done = 0;
            for (let i = 0; i < withWebsite.length; i += EMAIL_CONCURRENCY) {
              const batch = withWebsite.slice(i, i + EMAIL_CONCURRENCY);
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
              send({ type: 'status', message: `E-Mail-Enrichment: ${done}/${withWebsite.length}` });
            }
          }
        }

        // Import
        send({ type: 'status', message: 'Importiere in Datenbank...' });
        const importResult = importBusinessesToLeads(db, allBusinesses, jobLabel, keyword);

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
          allBusinesses.length,
          importResult.imported,
          importResult.duplicates,
          JSON.stringify(allErrors),
          JSON.stringify(allBusinesses),
          jobId,
        );

        send({
          type: 'complete',
          success: true,
          jobId,
          totalFound: allBusinesses.length,
          imported: importResult.imported,
          duplicates: importResult.duplicates,
          skipped: importResult.skipped,
          errors: allErrors,
        });
      } catch (error) {
        db.prepare("UPDATE scraper_jobs SET status = 'error', errors = ?, completed_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify([String(error)]), jobId);
        console.error('Branchenportal scraper error:', error);
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
