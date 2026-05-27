import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import {
  normalizeLinkedInUrl,
  type LinkedInPerson,
} from '@/lib/linkedin-scraper';
import {
  scrapeLinkedInKeyword,
  parseProxyList,
  type FreeLinkedInPerson,
  type SearchEngineConfig,
} from '@/lib/linkedin-scraper-free';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scraper/linkedin/stream - Start or resume LinkedIn scraping with SSE
 *
 * Body: { keywords, location, maxResults, onlyWithEmail, smtpVerification, proxies?, resumeJobId? }
 */
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const {
    keywords: rawKeywords,
    location: rawLocation,
    maxResults: rawMaxResults,
    onlyWithEmail: rawOnlyWithEmail,
    smtpVerification: rawSmtpVerification,
    resumeJobId,
    proxies: rawProxies,
  } = body as {
    keywords?: string[];
    location?: string;
    maxResults?: number;
    onlyWithEmail?: boolean;
    smtpVerification?: boolean;
    resumeJobId?: number;
    proxies?: string;
  };

  const db = getDb();

  // Resume mode: load config from existing job
  let keywords: string[];
  let location: string;
  let maxResults: number;
  let onlyWithEmail: boolean;
  let smtpVerification: boolean;
  let proxies: string | undefined = rawProxies;
  let jobId: number;
  let completedKeywords: string[];
  let isResume = false;

  if (resumeJobId) {
    const job = db.prepare('SELECT * FROM scraper_jobs WHERE id = ?').get(resumeJobId) as {
      id: number; config: string | null; completed_keywords: string | null;
      status: string; businesses_found: number; businesses_imported: number;
      businesses_duplicate: number;
    } | undefined;

    if (!job || !job.config) {
      return new Response(JSON.stringify({ error: 'Job nicht gefunden oder hat keine gespeicherte Konfiguration' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config = JSON.parse(job.config);
    keywords = config.keywords || [];
    location = config.location || '';
    maxResults = config.maxResults || 0;
    onlyWithEmail = config.onlyWithEmail || false;
    smtpVerification = config.smtpVerification || false;
    if (!proxies && config.proxies) proxies = config.proxies;
    completedKeywords = JSON.parse(job.completed_keywords || '[]');
    jobId = job.id;
    isResume = true;

    // Reset status to running
    db.prepare("UPDATE scraper_jobs SET status = 'running', completed_at = NULL WHERE id = ?").run(jobId);
  } else {
    keywords = rawKeywords || [];
    location = rawLocation || '';
    maxResults = rawMaxResults || 0;
    onlyWithEmail = rawOnlyWithEmail || false;
    smtpVerification = rawSmtpVerification ?? true;
    completedKeywords = [];

    if (!keywords.length) {
      return new Response(JSON.stringify({ error: 'Keywords erforderlich' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create job entry with config
    const jobLabel = `LinkedIn: ${keywords.join(', ')}${location ? ` @ ${location}` : ''}`;
    const jobConfig = JSON.stringify({ keywords, location, maxResults, onlyWithEmail, smtpVerification, proxies: rawProxies || undefined });
    const jobResult = db.prepare(
      "INSERT INTO scraper_jobs (keyword, max_pages, status, started_at, config, completed_keywords) VALUES (?, ?, 'running', datetime('now'), ?, '[]')"
    ).run(jobLabel, maxResults, jobConfig);
    jobId = Number(jobResult.lastInsertRowid);
  }

  const remainingKeywords = keywords.filter(kw => !completedKeywords.includes(kw));

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
      const parsedProxies = proxies ? parseProxyList(proxies) : [];

      const engineConfig: SearchEngineConfig = {
        searxngUrl: searxngUrl || undefined,
        totalKeywords: remainingKeywords.length,
        proxies: parsedProxies.length > 0 ? parsedProxies : undefined,
      };

      const massMode = remainingKeywords.length > 5;

      if (isResume) {
        send({
          type: 'log',
          message: `Fortsetzen: ${completedKeywords.length} Keywords bereits erledigt, ${remainingKeywords.length} verbleibend`,
        });
      }

      if (parsedProxies.length > 0) {
        send({
          type: 'log',
          message: `${parsedProxies.length.toLocaleString()} Proxies geladen — direkte Google-Suche mit IP-Rotation`,
        });
      }

      send({
        type: 'log',
        message: parsedProxies.length > 0
          ? `Proxy-Modus aktiv — ${remainingKeywords.length} Keywords${massMode ? ' (Massen-Modus)' : ' (Tiefen-Modus)'}`
          : searxngUrl
            ? `SearXNG aktiv (${searxngUrl}) — ${remainingKeywords.length} Keywords${massMode ? ' (Massen-Modus)' : ' (Tiefen-Modus)'}`
            : 'WARNUNG: Keine Proxies und kein SearXNG! Scraping wird vermutlich fehlschlagen.',
      });

      send({
        type: 'batch_start',
        jobId,
        totalKeywords: keywords.length,
        remainingKeywords: remainingKeywords.length,
        completedKeywords: completedKeywords.length,
        keywords: remainingKeywords,
        location,
        maxResults,
        isResume,
      });

      let keywordIndex = completedKeywords.length;
      let consecutiveEmptyKeywords = 0;
      let finalStatus: 'completed' | 'stopped' = 'completed';

      for (const kw of remainingKeywords) {
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

          // Import results in a transaction
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

          // Save this keyword as completed
          completedKeywords.push(kw);
          db.prepare(
            "UPDATE scraper_jobs SET completed_keywords = ?, businesses_found = ?, businesses_imported = ?, businesses_duplicate = ? WHERE id = ?"
          ).run(JSON.stringify(completedKeywords), allPeople.length, totalImported, totalDuplicates, jobId);

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

          // Track consecutive empty keywords — abort if engines are blocked
          if (people.length === 0) {
            consecutiveEmptyKeywords++;
          } else {
            consecutiveEmptyKeywords = 0;
          }

          if (consecutiveEmptyKeywords >= 3 && keywordIndex < keywords.length) {
            finalStatus = 'stopped';
            send({
              type: 'log',
              message: `GESTOPPT: ${consecutiveEmptyKeywords} Keywords in Folge ohne Ergebnisse — Suchmaschinen blockieren. Job kann später fortgesetzt werden.`,
            });
            send({
              type: 'error',
              error: `Automatisch gestoppt nach ${consecutiveEmptyKeywords} leeren Keywords. Upstream-Engines blockieren die IP. Fortsetzen über den "Fortsetzen"-Button.`,
              totalFound: allPeople.length,
              totalImported,
              totalDuplicates,
              totalNoEmail,
            });
            break;
          }
        } catch (err) {
          const errMsg = `${kw}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`;
          allErrors.push(errMsg);
          // Still mark as completed so we don't retry failed keywords
          completedKeywords.push(kw);
          db.prepare(
            "UPDATE scraper_jobs SET completed_keywords = ? WHERE id = ?"
          ).run(JSON.stringify(completedKeywords), jobId);

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
          const kwDelay = remainingKeywords.length > 20 ? 3000 : remainingKeywords.length > 5 ? 1500 : 500;
          await new Promise(resolve => setTimeout(resolve, kwDelay));
        }
      }

      const totalDuration = Date.now() - startTime;
      const allDone = completedKeywords.length >= keywords.length;

      // Update job record
      db.prepare(
        `UPDATE scraper_jobs SET
          status = ?,
          businesses_found = ?,
          businesses_imported = ?,
          businesses_duplicate = ?,
          errors = ?,
          results = ?,
          completed_keywords = ?,
          completed_at = datetime('now')
        WHERE id = ?`
      ).run(
        allDone ? 'completed' : finalStatus === 'stopped' ? 'stopped' : 'completed',
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
        JSON.stringify(completedKeywords),
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
        completedKeywords: completedKeywords.length,
        totalKeywords: keywords.length,
        canResume: !allDone,
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
