/**
 * Google Maps Lead Scraper
 *
 * Scrapes business data from Google Maps search results using native fetch.
 * Extracts: Firmenname, Website, Adresse, Stadt, Telefonnummer
 * Supports pagination (multiple "pages" via scrolling simulation).
 */

export interface ScrapedBusiness {
  name: string;
  address: string;
  city: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  placeId: string | null;
}

export interface ScrapeProgress {
  status: 'running' | 'completed' | 'error';
  keyword: string;
  currentPage: number;
  totalPages: number;
  businessesFound: number;
  errors: string[];
}

export interface ScrapeResult {
  keyword: string;
  businesses: ScrapedBusiness[];
  totalFound: number;
  pagesScraped: number;
  duration: number;
  errors: string[];
}

// Realistic browser User-Agents (rotation to avoid blocks)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build Google Maps search URL
 */
function buildSearchUrl(keyword: string, start: number = 0): string {
  const encoded = encodeURIComponent(keyword);
  // Use Google Local Search (tbm=lcl) for more parseable results
  return `https://www.google.de/search?q=${encoded}&tbm=lcl&hl=de&gl=de&start=${start}`;
}

/**
 * Build headers for the request
 */
function buildHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };
}

/**
 * Extract business data from Google Local Search HTML
 * Parses the embedded JavaScript data arrays in the response
 */
function extractBusinesses(html: string, searchCity: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  try {
    // Strategy 1: Parse from embedded data arrays
    // Google Local Search embeds data in script tags with specific patterns
    const dataFromArrays = extractFromDataArrays(html, searchCity);
    if (dataFromArrays.length > 0) {
      businesses.push(...dataFromArrays);
    }

    // Strategy 2: Parse from HTML structure (fallback)
    if (businesses.length === 0) {
      const dataFromHtml = extractFromHtmlStructure(html, searchCity);
      businesses.push(...dataFromHtml);
    }

    // Strategy 3: Regex-based extraction (last resort)
    if (businesses.length === 0) {
      const dataFromRegex = extractFromRegexPatterns(html, searchCity);
      businesses.push(...dataFromRegex);
    }
  } catch (err) {
    console.error('Error extracting businesses:', err);
  }

  return businesses;
}

/**
 * Strategy 1: Extract from embedded JavaScript data arrays
 * Google embeds search results in AF_initDataCallback or similar structures
 */
function extractFromDataArrays(html: string, searchCity: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  try {
    // Find all data callback blocks
    const callbackRegex = /AF_initDataCallback\(\{[^}]*?data:([\s\S]*?)\}\s*\)\s*;/g;
    let match;

    while ((match = callbackRegex.exec(html)) !== null) {
      try {
        const dataStr = match[1].trim();
        // Try to parse as JSON (some data blocks are valid JSON)
        const data = JSON.parse(dataStr);
        const extracted = walkDataArray(data, searchCity);
        businesses.push(...extracted);
      } catch {
        // Data might not be valid JSON, try cleaning it
      }
    }

    // Also try extracting from window.__SSR_DATA or similar
    const ssrRegex = /window\.__SSR_DATA\s*=\s*(\{[\s\S]*?\});/;
    const ssrMatch = html.match(ssrRegex);
    if (ssrMatch) {
      try {
        const data = JSON.parse(ssrMatch[1]);
        const extracted = walkDataArray(data, searchCity);
        businesses.push(...extracted);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('extractFromDataArrays error:', err);
  }

  return businesses;
}

/**
 * Walk a nested data array looking for business entries
 */
function walkDataArray(data: unknown, searchCity: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  if (!Array.isArray(data)) return businesses;

  // Look for arrays that contain business-like data
  // Business entries typically have: name (string), address (string with city), phone pattern
  for (const item of data) {
    if (Array.isArray(item)) {
      // Check if this looks like a business entry
      const business = tryExtractBusiness(item, searchCity);
      if (business) {
        businesses.push(business);
      } else {
        // Recurse into sub-arrays
        const subResults = walkDataArray(item, searchCity);
        businesses.push(...subResults);
      }
    }
  }

  return businesses;
}

/**
 * Try to extract a business from an array that might contain business data
 */
function tryExtractBusiness(arr: unknown[], searchCity: string): ScrapedBusiness | null {
  // Flatten nested strings to find business data
  const strings = extractStrings(arr);
  if (strings.length < 2) return null;

  // Find a name (first substantial string that's not a URL or phone)
  const name = strings.find(s =>
    s.length >= 3 &&
    s.length <= 100 &&
    !s.startsWith('http') &&
    !s.startsWith('+') &&
    !s.match(/^\d/) &&
    !s.includes('@') &&
    !s.includes('.de') &&
    !s.includes('.com')
  );

  if (!name) return null;

  // Find address (string containing German postal code pattern or city name)
  const address = strings.find(s =>
    s !== name &&
    (s.match(/\d{5}\s+\w/) || s.toLowerCase().includes(searchCity.toLowerCase())) &&
    s.length > 5
  );

  // Find phone
  const phone = strings.find(s =>
    s.match(/(\+49|0\d{2,4})\s*[\d\s\-\/]+/) &&
    s.length >= 6
  );

  // Find website
  const website = strings.find(s =>
    s.startsWith('http') && !s.includes('google') && !s.includes('gstatic')
  );

  if (!address && !phone && !website) return null;

  // Find rating
  const ratingStr = strings.find(s => s.match(/^\d[.,]\d$/));
  const rating = ratingStr ? parseFloat(ratingStr.replace(',', '.')) : null;

  return {
    name: name.trim(),
    address: address?.trim() || '',
    city: extractCity(address || '', searchCity),
    phone: cleanPhone(phone || null),
    website: website?.trim() || null,
    rating,
    reviews: null,
    category: null,
    placeId: null,
  };
}

/**
 * Extract all strings from a nested array
 */
function extractStrings(arr: unknown[], depth: number = 0): string[] {
  if (depth > 10) return [];
  const strings: string[] = [];

  for (const item of arr) {
    if (typeof item === 'string' && item.length > 0) {
      strings.push(item);
    } else if (Array.isArray(item)) {
      strings.push(...extractStrings(item, depth + 1));
    }
  }

  return strings;
}

/**
 * Strategy 2: Extract from HTML structure
 * Parse the actual DOM-like structure of local search results
 */
function extractFromHtmlStructure(html: string, searchCity: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  try {
    // Google Local Search results are in div blocks with specific patterns
    // Look for business name patterns in the HTML
    // Business names are typically in elements like <span class="OSrXXb">Business Name</span>
    // or <div class="dbg0pd" role="heading">Business Name</div>

    // Pattern 1: Local result cards (VkpGBb, rllt__details, etc.)
    const cardPatterns = [
      // Modern Google Local format
      /<div[^>]*class="[^"]*rllt__details[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g,
      // Alternative format
      /<div[^>]*class="[^"]*VkpGBb[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g,
      // Another variant
      /<div[^>]*data-cid="[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*data-cid)/g,
    ];

    for (const pattern of cardPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const cardHtml = match[1] || match[0];
        const business = parseBusinessCard(cardHtml, searchCity);
        if (business) {
          businesses.push(business);
        }
      }
      if (businesses.length > 0) break;
    }

    // Pattern 2: Extract individual fields with specific class names
    if (businesses.length === 0) {
      // Find all business name elements
      const namePattern = /<(?:span|div)[^>]*class="[^"]*(?:OSrXXb|dbg0pd|fontHeadlineSmall)[^"]*"[^>]*>(.*?)<\/(?:span|div)>/g;
      const names: string[] = [];
      let m;
      while ((m = namePattern.exec(html)) !== null) {
        const name = stripHtml(m[1]).trim();
        if (name.length >= 2 && name.length <= 100) {
          names.push(name);
        }
      }

      // For each name found, try to find associated data
      for (const name of names) {
        // Find the context around this name (500 chars after)
        const nameIndex = html.indexOf(name);
        if (nameIndex === -1) continue;
        const context = html.substring(nameIndex, nameIndex + 2000);

        const business = parseContextForBusiness(name, context, searchCity);
        if (business) {
          businesses.push(business);
        }
      }
    }
  } catch (err) {
    console.error('extractFromHtmlStructure error:', err);
  }

  return businesses;
}

/**
 * Parse a business card HTML block
 */
function parseBusinessCard(cardHtml: string, searchCity: string): ScrapedBusiness | null {
  // Extract name (usually in a heading or bold element)
  const namePatterns = [
    /<(?:span|div)[^>]*class="[^"]*(?:OSrXXb|dbg0pd|fontHeadlineSmall)[^"]*"[^>]*>(.*?)<\/(?:span|div)>/,
    /role="heading"[^>]*>(.*?)</,
    /<a[^>]*aria-label="([^"]+)"/,
  ];

  let name = '';
  for (const pattern of namePatterns) {
    const match = cardHtml.match(pattern);
    if (match) {
      name = stripHtml(match[1]).trim();
      break;
    }
  }
  if (!name) return null;

  // Extract address
  const addressPatterns = [
    /(?:\d{5}\s+[\wäöüÄÖÜß]+|[\wäöüÄÖÜß]+(?:str|straße|weg|platz|gasse|allee)\.\s*\d+[^<]*)/i,
    /<span[^>]*>([^<]*(?:str|straße|weg|platz|gasse|allee|Str\.)[^<]*)<\/span>/i,
  ];

  let address = '';
  for (const pattern of addressPatterns) {
    const match = cardHtml.match(pattern);
    if (match) {
      address = stripHtml(match[1] || match[0]).trim();
      break;
    }
  }

  // Extract phone
  const phonePatterns = [
    /(?:Tel\.?|Telefon|☎)?\s*((?:\+49|0)\s*[\d\s\-\/()]{6,})/,
    /(\+49[\d\s\-\/()]{8,})/,
    /(0\d{2,4}[\s\-\/][\d\s\-\/]{5,})/,
  ];

  let phone: string | null = null;
  for (const pattern of phonePatterns) {
    const match = cardHtml.match(pattern);
    if (match) {
      phone = cleanPhone(match[1]);
      break;
    }
  }

  // Extract website
  const websitePatterns = [
    /href="(https?:\/\/(?!(?:www\.)?google)[^\s"]+)"/,
    /(https?:\/\/(?!(?:www\.)?google)[^\s<"]+)/,
  ];

  let website: string | null = null;
  for (const pattern of websitePatterns) {
    const match = cardHtml.match(pattern);
    if (match) {
      website = match[1];
      break;
    }
  }

  // Extract rating
  const ratingMatch = cardHtml.match(/(\d[.,]\d)\s*(?:Sterne|stars|\()/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null;

  // Extract review count
  const reviewMatch = cardHtml.match(/\((\d+(?:\.\d+)?)\s*(?:Bewertung|Review|Rezension)/i);
  const reviews = reviewMatch ? parseInt(reviewMatch[1].replace('.', ''), 10) : null;

  // Extract category
  const categoryMatch = cardHtml.match(/·\s*([^·<]+?)(?:\s*·|<)/);
  const category = categoryMatch ? stripHtml(categoryMatch[1]).trim() : null;

  return {
    name,
    address,
    city: extractCity(address, searchCity),
    phone,
    website,
    rating,
    reviews,
    category,
    placeId: null,
  };
}

/**
 * Parse business data from text context around a business name
 */
function parseContextForBusiness(name: string, context: string, searchCity: string): ScrapedBusiness | null {
  const plainText = stripHtml(context);

  // Extract address
  const addressMatch = plainText.match(/([\wäöüÄÖÜß]+(?:str|straße|weg|platz|gasse|allee)\.?\s*\d+[^,\n]*(?:,\s*\d{5}\s+[\wäöüÄÖÜß]+)?)/i);
  const address = addressMatch ? addressMatch[1].trim() : '';

  // Extract phone from plain text
  const phoneMatch = plainText.match(/((?:\+49|0)\s*[\d\s\-\/()]{6,15})/);
  const phone = phoneMatch ? cleanPhone(phoneMatch[1]) : null;

  // Extract website from HTML context
  const websiteMatch = context.match(/href="(https?:\/\/(?!(?:www\.)?google)[^\s"]+)"/);
  const website = websiteMatch ? websiteMatch[1] : null;

  // Extract rating
  const ratingMatch = plainText.match(/(\d[.,]\d)/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null;

  if (!address && !phone && !website) return null;

  return {
    name,
    address,
    city: extractCity(address, searchCity),
    phone,
    website,
    rating,
    reviews: null,
    category: null,
    placeId: null,
  };
}

/**
 * Strategy 3: Regex-based extraction from raw HTML
 * Find phone numbers, websites, and names independently, then group them
 */
function extractFromRegexPatterns(html: string, searchCity: string): ScrapedBusiness[] {
  const businesses: ScrapedBusiness[] = [];

  try {
    // Find all aria-labels which often contain business names in Google results
    const ariaLabels: { name: string; index: number }[] = [];
    const ariaRegex = /aria-label="([^"]{3,80})"/g;
    let m;
    while ((m = ariaRegex.exec(html)) !== null) {
      const label = m[1].trim();
      // Filter out common non-business labels
      if (!label.match(/^(Mehr|Weniger|Schließen|Suche|Google|Karte|Route|Bewertung|Ergebnis)/i)) {
        ariaLabels.push({ name: label, index: m.index });
      }
    }

    // Find all phone numbers in the HTML
    const phones: { phone: string; index: number }[] = [];
    const phoneRegex = /((?:\+49|0\d{2,4})[\s\-\/][\d\s\-\/]{5,15})/g;
    while ((m = phoneRegex.exec(html)) !== null) {
      phones.push({ phone: cleanPhone(m[1]) || m[1], index: m.index });
    }

    // Find all external URLs
    const urls: { url: string; index: number }[] = [];
    const urlRegex = /href="(https?:\/\/(?!(?:www\.)?(?:google|gstatic|googleapis|youtube))[^\s"]{5,}?)"/g;
    while ((m = urlRegex.exec(html)) !== null) {
      urls.push({ url: m[1], index: m.index });
    }

    // Find addresses (German format)
    const addresses: { address: string; index: number }[] = [];
    const addrRegex = /([\wäöüÄÖÜß]+(?:str|straße|weg|platz|gasse|allee)\.?\s*\d+[^<"]{0,50}?\d{5}\s+[\wäöüÄÖÜß]+)/gi;
    while ((m = addrRegex.exec(html)) !== null) {
      addresses.push({ address: m[1].trim(), index: m.index });
    }

    // Group data by proximity (items within 3000 chars of each other likely belong together)
    const PROXIMITY = 3000;

    for (const label of ariaLabels) {
      const nearPhone = phones.find(p => Math.abs(p.index - label.index) < PROXIMITY);
      const nearUrl = urls.find(u => Math.abs(u.index - label.index) < PROXIMITY);
      const nearAddr = addresses.find(a => Math.abs(a.index - label.index) < PROXIMITY);

      if (nearPhone || nearUrl || nearAddr) {
        // Avoid duplicate names
        if (!businesses.some(b => b.name === label.name)) {
          businesses.push({
            name: label.name,
            address: nearAddr?.address || '',
            city: extractCity(nearAddr?.address || '', searchCity),
            phone: nearPhone?.phone || null,
            website: nearUrl?.url || null,
            rating: null,
            reviews: null,
            category: null,
            placeId: null,
          });
        }
      }
    }
  } catch (err) {
    console.error('extractFromRegexPatterns error:', err);
  }

  return businesses;
}

/**
 * Extract city from address string, fallback to search city
 */
function extractCity(address: string, fallbackCity: string): string {
  if (!address) return fallbackCity;

  // Try to find city after German postal code (5 digits)
  const plzMatch = address.match(/\d{5}\s+([\wäöüÄÖÜß]+(?:\s+(?:am|an|im|bei|ob)\s+[\wäöüÄÖÜß]+)?)/i);
  if (plzMatch) return plzMatch[1].trim();

  return fallbackCity;
}

/**
 * Clean and normalize phone number
 */
function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  // Remove extra spaces, keep only digits, +, -, /
  let cleaned = phone.replace(/[^\d+\-\/\s]/g, '').trim();
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  if (cleaned.length < 6) return null;
  return cleaned;
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize website URL for deduplication
 */
export function normalizeWebsite(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').toLowerCase().split('/')[0];
  }
}

/**
 * Deduplicate businesses by name or website
 */
function deduplicateBusinesses(businesses: ScrapedBusiness[]): ScrapedBusiness[] {
  const seen = new Set<string>();
  const unique: ScrapedBusiness[] = [];

  for (const biz of businesses) {
    const key = biz.website
      ? normalizeWebsite(biz.website)
      : biz.name.toLowerCase().trim();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(biz);
    }
  }

  return unique;
}

/**
 * Main scraping function
 *
 * @param keyword - Search term (e.g. "Heizungsinstallateur Essen")
 * @param maxPages - Number of result pages to scrape (each page ≈ 20 results)
 * @param onProgress - Optional callback for progress updates
 */
export async function scrapeGoogleMaps(
  keyword: string,
  maxPages: number = 5,
  onProgress?: (progress: ScrapeProgress) => void,
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  // Extract city from keyword for fallback
  const cityMatch = keyword.match(/\b([\wäöüÄÖÜß]{3,})\s*$/);
  const searchCity = cityMatch ? cityMatch[1] : '';

  const RESULTS_PER_PAGE = 20;

  for (let page = 0; page < maxPages; page++) {
    const start = page * RESULTS_PER_PAGE;

    onProgress?.({
      status: 'running',
      keyword,
      currentPage: page + 1,
      totalPages: maxPages,
      businessesFound: allBusinesses.length,
      errors,
    });

    try {
      const url = buildSearchUrl(keyword, start);
      console.log(`[Scraper] Fetching page ${page + 1}: ${url}`);

      const response = await fetch(url, {
        headers: buildHeaders(),
        redirect: 'follow',
      });

      if (!response.ok) {
        const errMsg = `Seite ${page + 1}: HTTP ${response.status}`;
        errors.push(errMsg);
        console.error(`[Scraper] ${errMsg}`);

        if (response.status === 429) {
          // Rate limited - wait longer and retry once
          errors.push('Rate-Limit erkannt, warte 30s...');
          await delay(30000);
          continue;
        }
        break;
      }

      const html = await response.text();

      // Check for CAPTCHA
      if (html.includes('captcha') || html.includes('unusual traffic') || html.includes('ungewöhnlichen Datenverkehr')) {
        errors.push(`Seite ${page + 1}: Google CAPTCHA erkannt. Bitte später erneut versuchen.`);
        break;
      }

      // Extract businesses from this page
      const pageBusinesses = extractBusinesses(html, searchCity);
      console.log(`[Scraper] Page ${page + 1}: Found ${pageBusinesses.length} businesses`);

      if (pageBusinesses.length === 0) {
        // No more results - stop pagination
        if (page > 0) {
          console.log(`[Scraper] No results on page ${page + 1}, stopping.`);
          break;
        } else {
          errors.push(`Seite ${page + 1}: Keine Ergebnisse gefunden. HTML-Parsing fehlgeschlagen.`);
        }
      }

      allBusinesses.push(...pageBusinesses);

      // Random delay between pages (2-5 seconds)
      if (page < maxPages - 1) {
        const waitMs = 2000 + Math.random() * 3000;
        console.log(`[Scraper] Waiting ${Math.round(waitMs)}ms before next page...`);
        await delay(waitMs);
      }
    } catch (err) {
      const errMsg = `Seite ${page + 1}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`;
      errors.push(errMsg);
      console.error(`[Scraper] ${errMsg}`);
    }
  }

  // Deduplicate
  const uniqueBusinesses = deduplicateBusinesses(allBusinesses);

  const result: ScrapeResult = {
    keyword,
    businesses: uniqueBusinesses,
    totalFound: uniqueBusinesses.length,
    pagesScraped: Math.min(maxPages, Math.ceil(allBusinesses.length / RESULTS_PER_PAGE) || 1),
    duration: Date.now() - startTime,
    errors,
  };

  onProgress?.({
    status: errors.length > 0 && uniqueBusinesses.length === 0 ? 'error' : 'completed',
    keyword,
    currentPage: maxPages,
    totalPages: maxPages,
    businessesFound: uniqueBusinesses.length,
    errors,
  });

  return result;
}

/**
 * Alternative: Direct Google Maps search URL approach
 * Fetches Google Maps directly and parses embedded data
 */
export async function scrapeGoogleMapsDirect(
  keyword: string,
  maxScrolls: number = 5,
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  const cityMatch = keyword.match(/\b([\wäöüÄÖÜß]{3,})\s*$/);
  const searchCity = cityMatch ? cityMatch[1] : '';

  try {
    const encoded = encodeURIComponent(keyword);
    const url = `https://www.google.de/maps/search/${encoded}/`;

    console.log(`[Scraper Direct] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: buildHeaders(),
      redirect: 'follow',
    });

    if (!response.ok) {
      errors.push(`HTTP ${response.status}`);
      return { keyword, businesses: [], totalFound: 0, pagesScraped: 0, duration: Date.now() - startTime, errors };
    }

    const html = await response.text();

    // Google Maps embeds business data in specific patterns
    // Look for business data in the page source

    // Pattern: Find business names and data in Google Maps format
    // Business entries are often in arrays like: ["0x...",lat,lng,null,"Business Name",...]
    const businessPattern = /\["0x[0-9a-f]+:[0-9a-f]+",[\d.-]+,[\d.-]+[^\]]*?"([^"]{2,80})"[^\]]*?\]/g;
    let match;
    while ((match = businessPattern.exec(html)) !== null) {
      const context = html.substring(match.index, match.index + 5000);
      const name = match[1];

      if (name && !name.startsWith('http') && !name.match(/^\d/)) {
        // Try to find phone and website in nearby context
        const phoneM = context.match(/((?:\+49|0\d{2,4})[\s\-\/][\d\s\-\/]{5,})/);
        const webM = context.match(/"(https?:\/\/(?!(?:www\.)?(?:google|gstatic))[^\s"]+)"/);
        const addrM = context.match(/"([\wäöüÄÖÜß]+(?:str|straße|weg|platz|gasse|allee)\.?\s*\d+[^"]{0,50})"/i);

        allBusinesses.push({
          name: name.trim(),
          address: addrM ? addrM[1].trim() : '',
          city: searchCity,
          phone: phoneM ? cleanPhone(phoneM[1]) : null,
          website: webM ? webM[1] : null,
          rating: null,
          reviews: null,
          category: null,
          placeId: null,
        });
      }
    }

    // Also try the JSON-like data format
    // Google Maps has data in format: [null,null,[null,[...businesses...]]]
    const jsonArrayRegex = /\[\s*null\s*,\s*null\s*,\s*\[/g;
    // This is a simplified approach - in production you'd parse the full structure

  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unbekannter Fehler');
  }

  const uniqueBusinesses = deduplicateBusinesses(allBusinesses);

  return {
    keyword,
    businesses: uniqueBusinesses,
    totalFound: uniqueBusinesses.length,
    pagesScraped: 1,
    duration: Date.now() - startTime,
    errors,
  };
}
