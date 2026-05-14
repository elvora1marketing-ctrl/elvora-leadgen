/**
 * Branchenportal Scraper — Gelbe Seiten & 11880.com
 *
 * Scrapes German business directories by keyword + city.
 * Uses regex-based HTML parsing (no DOM) for server-side usage.
 * Returns results in the same ScrapedBusiness format as the Maps scraper.
 *
 * Both portals are scraped in parallel via scrapeBranchenportale().
 * Errors are caught gracefully — partial results are returned, never crashes.
 */

import { type ScrapedBusiness } from './maps-scraper';
import { delay, normalizeWebsite } from './utils';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 10000;

export interface BranchenportalResult {
  source: 'gelbeseiten' | '11880';
  businesses: ScrapedBusiness[];
  totalFound: number;
  errors: string[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode common HTML entities back to plain text.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strip all HTML tags and collapse whitespace.
 */
function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Fetch a URL with timeout, user-agent, and basic error handling.
 * Returns the response body as text, or null on failure (with error pushed).
 */
async function fetchPage(url: string, errors: string[]): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!response.ok) {
      errors.push(`HTTP ${response.status} für ${url}`);
      return null;
    }

    return await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      errors.push(`Timeout nach ${FETCH_TIMEOUT}ms für ${url}`);
    } else {
      errors.push(`Fehler beim Abrufen von ${url}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
    return null;
  }
}

/**
 * Extract the first regex capture group match from HTML, or return fallback.
 */
function extractFirst(html: string, regex: RegExp, fallback: string = ''): string {
  const match = html.match(regex);
  return match?.[1] ? stripHtml(match[1]).trim() : fallback;
}

/**
 * Normalise a phone number string: remove extra whitespace, keep digits/+/- etc.
 */
function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  // Must contain at least 5 digits to be a valid phone number
  if (cleaned.replace(/\D/g, '').length < 5) return null;
  return cleaned;
}

/**
 * Extract an external website URL from an href, skipping internal portal links.
 */
function extractWebsiteUrl(href: string, portalDomain: string): string | null {
  if (!href) return null;
  try {
    // Handle relative URLs or anchors
    if (href.startsWith('/') || href.startsWith('#') || href.startsWith('javascript:')) return null;
    // Must be a full URL
    if (!href.startsWith('http://') && !href.startsWith('https://')) return null;
    const parsed = new URL(href);
    const host = parsed.hostname.toLowerCase();
    // Skip links that point back to the portal itself
    if (host.includes(portalDomain)) return null;
    // Skip common non-business domains
    if (host.includes('google.') || host.includes('facebook.') || host.includes('instagram.')) return null;
    return href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gelbe Seiten
// ---------------------------------------------------------------------------

/**
 * Parse Gelbe Seiten HTML for business listings.
 *
 * Known patterns in gelbeseiten.de HTML:
 *   - Listings wrapped in <article> or <div data-realid="...">
 *   - Company name inside <h2> tags (sometimes with nested <a>)
 *   - Address in elements with class containing "address" or "addr"
 *   - Phone in elements with class containing "phone" or "tel", or href="tel:..."
 *   - Website link as <a> with external href, sometimes in data-webseite or data-website
 */
function parseGelbeSeitenHtml(html: string, city: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  // Split HTML into individual listing blocks.
  // Gelbe Seiten uses <article ...> blocks or <div ... data-realid="..."> blocks.
  const articleRegex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  let blockMatch: RegExpExecArray | null;
  const blocks: string[] = [];

  while ((blockMatch = articleRegex.exec(html)) !== null) {
    blocks.push(blockMatch[0]);
  }

  // Fallback: try data-realid divs if no articles found
  if (blocks.length === 0) {
    const divRegex = /<div\b[^>]*data-realid[^>]*>([\s\S]*?)(?=<div\b[^>]*data-realid|<\/main|<footer|$)/gi;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divRegex.exec(html)) !== null) {
      blocks.push(divMatch[0]);
    }
  }

  for (const block of blocks) {
    // --- Name ---
    // Try <h2> first (most common), then any heading
    let name = extractFirst(block, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!name) {
      name = extractFirst(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
    }
    if (!name) {
      // Try data-name or title attributes
      name = extractFirst(block, /data-(?:company)?name=["']([^"']+)["']/i);
    }
    if (!name) continue; // Skip blocks without a name

    // --- Address ---
    let address = '';
    // Try address-specific elements
    const addrMatch = block.match(/<[^>]*class="[^"]*(?:address|addr|anschrift)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span|address)>/i);
    if (addrMatch) {
      address = stripHtml(addrMatch[1]);
    }
    if (!address) {
      // Look for <address> tag
      address = extractFirst(block, /<address[^>]*>([\s\S]*?)<\/address>/i);
    }
    if (!address) {
      // Look for data-address attribute
      const dataAddr = block.match(/data-address=["']([^"']+)["']/i);
      if (dataAddr) address = decodeHtmlEntities(dataAddr[1]);
    }
    if (!address) {
      // Try street + postal code pattern
      const streetMatch = block.match(/<[^>]*class="[^"]*(?:street|strasse|str)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/i);
      const plzMatch = block.match(/<[^>]*class="[^"]*(?:city|ort|plz|zip)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/i);
      if (streetMatch || plzMatch) {
        address = [streetMatch ? stripHtml(streetMatch[1]) : '', plzMatch ? stripHtml(plzMatch[1]) : '']
          .filter(Boolean)
          .join(', ');
      }
    }

    // --- Phone ---
    let phone: string | null = null;
    // Try tel: links
    const telMatch = block.match(/href=["']tel:([^"']+)["']/i);
    if (telMatch) {
      phone = normalizePhone(decodeURIComponent(telMatch[1]));
    }
    if (!phone) {
      // Try phone-related class elements
      const phoneEl = block.match(/<[^>]*class="[^"]*(?:phone|tel|telefon|rufnummer)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/i);
      if (phoneEl) {
        phone = normalizePhone(stripHtml(phoneEl[1]));
      }
    }
    if (!phone) {
      // Try data-phone attribute
      const dataPhone = block.match(/data-(?:phone|telefon)=["']([^"']+)["']/i);
      if (dataPhone) phone = normalizePhone(dataPhone[1]);
    }

    // --- Website ---
    let website: string | null = null;
    // Try data-webseite / data-website attribute
    const dataWeb = block.match(/data-web(?:seite|site)=["']([^"']+)["']/i);
    if (dataWeb) {
      website = extractWebsiteUrl(dataWeb[1], 'gelbeseiten.de');
    }
    if (!website) {
      // Look for external links
      const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(block)) !== null) {
        const candidate = extractWebsiteUrl(linkMatch[1], 'gelbeseiten.de');
        if (candidate) {
          website = candidate;
          break;
        }
      }
    }

    // --- Category ---
    let category: string | null = null;
    const catMatch = block.match(/<[^>]*class="[^"]*(?:branch|kategorie|category|rubrik)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/i);
    if (catMatch) {
      category = stripHtml(catMatch[1]) || null;
    }

    // --- Rating ---
    let rating: number | null = null;
    const ratingMatch = block.match(/(?:data-rating|data-score)=["']([0-9.]+)["']/i);
    if (ratingMatch) {
      const parsed = parseFloat(ratingMatch[1]);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 5) rating = parsed;
    }

    businesses.push({
      name,
      address,
      city,
      phone,
      website: website ? normalizeWebsite(website) : null,
      email: null,
      rating,
      reviews: null,
      category,
      placeId: null,
    });
  }

  return businesses;
}

/**
 * Scrape Gelbe Seiten by keyword + city, across multiple pages.
 */
export async function scrapeGelbeSeiten(
  keyword: string,
  city: string,
  maxPages: number = 2,
): Promise<BranchenportalResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  const encodedKeyword = encodeURIComponent(keyword);
  const encodedCity = encodeURIComponent(city);

  for (let page = 1; page <= maxPages; page++) {
    const pageParam = page > 1 ? `/seite-${page}` : '';
    const url = `https://www.gelbeseiten.de/suche/${encodedKeyword}/${encodedCity}${pageParam}`;

    console.log(`[Branchenportal] Gelbe Seiten: "${keyword}" in "${city}" — Seite ${page}/${maxPages}`);

    const html = await fetchPage(url, errors);
    if (!html) break;

    const parsed = parseGelbeSeitenHtml(html, city);
    console.log(`[Branchenportal] Gelbe Seiten Seite ${page}: ${parsed.length} Ergebnisse`);

    if (parsed.length === 0) {
      // No results on this page — no point trying more pages
      if (page === 1) {
        console.log(`[Branchenportal] Gelbe Seiten: keine Ergebnisse für "${keyword}" in "${city}"`);
      }
      break;
    }

    allBusinesses.push(...parsed);

    // Polite delay between pages
    if (page < maxPages) {
      await delay(1500 + Math.random() * 1000);
    }
  }

  // Deduplicate by normalised website or name
  const seen = new Set<string>();
  const unique = allBusinesses.filter((biz) => {
    const key = biz.website ? biz.website : biz.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    source: 'gelbeseiten',
    businesses: unique,
    totalFound: unique.length,
    errors,
    duration: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// 11880.com
// ---------------------------------------------------------------------------

/**
 * Parse 11880.com HTML for business listings.
 *
 * Known patterns in 11880.com HTML:
 *   - Listings in <article> tags or result-item divs
 *   - Company name in <h2> or elements with class "name" / "title"
 *   - Address in elements with class containing "address"
 *   - Phone in tel: links or elements with class containing "phone"/"tel"
 *   - Website as external <a> link
 */
function parse11880Html(html: string, city: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  // Split into listing blocks
  const articleRegex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  let blockMatch: RegExpExecArray | null;
  const blocks: string[] = [];

  while ((blockMatch = articleRegex.exec(html)) !== null) {
    blocks.push(blockMatch[0]);
  }

  // Fallback: look for result-item or result-entry divs
  if (blocks.length === 0) {
    const divRegex = /<div\b[^>]*class="[^"]*(?:result[-_]?item|result[-_]?entry|treffer)[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*class="[^"]*(?:result[-_]?item|result[-_]?entry|treffer)|<\/main|<footer|$)/gi;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divRegex.exec(html)) !== null) {
      blocks.push(divMatch[0]);
    }
  }

  for (const block of blocks) {
    // --- Name ---
    let name = extractFirst(block, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!name) {
      name = extractFirst(block, /<[^>]*class="[^"]*(?:company[-_]?name|entry[-_]?name|name)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|h\d|a|p)>/i);
    }
    if (!name) {
      name = extractFirst(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
    }
    if (!name) continue;

    // --- Address ---
    let address = '';
    const addrMatch = block.match(/<[^>]*class="[^"]*(?:address|addr|anschrift)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span|address)>/i);
    if (addrMatch) {
      address = stripHtml(addrMatch[1]);
    }
    if (!address) {
      address = extractFirst(block, /<address[^>]*>([\s\S]*?)<\/address>/i);
    }
    if (!address) {
      // Try structured street + city
      const streetMatch = block.match(/<[^>]*class="[^"]*(?:street|strasse)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/i);
      const plzMatch = block.match(/<[^>]*class="[^"]*(?:city|ort|zip|plz)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/i);
      if (streetMatch || plzMatch) {
        address = [streetMatch ? stripHtml(streetMatch[1]) : '', plzMatch ? stripHtml(plzMatch[1]) : '']
          .filter(Boolean)
          .join(', ');
      }
    }

    // --- Phone ---
    let phone: string | null = null;
    const telMatch = block.match(/href=["']tel:([^"']+)["']/i);
    if (telMatch) {
      phone = normalizePhone(decodeURIComponent(telMatch[1]));
    }
    if (!phone) {
      const phoneEl = block.match(/<[^>]*class="[^"]*(?:phone|tel|telefon)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/i);
      if (phoneEl) {
        phone = normalizePhone(stripHtml(phoneEl[1]));
      }
    }

    // --- Website ---
    let website: string | null = null;
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(block)) !== null) {
      const candidate = extractWebsiteUrl(linkMatch[1], '11880.com');
      if (candidate) {
        website = candidate;
        break;
      }
    }

    // --- Category ---
    let category: string | null = null;
    const catMatch = block.match(/<[^>]*class="[^"]*(?:branch|kategorie|category|rubrik)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/i);
    if (catMatch) {
      category = stripHtml(catMatch[1]) || null;
    }

    // --- Rating ---
    let rating: number | null = null;
    const ratingMatch = block.match(/(?:data-rating|data-score)=["']([0-9.]+)["']/i);
    if (ratingMatch) {
      const parsed = parseFloat(ratingMatch[1]);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 5) rating = parsed;
    }

    businesses.push({
      name,
      address,
      city,
      phone,
      website: website ? normalizeWebsite(website) : null,
      email: null,
      rating,
      reviews: null,
      category,
      placeId: null,
    });
  }

  return businesses;
}

/**
 * Scrape 11880.com by keyword + city, across multiple pages.
 */
export async function scrape11880(
  keyword: string,
  city: string,
  maxPages: number = 2,
): Promise<BranchenportalResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  const encodedKeyword = encodeURIComponent(keyword);
  const encodedCity = encodeURIComponent(city);

  for (let page = 1; page <= maxPages; page++) {
    const pageParam = page > 1 ? `/seite/${page}` : '';
    const url = `https://www.11880.com/suche/${encodedKeyword}/${encodedCity}${pageParam}`;

    console.log(`[Branchenportal] 11880: "${keyword}" in "${city}" — Seite ${page}/${maxPages}`);

    const html = await fetchPage(url, errors);
    if (!html) break;

    const parsed = parse11880Html(html, city);
    console.log(`[Branchenportal] 11880 Seite ${page}: ${parsed.length} Ergebnisse`);

    if (parsed.length === 0) {
      if (page === 1) {
        console.log(`[Branchenportal] 11880: keine Ergebnisse für "${keyword}" in "${city}"`);
      }
      break;
    }

    allBusinesses.push(...parsed);

    // Polite delay between pages
    if (page < maxPages) {
      await delay(1500 + Math.random() * 1000);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = allBusinesses.filter((biz) => {
    const key = biz.website ? biz.website : biz.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    source: '11880',
    businesses: unique,
    totalFound: unique.length,
    errors,
    duration: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Combined scraper
// ---------------------------------------------------------------------------

/**
 * Scrape both Gelbe Seiten and 11880.com in parallel.
 * Returns an array of results — one per portal.
 * Never throws; failed portals return empty results with error messages.
 */
export async function scrapeBranchenportale(
  keyword: string,
  city: string,
  maxPages?: number,
): Promise<BranchenportalResult[]> {
  const [gs, el] = await Promise.allSettled([
    scrapeGelbeSeiten(keyword, city, maxPages),
    scrape11880(keyword, city, maxPages),
  ]);

  const results: BranchenportalResult[] = [];

  if (gs.status === 'fulfilled') {
    results.push(gs.value);
  } else {
    results.push({
      source: 'gelbeseiten',
      businesses: [],
      totalFound: 0,
      errors: [gs.reason?.message || 'Fehler bei Gelbe Seiten'],
      duration: 0,
    });
  }

  if (el.status === 'fulfilled') {
    results.push(el.value);
  } else {
    results.push({
      source: '11880',
      businesses: [],
      totalFound: 0,
      errors: [el.reason?.message || 'Fehler bei 11880'],
      duration: 0,
    });
  }

  return results;
}
