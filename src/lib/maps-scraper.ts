/**
 * Google Maps Lead Scraper
 *
 * Uses the Google Places API (New) Text Search to find businesses.
 * Returns structured JSON data - no HTML parsing needed.
 *
 * Required: Google Maps API Key with "Places API (New)" enabled.
 * Get one at: https://console.cloud.google.com/apis/credentials
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

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

// Fields we request from the API (controls billing)
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.shortFormattedAddress',
].join(',');

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
 * Extract city from a German formatted address
 */
function extractCity(address: string, fallbackCity: string): string {
  if (!address) return fallbackCity;

  // German format: "Straße 123, 45678 Stadtname, Deutschland"
  const plzMatch = address.match(/\d{5}\s+([\wäöüÄÖÜß]+(?:\s+(?:am|an|im|bei|ob)\s+[\wäöüÄÖÜß]+)?)/i);
  if (plzMatch) return plzMatch[1].trim();

  // Try city from comma-separated parts (second-to-last part often is the city)
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Last part is usually "Deutschland", second-to-last is "PLZ Stadt"
    const cityPart = parts[parts.length - 2] || parts[parts.length - 1];
    const cityFromPart = cityPart.replace(/^\d{5}\s*/, '').trim();
    if (cityFromPart.length >= 2 && cityFromPart !== 'Deutschland') {
      return cityFromPart;
    }
  }

  return fallbackCity;
}

/**
 * Deduplicate businesses by website or name
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse a single place from the Google Places API response
 */
function parsePlaceResult(place: Record<string, unknown>, searchCity: string): ScrapedBusiness {
  const displayName = place.displayName as { text?: string; languageCode?: string } | undefined;
  const primaryType = place.primaryTypeDisplayName as { text?: string } | undefined;

  return {
    name: displayName?.text || 'Unbekannt',
    address: (place.formattedAddress as string) || (place.shortFormattedAddress as string) || '',
    city: extractCity((place.formattedAddress as string) || '', searchCity),
    phone: (place.nationalPhoneNumber as string) || (place.internationalPhoneNumber as string) || null,
    website: (place.websiteUri as string) || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviews: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    category: primaryType?.text || null,
    placeId: (place.id as string) || null,
  };
}

/**
 * Main scraping function using Google Places API (Text Search)
 *
 * @param keyword - Search term (e.g. "Heizungsinstallateur Essen")
 * @param maxPages - Number of result pages (each page = up to 20 results, max 3 pages = 60 results)
 * @param onProgress - Optional callback for progress updates
 * @param apiKey - Google Maps API Key
 */
export async function scrapeGoogleMaps(
  keyword: string,
  maxPages: number = 3,
  onProgress?: (progress: ScrapeProgress) => void,
  apiKey?: string,
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const allBusinesses: ScrapedBusiness[] = [];
  const errors: string[] = [];

  if (!apiKey) {
    return {
      keyword,
      businesses: [],
      totalFound: 0,
      pagesScraped: 0,
      duration: Date.now() - startTime,
      errors: ['Google Maps API-Key fehlt. Bitte unter Einstellungen hinterlegen.'],
    };
  }

  // Extract city from keyword for fallback
  const cityMatch = keyword.match(/\b([\wäöüÄÖÜß]{3,})\s*$/);
  const searchCity = cityMatch ? cityMatch[1] : '';

  // Google Places Text Search returns max 20 results per request
  // Pagination via nextPageToken (max 3 pages = 60 results)
  const effectiveMaxPages = Math.min(maxPages, 3);
  let nextPageToken: string | null = null;

  for (let page = 0; page < effectiveMaxPages; page++) {
    onProgress?.({
      status: 'running',
      keyword,
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      businessesFound: allBusinesses.length,
      errors,
    });

    try {
      // Build request body
      const requestBody: Record<string, unknown> = {
        textQuery: keyword,
        languageCode: 'de',
        regionCode: 'DE',
        maxResultCount: 20,
      };

      if (nextPageToken) {
        requestBody.pageToken = nextPageToken;
      }

      console.log(`[Scraper] Page ${page + 1}: Searching "${keyword}"...`);

      const response = await fetch(PLACES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          // use raw status
        }

        if (response.status === 403) {
          errors.push(`API-Key ungültig oder Places API nicht aktiviert: ${errorMessage}`);
          break;
        }
        if (response.status === 429) {
          errors.push('Rate-Limit erreicht. Bitte später erneut versuchen.');
          break;
        }
        if (response.status === 400) {
          errors.push(`Ungültige Anfrage: ${errorMessage}`);
          break;
        }

        errors.push(`Seite ${page + 1}: ${errorMessage}`);
        break;
      }

      const data = await response.json() as {
        places?: Record<string, unknown>[];
        nextPageToken?: string;
      };

      const places = data.places || [];
      console.log(`[Scraper] Page ${page + 1}: ${places.length} Ergebnisse`);

      if (places.length === 0) {
        if (page === 0) {
          errors.push('Keine Ergebnisse gefunden. Versuche einen anderen Suchbegriff.');
        }
        break;
      }

      for (const place of places) {
        const business = parsePlaceResult(place, searchCity);
        allBusinesses.push(business);
      }

      // Check for next page
      nextPageToken = data.nextPageToken || null;
      if (!nextPageToken) {
        console.log(`[Scraper] No more pages available.`);
        break;
      }

      // Short delay between pages
      if (page < effectiveMaxPages - 1) {
        await delay(500);
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
    pagesScraped: Math.max(1, Math.ceil(allBusinesses.length / 20)),
    duration: Date.now() - startTime,
    errors,
  };

  onProgress?.({
    status: errors.length > 0 && uniqueBusinesses.length === 0 ? 'error' : 'completed',
    keyword,
    currentPage: effectiveMaxPages,
    totalPages: effectiveMaxPages,
    businessesFound: uniqueBusinesses.length,
    errors,
  });

  return result;
}
