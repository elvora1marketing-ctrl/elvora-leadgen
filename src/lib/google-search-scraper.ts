/**
 * Web Search Business Scraper (via DuckDuckGo HTML)
 *
 * Findet Firmen-Websites über DuckDuckGo-Suche und extrahiert Kontaktdaten.
 * KEIN API-Key nötig. Nutzt DuckDuckGo HTML (kein JS, kein CAPTCHA).
 *
 * Pipeline:
 * 1. DuckDuckGo HTML Suche — findet Business-Websites zu Keyword + Stadt
 * 2. Filtert Aggregator-Seiten raus (Yelp, Gelbe Seiten etc.)
 * 3. Dedupliziert nach Domain
 * 4. (Optional) Enrichment: besucht jede Website, parst Impressum für Kontaktdaten
 */

import { type ScrapedBusiness } from './maps-scraper';
import { delay, normalizeWebsite } from './utils';
import { parseImpressum } from './impressum-parser';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 10000;

/** Domains to skip — aggregator / social / job sites, not direct business websites */
const BLOCKED_DOMAINS = new Set([
  'gelbeseiten.de',
  '11880.com',
  'yelp.de',
  'yelp.com',
  'google.com',
  'google.de',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'wikipedia.org',
  'linkedin.com',
  'xing.com',
  'kununu.de',
  'indeed.de',
  'indeed.com',
  'stepstone.de',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'pinterest.com',
  'pinterest.de',
  'amazon.de',
  'amazon.com',
  'ebay.de',
  'ebay.com',
  'tripadvisor.de',
  'tripadvisor.com',
  'golocal.de',
  'branchenbuch.meinestadt.de',
  'meinestadt.de',
  'cylex.de',
  'hotfrog.de',
  'firmenwissen.de',
  'northdata.de',
  'wlw.de',
  'kompass.com',
  'duckduckgo.com',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface GoogleSearchResult {
  businesses: ScrapedBusiness[];
  searchResults: SearchResult[];
  totalFound: number;
  errors: string[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a URL belongs to a blocked aggregator domain.
 */
function isBlockedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        return true;
      }
    }
    return false;
  } catch {
    return true; // malformed URL → skip
  }
}

/**
 * Extract the registrable domain from a URL for deduplication.
 * e.g. "https://www.example.de/kontakt" → "example.de"
 */
function extractDomain(url: string): string {
  return normalizeWebsite(url);
}

/**
 * Decode HTML entities commonly found in DuckDuckGo results.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#\d+;/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Strip all HTML tags from a string.
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Resolve a DuckDuckGo redirect URL to the actual target URL.
 * DDG wraps links like: //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.de&...
 */
function resolveDdgUrl(rawUrl: string): string {
  const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
  if (uddgMatch) {
    return decodeURIComponent(uddgMatch[1]);
  }
  // Sometimes DDG uses a plain href
  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Core: DuckDuckGo HTML Search
// ---------------------------------------------------------------------------

/**
 * Search DuckDuckGo HTML for business websites.
 *
 * Fetches the HTML version of DuckDuckGo (no JS needed) and parses result
 * links, titles and snippets. Filters out aggregator sites and deduplicates
 * by domain.
 */
async function fetchDuckDuckGoResults(
  query: string,
  maxResults: number,
): Promise<{ results: SearchResult[]; error: string | null }> {
  const results: SearchResult[] = [];
  const seenDomains = new Set<string>();
  let error: string | null = null;

  let pageNum = 0;
  let hasMore = true;

  while (hasMore) {
    pageNum++;

    try {
      let html: string;

      if (pageNum === 1) {
        // First page: GET request
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'de-DE,de;q=0.9',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          error = `DuckDuckGo HTTP ${res.status}`;
          break;
        }

        html = await res.text();
      } else {
        // Subsequent pages: POST with pagination params
        const formData = new URLSearchParams();
        formData.append('q', query);
        formData.append('s', String((pageNum - 1) * 30));
        formData.append('dc', String((pageNum - 1) * 30 + 1));
        formData.append('o', 'json');
        formData.append('api', 'd.js');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const res = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'de-DE,de;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          error = `DuckDuckGo Seite ${pageNum} HTTP ${res.status}`;
          break;
        }

        html = await res.text();
      }

      // Detect blocking / CAPTCHA
      if (
        html.includes('detected unusual traffic') ||
        html.includes('Please try again') ||
        html.includes('blocked')
      ) {
        error = 'DuckDuckGo hat die Anfrage blockiert (Rate-Limit)';
        break;
      }

      // ---- Parse result links ----
      // DuckDuckGo HTML results: <a class="result__a" href="...">Title</a>
      const linkRegex =
        /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

      // Snippets live in: <a class="result__snippet" ...>Snippet text</a>
      // or <td class="result__snippet">...</td>
      const snippetRegex =
        /<(?:a|td)[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;

      // Collect all snippets in order
      const snippets: string[] = [];
      let snippetMatch: RegExpExecArray | null;
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippets.push(decodeHtmlEntities(stripHtmlTags(snippetMatch[1])));
      }

      let linkMatch: RegExpExecArray | null;
      let resultIndex = 0;
      let foundOnPage = 0;

      while ((linkMatch = linkRegex.exec(html)) !== null) {
        const rawUrl = linkMatch[1];
        const rawTitle = decodeHtmlEntities(stripHtmlTags(linkMatch[2]));

        const actualUrl = resolveDdgUrl(rawUrl);
        if (!actualUrl) {
          resultIndex++;
          continue;
        }

        // Filter out blocked domains
        if (isBlockedUrl(actualUrl)) {
          resultIndex++;
          continue;
        }

        // Deduplicate by domain
        const domain = extractDomain(actualUrl);
        if (!domain || seenDomains.has(domain)) {
          resultIndex++;
          continue;
        }
        seenDomains.add(domain);

        results.push({
          title: rawTitle,
          url: actualUrl,
          snippet: snippets[resultIndex] || '',
        });
        foundOnPage++;
        resultIndex++;

        if (results.length >= maxResults) break;
      }

      // If the primary regex found nothing, try a broader fallback
      if (foundOnPage === 0) {
        const altRegex =
          /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
        let altMatch: RegExpExecArray | null;

        while ((altMatch = altRegex.exec(html)) !== null) {
          const actualUrl = resolveDdgUrl(altMatch[1]);
          if (!actualUrl || isBlockedUrl(actualUrl)) continue;

          const domain = extractDomain(actualUrl);
          if (!domain || seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          results.push({
            title: decodeHtmlEntities(stripHtmlTags(altMatch[2])),
            url: actualUrl,
            snippet: '',
          });
          foundOnPage++;
          if (results.length >= maxResults) break;
        }
      }

      // Stop conditions
      if (foundOnPage === 0) {
        hasMore = false;
      } else if (results.length >= maxResults) {
        hasMore = false;
      } else {
        // Check if DDG has a "next" page
        const hasNext =
          html.includes('name="s"') ||
          html.includes('next') ||
          html.includes('nächste');
        if (!hasNext && pageNum > 1) {
          hasMore = false;
        }
      }

      // Rate-limit between pages
      if (hasMore) {
        await delay(1200 + Math.random() * 1300); // 1.2–2.5s
      }

      // Safety: cap at 10 pages (300 raw results before filtering)
      if (pageNum >= 10) {
        hasMore = false;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        error = 'DuckDuckGo Timeout';
      } else {
        error = err instanceof Error ? err.message : 'Unbekannter Fehler';
      }
      hasMore = false;
    }
  }

  return { results, error };
}

// ---------------------------------------------------------------------------
// Public API: searchBusinesses
// ---------------------------------------------------------------------------

/**
 * Search for businesses via DuckDuckGo HTML search.
 *
 * Builds a German-oriented query (`keyword city Firma Kontakt`), fetches
 * results, filters aggregator sites, and deduplicates by domain.
 *
 * The returned `searchResults` contain direct business website URLs that can
 * be enriched via `enrichSearchResults()` for contact details.
 */
export async function searchBusinesses(
  keyword: string,
  city: string,
  maxResults: number = 20,
): Promise<GoogleSearchResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const query = `${keyword} ${city} Firma Kontakt`;

  const { results: searchResults, error } = await fetchDuckDuckGoResults(
    query,
    maxResults,
  );

  if (error) {
    errors.push(error);
  }

  // Build basic ScrapedBusiness entries from search results (without enrichment)
  const businesses: ScrapedBusiness[] = searchResults.map((sr) => ({
    name: sr.title || extractDomain(sr.url),
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

  return {
    businesses,
    searchResults,
    totalFound: searchResults.length,
    errors,
    duration: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Public API: enrichSearchResults
// ---------------------------------------------------------------------------

/**
 * Enrich search results by visiting each business website and parsing the
 * Impressum / Kontakt page for contact details.
 *
 * Runs in batches of `concurrency` to avoid hammering servers.
 * Returns a `ScrapedBusiness[]` with company name, email, phone and address
 * where available.
 */
export async function enrichSearchResults(
  results: SearchResult[],
  city: string,
  concurrency: number = 3,
): Promise<ScrapedBusiness[]> {
  const businesses: ScrapedBusiness[] = [];

  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);

    const settled = await Promise.allSettled(
      batch.map((sr) => enrichSingleResult(sr, city)),
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        businesses.push(outcome.value);
      }
    }

    // Short delay between batches to be polite
    if (i + concurrency < results.length) {
      await delay(800 + Math.random() * 700); // 0.8–1.5s
    }
  }

  return businesses;
}

/**
 * Visit a single business website:
 * 1. Fetch the homepage to get the <title> (used as company name).
 * 2. Run `parseImpressum` to extract email, phone, address, Geschäftsführer.
 * 3. Assemble a `ScrapedBusiness`.
 */
async function enrichSingleResult(
  sr: SearchResult,
  city: string,
): Promise<ScrapedBusiness | null> {
  const domain = extractDomain(sr.url);
  if (!domain) return null;

  let companyName = sr.title || domain;
  let email: string | null = null;
  let phone: string | null = null;
  let address: string | null = city;

  // --- Step 1: Fetch homepage title ---
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(sr.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();

      // Extract <title>
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        const pageTitle = decodeHtmlEntities(stripHtmlTags(titleMatch[1])).trim();
        if (pageTitle && pageTitle.length > 1 && pageTitle.length < 200) {
          // Clean common suffixes like " | Startseite", " - Home" etc.
          companyName = pageTitle
            .replace(/\s*[\|–-]\s*(?:Start(?:seite)?|Home|Willkommen|Hauptseite|Über uns)$/i, '')
            .trim() || pageTitle;
        }
      }
    }
  } catch {
    // Homepage fetch failed — continue with Impressum parsing
  }

  // --- Step 2: Parse Impressum ---
  try {
    const baseUrl = `https://${domain}`;
    const impressum = await parseImpressum(baseUrl);

    if (impressum.emails.length > 0) {
      email = impressum.emails[0];
    }
    if (impressum.phones.length > 0) {
      phone = impressum.phones[0];
    }
    if (impressum.geschaeftsfuehrer) {
      // Prefer the Geschäftsführer name + company for the business name
      companyName = companyName || domain;
    }
  } catch {
    // Impressum parsing failed — return what we have
  }

  return {
    name: companyName,
    address: address || city,
    city,
    phone,
    website: sr.url,
    email,
    rating: null,
    reviews: null,
    category: null,
    placeId: null,
  };
}
