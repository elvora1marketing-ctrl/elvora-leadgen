/**
 * Branchenportal Scraper — Gelbe Seiten & 11880.com
 */

import { type ScrapedBusiness } from './maps-scraper';
import { delay, normalizeWebsite } from './utils';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 15000;

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

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeBase64(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

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

async function fetchPost(url: string, formData: Record<string, string>, errors: string[]): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const body = new URLSearchParams(formData).toString();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!response.ok) {
      errors.push(`HTTP ${response.status} für POST ${url}`);
      return null;
    }

    return await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      errors.push(`Timeout nach ${FETCH_TIMEOUT}ms für POST ${url}`);
    } else {
      errors.push(`Fehler bei POST ${url}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
    return null;
  }
}

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.replace(/\D/g, '').length < 5) return null;
  return cleaned;
}

// ---------------------------------------------------------------------------
// Gelbe Seiten
// ---------------------------------------------------------------------------

/**
 * Parse Gelbe Seiten HTML for business listings.
 *
 * Real HTML structure:
 *   - Listings in <article> blocks with class "mod mod-Treffer"
 *   - Name: <h2 class="mod-Treffer__name">
 *   - Address: div with class "mod-AdresseKompakt__adress-text"
 *   - Phone: Base64-encoded in data-prg="..." attribute
 *   - Website: Base64-encoded in data-webseiteLink="..." attribute
 *   - Rating: <span class="mod-BewertungKompakt__number ...">4,6</span>
 *   - Reviews: <span class="mod-BewertungKompakt__text ...">57 Bewertungen</span>
 *   - Email: sometimes in chat button JSON: "email":"info@example.de"
 */
function parseGelbeSeitenHtml(html: string, city: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  // Split into article blocks (each listing is an <article>)
  const articleRegex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  let blockMatch: RegExpExecArray | null;
  const blocks: string[] = [];

  while ((blockMatch = articleRegex.exec(html)) !== null) {
    blocks.push(blockMatch[0]);
  }

  // Fallback: try mod-Treffer divs
  if (blocks.length === 0) {
    const divRegex = /<div\b[^>]*class="[^"]*mod-Treffer[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*class="[^"]*mod-Treffer[^"]*"|<\/main|<footer|$)/gi;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divRegex.exec(html)) !== null) {
      blocks.push(divMatch[0]);
    }
  }

  for (const block of blocks) {
    // --- Name ---
    let name = '';
    const nameMatch = block.match(/<h2[^>]*class="[^"]*mod-Treffer__name[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    if (nameMatch) {
      name = stripHtml(nameMatch[1]);
    }
    if (!name) {
      const h2Match = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      if (h2Match) name = stripHtml(h2Match[1]);
    }
    if (!name) continue;

    // --- Address ---
    let address = '';
    const addrMatch = block.match(/<[^>]*class="[^"]*mod-AdresseKompakt__adress-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (addrMatch) {
      address = stripHtml(addrMatch[1]);
    }
    if (!address) {
      const addrGeneric = block.match(/<[^>]*class="[^"]*(?:address|addr|anschrift|adresse)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span|address)>/i);
      if (addrGeneric) address = stripHtml(addrGeneric[1]);
    }

    // --- Phone (Base64 in data-prg attribute) ---
    let phone: string | null = null;
    const prgMatch = block.match(/data-prg=["']([A-Za-z0-9+/=]+)["']/);
    if (prgMatch) {
      const decoded = decodeBase64(prgMatch[1]);
      if (decoded) phone = normalizePhone(decoded);
    }
    if (!phone) {
      const telMatch = block.match(/href=["']tel:([^"']+)["']/i);
      if (telMatch) phone = normalizePhone(decodeURIComponent(telMatch[1]));
    }

    // --- Website (Base64 in data-webseiteLink attribute) ---
    let website: string | null = null;
    const webLinkMatch = block.match(/data-webseiteLink=["']([A-Za-z0-9+/=]+)["']/);
    if (webLinkMatch) {
      const decoded = decodeBase64(webLinkMatch[1]);
      if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) {
        website = decoded;
      }
    }
    if (!website) {
      const dataWeb = block.match(/data-web(?:seite|site)=["']([^"']+)["']/i);
      if (dataWeb && (dataWeb[1].startsWith('http://') || dataWeb[1].startsWith('https://'))) {
        website = dataWeb[1];
      }
    }

    // --- Email (from chat button JSON) ---
    let email: string | null = null;
    const emailJsonMatch = block.match(/"email"\s*:\s*"([^"]+@[^"]+)"/);
    if (emailJsonMatch) {
      email = emailJsonMatch[1];
    }

    // --- Rating ---
    let rating: number | null = null;
    const ratingMatch = block.match(/<span[^>]*class="[^"]*mod-BewertungKompakt__number[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (ratingMatch) {
      const ratingText = stripHtml(ratingMatch[1]).replace(',', '.');
      const parsed = parseFloat(ratingText);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 5) rating = parsed;
    }

    // --- Reviews ---
    let reviews: number | null = null;
    const reviewMatch = block.match(/<span[^>]*class="[^"]*mod-BewertungKompakt__text[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (reviewMatch) {
      const reviewText = stripHtml(reviewMatch[1]);
      const numMatch = reviewText.match(/(\d+)/);
      if (numMatch) reviews = parseInt(numMatch[1]);
    }

    // --- Category ---
    let category: string | null = null;
    const catMatch = block.match(/<[^>]*class="[^"]*(?:mod-Treffer__branche|branch|kategorie|category)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/i);
    if (catMatch) {
      category = stripHtml(catMatch[1]) || null;
    }

    businesses.push({
      name,
      address,
      city,
      phone,
      website: website ? normalizeWebsite(website) : null,
      email,
      rating,
      reviews,
      category,
      placeId: null,
    });
  }

  return businesses;
}

/**
 * Scrape Gelbe Seiten by keyword + city.
 * Page 1: GET /branchen/{keyword}/{city}
 * Page 2+: POST to /ajaxsuche (AJAX pagination, 10 results per batch)
 */
export async function scrapeGelbeSeiten(
  keyword: string,
  city: string,
  maxPages: number = 50,
): Promise<BranchenportalResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  const kwLower = keyword.toLowerCase().replace(/\s+/g, '-');
  const cityLower = city.toLowerCase().replace(/\s+/g, '-');

  // Page 1: regular GET request
  const url = `https://www.gelbeseiten.de/branchen/${encodeURIComponent(kwLower)}/${encodeURIComponent(cityLower)}`;
  console.log(`[Branchenportal] Gelbe Seiten: "${keyword}" in "${city}" — Seite 1`);

  const html = await fetchPage(url, errors);
  if (html) {
    const parsed = parseGelbeSeitenHtml(html, city);
    console.log(`[Branchenportal] Gelbe Seiten Seite 1: ${parsed.length} Ergebnisse`);
    allBusinesses.push(...parsed);

    // AJAX pagination for additional results (page 1 typically returns ~50)
    if (parsed.length > 0 && maxPages > 1) {
      const itemsOnPage1 = parsed.length;
      const ajaxBatchSize = 10;

      for (let batch = 1; batch < maxPages; batch++) {
        const position = itemsOnPage1 + 1 + (batch - 1) * ajaxBatchSize;

        await delay(1500 + Math.random() * 1000);

        console.log(`[Branchenportal] Gelbe Seiten: AJAX Seite ${batch + 1} (Position ${position})`);

        const ajaxHtml = await fetchPost(
          'https://www.gelbeseiten.de/ajaxsuche',
          {
            WAS: keyword,
            WO: city,
            position: String(position),
            anzahl: String(ajaxBatchSize),
            umkreis: '50',
          },
          errors,
        );

        if (!ajaxHtml) {
          // Retry once after short wait
          await delay(3000);
          const retry = await fetchPost(
            'https://www.gelbeseiten.de/ajaxsuche',
            { WAS: keyword, WO: city, position: String(position), anzahl: String(ajaxBatchSize), umkreis: '50' },
            errors,
          );
          if (!retry) break;
          const retryParsed = parseGelbeSeitenHtml(retry, city);
          if (retryParsed.length === 0) break;
          allBusinesses.push(...retryParsed);
          continue;
        }

        const ajaxParsed = parseGelbeSeitenHtml(ajaxHtml, city);
        console.log(`[Branchenportal] Gelbe Seiten AJAX Batch ${batch + 1}: ${ajaxParsed.length} Ergebnisse`);

        if (ajaxParsed.length === 0) break;
        allBusinesses.push(...ajaxParsed);
      }
    }
  } else if (allBusinesses.length === 0) {
    console.log(`[Branchenportal] Gelbe Seiten: keine Ergebnisse für "${keyword}" in "${city}"`);
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
 * Primary: extract from JSON-LD structured data (SearchResultsPage → itemListElement).
 * Fallback: parse <li class="result-list-entry"> HTML blocks.
 */
function parse11880Html(html: string, city: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  // --- Primary: JSON-LD structured data ---
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch: RegExpExecArray | null;

  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data['@type'] !== 'SearchResultsPage' || !Array.isArray(data.mainEntity?.itemListElement)) continue;

      for (const item of data.mainEntity.itemListElement) {
        const biz = item.item;
        if (!biz || !biz.name) continue;

        const addr = biz.address || {};
        const street = addr.streetAddress || '';
        const postal = addr.postalCode || '';
        const locality = addr.addressLocality || '';
        const address = [street, [postal, locality].filter(Boolean).join(' ')].filter(Boolean).join(', ');

        let phone: string | null = null;
        if (biz.telephone) phone = normalizePhone(biz.telephone);

        let website: string | null = null;
        if (biz.url) {
          try {
            const host = new URL(biz.url).hostname.toLowerCase();
            if (!host.includes('11880.com')) website = biz.url;
          } catch { /* skip */ }
        }

        let rating: number | null = null;
        let reviews: number | null = null;
        if (biz.aggregateRating) {
          const rv = parseFloat(biz.aggregateRating.ratingValue);
          if (!isNaN(rv) && rv > 0 && rv <= 5) rating = rv;
          const rc = parseInt(biz.aggregateRating.reviewCount || biz.aggregateRating.ratingCount);
          if (!isNaN(rc)) reviews = rc;
        }

        businesses.push({
          name: biz.name,
          address,
          city: locality || city,
          phone,
          website: website ? normalizeWebsite(website) : null,
          email: biz.email || null,
          rating,
          reviews,
          category: null,
          placeId: null,
        });
      }
    } catch { /* invalid JSON, skip */ }
  }

  if (businesses.length > 0) {
    // Enrich with category from HTML (JSON-LD doesn't include it)
    const catByName = new Map<string, string>();
    const liRegex = /<li\b[^>]*class="[^"]*result-list-entry[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(html)) !== null) {
      const block = liMatch[0];
      const nameMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      const catMatch = block.match(/<span[^>]*class="[^"]*trades-list[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      if (nameMatch && catMatch) {
        catByName.set(stripHtml(nameMatch[1]), stripHtml(catMatch[1]));
      }
    }
    for (const biz of businesses) {
      const cat = catByName.get(biz.name);
      if (cat) biz.category = cat;
    }
    return businesses;
  }

  // --- Fallback: parse HTML <li> blocks ---
  const liRegex = /<li\b[^>]*class="[^"]*result-list-entry[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;
  const blocks: string[] = [];
  while ((liMatch = liRegex.exec(html)) !== null) {
    blocks.push(liMatch[0]);
  }

  for (const block of blocks) {
    let name = '';
    const h2Match = block.match(/<h2[^>]*result-list-entry-title__headline[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) name = stripHtml(h2Match[1]);
    if (!name) {
      const h2Generic = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      if (h2Generic) name = stripHtml(h2Generic[1]);
    }
    if (!name) continue;

    let address = '';
    const streetMatch = block.match(/<span[^>]*class="[^"]*d-block[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const postalMatch = block.match(/<span[^>]*class="[^"]*js-postal-code[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const localityMatch = block.match(/<span[^>]*class="[^"]*js-address-locality[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const street = streetMatch ? stripHtml(streetMatch[1]) : '';
    const postal = postalMatch ? stripHtml(postalMatch[1]) : '';
    const locality = localityMatch ? stripHtml(localityMatch[1]) : '';
    address = [street, [postal, locality].filter(Boolean).join(' ')].filter(Boolean).join(', ');

    let phone: string | null = null;
    const telMatch = block.match(/href=["']tel:([^"']+)["']/i);
    if (telMatch) phone = normalizePhone(decodeURIComponent(telMatch[1]));
    if (!phone) {
      const phoneLabel = block.match(/<span[^>]*class="[^"]*result-list-entry-phone-number__label[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      if (phoneLabel) phone = normalizePhone(stripHtml(phoneLabel[1]));
    }

    let website: string | null = null;
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(block)) !== null) {
      const href = linkMatch[1];
      if (!href || href.startsWith('/') || href.startsWith('#') || href.startsWith('javascript:')) continue;
      if (!href.startsWith('http://') && !href.startsWith('https://')) continue;
      try {
        const host = new URL(href).hostname.toLowerCase();
        if (host.includes('11880.com') || host.includes('google.') || host.includes('facebook.') || host.includes('instagram.')) continue;
        website = href;
        break;
      } catch { /* skip */ }
    }

    let category: string | null = null;
    const catMatch = block.match(/<span[^>]*class="[^"]*trades-list[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (catMatch) category = stripHtml(catMatch[1]) || null;

    let rating: number | null = null;
    let reviews: number | null = null;
    const srOnly = block.match(/<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>(\d+(?:[.,]\d+)?)\s*von\s*5/i);
    if (srOnly) {
      const parsed = parseFloat(srOnly[1].replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0 && parsed <= 5) rating = parsed;
    }
    const reviewMatch = block.match(/<span[^>]*class="[^"]*result-list-entry-stars__count[^"]*"[^>]*>\((\d+)/i);
    if (reviewMatch) reviews = parseInt(reviewMatch[1]);

    businesses.push({
      name,
      address,
      city: locality || city,
      phone,
      website: website ? normalizeWebsite(website) : null,
      email: null,
      rating,
      reviews,
      category,
      placeId: null,
    });
  }

  return businesses;
}

/**
 * Scrape 11880.com by keyword + city, across multiple pages.
 * Pagination uses ?page=N query parameter.
 */
export async function scrape11880(
  keyword: string,
  city: string,
  maxPages: number = 50,
): Promise<BranchenportalResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  const encodedKeyword = encodeURIComponent(keyword);
  const encodedCity = encodeURIComponent(city);

  for (let page = 1; page <= maxPages; page++) {
    const pageParam = page > 1 ? `?page=${page}` : '';
    const url = `https://www.11880.com/suche/${encodedKeyword}/${encodedCity}${pageParam}`;

    console.log(`[Branchenportal] 11880: "${keyword}" in "${city}" — Seite ${page}/${maxPages}`);

    let html = await fetchPage(url, errors);
    if (!html) {
      // Retry once
      await delay(3000);
      html = await fetchPage(url, errors);
      if (!html) break;
    }

    const parsed = parse11880Html(html, city);
    console.log(`[Branchenportal] 11880 Seite ${page}: ${parsed.length} Ergebnisse`);

    if (parsed.length === 0) {
      if (page === 1) {
        console.log(`[Branchenportal] 11880: keine Ergebnisse für "${keyword}" in "${city}"`);
      }
      break;
    }

    allBusinesses.push(...parsed);

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
