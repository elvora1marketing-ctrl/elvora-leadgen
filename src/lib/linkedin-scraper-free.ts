/**
 * LinkedIn Profile & Email Scraper - FREE (Selbstgebaut)
 *
 * KEIN API-Key nötig. KEINE Kosten. Komplett unabhängig.
 * KEIN Limit - scrapt ALLE verfügbaren Ergebnisse.
 *
 * Pipeline:
 * 1. DuckDuckGo/Bing Suche - findet LinkedIn Profile via site:linkedin.com/in
 * 2. Public Profile Fetch - extrahiert Name, Firma, Titel aus JSON-LD/Meta-Tags
 * 3. Email-Pattern-Generierung - baut Kandidaten (vorname.nachname@firma.de etc.)
 * 4. SMTP-Verifikation - prüft ob E-Mail existiert (ohne zu senden)
 */

import { normalizeLinkedInUrl, type LinkedInPerson } from './linkedin-scraper';
import { delay, randomDelay } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedInScrapeProgress {
  type: string;
  keyword?: string;
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
        while ((altRegex.exec(html)) !== null) {
          const altMatch = altRegex.exec(html);
          if (!altMatch) break;
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
 * Main search function: tries DuckDuckGo first, falls back to Bing.
 * maxResults: 0 = unlimited
 */
export async function searchProfiles(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress?: (msg: string, count: number) => void,
): Promise<SearchResult[]> {
  // Try DuckDuckGo first
  onProgress?.('Starte Suche via DuckDuckGo...', 0);
  const ddgResults = await searchDuckDuckGo(keyword, location, maxResults, onProgress);

  if (ddgResults.length > 0) {
    onProgress?.(`DuckDuckGo: ${ddgResults.length} Profile gefunden`, ddgResults.length);
    return ddgResults;
  }

  // Fallback to Bing
  onProgress?.('DuckDuckGo lieferte keine Ergebnisse - versuche Bing...', 0);
  const bingResults = await searchBing(keyword, location, maxResults, onProgress);

  if (bingResults.length > 0) {
    onProgress?.(`Bing: ${bingResults.length} Profile gefunden`, bingResults.length);
    return bingResults;
  }

  onProgress?.('Keine Profile gefunden. Versuche einen anderen Suchbegriff.', 0);
  return [];
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
    const timeout = setTimeout(() => controller.abort(), 8000);

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
  concurrency: number = 5,
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

    // Short delay between batches
    if (i + concurrency < searchResults.length) {
      await randomDelay(300, 800);
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

    const timer = setTimeout(cleanup, 7000);

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
    socket.setTimeout(7000);
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
): Promise<FreeLinkedInPerson[]> {
  const people: FreeLinkedInPerson[] = [];

  // Step 1: Search
  onProgress?.({
    type: 'search_start',
    keyword,
    profilesFound: 0,
  });

  const searchResults = await searchProfiles(keyword, location, maxResults, (msg, count) => {
    onProgress?.({ type: 'search_progress', keyword, error: msg, profilesFound: count });
  });

  onProgress?.({
    type: 'search_results',
    keyword,
    profilesFound: searchResults.length,
  });

  if (searchResults.length === 0) return people;

  // Step 2: Fetch profiles (concurrent)
  const profiles = await fetchProfilesBatch(
    searchResults,
    5,
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

  // Step 3 & 4: Email generation + verification
  for (let i = 0; i < profiles.length; i++) {
    const person = profiles[i];

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
