import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import {
  normalizeLinkedInUrl,
  type LinkedInPerson,
} from '@/lib/linkedin-scraper';
import {
  scrapeLinkedInKeyword,
  type FreeLinkedInPerson,
  type SearchEngineConfig,
} from '@/lib/linkedin-scraper-free';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scraper/linkedin/stream - Start LinkedIn scraping with SSE live progress
 *
 * Body: { keywords: string[], location: string, maxResults: number, onlyWithEmail: boolean, smtpVerification: boolean }
 */
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const {
    keywords,
    location = '',
    maxResults = 0, // 0 = unlimited
    onlyWithEmail = false,
    smtpVerification = true,
  } = body as {
    keywords: string[];
    location?: string;
    maxResults?: number;
    onlyWithEmail?: boolean;
    smtpVerification?: boolean;
  };

  if (!keywords?.length) {
    return new Response(JSON.stringify({ error: 'Keywords erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

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

      const allPeople: FreeLinkedInPerson[] = [];
      let totalImported = 0;
      let totalDuplicates = 0;
      let totalNoEmail = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];
      const startTime = Date.now();
      const searxngUrl = (db.prepare("SELECT value FROM settings WHERE key = 'searxng_url'").get() as { value: string } | undefined)?.value || '';

      const engineConfig: SearchEngineConfig = {
        searxngUrl: searxngUrl || undefined,
        totalKeywords: keywords.length,
      };

      // Create job entry
      const jobLabel = `LinkedIn: ${keywords.join(', ')}${location ? ` @ ${location}` : ''}`;
      const jobResult = db.prepare(
        "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
      ).run(jobLabel, maxResults);
      const jobId = Number(jobResult.lastInsertRowid);

      const massMode = keywords.length > 5;
      send({
        type: 'log',
        message: searxngUrl
          ? `SearXNG aktiv (${searxngUrl}) — ${keywords.length} Keywords${massMode ? ' (Massen-Modus: 2 Strategien + längere Pausen)' : ' (Tiefen-Modus: 4 Strategien)'}`
          : 'WARNUNG: Kein SearXNG konfiguriert! Scraping wird vermutlich fehlschlagen. Setup: bash scripts/setup-searxng.sh',
      });

      send({
        type: 'batch_start',
        jobId,
        totalKeywords: keywords.length,
        keywords,
        location,
        maxResults,
      });

      let keywordIndex = 0;

      for (const kw of keywords) {
        keywordIndex++;
        let kwImported = 0;
        let kwDuplicates = 0;
        let kwNoEmail = 0;
        const kwStartTime = Date.now();

        send({
          type: 'search_start',
          keyword: kw,
          currentKeyword: keywordIndex,
          totalKeywords: keywords.length,
          totalFound: allPeople.length,
          totalImported,
          totalDuplicates,
          totalNoEmail,
        });

        try {
          // Use the free scraper pipeline
          const people = await scrapeLinkedInKeyword(
            kw,
            location,
            maxResults,
            smtpVerification,
            (progress) => {
              send({
                ...progress,
                currentKeyword: keywordIndex,
                totalKeywords: keywords.length,
                totalFound: allPeople.length + (progress.currentProfile || 0),
                totalImported,
                totalDuplicates,
                totalNoEmail,
              });
            },
            searxngUrl || undefined,
            engineConfig,
          );

          // Import results in a transaction (10-50x faster)
          const importBatch = db.transaction(() => {
            for (const person of people) {
              const linkedInPerson: LinkedInPerson = {
                fullName: person.fullName,
                profileUrl: person.profileUrl,
                headline: person.headline,
                location: person.location,
                company: person.company,
                title: person.title,
                email: person.email,
                profileImageUrl: person.profileImageUrl,
              };

              const importResult = importLinkedInLead(db, linkedInPerson, kw, onlyWithEmail);
              if (importResult === 'imported') {
                totalImported++;
                kwImported++;
              } else if (importResult === 'duplicate') {
                totalDuplicates++;
                kwDuplicates++;
              } else if (importResult === 'no_email') {
                totalNoEmail++;
                kwNoEmail++;
              } else {
                totalSkipped++;
              }

              allPeople.push(person);
            }
          });
          importBatch();

          // Send progress after batch import
          for (let pi = 0; pi < people.length; pi++) {
            const person = people[pi];
            send({
              type: 'profile_complete',
              keyword: kw,
              profileName: person.fullName,
              profileCompany: person.company,
              profileEmail: person.email ? '***' : null,
              hasEmail: !!person.email,
              emailConfidence: person.emailConfidence,
              importStatus: 'imported',
              currentProfile: allPeople.length - people.length + pi + 1,
              totalProfiles: people.length,
              currentKeyword: keywordIndex,
              totalKeywords: keywords.length,
              totalFound: allPeople.length,
              totalImported,
              totalDuplicates,
              totalNoEmail,
            });
          }

          send({
            type: 'search_complete',
            keyword: kw,
            currentKeyword: keywordIndex,
            totalKeywords: keywords.length,
            searchFound: people.length,
            searchImported: kwImported,
            searchDuplicates: kwDuplicates,
            searchNoEmail: kwNoEmail,
            searchDuration: Date.now() - kwStartTime,
            totalFound: allPeople.length,
            totalImported,
            totalDuplicates,
            totalNoEmail,
          });
        } catch (err) {
          const errMsg = `${kw}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`;
          allErrors.push(errMsg);
          send({
            type: 'error',
            keyword: kw,
            error: errMsg,
            totalFound: allPeople.length,
            totalImported,
            totalDuplicates,
            totalNoEmail,
          });
        }

        if (keywordIndex < keywords.length) {
          // More delay with more keywords to avoid upstream engine rate-limiting
          const kwDelay = keywords.length > 20 ? 3000 : keywords.length > 5 ? 1500 : 500;
          await new Promise(resolve => setTimeout(resolve, kwDelay));
        }
      }

      const totalDuration = Date.now() - startTime;

      // Update job record
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
        allPeople.length,
        totalImported,
        totalDuplicates,
        JSON.stringify(allErrors),
        JSON.stringify(allPeople.map(p => ({
          name: p.fullName,
          company: p.company,
          title: p.title,
          email: p.email,
          emailConfidence: p.emailConfidence,
          location: p.location,
          profileUrl: p.profileUrl,
        }))),
        jobId,
      );

      send({
        type: 'batch_complete',
        jobId,
        totalFound: allPeople.length,
        totalImported,
        totalDuplicates,
        totalNoEmail,
        totalSkipped,
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
 * Import a single LinkedIn person into the leads table.
 */
function importLinkedInLead(
  db: ReturnType<typeof getDb>,
  person: LinkedInPerson,
  keyword: string,
  onlyWithEmail: boolean,
): 'imported' | 'duplicate' | 'no_email' | 'skipped' {
  if (!person.fullName || person.fullName.length < 2) return 'skipped';

  if (onlyWithEmail && !person.email) return 'no_email';

  const linkedInNorm = normalizeLinkedInUrl(person.profileUrl);
  // Use LinkedIn URL path as the unique website_normalized key
  const websiteNorm = `linkedin:${linkedInNorm}`;

  const existing = db.prepare('SELECT id FROM leads WHERE website_normalized = ?').get(websiteNorm) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE leads SET
        times_found = times_found + 1,
        last_seen_at = datetime('now'),
        found_via_keywords = CASE
          WHEN found_via_keywords NOT LIKE '%' || ? || '%'
          THEN found_via_keywords || ', ' || ?
          ELSE found_via_keywords
        END
      WHERE id = ?
    `).run(keyword, keyword, existing.id);
    return 'duplicate';
  }

  try {
    db.prepare(`
      INSERT INTO leads (name, website_original, website_normalized, email, city, company, linkedin_url, status, found_via_keywords, score, rating, lead_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, 'pending', 'entscheider')
    `).run(
      person.fullName,
      person.profileUrl,
      websiteNorm,
      person.email || null,
      person.location || 'LinkedIn',
      person.company || null,
      person.profileUrl,
      `LinkedIn: ${keyword}`,
    );
    return 'imported';
  } catch (err) {
    console.error(`Failed to import LinkedIn lead "${person.fullName}":`, err);
    return 'skipped';
  }
}
