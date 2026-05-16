import { NextRequest } from 'next/server';
import getDb from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT = 15000;

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

const VALID_SOURCES = new Set(['maps', 'branchenportal', 'websearch']);

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

async function fetchPage(url: string): Promise<string | null> {
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

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Count: Branchenportal (Gelbe Seiten + 11880)
// ---------------------------------------------------------------------------

async function countGelbeSeiten(keyword: string, city: string): Promise<number> {
  const kwLower = keyword.toLowerCase().replace(/\s+/g, '-');
  const cityLower = city.toLowerCase().replace(/\s+/g, '-');
  const url = `https://www.gelbeseiten.de/branchen/${encodeURIComponent(kwLower)}/${encodeURIComponent(cityLower)}`;

  const html = await fetchPage(url);
  if (!html) return 0;

  // Count <article> blocks (each is a listing)
  const articleRegex = /<article\b[^>]*>/gi;
  let count = 0;
  while (articleRegex.exec(html) !== null) count++;

  return count;
}

async function count11880(keyword: string, city: string): Promise<number> {
  const url = `https://www.11880.com/suche/${encodeURIComponent(keyword)}/${encodeURIComponent(city)}`;

  const html = await fetchPage(url);
  if (!html) return 0;

  // Primary: try to extract total from JSON-LD numberOfItems
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch: RegExpExecArray | null;

  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data['@type'] === 'SearchResultsPage' && data.mainEntity?.numberOfItems != null) {
        const total = parseInt(String(data.mainEntity.numberOfItems), 10);
        if (!isNaN(total) && total > 0) return total;
      }
    } catch { /* invalid JSON, skip */ }
  }

  // Fallback: count <li class="result-list-entry"> elements
  const liRegex = /<li\b[^>]*class="[^"]*result-list-entry[^"]*"[^>]*>/gi;
  let count = 0;
  while (liRegex.exec(html) !== null) count++;

  return count;
}

async function countBranchenportal(keyword: string, city: string): Promise<number> {
  const [gsCount, elCount] = await Promise.allSettled([
    countGelbeSeiten(keyword, city),
    count11880(keyword, city),
  ]);

  let total = 0;
  if (gsCount.status === 'fulfilled') total += gsCount.value;
  if (elCount.status === 'fulfilled') total += elCount.value;

  return total;
}

// ---------------------------------------------------------------------------
// Count: Websearch (SearXNG)
// ---------------------------------------------------------------------------

async function countWebsearch(keyword: string, city: string, searxngUrl: string): Promise<number> {
  const query = `${keyword} ${city} Firma Kontakt`;
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: 'general',
    language: 'de',
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(`${searxngUrl}/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return 0;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json')) return 0;

    const data = await res.json() as { results?: Array<{ url?: string }> };
    if (!data.results || data.results.length === 0) return 0;

    // Filter out blocked domains
    const filtered = data.results.filter(r => r.url && !isBlockedUrl(r.url));
    return filtered.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Count: Google Maps (Places API Text Search)
// ---------------------------------------------------------------------------

async function countMaps(keyword: string, city: string, apiKey: string): Promise<number> {
  const textQuery = `${keyword} ${city}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,nextPageToken',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'de',
        regionCode: 'DE',
        maxResultCount: 20,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return 0;

    const data = await res.json() as { places?: Array<Record<string, unknown>> };
    return data.places?.length || 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: { keyword?: string; cities?: string[]; sources?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { keyword, cities, sources } = body;

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
    return Response.json({ error: 'Keyword ist erforderlich (min. 2 Zeichen)' }, { status: 400 });
  }

  if (!cities || !Array.isArray(cities) || cities.length === 0) {
    return Response.json({ error: 'Mindestens eine Stadt erforderlich' }, { status: 400 });
  }

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return Response.json({ error: 'Mindestens eine Quelle erforderlich' }, { status: 400 });
  }

  const validSources = sources.filter(s => VALID_SOURCES.has(s));
  if (validSources.length === 0) {
    return Response.json(
      { error: `Ungültige Quellen. Erlaubt: ${[...VALID_SOURCES].join(', ')}` },
      { status: 400 },
    );
  }

  const cleanKeyword = keyword.trim();
  const cleanCities = cities.map(c => c.trim()).filter(c => c.length > 0);

  // Load settings from DB
  const db = getDb();
  const settingsRows = db
    .prepare("SELECT key, value FROM settings WHERE key IN ('searxng_url', 'google_maps_api_key')")
    .all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  const searxngUrl = settings.searxng_url || 'http://localhost:8888';
  const mapsApiKey = settings.google_maps_api_key || '';

  // Validate maps API key if maps source is requested
  if (validSources.includes('maps') && !mapsApiKey) {
    return Response.json(
      { error: 'Google Maps API-Key fehlt. Bitte unter Einstellungen hinterlegen.' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream already closed
        }
      }

      const bySource: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      let total = 0;

      for (const source of validSources) {
        bySource[source] = 0;
      }

      for (let cityIdx = 0; cityIdx < cleanCities.length; cityIdx++) {
        const city = cleanCities[cityIdx];
        byCity[city] = 0;

        for (const source of validSources) {
          let count = 0;

          try {
            switch (source) {
              case 'branchenportal':
                count = await countBranchenportal(cleanKeyword, city);
                break;
              case 'websearch':
                count = await countWebsearch(cleanKeyword, city, searxngUrl);
                break;
              case 'maps':
                count = await countMaps(cleanKeyword, city, mapsApiKey);
                break;
            }
          } catch (err) {
            console.error(`[Count] Error for ${source}/${city}:`, err);
            send({
              type: 'error',
              source,
              city,
              message: err instanceof Error ? err.message : 'Unbekannter Fehler',
            });
            // Continue with other sources/cities
          }

          bySource[source] = (bySource[source] || 0) + count;
          byCity[city] = (byCity[city] || 0) + count;
          total += count;

          send({ type: 'count', source, city, count });
        }

        // Delay between cities to avoid rate limiting (300-500ms)
        if (cityIdx < cleanCities.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
        }
      }

      send({
        type: 'summary',
        total,
        bySource,
        byCity,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
