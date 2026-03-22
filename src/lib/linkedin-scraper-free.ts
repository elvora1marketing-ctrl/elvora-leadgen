/**
 * LinkedIn Profile & Email Scraper - FREE (Selbstgebaut)
 *
 * KEIN API-Key nötig. KEINE Kosten. Komplett unabhängig.
 *
 * Pipeline:
 * 1. Google Dorking - findet LinkedIn Profile via site:linkedin.com/in
 * 2. Public Profile Fetch - extrahiert Name, Firma, Titel aus JSON-LD/Meta-Tags
 * 3. Email-Pattern-Generierung - baut Kandidaten (vorname.nachname@firma.de etc.)
 * 4. SMTP-Verifikation - prüft ob E-Mail existiert (ohne zu senden)
 */

import { normalizeLinkedInUrl, type LinkedInPerson } from './linkedin-scraper';

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

interface GoogleSearchResult {
  profileUrl: string;
  snippetName: string;
  snippetHeadline: string;
}

interface PuppeteerPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  $$(selector: string): Promise<unknown[]>;
  close(): Promise<void>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
  click(selector: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  content(): Promise<string>;
}

interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---------------------------------------------------------------------------
// 1. Google Dorking - LinkedIn Profile Discovery
// ---------------------------------------------------------------------------

/**
 * Search Google for LinkedIn profiles matching keyword + location
 */
export async function searchViaGoogle(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress?: (msg: string) => void,
): Promise<GoogleSearchResult[]> {
  let browser: PuppeteerBrowser | null = null;
  const results: GoogleSearchResult[] = [];
  const seenUrls = new Set<string>();

  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--lang=de-DE',
      ],
    }) as PuppeteerBrowser;

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Build search query
    const query = location
      ? `site:linkedin.com/in "${keyword}" "${location}"`
      : `site:linkedin.com/in "${keyword}"`;

    const pagesNeeded = Math.ceil(maxResults / 10);

    for (let pageNum = 0; pageNum < pagesNeeded && results.length < maxResults; pageNum++) {
      const start = pageNum * 10;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10&hl=de`;

      onProgress?.(`Google-Suche Seite ${pageNum + 1}/${pagesNeeded}...`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Accept cookies on first page
      if (pageNum === 0) {
        try {
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const acceptBtn = buttons.find(b =>
              b.textContent?.includes('Alle akzeptieren') ||
              b.textContent?.includes('Accept all') ||
              b.textContent?.includes('Ich stimme zu')
            );
            if (acceptBtn) (acceptBtn as HTMLButtonElement).click();
          });
          await delay(1000);
        } catch {
          // No cookie banner
        }
      }

      await delay(500);

      // Check for CAPTCHA
      const hasCaptcha = await page.evaluate(() => {
        return document.querySelector('#captcha-form') !== null ||
          document.querySelector('.g-recaptcha') !== null ||
          document.body.textContent?.includes('unusual traffic') === true;
      });

      if (hasCaptcha) {
        onProgress?.('Google CAPTCHA erkannt - versuche Bing als Fallback...');
        // Fall back to Bing
        const bingResults = await searchViaBing(page, keyword, location, maxResults - results.length);
        for (const r of bingResults) {
          const norm = normalizeLinkedInUrl(r.profileUrl);
          if (!seenUrls.has(norm)) {
            seenUrls.add(norm);
            results.push(r);
          }
        }
        break;
      }

      // Extract search results
      const pageResults = await page.evaluate(() => {
        const items: Array<{ url: string; title: string; snippet: string }> = [];
        const resultDivs = document.querySelectorAll('#search .g, #rso .g');

        resultDivs.forEach(div => {
          const linkEl = div.querySelector('a[href*="linkedin.com/in/"]');
          if (!linkEl) return;

          const url = (linkEl as HTMLAnchorElement).href;
          if (!url.includes('linkedin.com/in/')) return;

          const titleEl = div.querySelector('h3');
          const title = titleEl?.textContent?.trim() || '';

          const snippetEl = div.querySelector('.VwiC3b, [data-sncf], .IsZvec');
          const snippet = snippetEl?.textContent?.trim() || '';

          items.push({ url, title, snippet });
        });

        return items;
      });

      for (const item of pageResults) {
        // Clean up the LinkedIn URL
        let profileUrl = item.url;
        try {
          const parsed = new URL(profileUrl);
          profileUrl = `https://www.linkedin.com${parsed.pathname.replace(/\/+$/, '')}`;
        } catch {
          // Keep as-is
        }

        const norm = normalizeLinkedInUrl(profileUrl);
        if (seenUrls.has(norm)) continue;
        seenUrls.add(norm);

        // Extract name from Google title (format: "Name – Position – Firma | LinkedIn")
        let snippetName = '';
        let snippetHeadline = '';

        if (item.title) {
          const titleParts = item.title
            .replace(/\s*[\|–-]\s*LinkedIn\s*$/i, '')
            .split(/\s*[\|–-]\s*/);
          snippetName = titleParts[0]?.trim() || '';
          snippetHeadline = titleParts.slice(1).join(' – ').trim();
        }

        results.push({ profileUrl, snippetName, snippetHeadline });

        if (results.length >= maxResults) break;
      }

      // Random delay between pages
      if (pageNum < pagesNeeded - 1 && results.length < maxResults) {
        await randomDelay(1500, 3000);
      }
    }

    await page.close();
  } catch (err) {
    console.error('[LinkedIn Free] Google-Suche Fehler:', err);
    onProgress?.(`Suchfehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }

  return results;
}

/**
 * Fallback: Bing search when Google shows CAPTCHA
 */
async function searchViaBing(
  page: PuppeteerPage,
  keyword: string,
  location: string,
  maxResults: number,
): Promise<GoogleSearchResult[]> {
  const results: GoogleSearchResult[] = [];
  const query = location
    ? `site:linkedin.com/in "${keyword}" "${location}"`
    : `site:linkedin.com/in "${keyword}"`;

  try {
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${Math.min(maxResults, 50)}`;
    await page.goto(bingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1000);

    const bingResults = await page.evaluate(() => {
      const items: Array<{ url: string; title: string }> = [];
      document.querySelectorAll('#b_results .b_algo').forEach(div => {
        const linkEl = div.querySelector('a[href*="linkedin.com/in/"]');
        if (!linkEl) return;
        const url = (linkEl as HTMLAnchorElement).href;
        const title = linkEl.textContent?.trim() || '';
        items.push({ url, title });
      });
      return items;
    });

    for (const item of bingResults) {
      let profileUrl = item.url;
      try {
        const parsed = new URL(profileUrl);
        profileUrl = `https://www.linkedin.com${parsed.pathname.replace(/\/+$/, '')}`;
      } catch { /* keep as-is */ }

      const titleParts = item.title
        .replace(/\s*[\|–-]\s*LinkedIn\s*$/i, '')
        .split(/\s*[\|–-]\s*/);

      results.push({
        profileUrl,
        snippetName: titleParts[0]?.trim() || '',
        snippetHeadline: titleParts.slice(1).join(' – ').trim(),
      });

      if (results.length >= maxResults) break;
    }
  } catch (err) {
    console.error('[LinkedIn Free] Bing-Suche Fehler:', err);
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
      const titleClean = ogTitle.replace(/\s*[\|–-]\s*LinkedIn\s*$/i, '');
      const parts = titleClean.split(/\s*[\|–-]\s*/);
      base.fullName = parts[0]?.trim() || base.fullName;
      if (parts[1]) base.headline = parts[1].trim();
    }

    if (ogDesc && !base.company) {
      // OG description often contains: "Title at Company. Location. ..."
      const atMatch = ogDesc.match(/(?:bei|at|@)\s+(.+?)(?:\.|,|$)/i);
      if (atMatch) base.company = atMatch[1].trim();
    }

    if (ogImage && !base.profileImageUrl) {
      base.profileImageUrl = ogImage;
    }

    // --- Extract from HTML title ---
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && !base.fullName) {
      const titleClean = titleMatch[1]
        .replace(/\s*[\|–-]\s*LinkedIn\s*$/i, '')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'");
      const parts = titleClean.split(/\s*[\|–-]\s*/);
      base.fullName = parts[0]?.trim() || base.fullName;
    }

    // --- Extract location from meta description ---
    const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
    if (metaDesc && !base.location) {
      // Pattern: "... Location. ..."
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

  // Common patterns: "Title at Company", "Title bei Firma", "Title | Company"
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
  searchResults: GoogleSearchResult[],
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
      await randomDelay(500, 1200);
    }
  }

  return people;
}

// ---------------------------------------------------------------------------
// 3. Email Pattern Generation
// ---------------------------------------------------------------------------

/**
 * Normalize German umlauts and special characters for email
 */
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

/**
 * Guess company domain from company name
 */
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

  // Most common German TLD first
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

/**
 * Generate candidate email addresses for a person
 */
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

// Cache: domain -> { mx, catchAll }
const domainCache = new Map<string, { mx: string | null; catchAll: boolean }>();

/**
 * Resolve MX record for a domain
 */
async function resolveMx(domain: string): Promise<string | null> {
  try {
    const dns = await import('dns');
    const dnsPromises = dns.promises;

    const records = await dnsPromises.resolveMx(domain);
    if (records && records.length > 0) {
      // Sort by priority and return highest priority (lowest number)
      records.sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority);
      return records[0].exchange;
    }
  } catch {
    // Domain has no MX records
  }
  return null;
}

/**
 * Verify an email via SMTP RCPT TO handshake
 */
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
        // Got greeting
        socket.write('EHLO mail.example.com\r\n');
        step = 1;
      } else if (step === 1) {
        // EHLO response
        socket.write(`MAIL FROM:<verify@example.com>\r\n`);
        step = 2;
      } else if (step === 2) {
        // MAIL FROM response
        if (code === 250) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
        } else {
          cleanup();
        }
      } else if (step === 3) {
        // RCPT TO response - this tells us if the email exists
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

/**
 * Check if a domain is a catch-all (accepts all addresses)
 */
async function isCatchAll(domain: string, mxHost: string): Promise<boolean> {
  // Test with a random nonsense address
  const randomEmail = `xyztest${Date.now()}${Math.random().toString(36).slice(2)}@${domain}`;
  return smtpVerify(randomEmail, mxHost);
}

/**
 * Verify email candidates and return the best match
 */
export async function findVerifiedEmail(
  candidates: string[],
): Promise<{ email: string; confidence: 'high' | 'medium' | 'low' } | null> {
  if (candidates.length === 0) return null;

  // Group by domain
  const byDomain = new Map<string, string[]>();
  for (const email of candidates) {
    const domain = email.split('@')[1];
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(email);
  }

  for (const [domain, emails] of Array.from(byDomain.entries())) {
    // Check cache
    let cached = domainCache.get(domain);

    if (!cached) {
      const mx = await resolveMx(domain);
      if (!mx) {
        domainCache.set(domain, { mx: null, catchAll: false });
        continue; // Domain has no mail server
      }

      // Check catch-all
      const catchAll = await isCatchAll(domain, mx);
      cached = { mx, catchAll };
      domainCache.set(domain, cached);
    }

    if (!cached.mx) continue;

    if (cached.catchAll) {
      // Catch-all domain: accept the first pattern but with low confidence
      return { email: emails[0], confidence: 'low' };
    }

    // Try each candidate
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

  // No verified email found — return best guess with low confidence
  return { email: candidates[0], confidence: 'low' };
}

// ---------------------------------------------------------------------------
// 5. Main Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full LinkedIn scraping pipeline for a single keyword.
 */
export async function scrapeLinkedInKeyword(
  keyword: string,
  location: string,
  maxResults: number,
  smtpVerification: boolean,
  onProgress?: (progress: LinkedInScrapeProgress) => void,
): Promise<FreeLinkedInPerson[]> {
  const people: FreeLinkedInPerson[] = [];

  // Step 1: Google search
  onProgress?.({
    type: 'search_start',
    keyword,
    profilesFound: 0,
  });

  const searchResults = await searchViaGoogle(keyword, location, maxResults, (msg) => {
    onProgress?.({ type: 'search_progress', keyword, error: msg });
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

    // Generate company domains
    const companyDomains = guessCompanyDomain(person.company);
    person.companyDomain = companyDomains[0] || null;

    if (companyDomains.length > 0) {
      // Generate candidate emails
      const candidates = generateCandidateEmails(person.fullName, companyDomains);

      if (candidates.length > 0) {
        if (smtpVerification) {
          // SMTP verification
          const result = await findVerifiedEmail(candidates);
          if (result) {
            person.email = result.email;
            person.emailConfidence = result.confidence;
          }
        } else {
          // No verification — just use best guess
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
