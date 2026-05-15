/**
 * Web Search Business Scraper (Brave Search API → SearXNG → DuckDuckGo)
 *
 * Findet Firmen-Websites über Web-Suche und extrahiert Kontaktdaten.
 *
 * Pipeline:
 * 1. Brave Search API (primär — kostenlos 2000 Queries/Monat, zuverlässig von Servern)
 * 2. SearXNG JSON API (Fallback ohne API-Key)
 * 3. DuckDuckGo HTML (letzter Fallback)
 * 4. Filtert Aggregator-Seiten raus
 * 5. Dedupliziert nach Domain
 * 6. (Optional) Enrichment: besucht jede Website, parst Impressum für Kontaktdaten
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
// Brave Search API (Primary — requires API key)
// ---------------------------------------------------------------------------

async function fetchBraveResults(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<{ results: SearchResult[]; error: string | null }> {
  const seenDomains = new Set<string>();
  const allItems: Array<{ url: string; title: string; snippet: string }> = [];

  // Brave returns up to 20 results per request, supports offset
  const pages = Math.ceil(Math.min(maxResults, 40) / 20);

  for (let page = 0; page < pages; page++) {
    try {
      const params = new URLSearchParams({
        q: query,
        count: '20',
        offset: String(page * 20),
        country: 'de',
        search_lang: 'de',
        ui_lang: 'de-DE',
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        return { results: [], error: 'Brave Search API-Key ungültig oder abgelaufen' };
      }
      if (res.status === 429) {
        return { results: filterAndDedup(allItems, seenDomains, maxResults), error: 'Brave Search Rate-Limit erreicht' };
      }
      if (!res.ok) {
        return { results: [], error: `Brave Search HTTP ${res.status}` };
      }

      const data = await res.json() as {
        web?: { results?: Array<{ url: string; title: string; description: string }> };
      };

      const webResults = data.web?.results;
      if (!webResults || webResults.length === 0) break;

      for (const r of webResults) {
        allItems.push({ url: r.url, title: r.title, snippet: r.description || '' });
      }

      if (webResults.length < 20) break;
      if (page < pages - 1) await delay(300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      return { results: filterAndDedup(allItems, seenDomains, maxResults), error: `Brave Search: ${msg}` };
    }
  }

  return { results: filterAndDedup(allItems, seenDomains, maxResults), error: null };
}

// ---------------------------------------------------------------------------
// SearXNG JSON API (Fallback — no API key needed)
// ---------------------------------------------------------------------------

async function fetchSearxngResults(
  query: string,
  maxResults: number,
): Promise<{ results: SearchResult[]; error: string | null; instanceUsed: string | null }> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=de&pageno=1`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'de-DE,de;q=0.9' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) { console.log(`[WebSearch] SearXNG ${instance}: HTTP ${res.status}`); continue; }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) { console.log(`[WebSearch] SearXNG ${instance}: kein JSON`); continue; }

      const data = await res.json() as { results?: Array<{ url?: string; title?: string; content?: string }> };
      if (!data.results || data.results.length === 0) { console.log(`[WebSearch] SearXNG ${instance}: leer`); continue; }

      console.log(`[WebSearch] SearXNG ${instance}: ${data.results.length} Rohergebnisse`);

      const seenDomains = new Set<string>();
      const items = data.results.map(r => ({ url: r.url || '', title: r.title || '', snippet: r.content || '' }));
      const results = filterAndDedup(items, seenDomains, maxResults);

      // Page 2 if needed
      if (results.length < maxResults && data.results.length >= 10) {
        await delay(800 + Math.random() * 500);
        try {
          const c2 = new AbortController();
          const t2 = setTimeout(() => c2.abort(), FETCH_TIMEOUT);
          const r2 = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=de&pageno=2`, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: c2.signal,
          });
          clearTimeout(t2);
          if (r2.ok) {
            const d2 = await r2.json() as { results?: Array<{ url?: string; title?: string; content?: string }> };
            if (d2.results) {
              const items2 = d2.results.map(r => ({ url: r.url || '', title: r.title || '', snippet: r.content || '' }));
              results.push(...filterAndDedup(items2, seenDomains, maxResults - results.length));
            }
          }
        } catch { /* page 2 failed, use what we have */ }
      }

      return { results, error: null, instanceUsed: instance };
    } catch (err) {
      console.log(`[WebSearch] SearXNG ${instance}: ${err instanceof Error ? err.message : 'Fehler'}`);
      continue;
    }
  }

  return { results: [], error: `Alle ${SEARXNG_INSTANCES.length} SearXNG-Instanzen nicht erreichbar`, instanceUsed: null };
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML Search (Last resort)
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) { error = `DuckDuckGo HTTP ${res.status}`; break; }
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
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) { error = `DuckDuckGo Seite ${pageNum} HTTP ${res.status}`; break; }
        html = await res.text();
      }

      if (html.includes('detected unusual traffic') || html.includes('Please try again')) {
        error = 'DuckDuckGo Rate-Limit';
        break;
      }

      const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<(?:a|td)[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
      const snippets: string[] = [];
      let sm: RegExpExecArray | null;
      while ((sm = snippetRegex.exec(html)) !== null) snippets.push(decodeHtmlEntities(stripHtmlTags(sm[1])));

      let lm: RegExpExecArray | null;
      let idx = 0;
      let found = 0;

      while ((lm = linkRegex.exec(html)) !== null) {
        const actualUrl = resolveDdgUrl(lm[1]);
        if (!actualUrl || isBlockedUrl(actualUrl)) { idx++; continue; }
        const domain = extractDomain(actualUrl);
        if (!domain || seenDomains.has(domain)) { idx++; continue; }
        seenDomains.add(domain);
        results.push({ title: decodeHtmlEntities(stripHtmlTags(lm[2])), url: actualUrl, snippet: snippets[idx] || '' });
        found++;
        idx++;
        if (results.length >= maxResults) break;
      }

      if (found === 0 || results.length >= maxResults) hasMore = false;
      else if (hasMore) await delay(1200 + Math.random() * 1300);
      if (pageNum >= 5) hasMore = false;
    } catch (err) {
      error = err instanceof Error
        ? (err.name === 'AbortError' ? 'DuckDuckGo Timeout' : err.message)
        : 'Unbekannter Fehler';
      hasMore = false;
    }
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
  braveApiKey?: string,
): Promise<GoogleSearchResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const query = `${keyword} ${city} Firma Kontakt`;

  console.log(`[WebSearch] Suche: "${query}" (max ${maxResults})`);

  let searchResults: SearchResult[] = [];

  // 1. Try Brave Search API (if key configured)
  if (braveApiKey) {
    console.log('[WebSearch] Brave Search API...');
    const brave = await fetchBraveResults(query, braveApiKey, maxResults);
    if (brave.results.length > 0) {
      console.log(`[WebSearch] Brave: ${brave.results.length} Ergebnisse`);
      searchResults = brave.results;
    }
    if (brave.error) errors.push(brave.error);
  }

  // 2. Fallback: SearXNG
  if (searchResults.length === 0) {
    if (!braveApiKey) console.log('[WebSearch] Kein Brave API-Key — versuche SearXNG...');
    else console.log('[WebSearch] Brave fehlgeschlagen — versuche SearXNG...');

    const searxng = await fetchSearxngResults(query, maxResults);
    if (searxng.results.length > 0) {
      console.log(`[WebSearch] SearXNG: ${searxng.results.length} Ergebnisse via ${searxng.instanceUsed}`);
      searchResults = searxng.results;
    }
    if (searxng.error) errors.push(searxng.error);
  }

  // 3. Last resort: DuckDuckGo HTML
  if (searchResults.length === 0) {
    console.log('[WebSearch] Fallback: DuckDuckGo HTML...');
    const ddg = await fetchDuckDuckGoResults(query, maxResults);
    if (ddg.results.length > 0) {
      console.log(`[WebSearch] DuckDuckGo: ${ddg.results.length} Ergebnisse`);
      searchResults = ddg.results;
    }
    if (ddg.error) errors.push(ddg.error);
  }

  // If nothing worked, add a helpful message
  if (searchResults.length === 0 && errors.length > 0) {
    errors.push('Tipp: Brave Search API-Key in Einstellungen hinterlegen (kostenlos auf brave.com/search/api)');
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
  concurrency: number = 3,
): Promise<ScrapedBusiness[]> {
  const businesses: ScrapedBusiness[] = [];

  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((sr) => enrichSingleResult(sr, city)));

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) businesses.push(outcome.value);
    }

    if (i + concurrency < results.length) await delay(800 + Math.random() * 700);
  }

  return businesses;
}

async function enrichSingleResult(sr: SearchResult, city: string): Promise<ScrapedBusiness | null> {
  const domain = extractDomain(sr.url);
  if (!domain) return null;

  let companyName = sr.title || domain;
  let email: string | null = null;
  let phone: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(sr.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' },
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
          companyName = pageTitle.replace(/\s*[\|–-]\s*(?:Start(?:seite)?|Home|Willkommen|Hauptseite|Über uns)$/i, '').trim() || pageTitle;
        }
      }
    }
  } catch { /* homepage fetch failed */ }

  try {
    const impressum = await parseImpressum(`https://${domain}`);
    if (impressum.emails.length > 0) email = impressum.emails[0];
    if (impressum.phones.length > 0) phone = impressum.phones[0];
  } catch { /* impressum failed */ }

  return {
    name: companyName,
    address: city,
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
