/**
 * LinkedIn Profile & Email Scraper - FREE (Selbstgebaut)
 *
 * KEIN API-Key nötig. KEINE Kosten. Komplett unabhängig.
 * KEIN Limit - scrapt ALLE verfügbaren Ergebnisse.
 *
 * Pipeline:
 * 1. DuckDuckGo/Google/Bing Suche - findet LinkedIn Profile via site:linkedin.com/in
 * 2. Public Profile Fetch - extrahiert Name, Firma, Titel aus JSON-LD/Meta-Tags
 * 3. Email-Pattern-Generierung - baut Kandidaten (vorname.nachname@firma.de etc.)
 * 4. SMTP-Verifikation - prüft ob E-Mail existiert (ohne zu senden)
 * 5. Impressum-Fallback - parst /impressum der Firmen-Website für E-Mail
 */

import { normalizeLinkedInUrl, type LinkedInPerson } from './linkedin-scraper';
import { delay, randomDelay } from './utils';
import { parseImpressum } from './impressum-parser';
import * as http from 'http';
import * as tls from 'tls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedInScrapeProgress {
  type: string;
  keyword?: string;
  message?: string;
  profileName?: string;
  profileCompany?: string;
  profileEmail?: string | null;
  hasEmail?: boolean;
  emailConfidence?: 'high' | 'medium' | 'low' | null;
  importStatus?: string;
  currentProfile?: number;
  totalProfiles?: number;
  currentKeyword?: number;
  totalKeywords?: number;
  profilesFound?: number;
  totalFound?: number;
  totalImported?: number;
  totalDuplicates?: number;
  totalNoEmail?: number;
  totalSkipped?: number;
  searchFound?: number;
  searchImported?: number;
  searchDuplicates?: number;
  searchNoEmail?: number;
  searchDuration?: number;
  duration?: number;
  error?: string;
  errors?: string[];
  jobId?: number;
}

export interface FreeLinkedInPerson extends LinkedInPerson {
  emailConfidence: 'high' | 'medium' | 'low' | null;
  companyDomain: string | null;
}

interface SearchResult {
  profileUrl: string;
  snippetName: string;
  snippetHeadline: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
];

// Common email patterns ordered by frequency
const EMAIL_PATTERNS = [
  (f: string, l: string) => `${f}.${l}`,        // vorname.nachname
  (f: string, l: string) => `${f}${l}`,          // vornamenachname
  (f: string, l: string) => `${f[0]}.${l}`,      // v.nachname
  (f: string, l: string) => `${f[0]}${l}`,       // vnachname
  (f: string, l: string) => `${f}`,              // vorname
  (f: string, l: string) => `${l}`,              // nachname
  (f: string, l: string) => `${f}_${l}`,         // vorname_nachname
  (f: string, l: string) => `${f}-${l}`,         // vorname-nachname
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---------------------------------------------------------------------------
// Proxy Support
// ---------------------------------------------------------------------------

export interface ProxyEntry {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export function parseProxyList(text: string): ProxyEntry[] {
  return text.trim().split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      const p = line.split(':');
      if (p.length < 4) return null;
      return { host: p[0], port: parseInt(p[1]), user: p[2], pass: p.slice(3).join(':') };
    })
    .filter((p): p is ProxyEntry => p !== null && !isNaN(p.port));
}

const GOOGLE_CONSENT_COOKIES = 'CONSENT=PENDING+987; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTUtMF9SQzIaAmRlIAEaBgiA_ZYZBQ; NID=dummy';

async function fetchViaProxy(
  targetUrl: string,
  proxy: ProxyEntry,
  headers: Record<string, string> = {},
  timeout = 15000,
  redirectsLeft = 3,
): Promise<{ status: number; body: string }> {
  const target = new URL(targetUrl);
  const auth = Buffer.from(`${proxy.user}:${proxy.pass}`).toString('base64');

  // Step 1: CONNECT tunnel through proxy
  const tunnelSocket: any = await new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${target.hostname}:443`,
      headers: { 'Proxy-Authorization': `Basic ${auth}` },
      timeout,
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`CONNECT ${res.statusCode}`));
        return;
      }
      resolve(socket);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('CONNECT timeout')); });
    req.end();
  });

  // Step 2: TLS handshake over tunnel
  const tlsSocket = tls.connect({ socket: tunnelSocket, servername: target.hostname });
  await new Promise<void>((resolve, reject) => {
    tlsSocket.once('secureConnect', resolve);
    tlsSocket.once('error', reject);
    setTimeout(() => { tlsSocket.destroy(); reject(new Error('TLS timeout')); }, timeout);
  });

  // Step 3: HTTP request via Node's http parser (handles chunked encoding properly)
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const timer = setTimeout(() => { tlsSocket.destroy(); reject(new Error('Request timeout')); }, timeout);

    const req = http.request({
      createConnection: () => tlsSocket as any,
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'GET',
      headers: {
        ...headers,
        'Host': target.hostname,
        'Cookie': GOOGLE_CONSENT_COOKIES,
        'Connection': 'close',
        'Accept-Encoding': 'identity',
      },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location && redirectsLeft > 0) {
        clearTimeout(timer);
        tlsSocket.destroy();
        fetchViaProxy(res.headers.location!, proxy, headers, timeout, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }

      let body = '';
      res.on('data', (chunk: any) => { body += chunk.toString(); });
      res.on('end', () => { clearTimeout(timer); tlsSocket.destroy(); resolve({ status: res.statusCode || 0, body }); });
      res.on('error', (e) => { clearTimeout(timer); tlsSocket.destroy(); reject(e); });
    });

    req.on('error', (e) => { clearTimeout(timer); tlsSocket.destroy(); reject(e); });
    req.end();
  });
}

async function searchGoogleViaProxy(
  keyword: string,
  location: string,
  maxResults: number,
  proxies: ProxyEntry[],
  onProgress?: (msg: string, count: number) => void,
  lightweight: boolean = false,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const allQueries = [
    {
      label: 'Google',
      q: location
        ? `site:linkedin.com/in ${keyword} ${location}`
        : `site:linkedin.com/in ${keyword}`,
    },
    {
      label: 'Google breit',
      q: location
        ? `"linkedin.com/in" ${keyword} ${location}`
        : `"linkedin.com/in" ${keyword}`,
    },
  ];

  const queries = lightweight ? [allQueries[0]] : allQueries;
  const maxPages = lightweight ? 10 : 30;

  for (let qi = 0; qi < queries.length; qi++) {
    const { label, q } = queries[qi];
    let start = 0;
    let pageNum = 0;
    let hasMore = true;
    let proxyRetries = 0;

    while (hasMore) {
      pageNum++;
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];

      if (pageNum <= 3 || pageNum % 5 === 0) {
        onProgress?.(`[${label}] Seite ${pageNum} via Proxy ${proxy.host}...`, results.length);
      }

      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&start=${start}&num=10&hl=de`;
        const res = await fetchViaProxy(url, proxy, {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.3',
        });

        // Debug on first page
        if (pageNum === 1) {
          const rawMatches = (res.body.match(/linkedin\.com\/in\/[\w%-]+/gi) || []).length;
          const encodedMatches = (res.body.match(/linkedin\.com%2Fin%2F[\w%-]+/gi) || []).length;
          onProgress?.(`[${label}] Status ${res.status}, ${res.body.length} bytes, ${rawMatches} direkte + ${encodedMatches} encoded LinkedIn-URLs`, results.length);
        }

        if (res.status === 429 || res.status === 503) {
          onProgress?.(`[${label}] ${res.status} — wechsle Proxy`, results.length);
          proxyRetries++;
          if (proxyRetries >= 5) {
            onProgress?.(`[${label}] Zu viele Fehler — stoppe`, results.length);
            break;
          }
          await randomDelay(500, 1500);
          continue;
        }

        if (res.body.includes('detected unusual traffic') || res.body.includes('CAPTCHA') || res.body.includes('captcha')) {
          onProgress?.(`[${label}] CAPTCHA — wechsle Proxy`, results.length);
          proxyRetries++;
          if (proxyRetries >= 5) break;
          await randomDelay(500, 1500);
          continue;
        }

        proxyRetries = 0;
        const html = res.body;
        let foundOnPage = 0;

        // Broad extraction: find ALL LinkedIn profile URLs anywhere in the HTML
        // Handles: direct links, de.linkedin.com, URL-encoded, data attributes, etc.
        const urlPatterns = [
          /https?:\/\/(?:[a-z]{2}\.)?linkedin\.com\/in\/[\w%-]+/gi,
          /https?%3A%2F%2F(?:[a-z]{2}\.)?linkedin\.com%2Fin%2F[\w%-]+/gi,
        ];

        const foundUrls = new Set<string>();
        for (const pattern of urlPatterns) {
          let match;
          while ((match = pattern.exec(html)) !== null) {
            let rawUrl = match[0];
            if (rawUrl.includes('%3A%2F%2F')) rawUrl = decodeURIComponent(rawUrl);
            const profileUrl = cleanLinkedInUrl(rawUrl);
            if (profileUrl) foundUrls.add(profileUrl);
          }
        }

        for (const profileUrl of foundUrls) {
          const norm = normalizeLinkedInUrl(profileUrl);
          if (seenUrls.has(norm)) continue;
          seenUrls.add(norm);

          const username = profileUrl.split('/in/')[1] || '';
          const parsed = parseSearchTitle(username);
          results.push({ profileUrl, snippetName: parsed.name, snippetHeadline: parsed.headline });
          foundOnPage++;
          if (maxResults > 0 && results.length >= maxResults) break;
        }

        onProgress?.(`[${label}] Seite ${pageNum}: ${foundOnPage} Profile (gesamt: ${results.length})`, results.length);

        if (foundOnPage === 0 || (maxResults > 0 && results.length >= maxResults)) {
          hasMore = false;
        } else {
          start += 10;
          await randomDelay(1000, 3000);
        }

        if (pageNum >= maxPages) hasMore = false;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unbekannt';
        onProgress?.(`[${label}] Proxy-Fehler: ${msg} — wechsle Proxy`, results.length);
        proxyRetries++;
        if (proxyRetries >= 5) {
          onProgress?.(`[${label}] 5 Proxy-Fehler — stoppe Strategie`, results.length);
          break;
        }
        await randomDelay(300, 800);
      }
    }

    onProgress?.(`[${label}] fertig: ${results.length} Profile`, results.length);

    if (qi < queries.length - 1 && results.length < (maxResults || 999)) {
      await randomDelay(1000, 2000);
    }
  }

  return results;
}

/**
 * Extract LinkedIn profile name/headline from a search result title.
 * Titles usually look like: "Name – Position – Firma | LinkedIn"
 */
function parseSearchTitle(title: string): { name: string; headline: string } {
  const cleaned = title
    .replace(/\s*[\|–-]\s*LinkedIn\s*$/i, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const parts = cleaned.split(/\s*[\|–]\s*/);
  return {
    name: parts[0]?.trim() || '',
    headline: parts.slice(1).join(' – ').trim(),
  };
}

/**
 * Clean up a LinkedIn URL to canonical form
 */
function cleanLinkedInUrl(url: string): string | null {
  // Extract linkedin.com/in/username from any URL
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://www.linkedin.com/in/${match[1]}`;
}

// ---------------------------------------------------------------------------
// 1. Search Engines — DuckDuckGo + Bing (plain HTTP, kein Puppeteer)
// ---------------------------------------------------------------------------

/**
 * Search DuckDuckGo HTML for LinkedIn profiles.
 * DuckDuckGo HTML version: no JS required, no CAPTCHA, plain HTTP fetch.
 * Paginates until no more results.
 *
 * maxResults: 0 = unlimited (scrape everything available)
 */
async function searchDuckDuckGo(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress?: (msg: string, count: number) => void,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const query = location
    ? `site:linkedin.com/in ${keyword} ${location}`
    : `site:linkedin.com/in ${keyword}`;

  let pageNum = 0;
  let hasMore = true;

  while (hasMore) {
    pageNum++;
    onProgress?.(`DuckDuckGo Seite ${pageNum}...`, results.length);

    try {
      // DuckDuckGo HTML pagination uses POST with form data
      let html: string;

      if (pageNum === 1) {
        // First page: GET request
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'de-DE,de;q=0.9',
          },
        });
        if (!res.ok) {
          onProgress?.(`DuckDuckGo Fehler: ${res.status}`, results.length);
          break;
        }
        html = await res.text();
      } else {
        // Subsequent pages: POST with form data including vqd token and s offset
        // DuckDuckGo HTML uses form-based pagination
        const formData = new URLSearchParams();
        formData.append('q', query);
        formData.append('s', String((pageNum - 1) * 30));
        formData.append('dc', String((pageNum - 1) * 30 + 1));
        formData.append('o', 'json');
        formData.append('api', 'd.js');

        const res = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'de-DE,de;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });
        if (!res.ok) break;
        html = await res.text();
      }

      // Parse results from HTML
      // DuckDuckGo HTML results are in <a class="result__a" href="..."> tags
      const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      let foundOnPage = 0;

      while ((match = linkRegex.exec(html)) !== null) {
        const rawUrl = match[1];
        const rawTitle = match[2].replace(/<[^>]+>/g, '').trim(); // Strip HTML tags

        // DuckDuckGo wraps URLs in a redirect - extract actual URL
        let actualUrl = rawUrl;
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          actualUrl = decodeURIComponent(uddgMatch[1]);
        }

        const profileUrl = cleanLinkedInUrl(actualUrl);
        if (!profileUrl) continue;

        const norm = normalizeLinkedInUrl(profileUrl);
        if (seenUrls.has(norm)) continue;
        seenUrls.add(norm);

        const parsed = parseSearchTitle(rawTitle);
        results.push({
          profileUrl,
          snippetName: parsed.name,
          snippetHeadline: parsed.headline,
        });
        foundOnPage++;

        if (maxResults > 0 && results.length >= maxResults) break;
      }

      // Also try alternative DDG result format
      if (foundOnPage === 0) {
        const altRegex = /<a[^>]+href="(https?:\/\/[^"]*linkedin\.com\/in\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let altMatch;
        while ((altMatch = altRegex.exec(html)) !== null) {
          const profileUrl = cleanLinkedInUrl(altMatch[1]);
          if (!profileUrl) continue;
          const norm = normalizeLinkedInUrl(profileUrl);
          if (seenUrls.has(norm)) continue;
          seenUrls.add(norm);
          const parsed = parseSearchTitle(altMatch[2].replace(/<[^>]+>/g, '').trim());
          results.push({ profileUrl, snippetName: parsed.name, snippetHeadline: parsed.headline });
          foundOnPage++;
          if (maxResults > 0 && results.length >= maxResults) break;
        }
      }

      onProgress?.(`DuckDuckGo Seite ${pageNum}: ${foundOnPage} neue Profile (gesamt: ${results.length})`, results.length);

      // Stop conditions
      if (foundOnPage === 0) {
        hasMore = false;
      } else if (maxResults > 0 && results.length >= maxResults) {
        hasMore = false;
      } else {
        // Check if there's a "next" button
        const hasNext = html.includes('name="s"') || html.includes('next') || html.includes('nächste');
        if (!hasNext && pageNum > 1) {
          hasMore = false;
        }
      }

      // Rate limit between pages
      if (hasMore) {
        await randomDelay(1000, 2500);
      }

      // Safety: max 100 pages to avoid infinite loops
      if (pageNum >= 100) {
        onProgress?.('Maximale Seitenzahl erreicht (100 Seiten)', results.length);
        hasMore = false;
      }
    } catch (err) {
      onProgress?.(`DuckDuckGo Fehler Seite ${pageNum}: ${err instanceof Error ? err.message : 'Unbekannt'}`, results.length);
      hasMore = false;
    }
  }

  return results;
}

/**
 * Search Bing for LinkedIn profiles. Plain HTTP fetch, no Puppeteer.
 * Used as fallback if DuckDuckGo fails.
 */
async function searchBing(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress?: (msg: string, count: number) => void,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const query = location
    ? `site:linkedin.com/in "${keyword}" "${location}"`
    : `site:linkedin.com/in "${keyword}"`;

  let offset = 0;
  let hasMore = true;
  let pageNum = 0;

  while (hasMore) {
    pageNum++;
    onProgress?.(`Bing Seite ${pageNum}...`, results.length);

    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${offset + 1}&count=50`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9',
        },
      });

      if (!res.ok) {
        onProgress?.(`Bing Fehler: ${res.status}`, results.length);
        break;
      }

      const html = await res.text();

      // Parse Bing results — links in <li class="b_algo"> containers
      const resultRegex = /<li\s+class="b_algo">([\s\S]*?)<\/li>/gi;
      let resultMatch: RegExpExecArray | null;
      let foundOnPage = 0;

      while ((resultMatch = resultRegex.exec(html)) !== null) {
        const block = resultMatch[1];
        const linkMatch = block.match(/<a\s+href="(https?:\/\/[^"]*linkedin\.com\/in\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        const profileUrl = cleanLinkedInUrl(linkMatch[1]);
        if (!profileUrl) continue;

        const norm = normalizeLinkedInUrl(profileUrl);
        if (seenUrls.has(norm)) continue;
        seenUrls.add(norm);

        const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        const parsed = parseSearchTitle(title);
        results.push({
          profileUrl,
          snippetName: parsed.name,
          snippetHeadline: parsed.headline,
        });
        foundOnPage++;

        if (maxResults > 0 && results.length >= maxResults) break;
      }

      onProgress?.(`Bing Seite ${pageNum}: ${foundOnPage} neue Profile (gesamt: ${results.length})`, results.length);

      if (foundOnPage === 0) {
        hasMore = false;
      } else if (maxResults > 0 && results.length >= maxResults) {
        hasMore = false;
      } else {
        offset += 50;
      }

      if (hasMore) {
        await randomDelay(1500, 3000);
      }

      // Safety limit
      if (pageNum >= 50) {
        hasMore = false;
      }
    } catch (err) {
      onProgress?.(`Bing Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`, results.length);
      hasMore = false;
    }
  }

  return results;
}

/**
 * Search via SearXNG instance for LinkedIn profiles.
 * Self-hosted — no rate limits from SearXNG itself, but upstream engines
 * (Google, Bing, DDG) WILL rate-limit if hammered.
 *
 * Strategy: Uses 1-2 query formats with pagination. Respects upstream engine
 * rate limits by adding delays between requests. When called for many keywords
 * in succession, uses only the most effective strategy (site:) to reduce load.
 *
 * @param lightweight - When true, uses only the primary strategy (site:) and
 *   shorter pagination. Use for mass-keyword scraping (10+ keywords).
 */
async function searchSearXNG(
  keyword: string,
  location: string,
  maxResults: number,
  searxngUrl: string,
  onProgress?: (msg: string, count: number) => void,
  lightweight: boolean = false,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  // In lightweight mode (many keywords), use only the best strategy
  // In full mode (few keywords), use all 4 for maximum coverage
  const allQueries = [
    {
      label: 'site:',
      q: location
        ? `site:linkedin.com/in ${keyword} ${location}`
        : `site:linkedin.com/in ${keyword}`,
    },
    {
      label: 'URL-Match',
      q: location
        ? `"linkedin.com/in" ${keyword} ${location}`
        : `"linkedin.com/in" ${keyword}`,
    },
    {
      label: 'Profil',
      q: location
        ? `linkedin profil ${keyword} ${location}`
        : `linkedin profil ${keyword}`,
    },
    {
      label: 'Breit',
      q: location
        ? `${keyword} ${location} linkedin`
        : `${keyword} linkedin`,
    },
  ];

  const queries = lightweight ? [allQueries[0], allQueries[3]] : allQueries;
  const maxPagesPerStrategy = lightweight
    ? (maxResults === 0 ? 10 : Math.max(3, Math.ceil(maxResults / 10)))
    : (maxResults === 0 ? 50 : Math.max(5, Math.ceil(maxResults / 10)));

  let emptyStrategies = 0;
  let totalApiResults = 0;

  for (let qi = 0; qi < queries.length; qi++) {
    const { label, q } = queries[qi];
    let pageNum = 0;
    let hasMore = true;
    let strategyFound = 0;
    let consecutiveEmpty = 0;
    let retries = 0;

    while (hasMore) {
      pageNum++;
      if (pageNum % 5 === 1 || pageNum <= 3) {
        onProgress?.(`[${label}] Seite ${pageNum}... (${results.length} Profile bisher)`, results.length);
      }

      try {
        const params = new URLSearchParams({
          q,
          format: 'json',
          pageno: String(pageNum),
          language: 'de',
          safesearch: '0',
          time_range: '',
        });

        const res = await fetch(`${searxngUrl}/search?${params}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (res.status === 429) {
          onProgress?.(`[${label}] Rate-Limit — warte 5s`, results.length);
          await delay(5000);
          retries++;
          if (retries >= 3) {
            onProgress?.(`[${label}] Zu viele Rate-Limits — ueberspringe`, results.length);
            break;
          }
          continue;
        }
        if (!res.ok) {
          onProgress?.(`[${label}] HTTP ${res.status}`, results.length);
          break;
        }

        const data = await res.json();
        const items = (data.results || []) as { url?: string; title?: string; content?: string }[];
        totalApiResults += items.length;
        let foundOnPage = 0;

        for (const item of items) {
          const profileUrl = cleanLinkedInUrl(item.url || '');
          if (!profileUrl) continue;
          const norm = normalizeLinkedInUrl(profileUrl);
          if (seenUrls.has(norm)) continue;
          seenUrls.add(norm);
          const parsed = parseSearchTitle(item.title || '');
          results.push({
            profileUrl,
            snippetName: parsed.name,
            snippetHeadline: parsed.headline || (item.content || '').slice(0, 100),
          });
          foundOnPage++;
          strategyFound++;
          if (maxResults > 0 && results.length >= maxResults) break;
        }

        if (foundOnPage === 0 && items.length === 0) {
          // SearXNG returned nothing — upstream engines may be rate-limiting
          consecutiveEmpty++;
          if (consecutiveEmpty === 1 && retries < 2) {
            // First empty page: wait and retry once
            onProgress?.(`[${label}] 0 Ergebnisse — warte 3s und versuche erneut`, results.length);
            await delay(3000);
            retries++;
            continue;
          }
        } else if (foundOnPage === 0 && items.length > 0) {
          // SearXNG returned results, but none were LinkedIn profiles
          consecutiveEmpty++;
          onProgress?.(`[${label}] ${items.length} Ergebnisse, aber keine LinkedIn-Profile`, results.length);
        } else {
          consecutiveEmpty = 0;
        }

        // Stop conditions for this strategy
        if (consecutiveEmpty >= 3) hasMore = false;
        else if (items.length === 0 && consecutiveEmpty >= 2) hasMore = false;
        else if (maxResults > 0 && results.length >= maxResults) hasMore = false;
        else if (pageNum >= maxPagesPerStrategy) hasMore = false;

        // Delay between pages — longer to avoid upstream rate-limiting
        if (hasMore) {
          const pageDelay = lightweight ? [800, 1500] : [400, 800];
          await randomDelay(pageDelay[0], pageDelay[1]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unbekannt';
        if (msg.includes('timeout') || msg.includes('abort')) {
          onProgress?.(`[${label}] Timeout Seite ${pageNum} — weiter`, results.length);
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) hasMore = false;
          continue;
        }
        onProgress?.(`[${label}] Fehler: ${msg}`, results.length);
        break;
      }
    }

    onProgress?.(`[${label}] fertig: ${strategyFound} neue Profile in ${pageNum} Seiten (gesamt: ${results.length})`, results.length);

    if (strategyFound === 0) emptyStrategies++;
    if (maxResults > 0 && results.length >= maxResults) break;

    // If the first strategy returned 0 API results at all, engines are blocked — skip rest
    if (qi === 0 && totalApiResults === 0) {
      onProgress?.('Engines blockiert — ueberspringe restliche Strategien', results.length);
      break;
    }

    // Delay between strategies — longer to let upstream engines cool down
    if (qi < queries.length - 1) {
      const stratDelay = lightweight ? [2000, 4000] : [1000, 2000];
      await randomDelay(stratDelay[0], stratDelay[1]);
    }
  }

  if (emptyStrategies === queries.length) {
    if (totalApiResults === 0) {
      onProgress?.('SearXNG: 0 Ergebnisse — Upstream-Suchmaschinen antworten nicht. IP blockiert oder Rate-Limit.', 0);
    } else {
      onProgress?.(`SearXNG: ${totalApiResults} Ergebnisse insgesamt, aber 0 LinkedIn-Profile darunter.`, 0);
    }
  }

  return results;
}

/**
 * Main search function: tries DuckDuckGo first, falls back to Bing.
 * maxResults: 0 = unlimited
 */
async function searchGoogle(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress?: (msg: string, count: number) => void,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const query = location
    ? `site:linkedin.com/in ${keyword} ${location}`
    : `site:linkedin.com/in ${keyword}`;

  let start = 0;
  let pageNum = 0;
  let hasMore = true;

  while (hasMore) {
    pageNum++;
    onProgress?.(`Google Seite ${pageNum}...`, results.length);

    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10&hl=de`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
        },
      });

      if (res.status === 429 || !res.ok) {
        onProgress?.(`Google Rate-Limit oder Fehler: ${res.status}`, results.length);
        break;
      }

      const html = await res.text();

      if (html.includes('detected unusual traffic') || html.includes('CAPTCHA')) {
        onProgress?.('Google CAPTCHA erkannt - wechsle Suchmaschine', results.length);
        break;
      }

      const linkRegex = /<a[^>]+href="(https?:\/\/[^"]*linkedin\.com\/in\/[^"&]+)"[^>]*>/gi;
      let match;
      let foundOnPage = 0;

      while ((match = linkRegex.exec(html)) !== null) {
        const profileUrl = cleanLinkedInUrl(match[1]);
        if (!profileUrl) continue;

        const norm = normalizeLinkedInUrl(profileUrl);
        if (seenUrls.has(norm)) continue;
        seenUrls.add(norm);

        const username = profileUrl.split('/in/')[1] || '';
        const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const titleRegex = new RegExp(`<h3[^>]*>([^<]*${escapedUsername}[^<]*)<\\/h3>`, 'i');
        const titleMatch = html.match(titleRegex);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        const parsed = parseSearchTitle(title || username);

        results.push({ profileUrl, snippetName: parsed.name, snippetHeadline: parsed.headline });
        foundOnPage++;
        if (maxResults > 0 && results.length >= maxResults) break;
      }

      if (foundOnPage === 0) {
        const altRegex = /href="\/url\?q=(https?%3A%2F%2F[^"]*linkedin\.com%2Fin%2F[^"&]+)/gi;
        while ((match = altRegex.exec(html)) !== null) {
          const decoded = decodeURIComponent(match[1]);
          const profileUrl = cleanLinkedInUrl(decoded);
          if (!profileUrl) continue;
          const norm = normalizeLinkedInUrl(profileUrl);
          if (seenUrls.has(norm)) continue;
          seenUrls.add(norm);
          results.push({ profileUrl, snippetName: '', snippetHeadline: '' });
          foundOnPage++;
          if (maxResults > 0 && results.length >= maxResults) break;
        }
      }

      onProgress?.(`Google Seite ${pageNum}: ${foundOnPage} Profile (gesamt: ${results.length})`, results.length);

      if (foundOnPage === 0 || (maxResults > 0 && results.length >= maxResults)) {
        hasMore = false;
      } else {
        start += 10;
        await randomDelay(2000, 4000);
      }

      if (pageNum >= 30) hasMore = false;
    } catch (err) {
      onProgress?.(`Google Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`, results.length);
      hasMore = false;
    }
  }

  return results;
}

export interface SearchEngineConfig {
  searxngUrl?: string;
  totalKeywords?: number;
  proxies?: ProxyEntry[];
}

/**
 * Main search orchestrator.
 *
 * Priority:
 * 1. SearXNG (self-hosted, kostenlos, unbegrenzt) — runs solo when configured
 * 2. DDG/Bing/Google scraping — only when nothing else is configured, and they
 *    almost never work from cloud IPs
 */
export async function searchProfiles(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress?: (msg: string, count: number) => void,
  searxngUrl?: string,
  engineConfig?: SearchEngineConfig,
): Promise<SearchResult[]> {
  const seenUrls = new Set<string>();
  const allResults: SearchResult[] = [];
  const config = engineConfig || { searxngUrl };

  const hasProxies = config.proxies && config.proxies.length > 0;
  const hasSearXNG = !!config.searxngUrl;
  const hasReliableEngine = hasProxies || hasSearXNG;

  if (hasProxies) {
    const lightweight = (config.totalKeywords || 1) > 5;
    onProgress?.(`Proxy-Suche (${config.proxies!.length} Proxies) — ${lightweight ? 'Massen-Modus' : 'Tiefen-Suche'}`, 0);

    try {
      const r = await searchGoogleViaProxy(keyword, location, maxResults, config.proxies!, (msg) => {
        onProgress?.(msg, allResults.length);
      }, lightweight);
      for (const item of r) {
        const norm = normalizeLinkedInUrl(item.profileUrl);
        if (!seenUrls.has(norm)) {
          seenUrls.add(norm);
          allResults.push(item);
        }
      }
      onProgress?.(`Proxy-Suche fertig: ${allResults.length} einzigartige Profile`, allResults.length);
    } catch (e) {
      onProgress?.(`Proxy-Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`, allResults.length);
    }
  } else if (hasSearXNG) {
    const lightweight = (config.totalKeywords || 1) > 5;
    onProgress?.(`SearXNG aktiv — ${lightweight ? 'Massen-Modus (schnell)' : 'Tiefen-Suche'} gestartet`, 0);

    try {
      const r = await searchSearXNG(keyword, location, maxResults, config.searxngUrl!, (msg) => {
        onProgress?.(msg, allResults.length);
      }, lightweight);
      for (const item of r) {
        const norm = normalizeLinkedInUrl(item.profileUrl);
        if (!seenUrls.has(norm)) {
          seenUrls.add(norm);
          allResults.push(item);
        }
      }
      onProgress?.(`SearXNG fertig: ${allResults.length} einzigartige Profile`, allResults.length);
    } catch (e) {
      onProgress?.(`SearXNG Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`, allResults.length);
    }
  }

  if (!hasReliableEngine) {
    onProgress?.('WARNUNG: Kein SearXNG konfiguriert. Versuche DDG/Bing als Fallback (funktioniert selten von Cloud-Servern).', 0);

    const fallbacks: Promise<{ engine: string; results: SearchResult[] }>[] = [
      searchDuckDuckGo(keyword, location, maxResults, (msg) => {
        onProgress?.(`[DDG] ${msg}`, allResults.length);
      }).then(results => ({ engine: 'DuckDuckGo', results })),
      searchBing(keyword, location, maxResults, (msg) => {
        onProgress?.(`[Bing] ${msg}`, allResults.length);
      }).then(results => ({ engine: 'Bing', results })),
    ];

    const settled = await Promise.allSettled(fallbacks);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        for (const r of result.value.results) {
          const norm = normalizeLinkedInUrl(r.profileUrl);
          if (!seenUrls.has(norm)) {
            seenUrls.add(norm);
            allResults.push(r);
          }
        }
      }
    }
  }

  if (allResults.length === 0) {
    if (hasProxies) {
      onProgress?.('0 Profile gefunden — Google liefert keine Ergebnisse ueber die Proxies. Proxy-Liste pruefen.', 0);
    } else if (!hasSearXNG) {
      onProgress?.('0 Ergebnisse. Loesung: Proxies einfuegen oder SearXNG einrichten!', 0);
    } else {
      onProgress?.('0 Ergebnisse von SearXNG. Pruefe: 1) Laeuft SearXNG? 2) Sind Engines aktiviert?', 0);
    }
  }

  if (maxResults > 0 && allResults.length > maxResults) {
    return allResults.slice(0, maxResults);
  }

  return allResults;
}

/**
 * Test which search engines work from this server.
 */
export async function testSearchEngines(config: SearchEngineConfig): Promise<{
  engine: string;
  status: 'ok' | 'error' | 'not_configured';
  results: number;
  error?: string;
  latency?: number;
}[]> {
  const testKeyword = 'CEO Software';
  const testLocation = 'Deutschland';
  const results: { engine: string; status: 'ok' | 'error' | 'not_configured'; results: number; error?: string; latency?: number }[] = [];

  // Test SearXNG
  if (config.searxngUrl) {
    const start = Date.now();
    try {
      const r = await searchSearXNG(testKeyword, testLocation, 5, config.searxngUrl);
      results.push({ engine: 'SearXNG', status: r.length > 0 ? 'ok' : 'error', results: r.length, latency: Date.now() - start, error: r.length === 0 ? 'Laeuft, aber 0 LinkedIn-Profile gefunden. Pruefe Engine-Konfiguration.' : undefined });
    } catch (e) {
      results.push({ engine: 'SearXNG', status: 'error', results: 0, error: e instanceof Error ? e.message : 'Fehler', latency: Date.now() - start });
    }
  } else {
    results.push({ engine: 'SearXNG', status: 'not_configured', results: 0, error: 'docker run -d --name searxng -p 8888:8080 searxng/searxng' });
  }

  // Test DuckDuckGo (quick, just to show status)
  const ddgStart = Date.now();
  try {
    const r = await searchDuckDuckGo(testKeyword, testLocation, 3);
    results.push({ engine: 'DuckDuckGo', status: r.length > 0 ? 'ok' : 'error', results: r.length, latency: Date.now() - ddgStart, error: r.length === 0 ? 'Blockiert (normal bei Cloud-Servern)' : undefined });
  } catch (e) {
    results.push({ engine: 'DuckDuckGo', status: 'error', results: 0, error: e instanceof Error ? e.message : 'Blockiert', latency: Date.now() - ddgStart });
  }

  // Test Bing
  const bingStart = Date.now();
  try {
    const r = await searchBing(testKeyword, testLocation, 3);
    results.push({ engine: 'Bing', status: r.length > 0 ? 'ok' : 'error', results: r.length, latency: Date.now() - bingStart, error: r.length === 0 ? 'Blockiert (normal bei Cloud-Servern)' : undefined });
  } catch (e) {
    results.push({ engine: 'Bing', status: 'error', results: 0, error: e instanceof Error ? e.message : 'Blockiert', latency: Date.now() - bingStart });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 2. Public Profile Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a public LinkedIn profile and extract structured data.
 * Uses plain HTTP fetch (no Puppeteer) — looks like a link preview bot.
 */
export async function fetchPublicProfile(
  profileUrl: string,
  snippetName: string = '',
  snippetHeadline: string = '',
): Promise<FreeLinkedInPerson> {
  const base: FreeLinkedInPerson = {
    fullName: snippetName,
    profileUrl,
    headline: snippetHeadline,
    location: '',
    company: '',
    title: snippetHeadline,
    email: null,
    profileImageUrl: null,
    emailConfidence: null,
    companyDomain: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // LinkedIn often redirects to login — check final URL
    if (res.url.includes('/login') || res.url.includes('/authwall')) {
      // Can't access profile, return snippet data
      extractCompanyFromHeadline(base);
      return base;
    }

    const html = await res.text();

    // --- Extract from JSON-LD ---
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd['@type'] === 'Person' || jsonLd.name) {
          base.fullName = jsonLd.name || base.fullName;
          base.headline = jsonLd.jobTitle || jsonLd.description || base.headline;
          base.title = jsonLd.jobTitle || base.title;
          base.location = jsonLd.address?.addressLocality || jsonLd.address?.addressRegion || base.location;
          base.profileImageUrl = jsonLd.image?.contentUrl || jsonLd.image || base.profileImageUrl;

          if (jsonLd.worksFor) {
            const worksFor = Array.isArray(jsonLd.worksFor) ? jsonLd.worksFor[0] : jsonLd.worksFor;
            base.company = worksFor?.name || base.company;
          }
        }
      } catch {
        // Invalid JSON-LD
      }
    }

    // --- Extract from Open Graph meta tags ---
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1];
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1];
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];

    if (ogTitle && !base.fullName) {
      const parsed = parseSearchTitle(ogTitle);
      base.fullName = parsed.name || base.fullName;
      if (parsed.headline) base.headline = parsed.headline;
    }

    if (ogDesc && !base.company) {
      const atMatch = ogDesc.match(/(?:bei|at|@)\s+(.+?)(?:\.|,|$)/i);
      if (atMatch) base.company = atMatch[1].trim();
    }

    if (ogImage && !base.profileImageUrl) {
      base.profileImageUrl = ogImage;
    }

    // --- Extract from HTML title ---
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && !base.fullName) {
      const parsed = parseSearchTitle(titleMatch[1]);
      base.fullName = parsed.name || base.fullName;
    }

    // --- Extract location from meta description ---
    const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
    if (metaDesc && !base.location) {
      const locMatch = metaDesc.match(/(?:Standort|Location|Ort)[:\s]+([^.·,]+)/i);
      if (locMatch) base.location = locMatch[1].trim();
    }

    // Try to extract company from headline if not found
    extractCompanyFromHeadline(base);

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.log(`[LinkedIn Free] Timeout für ${profileUrl}`);
    } else {
      console.log(`[LinkedIn Free] Profil-Fehler ${profileUrl}: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    }
    extractCompanyFromHeadline(base);
  }

  return base;
}

function extractCompanyFromHeadline(person: FreeLinkedInPerson): void {
  if (person.company || !person.headline) return;

  const patterns = [
    /(?:bei|at|@)\s+(.+?)(?:\s*[\|–-]|$)/i,
    /[\|–-]\s*(.+?)(?:\s*[\|–-]|$)/,
  ];

  for (const pattern of patterns) {
    const match = person.headline.match(pattern);
    if (match && match[1]) {
      person.company = match[1].trim();
      break;
    }
  }
}

/**
 * Fetch multiple profiles concurrently in batches
 */
export async function fetchProfilesBatch(
  searchResults: SearchResult[],
  concurrency: number = 15,
  onProfile?: (person: FreeLinkedInPerson, index: number, total: number) => void,
): Promise<FreeLinkedInPerson[]> {
  const people: FreeLinkedInPerson[] = [];

  for (let i = 0; i < searchResults.length; i += concurrency) {
    const batch = searchResults.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(sr => fetchPublicProfile(sr.profileUrl, sr.snippetName, sr.snippetHeadline))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled' && result.value.fullName) {
        people.push(result.value);
        onProfile?.(result.value, i + j, searchResults.length);
      }
    }

    if (i + concurrency < searchResults.length) {
      await randomDelay(50, 150);
    }
  }

  return people;
}

// ---------------------------------------------------------------------------
// 3. Email Pattern Generation
// ---------------------------------------------------------------------------

function normalizeForEmail(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/é|è|ê|ë/g, 'e')
    .replace(/á|à|â/g, 'a')
    .replace(/í|ì|î/g, 'i')
    .replace(/ó|ò|ô/g, 'o')
    .replace(/ú|ù|û/g, 'u')
    .replace(/[^a-z0-9._-]/g, '')
    .trim();
}

export function guessCompanyDomain(company: string): string[] {
  if (!company) return [];

  const cleaned = company
    .toLowerCase()
    .replace(/\s*(gmbh|ag|kg|ohg|e\.v\.|mbh|co\.\s*kg|inc\.?|ltd\.?|corp\.?|se)\s*/gi, '')
    .replace(/&/g, 'und')
    .trim();

  const slug = cleaned
    .replace(/[^a-z0-9äöüß]/gi, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

  const slugDash = cleaned
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-äöüß]/gi, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

  const domains: string[] = [];

  if (slug) {
    domains.push(`${slug}.de`);
    domains.push(`${slug}.com`);
  }
  if (slugDash && slugDash !== slug) {
    domains.push(`${slugDash}.de`);
    domains.push(`${slugDash}.com`);
  }

  return Array.from(new Set(domains));
}

export function generateCandidateEmails(
  fullName: string,
  companyDomains: string[],
): string[] {
  if (!fullName || companyDomains.length === 0) return [];

  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts.length < 2) return [];

  const firstName = normalizeForEmail(nameParts[0]);
  const lastName = normalizeForEmail(nameParts[nameParts.length - 1]);

  if (!firstName || !lastName) return [];

  const candidates: string[] = [];

  for (const domain of companyDomains) {
    for (const pattern of EMAIL_PATTERNS) {
      const local = pattern(firstName, lastName);
      if (local) {
        candidates.push(`${local}@${domain}`);
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// 4. SMTP Email Verification
// ---------------------------------------------------------------------------

const domainCache = new Map<string, { mx: string | null; catchAll: boolean }>();

async function resolveMx(domain: string): Promise<string | null> {
  try {
    const dns = await import('dns');
    const dnsPromises = dns.promises;

    const records = await dnsPromises.resolveMx(domain);
    if (records && records.length > 0) {
      records.sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority);
      return records[0].exchange;
    }
  } catch {
    // Domain has no MX records
  }
  return null;
}

async function smtpVerify(email: string, mxHost: string): Promise<boolean> {
  const net = await import('net');

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 0;
    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
      try { socket.destroy(); } catch { /* ignore */ }
    };

    const timer = setTimeout(cleanup, 4000);

    socket.connect(25, mxHost, () => {
      // Connected, wait for greeting
    });

    socket.on('data', (data: { toString(): string }) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));

      if (step === 0) {
        socket.write('EHLO mail.example.com\r\n');
        step = 1;
      } else if (step === 1) {
        socket.write(`MAIL FROM:<verify@example.com>\r\n`);
        step = 2;
      } else if (step === 2) {
        if (code === 250) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
        } else {
          cleanup();
        }
      } else if (step === 3) {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(code === 250);
        }
        socket.write('QUIT\r\n');
        try { socket.destroy(); } catch { /* ignore */ }
      }
    });

    socket.on('error', cleanup);
    socket.on('timeout', cleanup);
    socket.setTimeout(4000);
  });
}

async function isCatchAll(domain: string, mxHost: string): Promise<boolean> {
  const randomEmail = `xyztest${Date.now()}${Math.random().toString(36).slice(2)}@${domain}`;
  return smtpVerify(randomEmail, mxHost);
}

export async function findVerifiedEmail(
  candidates: string[],
): Promise<{ email: string; confidence: 'high' | 'medium' | 'low' } | null> {
  if (candidates.length === 0) return null;

  const byDomain = new Map<string, string[]>();
  for (const email of candidates) {
    const domain = email.split('@')[1];
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(email);
  }

  for (const [domain, emails] of Array.from(byDomain.entries())) {
    let cached = domainCache.get(domain);

    if (!cached) {
      const mx = await resolveMx(domain);
      if (!mx) {
        domainCache.set(domain, { mx: null, catchAll: false });
        continue;
      }

      const catchAll = await isCatchAll(domain, mx);
      cached = { mx, catchAll };
      domainCache.set(domain, cached);
    }

    if (!cached.mx) continue;

    if (cached.catchAll) {
      return { email: emails[0], confidence: 'low' };
    }

    for (const email of emails) {
      try {
        const exists = await smtpVerify(email, cached.mx);
        if (exists) {
          return { email, confidence: 'high' };
        }
      } catch {
        // SMTP error, continue
      }
    }
  }

  return { email: candidates[0], confidence: 'low' };
}

// ---------------------------------------------------------------------------
// 5. Main Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full LinkedIn scraping pipeline for a single keyword.
 * maxResults: 0 = unlimited (scrape EVERYTHING)
 */
export async function scrapeLinkedInKeyword(
  keyword: string,
  location: string,
  maxResults: number,
  smtpVerification: boolean,
  onProgress?: (progress: LinkedInScrapeProgress) => void,
  searxngUrl?: string,
  engineConfig?: SearchEngineConfig,
): Promise<FreeLinkedInPerson[]> {
  const people: FreeLinkedInPerson[] = [];

  // Step 1: Search
  onProgress?.({
    type: 'search_start',
    keyword,
    profilesFound: 0,
  });

  const config = engineConfig || { searxngUrl };
  const searchResults = await searchProfiles(keyword, location, maxResults, (msg, count) => {
    onProgress?.({ type: 'search_progress', keyword, message: msg, profilesFound: count });
  }, searxngUrl, config);

  onProgress?.({
    type: 'search_results',
    keyword,
    profilesFound: searchResults.length,
  });

  if (searchResults.length === 0) {
    onProgress?.({
      type: 'search_empty',
      keyword,
      message: 'Keine LinkedIn-Profile gefunden. Suchmaschinen blockieren vermutlich die Server-IP. Richte eine SearXNG-Instanz ein fuer bessere Ergebnisse.',
      profilesFound: 0,
    });
    return people;
  }

  // Step 2: Fetch profiles (concurrent)
  const profiles = await fetchProfilesBatch(
    searchResults,
    15,
    (person, index, total) => {
      onProgress?.({
        type: 'profile_fetch',
        keyword,
        profileName: person.fullName,
        profileCompany: person.company,
        currentProfile: index + 1,
        totalProfiles: total,
      });
    },
  );

  // Sort: decision-makers first
  const entscheiderKeywords = [
    'geschäftsführ', 'inhaber', 'ceo', 'founder', 'gründer', 'eigentümer',
    'managing director', 'geschäftsleitung', 'vorstand', 'partner',
    'director', 'head of', 'vp ', 'vice president', 'chief',
    'leiter', 'owner',
  ];
  profiles.sort((a, b) => {
    const aText = `${a.headline} ${a.title}`.toLowerCase();
    const bText = `${b.headline} ${b.title}`.toLowerCase();
    const aIsE = entscheiderKeywords.some(kw => aText.includes(kw)) ? 0 : 1;
    const bIsE = entscheiderKeywords.some(kw => bText.includes(kw)) ? 0 : 1;
    return aIsE - bIsE;
  });

  // Step 3: Email pattern generation (instant, no network)
  for (const person of profiles) {
    const companyDomains = guessCompanyDomain(person.company);
    person.companyDomain = companyDomains[0] || null;

    if (companyDomains.length > 0) {
      const candidates = generateCandidateEmails(person.fullName, companyDomains);
      if (candidates.length > 0) {
        if (smtpVerification) {
          const result = await findVerifiedEmail(candidates);
          if (result) {
            person.email = result.email;
            person.emailConfidence = result.confidence;
          }
        } else {
          person.email = candidates[0];
          person.emailConfidence = 'low';
        }
      }
    }
  }

  // Step 4: Impressum fallback — batch 10 at a time for profiles without email
  const needImpressum = profiles.filter(p => !p.email && p.companyDomain);
  for (let i = 0; i < needImpressum.length; i += 10) {
    const batch = needImpressum.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (person) => {
        try {
          const impressum = await parseImpressum(`https://${person.companyDomain}`);
          if (impressum.emails.length > 0) {
            person.email = impressum.emails[0];
            person.emailConfidence = 'medium';
          }
        } catch { /* silent */ }
      })
    );
  }

  // Report all profiles
  for (let i = 0; i < profiles.length; i++) {
    const person = profiles[i];
    people.push(person);

    onProgress?.({
      type: 'profile_complete',
      keyword,
      profileName: person.fullName,
      profileCompany: person.company,
      profileEmail: person.email ? '***' : null,
      hasEmail: !!person.email,
      emailConfidence: person.emailConfidence,
      currentProfile: i + 1,
      totalProfiles: profiles.length,
    });
  }

  return people;
}
