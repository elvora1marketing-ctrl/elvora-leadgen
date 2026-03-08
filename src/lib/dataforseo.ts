/**
 * DataForSEO API Client
 * Handles keyword suggestions, SERP results, and Google Maps data
 * for local SEO research in Germany.
 */

import { getDb } from './db';

// ── Types ──

export interface LocalKeywordResult {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  difficulty: number;
  searchIntent: string;
}

export interface OrganicResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string;
}

export interface MapsResult {
  position: number;
  title: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  category: string | null;
}

export interface CompetitorResult {
  domain: string;
  urls: string[];
  avgPosition: number;
  topTitle: string;
  topDescription: string;
}

export interface LocalSeoResult {
  keywords: LocalKeywordResult[];
  serp: {
    organic: OrganicResult[];
    mapsPack: MapsResult[];
    totalResults: number;
  };
  maps: MapsResult[];
  competitors: CompetitorResult[];
  searchedAt: string;
}

// ── Credentials ──

function getCredentials(): { login: string; password: string } {
  const db = getDb();
  const login = db.prepare("SELECT value FROM settings WHERE key = 'dataforseo_login'").get() as { value: string } | undefined;
  const password = db.prepare("SELECT value FROM settings WHERE key = 'dataforseo_password'").get() as { value: string } | undefined;

  if (!login?.value || !password?.value) {
    throw new Error('DataForSEO Zugangsdaten nicht konfiguriert. Bitte in den Einstellungen hinterlegen.');
  }

  return { login: login.value, password: password.value };
}

// ── Base Request ──

async function dataforseoFetch(endpoint: string, body: unknown[]): Promise<unknown> {
  const { login, password } = getCredentials();
  const auth = Buffer.from(`${login}:${password}`).toString('base64');

  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    throw new Error('DataForSEO: Ungültige Zugangsdaten. Bitte Login und Passwort prüfen.');
  }

  if (!res.ok) {
    throw new Error(`DataForSEO API Fehler: HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO: ${data.status_message || 'Unbekannter Fehler'}`);
  }

  return data;
}

// ── Keyword Suggestions ──

export async function fetchKeywordSuggestions(branche: string, stadt: string): Promise<LocalKeywordResult[]> {
  const seedKeyword = `${branche} ${stadt}`;

  const data = await dataforseoFetch('dataforseo_labs/google/keyword_suggestions/live', [
    {
      keyword: seedKeyword,
      location_name: 'Germany',
      language_code: 'de',
      include_serp_info: true,
      include_seed_keyword: true,
      limit: 50,
    },
  ]) as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> };

  const items = data?.tasks?.[0]?.result?.[0]?.items || [];

  return items.map((item: Record<string, unknown>) => {
    const kd = item.keyword_data as Record<string, unknown> | undefined;
    const ki = kd?.keyword_info as Record<string, unknown> | undefined;
    const kp = kd?.keyword_properties as Record<string, unknown> | undefined;
    const si = kd?.search_intent_info as Record<string, unknown> | undefined;

    return {
      keyword: (kd?.keyword as string) || '',
      searchVolume: (ki?.search_volume as number) || 0,
      cpc: (ki?.cpc as number) || 0,
      competition: (ki?.competition as number) || 0,
      competitionLevel: (ki?.competition_level as 'LOW' | 'MEDIUM' | 'HIGH') || 'LOW',
      difficulty: (kp?.keyword_difficulty as number) || 0,
      searchIntent: (si?.main_intent as string) || 'informational',
    };
  }).filter((k: LocalKeywordResult) => k.keyword && k.searchVolume > 0)
    .sort((a: LocalKeywordResult, b: LocalKeywordResult) => b.searchVolume - a.searchVolume);
}

// ── Organic SERP ──

export async function fetchOrganicSerp(branche: string, stadt: string): Promise<{ organic: OrganicResult[]; mapsPack: MapsResult[]; totalResults: number }> {
  const keyword = `${branche} ${stadt}`;

  const data = await dataforseoFetch('serp/google/organic/live/advanced', [
    {
      keyword,
      location_name: 'Germany',
      language_code: 'de',
      se_domain: 'google.de',
      depth: 20,
      device: 'desktop',
    },
  ]) as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>>; total_results_count?: number }> }> };

  const result = data?.tasks?.[0]?.result?.[0];
  const items = result?.items || [];
  const totalResults = result?.total_results_count || 0;

  const organic: OrganicResult[] = [];
  const mapsPack: MapsResult[] = [];

  for (const item of items) {
    if (item.type === 'organic') {
      organic.push({
        position: (item.rank_group as number) || 0,
        title: (item.title as string) || '',
        url: (item.url as string) || '',
        domain: (item.domain as string) || '',
        description: (item.description as string) || '',
      });
    } else if (item.type === 'maps' || item.type === 'local_pack') {
      const mapItems = (item.items as Array<Record<string, unknown>>) || [];
      for (let i = 0; i < mapItems.length; i++) {
        const m = mapItems[i];
        mapsPack.push({
          position: i + 1,
          title: (m.title as string) || '',
          address: (m.address as string) || '',
          phone: (m.phone as string) || null,
          website: (m.url as string) || (m.domain as string) || null,
          rating: typeof m.rating === 'number' ? m.rating : null,
          reviewCount: (m.reviews_count as number) || 0,
          category: (m.category as string) || null,
        });
      }
    }
  }

  return { organic, mapsPack, totalResults };
}

// ── Google Maps SERP ──

export async function fetchMapsSerp(branche: string, stadt: string): Promise<MapsResult[]> {
  const keyword = `${branche} ${stadt}`;

  const data = await dataforseoFetch('serp/google/maps/live/advanced', [
    {
      keyword,
      location_name: 'Germany',
      language_code: 'de',
      device: 'desktop',
      depth: 20,
    },
  ]) as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> };

  const items = data?.tasks?.[0]?.result?.[0]?.items || [];

  return items
    .filter((item: Record<string, unknown>) => item.type === 'maps_search')
    .map((item: Record<string, unknown>, i: number) => ({
      position: i + 1,
      title: (item.title as string) || '',
      address: (item.address as string) || '',
      phone: (item.phone as string) || null,
      website: (item.url as string) || (item.domain as string) || null,
      rating: typeof item.rating === 'number' ? item.rating : null,
      reviewCount: (item.reviews_count as number) || 0,
      category: (item.category as string) || null,
    }));
}

// ── Competitor extraction from SERP data ──

function extractCompetitors(organic: OrganicResult[]): CompetitorResult[] {
  const domainMap = new Map<string, { urls: string[]; positions: number[]; title: string; description: string }>();

  for (const item of organic) {
    if (!item.domain) continue;
    const existing = domainMap.get(item.domain);
    if (existing) {
      existing.urls.push(item.url);
      existing.positions.push(item.position);
    } else {
      domainMap.set(item.domain, {
        urls: [item.url],
        positions: [item.position],
        title: item.title,
        description: item.description,
      });
    }
  }

  return Array.from(domainMap.entries())
    .map(([domain, data]) => ({
      domain,
      urls: data.urls,
      avgPosition: Math.round(data.positions.reduce((a, b) => a + b, 0) / data.positions.length * 10) / 10,
      topTitle: data.title,
      topDescription: data.description,
    }))
    .sort((a, b) => a.avgPosition - b.avgPosition);
}

// ── Cache helpers ──

function getCached(cacheKey: string): LocalSeoResult | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT response_data FROM local_seo_cache WHERE cache_key = ? AND created_at > datetime('now', '-24 hours')"
  ).get(cacheKey) as { response_data: string } | undefined;

  if (row) {
    try {
      return JSON.parse(row.response_data);
    } catch { /* ignore corrupt cache */ }
  }
  return null;
}

function setCache(cacheKey: string, branche: string, stadt: string, data: LocalSeoResult): void {
  const db = getDb();
  db.prepare(
    "INSERT OR REPLACE INTO local_seo_cache (cache_key, branche, stadt, response_data, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(cacheKey, branche, stadt, JSON.stringify(data));
}

// ── Main research function ──

export async function runLocalSeoResearch(branche: string, stadt: string): Promise<{ data: LocalSeoResult; cached: boolean }> {
  const cacheKey = `${branche.toLowerCase().trim()}:${stadt.toLowerCase().trim()}`;

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) {
    return { data: cached, cached: true };
  }

  // Fire all API calls in parallel
  const [keywordsResult, serpResult, mapsResult] = await Promise.allSettled([
    fetchKeywordSuggestions(branche, stadt),
    fetchOrganicSerp(branche, stadt),
    fetchMapsSerp(branche, stadt),
  ]);

  const keywords = keywordsResult.status === 'fulfilled' ? keywordsResult.value : [];
  const serp = serpResult.status === 'fulfilled' ? serpResult.value : { organic: [], mapsPack: [], totalResults: 0 };
  const maps = mapsResult.status === 'fulfilled' ? mapsResult.value : [];
  const competitors = extractCompetitors(serp.organic);

  // Check if we got any data at all
  if (keywords.length === 0 && serp.organic.length === 0 && maps.length === 0) {
    // Check for individual errors
    const errors: string[] = [];
    if (keywordsResult.status === 'rejected') errors.push(keywordsResult.reason?.message || 'Keywords fehlgeschlagen');
    if (serpResult.status === 'rejected') errors.push(serpResult.reason?.message || 'SERP fehlgeschlagen');
    if (mapsResult.status === 'rejected') errors.push(mapsResult.reason?.message || 'Maps fehlgeschlagen');
    if (errors.length > 0) {
      throw new Error(errors[0]);
    }
  }

  const data: LocalSeoResult = {
    keywords,
    serp,
    maps,
    competitors,
    searchedAt: new Date().toISOString(),
  };

  // Cache the result
  setCache(cacheKey, branche, stadt, data);

  return { data, cached: false };
}
