import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import {
  searchLinkedInPeople,
  getLinkedInProfile,
  normalizeLinkedInUrl,
  type LinkedInPerson,
} from '@/lib/linkedin-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scraper/linkedin/stream - Start LinkedIn scraping with SSE live progress
 *
 * Body: { keywords: string[], location: string, maxResults: number, onlyWithEmail: boolean }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    keywords,
    location = '',
    maxResults = 25,
    onlyWithEmail = false,
  } = body as {
    keywords: string[];
    location?: string;
    maxResults?: number;
    onlyWithEmail?: boolean;
  };

  if (!keywords?.length) {
    return new Response(JSON.stringify({ error: 'Keywords erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Load API credentials
  const apiKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'rapidapi_key'").get() as { value: string } | undefined;
  const apiHostSetting = db.prepare("SELECT value FROM settings WHERE key = 'rapidapi_linkedin_host'").get() as { value: string } | undefined;

  const rapidapiKey = apiKeySetting?.value || '';
  const rapidapiHost = apiHostSetting?.value || 'fresh-linkedin-profile-data.p.rapidapi.com';

  if (!rapidapiKey) {
    return new Response(JSON.stringify({ error: 'RapidAPI-Key fehlt. Bitte unter Einstellungen hinterlegen.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

      const allPeople: LinkedInPerson[] = [];
      let totalImported = 0;
      let totalDuplicates = 0;
      let totalNoEmail = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];
      const startTime = Date.now();

      // Create job entry
      const jobLabel = `LinkedIn: ${keywords.join(', ')}${location ? ` @ ${location}` : ''}`;
      const jobResult = db.prepare(
        "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
      ).run(jobLabel, maxResults);
      const jobId = Number(jobResult.lastInsertRowid);

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
          // Search for people
          const searchResult = await searchLinkedInPeople(kw, location, rapidapiKey, rapidapiHost);
          const people = searchResult.people.slice(0, maxResults);

          send({
            type: 'search_results',
            keyword: kw,
            profilesFound: people.length,
            totalResults: searchResult.totalResults,
          });

          // Fetch details for each profile
          let profileIndex = 0;
          let kwImported = 0;
          let kwDuplicates = 0;
          let kwNoEmail = 0;
          const kwStartTime = Date.now();

          for (const person of people) {
            profileIndex++;

            send({
              type: 'profile_fetch',
              keyword: kw,
              profileName: person.fullName,
              currentProfile: profileIndex,
              totalProfiles: people.length,
              currentKeyword: keywordIndex,
              totalKeywords: keywords.length,
              totalFound: allPeople.length,
              totalImported,
              totalDuplicates,
              totalNoEmail,
            });

            try {
              // Fetch full profile with email
              const profile = await getLinkedInProfile(person.profileUrl, rapidapiKey, rapidapiHost);

              // Merge search data with profile data
              const mergedPerson: LinkedInPerson = {
                ...person,
                ...profile,
                fullName: profile.fullName || person.fullName,
                company: profile.company || person.company,
                title: profile.title || person.title,
                location: profile.location || person.location,
              };

              // Import to DB
              const importResult = importLinkedInLead(db, mergedPerson, kw, onlyWithEmail);
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

              allPeople.push(mergedPerson);

              send({
                type: 'profile_complete',
                keyword: kw,
                profileName: mergedPerson.fullName,
                profileCompany: mergedPerson.company,
                profileEmail: mergedPerson.email ? '***' : null,
                hasEmail: !!mergedPerson.email,
                importStatus: importResult,
                currentProfile: profileIndex,
                totalProfiles: people.length,
                currentKeyword: keywordIndex,
                totalKeywords: keywords.length,
                totalFound: allPeople.length,
                totalImported,
                totalDuplicates,
                totalNoEmail,
              });
            } catch (err) {
              const errMsg = `Profil ${person.fullName}: ${err instanceof Error ? err.message : 'Fehler'}`;
              allErrors.push(errMsg);
              send({
                type: 'profile_error',
                error: errMsg,
                currentProfile: profileIndex,
                totalProfiles: people.length,
                totalFound: allPeople.length,
                totalImported,
                totalDuplicates,
                totalNoEmail,
              });
            }

            // Rate limiting between profile fetches
            if (profileIndex < people.length) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
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

        // Delay between keyword searches
        if (keywordIndex < keywords.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
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
      INSERT INTO leads (name, website_original, website_normalized, email, city, company, linkedin_url, status, found_via_keywords, score, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, 'pending')
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
