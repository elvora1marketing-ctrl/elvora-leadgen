import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { scrapeGoogleMaps, normalizeWebsite, type ScrapedBusiness } from '@/lib/maps-scraper';

export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get target cities and keywords from settings
    const citiesRow = db.prepare("SELECT value FROM settings WHERE key = 'target_cities'").get() as { value: string } | undefined;
    const keywordsRow = db.prepare("SELECT value FROM settings WHERE key = 'keywords'").get() as { value: string } | undefined;
    const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'google_maps_api_key'").get() as { value: string } | undefined;

    const cities: string[] = citiesRow ? JSON.parse(citiesRow.value) : ['Essen', 'Dortmund', 'Bochum', 'Duisburg'];
    const keywords: string[] = keywordsRow ? JSON.parse(keywordsRow.value) : ['Sanitär', 'Heizung', 'Klempner', 'SHK'];
    const googleApiKey = apiKeyRow?.value || '';

    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google Maps API-Key fehlt. Bitte unter Einstellungen hinterlegen.' }, { status: 400 });
    }

    const scanResults: Array<{ keyword: string; city: string; status: string; found: number; imported: number }> = [];

    for (const keyword of keywords) {
      for (const city of cities) {
        const fullKeyword = `${keyword} ${city}`;

        // Record scan in history
        const result = db.prepare(
          "INSERT INTO scan_history (keyword, city, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
        ).run(keyword, city);
        const scanId = result.lastInsertRowid;

        try {
          // Run the scraper
          const scrapeResult = await scrapeGoogleMaps(fullKeyword, 1, undefined, googleApiKey);

          // Import results into leads
          const importResult = importBusinessesToLeads(db, scrapeResult.businesses, fullKeyword);

          db.prepare(
            "UPDATE scan_history SET status = 'completed', leads_found = ?, leads_new = ?, leads_duplicate = ?, completed_at = datetime('now') WHERE id = ?"
          ).run(scrapeResult.totalFound, importResult.imported, importResult.duplicates, scanId);

          scanResults.push({ keyword, city, status: 'completed', found: scrapeResult.totalFound, imported: importResult.imported });
        } catch (err) {
          db.prepare(
            "UPDATE scan_history SET status = 'error', completed_at = datetime('now') WHERE id = ?"
          ).run(scanId);
          scanResults.push({ keyword, city, status: 'error', found: 0, imported: 0 });
          console.error(`Cron scan error for "${fullKeyword}":`, err);
        }
      }
    }

    // Also process any due follow-ups
    let followUpData = {};
    try {
      const followUpRes = await fetch(new URL('/api/followups/process', request.url).toString(), {
        method: 'POST',
        headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
      });
      followUpData = await followUpRes.json();
    } catch {
      // Follow-up processing is optional
    }

    return NextResponse.json({
      success: true,
      scans: scanResults,
      cities: cities.length,
      keywords: keywords.length,
      totalScans: scanResults.length,
      followUps: followUpData,
    });
  } catch (error: unknown) {
    console.error('Cron scan error:', error);
    return NextResponse.json({ error: 'Scan-Fehler' }, { status: 500 });
  }
}

/**
 * Import scraped businesses into the leads table
 */
function importBusinessesToLeads(
  db: ReturnType<typeof getDb>,
  businesses: ScrapedBusiness[],
  keyword: string,
): { imported: number; duplicates: number } {
  let imported = 0;
  let duplicates = 0;

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
    'SELECT id FROM leads WHERE website_normalized = ?'
  );

  const importAll = db.transaction(() => {
    for (const biz of businesses) {
      if (!biz.name || biz.name.length < 2) continue;

      const websiteNorm = biz.website
        ? normalizeWebsite(biz.website)
        : biz.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + '.maps-lead';

      const existing = checkExists.get(websiteNorm) as { id: number } | undefined;

      if (existing) {
        updateSeen.run(keyword, keyword, websiteNorm);
        duplicates++;
      } else {
        try {
          insertLead.run(biz.name, biz.website || null, websiteNorm, biz.phone || null, biz.city || 'Unbekannt', keyword);
          imported++;
        } catch {
          // Unique constraint or other error
        }
      }
    }
  });

  importAll();
  return { imported, duplicates };
}
