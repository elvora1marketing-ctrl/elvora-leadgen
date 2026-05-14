import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { scrapeBranchenportale, type BranchenportalResult } from '@/lib/branchenportal-scraper';
import { normalizeWebsite } from '@/lib/utils';
import { parseImpressum } from '@/lib/impressum-parser';
import { type ScrapedBusiness } from '@/lib/maps-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_CONCURRENCY = 5;

async function enrichWithEmail(businesses: ScrapedBusiness[]): Promise<void> {
  const withWebsite = businesses.filter(b => b.website && !b.email);
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
  }
}

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
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.portal-lead';

      const existing = checkExists.get(websiteNorm) as { id: number } | undefined;

      if (existing) {
        updateSeen.run(source, source, websiteNorm);
        if (biz.email) {
          db.prepare(`UPDATE leads SET email = COALESCE(NULLIF(email, ''), ?) WHERE id = ?`).run(biz.email, existing.id);
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
  const { keyword, city, maxPages = 2, autoEnrich = true } = body as {
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

  try {
    const portalResults = await scrapeBranchenportale(keyword, city, maxPages);

    const allBusinesses: ScrapedBusiness[] = [];
    const allErrors: string[] = [];

    for (const pr of portalResults) {
      allBusinesses.push(...pr.businesses);
      allErrors.push(...pr.errors.map(e => `${pr.source}: ${e}`));
    }

    if (autoEnrich && allBusinesses.length > 0) {
      await enrichWithEmail(allBusinesses);
    }

    const importResult = importBusinessesToLeads(db, allBusinesses, jobLabel);

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

    const resultsBySource: Record<string, BranchenportalResult> = {};
    for (const pr of portalResults) {
      resultsBySource[pr.source] = pr;
    }

    return Response.json({
      success: true,
      jobId,
      totalFound: allBusinesses.length,
      imported: importResult.imported,
      duplicates: importResult.duplicates,
      skipped: importResult.skipped,
      sources: resultsBySource,
      errors: allErrors,
    });
  } catch (error) {
    db.prepare("UPDATE scraper_jobs SET status = 'error', errors = ?, completed_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify([String(error)]), jobId);
    console.error('Branchenportal scraper error:', error);
    return Response.json({ error: 'Scraper-Fehler' }, { status: 500 });
  }
}
