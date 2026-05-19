/**
 * Web Search Business Scraper
 * Queries ALL available search sources in parallel, merges + deduplicates.
 */

import { type ScrapedBusiness } from './maps-scraper';
import { delay, normalizeWebsite } from './utils';
import { parseImpressum } from './impressum-parser';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 8000;

const PUBLIC_SEARXNG = [
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://search.bus-hit.me',
  'https://searx.be',
  'https://search.mdosch.de',
  'https://paulgo.io',
  'https://priv.au',
];

const BLOCKED_DOMAINS = new Set([
  'gelbeseiten.de', '11880.com', 'yelp.de', 'yelp.com',
  'google.com', 'google.de', 'facebook.com', 'instagram.com',
  'youtube.com', 'wikipedia.org', 'linkedin.com', 'xing.com',
  'kununu.de', 'indeed.de', 'indeed.com', 'stepstone.de',
  'twitter.com', 'x.com', 'tiktok.com', 'pinterest.com', 'pinterest.de',
  'amazon.de', 'amazon.com', 'ebay.de', 'ebay.com',
  'tripadvisor.de', 'tripadvisor.com', 'golocal.de',
  'branchenbuch.meinestadt.de', 'meinestadt.de', 'cylex.de',
  'hotfrog.de', 'firmenwissen.de', 'northdata.de', 'wlw.de',
  'kompass.com', 'duckduckgo.com', 'brave.com',
  'kennstdueinen.de', 'werkenntdenbesten.de', 'stadtbranchenbuch.com',
  'dasoertliche.de', 'branchenbuch.de', 'tupalo.com', 'stayfriends.de',
  'marktplatz-mittelstand.de', 'myhammer.de', 'check24.de',
  'provenexpert.com', 'trustpilot.com', 'auskunft.de',
  'herold.at', 'local.ch', 'reddit.com', 'gutefrage.net',
  'handwerker.de', 'handwerkerportal.de', 'my-hammer.de',
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
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) return true;
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü')
    .replace(/&Ouml;/g, 'Ö').replace(/&Auml;/g, 'Ä').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß').replace(/&#\d+;/g, ' ').replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function resolveDdgUrl(rawUrl: string): string {
  const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
  if (uddgMatch) return decodeURIComponent(uddgMatch[1]);
  if (rawUrl.startsWith('http')) return rawUrl;
  return '';
}

function filterAndDedup(
  items: Array<{ url: string; title: string; snippet: string }>,
  seenDomains: Set<string>,
  maxResults: number,
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const item of items) {
    if (!item.url || isBlockedUrl(item.url)) continue;
    const domain = extractDomain(item.url);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    results.push({ title: item.title || domain, url: item.url, snippet: item.snippet || '' });
    if (results.length >= maxResults) break;
  }
  return results;
}

// ---------------------------------------------------------------------------
// SearXNG (lokal oder remote)
// ---------------------------------------------------------------------------

interface SearxngResult {
  url?: string;
  title?: string;
  content?: string;
}

async function fetchSearxng(
  baseUrl: string,
  query: string,
  maxResults: number,
  maxPages: number = 10,
): Promise<{ results: SearchResult[]; error: string | null }> {
  const seenDomains = new Set<string>();
  const allResults: SearchResult[] = [];
  let apiEmptyPages = 0;
  let filteredEmptyStreak = 0;
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  for (let page = 1; page <= maxPages; page++) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        categories: 'general',
        language: 'de',
        pageno: String(page),
      });
      // Don't force engines on local — let SearXNG use ALL enabled engines
      // Forcing engines that aren't installed causes it to return fewer results

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(`${baseUrl}/search?${params}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) return { results: allResults, error: `SearXNG HTTP ${res.status}` };

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) return { results: allResults, error: 'SearXNG: kein JSON' };

      const data = await res.json() as { results?: SearxngResult[] };
      if (!data.results || data.results.length === 0) {
        apiEmptyPages++;
        if (apiEmptyPages >= 3) break;
        continue;
      }

      const prevCount = allResults.length;
      const items = data.results.map(r => ({
        url: r.url || '', title: r.title || '', snippet: r.content || '',
      }));
      const pageResults = filterAndDedup(items, seenDomains, maxResults - allResults.length);
      allResults.push(...pageResults);

      if (allResults.length >= maxResults) break;

      if (allResults.length === prevCount) {
        filteredEmptyStreak++;
        // Keep paginating through blocked domains — real business sites are buried deep
        if (filteredEmptyStreak >= 15) break;
      } else {
        filteredEmptyStreak = 0;
      }

      // No delay on local SearXNG (our own server), small delay on public
      if (!isLocal && page < maxPages) await delay(50 + Math.random() * 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler';
      return { results: allResults, error: `SearXNG: ${msg}` };
    }
  }

  return { results: allResults, error: null };
}

// ---------------------------------------------------------------------------
// Brave Search API
// ---------------------------------------------------------------------------

async function fetchBraveResults(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<{ results: SearchResult[]; error: string | null }> {
  const seenDomains = new Set<string>();
  const allItems: Array<{ url: string; title: string; snippet: string }> = [];
  const pages = Math.ceil(Math.min(maxResults, 200) / 20);

  for (let page = 0; page < pages; page++) {
    try {
      const params = new URLSearchParams({
        q: query, count: '20', offset: String(page * 20),
        country: 'de', search_lang: 'de', ui_lang: 'de-DE',
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) return { results: [], error: 'Brave API-Key ungültig' };
      if (res.status === 429) return { results: filterAndDedup(allItems, seenDomains, maxResults), error: 'Brave Rate-Limit' };
      if (!res.ok) return { results: [], error: `Brave HTTP ${res.status}` };

      const data = await res.json() as { web?: { results?: Array<{ url: string; title: string; description: string }> } };
      const webResults = data.web?.results;
      if (!webResults || webResults.length === 0) break;

      for (const r of webResults) allItems.push({ url: r.url, title: r.title, snippet: r.description || '' });
      if (webResults.length < 20) break;
      if (page < pages - 1) await delay(200);
    } catch (err) {
      return { results: filterAndDedup(allItems, seenDomains, maxResults), error: `Brave: ${err instanceof Error ? err.message : 'Fehler'}` };
    }
  }

  return { results: filterAndDedup(allItems, seenDomains, maxResults), error: null };
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML (mit Pagination)
// ---------------------------------------------------------------------------

async function fetchDdgResults(
  query: string,
  maxResults: number,
): Promise<{ results: SearchResult[]; error: string | null }> {
  const results: SearchResult[] = [];
  const seenDomains = new Set<string>();
  let error: string | null = null;
  const maxPages = 5;

  function parseHtmlPage(html: string): { nextFormData: string | null } {
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<(?:a|td)[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snippetRegex.exec(html)) !== null) snippets.push(decodeHtmlEntities(stripHtmlTags(sm[1])));

    let lm: RegExpExecArray | null;
    let idx = 0;
    while ((lm = linkRegex.exec(html)) !== null) {
      const actualUrl = resolveDdgUrl(lm[1]);
      if (!actualUrl || isBlockedUrl(actualUrl)) { idx++; continue; }
      const domain = extractDomain(actualUrl);
      if (!domain || seenDomains.has(domain)) { idx++; continue; }
      seenDomains.add(domain);
      results.push({ title: decodeHtmlEntities(stripHtmlTags(lm[2])), url: actualUrl, snippet: snippets[idx] || '' });
      idx++;
    }

    const nextMatch = html.match(/<input[^>]+name="s"[^>]+value="([^"]+)"/);
    const dcMatch = html.match(/<input[^>]+name="dc"[^>]+value="([^"]+)"/);
    if (nextMatch) {
      return { nextFormData: `q=${encodeURIComponent(query)}&s=${nextMatch[1]}${dcMatch ? `&dc=${dcMatch[1]}` : ''}` };
    }
    return { nextFormData: null };
  }

  try {
    let url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=de-de`;
    let method: 'GET' | 'POST' = 'GET';
    let body: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const fetchOpts: RequestInit = {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html',
          'Accept-Language': 'de-DE,de;q=0.9',
          ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        signal: controller.signal,
        method,
        body: method === 'POST' ? body : undefined,
      };

      const res = await fetch(url, fetchOpts);
      clearTimeout(timeout);

      if (!res.ok) { error = `DuckDuckGo HTTP ${res.status}`; break; }
      const html = await res.text();

      if (html.includes('detected unusual traffic') || html.includes('Please try again')) {
        error = 'DuckDuckGo Rate-Limit';
        break;
      }

      const prevCount = results.length;
      const { nextFormData } = parseHtmlPage(html);

      if (results.length >= maxResults) break;
      if (results.length === prevCount && page > 0) break;
      if (!nextFormData) break;

      url = 'https://html.duckduckgo.com/html/';
      method = 'POST';
      body = nextFormData;
      await delay(100 + Math.random() * 150);
    }
  } catch (err) {
    error = err instanceof Error ? (err.name === 'AbortError' ? 'DuckDuckGo Timeout' : err.message) : 'Fehler';
  }

  return { results, error };
}

// ---------------------------------------------------------------------------
// Public API: searchBusinesses
// ---------------------------------------------------------------------------

export async function searchBusinesses(
  keyword: string,
  city: string,
  maxResults: number = 20,
  options?: { searxngUrl?: string; braveApiKey?: string; fast?: boolean },
): Promise<GoogleSearchResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const query = city ? `${keyword} ${city}` : keyword;
  const searxngUrl = options?.searxngUrl;
  const braveApiKey = options?.braveApiKey;
  const fast = options?.fast || false;

  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  function mergeResults(results: SearchResult[]) {
    for (const r of results) {
      const normalized = r.url.replace(/\/+$/, '').toLowerCase();
      if (!seenUrls.has(normalized)) {
        seenUrls.add(normalized);
        allResults.push(r);
      }
    }
  }

  const promises: Promise<void>[] = [];

  // SearXNG lokal — deep pagination for max results
  if (searxngUrl) {
    promises.push((async () => {
      const pages = fast ? 8 : 30;
      const local = await fetchSearxng(searxngUrl, query, maxResults, pages);
      if (local.results.length > 0) mergeResults(local.results);
      if (local.error) errors.push(`Lokal: ${local.error}`);
    })());
  }

  // Brave Search API
  if (braveApiKey) {
    promises.push((async () => {
      const brave = await fetchBraveResults(query, braveApiKey, fast ? 40 : maxResults);
      if (brave.results.length > 0) mergeResults(brave.results);
      if (brave.error) errors.push(brave.error);
    })());
  }

  // DuckDuckGo — always run, even in fast mode (it's quick)
  promises.push((async () => {
    const ddg = await fetchDdgResults(query, fast ? 50 : maxResults);
    if (ddg.results.length > 0) mergeResults(ddg.results);
    if (ddg.error) errors.push(`DDG: ${ddg.error}`);
  })());

  // Public SearXNG only if no local instance
  if (!searxngUrl) {
    promises.push((async () => {
      for (const instance of PUBLIC_SEARXNG) {
        const pub = await fetchSearxng(instance, query, maxResults, fast ? 3 : 5);
        if (pub.results.length > 0) {
          mergeResults(pub.results);
          break;
        }
      }
    })());
  }

  await Promise.allSettled(promises);

  const searchResults = allResults;

  if (searchResults.length === 0 && !searxngUrl) {
    errors.push('Tipp: SearXNG lokal installieren für unlimitierte Web-Suche (docker run -d -p 8888:8080 searxng/searxng)');
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

export async function enrichSearchResults(
  results: SearchResult[],
  city: string,
  concurrency: number = 15,
): Promise<ScrapedBusiness[]> {
  const businesses: ScrapedBusiness[] = [];

  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((sr) => enrichSingleResult(sr, city)));
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) businesses.push(outcome.value);
    }
  }

  return businesses;
}

async function enrichSingleResult(sr: SearchResult, city: string): Promise<ScrapedBusiness | null> {
  const domain = extractDomain(sr.url);
  if (!domain) return null;

  let companyName = sr.title || domain;
  let email: string | null = null;
  let phone: string | null = null;

  const [homepageResult, impressumResult] = await Promise.allSettled([
    (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const res = await fetch(sr.url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' },
        redirect: 'follow', signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        const pageTitle = decodeHtmlEntities(stripHtmlTags(titleMatch[1])).trim();
        if (pageTitle && pageTitle.length > 1 && pageTitle.length < 200) {
          return pageTitle.replace(/\s*[\|–-]\s*(?:Start(?:seite)?|Home|Willkommen|Hauptseite|Über uns)$/i, '').trim() || pageTitle;
        }
      }
      return null;
    })(),
    parseImpressum(`https://${domain}`),
  ]);

  if (homepageResult.status === 'fulfilled' && homepageResult.value) {
    companyName = homepageResult.value;
  }
  if (impressumResult.status === 'fulfilled') {
    if (impressumResult.value.emails.length > 0) email = impressumResult.value.emails[0];
    if (impressumResult.value.phones.length > 0) phone = impressumResult.value.phones[0];
  }

  return {
    name: companyName, address: city, city, phone, website: sr.url, email,
    rating: null, reviews: null, category: null, placeId: null,
  };
}
