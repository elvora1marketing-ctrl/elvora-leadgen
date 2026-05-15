/**
 * Web Search Business Scraper (multi-engine: SearXNG → DuckDuckGo)
 *
 * Findet Firmen-Websites über Web-Suche und extrahiert Kontaktdaten.
 * KEIN API-Key nötig.
 *
 * Pipeline:
 * 1. SearXNG JSON API (primär — funktioniert von Server-IPs, mehrere Instanzen als Fallback)
 * 2. DuckDuckGo HTML Suche (Fallback)
 * 3. Filtert Aggregator-Seiten raus (Yelp, Gelbe Seiten etc.)
 * 4. Dedupliziert nach Domain
 * 5. (Optional) Enrichment: besucht jede Website, parst Impressum für Kontaktdaten
 */

import { type ScrapedBusiness } from './maps-scraper';
import { delay, normalizeWebsite } from './utils';
import { parseImpressum } from './impressum-parser';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 12000;

const SEARXNG_INSTANCES = [
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://search.bus-hit.me',
  'https://searx.be',
  'https://search.mdosch.de',
  'https://searx.fmac.xyz',
  'https://paulgo.io',
  'https://priv.au',
  'https://search.ononoki.org',
  'https://opnxng.com',
];

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
    return true;
  }
}

function extractDomain(url: string): string {
  return normalizeWebsite(url);
}

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

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function resolveDdgUrl(rawUrl: string): string {
  const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
  if (uddgMatch) {
    return decodeURIComponent(uddgMatch[1]);
  }
  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }
  return '';
}

// ---------------------------------------------------------------------------
// SearXNG JSON API (Primary)
// ---------------------------------------------------------------------------

async function fetchSearxngResults(
  query: string,
  maxResults: number,
): Promise<{ results: SearchResult[]; error: string | null; instanceUsed: string | null }> {
  const results: SearchResult[] = [];
  const seenDomains = new Set<string>();

  for (const instance of SEARXNG_INSTANCES) {
    try {
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=de&pageno=1`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Accept-Language': 'de-DE,de;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.log(`[WebSearch] SearXNG ${instance}: HTTP ${res.status}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        console.log(`[WebSearch] SearXNG ${instance}: kein JSON (${contentType})`);
        continue;
      }

      const data = await res.json() as { results?: Array<{ url?: string; title?: string; content?: string }> };

      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        console.log(`[WebSearch] SearXNG ${instance}: keine Ergebnisse`);
        continue;
      }

      console.log(`[WebSearch] SearXNG ${instance}: ${data.results.length} Rohergebnisse`);

      for (const item of data.results) {
        if (!item.url) continue;
        if (isBlockedUrl(item.url)) continue;

        const domain = extractDomain(item.url);
        if (!domain || seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        results.push({
          title: item.title || domain,
          url: item.url,
          snippet: item.content || '',
        });

        if (results.length >= maxResults) break;
      }

      // If we need more results, fetch page 2
      if (results.length < maxResults && data.results.length >= 10) {
        await delay(800 + Math.random() * 500);

        try {
          const page2Url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=de&pageno=2`;

          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT);

          const res2 = await fetch(page2Url, {
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'application/json',
              'Accept-Language': 'de-DE,de;q=0.9',
            },
            signal: controller2.signal,
          });

          clearTimeout(timeout2);

          if (res2.ok) {
            const data2 = await res2.json() as { results?: Array<{ url?: string; title?: string; content?: string }> };
            if (data2.results && Array.isArray(data2.results)) {
              for (const item of data2.results) {
                if (!item.url || isBlockedUrl(item.url)) continue;
                const domain = extractDomain(item.url);
                if (!domain || seenDomains.has(domain)) continue;
                seenDomains.add(domain);
                results.push({
                  title: item.title || domain,
                  url: item.url,
                  snippet: item.content || '',
                });
                if (results.length >= maxResults) break;
              }
            }
          }
        } catch {
          // Page 2 failed — that's fine, use what we have
        }
      }

      return { results, error: null, instanceUsed: instance };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannt';
      console.log(`[WebSearch] SearXNG ${instance}: Fehler — ${msg}`);
      continue;
    }
  }

  return {
    results: [],
    error: `Alle ${SEARXNG_INSTANCES.length} SearXNG-Instanzen nicht erreichbar`,
    instanceUsed: null,
  };
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML Search (Fallback)
// ---------------------------------------------------------------------------

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

      if (
        html.includes('detected unusual traffic') ||
        html.includes('Please try again') ||
        html.includes('blocked')
      ) {
        error = 'DuckDuckGo hat die Anfrage blockiert (Rate-Limit)';
        break;
      }

      const linkRegex =
        /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

      const snippetRegex =
        /<(?:a|td)[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;

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

        if (isBlockedUrl(actualUrl)) {
          resultIndex++;
          continue;
        }

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

      if (foundOnPage === 0) {
        hasMore = false;
      } else if (results.length >= maxResults) {
        hasMore = false;
      } else {
        const hasNext =
          html.includes('name="s"') ||
          html.includes('next') ||
          html.includes('nächste');
        if (!hasNext && pageNum > 1) {
          hasMore = false;
        }
      }

      if (hasMore) {
        await delay(1200 + Math.random() * 1300);
      }

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
 * Search for businesses via web search.
 * Tries SearXNG instances first (JSON API, server-friendly),
 * then falls back to DuckDuckGo HTML.
 */
export async function searchBusinesses(
  keyword: string,
  city: string,
  maxResults: number = 20,
): Promise<GoogleSearchResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const query = `${keyword} ${city} Firma Kontakt`;

  // Try SearXNG first
  console.log(`[WebSearch] Suche: "${query}" (max ${maxResults})`);
  const searxng = await fetchSearxngResults(query, maxResults);

  let searchResults: SearchResult[];

  if (searxng.results.length > 0) {
    console.log(`[WebSearch] SearXNG erfolgreich: ${searxng.results.length} Ergebnisse via ${searxng.instanceUsed}`);
    searchResults = searxng.results;
  } else {
    if (searxng.error) errors.push(searxng.error);

    // Fallback to DuckDuckGo
    console.log('[WebSearch] Fallback: DuckDuckGo HTML');
    const ddg = await fetchDuckDuckGoResults(query, maxResults);
    searchResults = ddg.results;
    if (ddg.error) errors.push(ddg.error);
  }

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

    if (i + concurrency < results.length) {
      await delay(800 + Math.random() * 700);
    }
  }

  return businesses;
}

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

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        const pageTitle = decodeHtmlEntities(stripHtmlTags(titleMatch[1])).trim();
        if (pageTitle && pageTitle.length > 1 && pageTitle.length < 200) {
          companyName = pageTitle
            .replace(/\s*[\|–-]\s*(?:Start(?:seite)?|Home|Willkommen|Hauptseite|Über uns)$/i, '')
            .trim() || pageTitle;
        }
      }
    }
  } catch {
    // Homepage fetch failed — continue with Impressum parsing
  }

  try {
    const baseUrl = `https://${domain}`;
    const impressum = await parseImpressum(baseUrl);

    if (impressum.emails.length > 0) {
      email = impressum.emails[0];
    }
    if (impressum.phones.length > 0) {
      phone = impressum.phones[0];
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
