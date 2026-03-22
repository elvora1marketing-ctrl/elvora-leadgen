/**
 * LinkedIn People Scraper via RapidAPI
 *
 * Uses the "Fresh LinkedIn Profile Data" API (or compatible) to:
 * 1. Search for people by keyword + location
 * 2. Fetch profile details including email, company, title
 */

export interface LinkedInPerson {
  fullName: string;
  profileUrl: string;
  headline: string;
  location: string;
  company: string;
  title: string;
  email: string | null;
  profileImageUrl: string | null;
}

export interface LinkedInSearchResult {
  people: LinkedInPerson[];
  totalResults: number;
}

interface RapidAPISearchItem {
  profile_link?: string;
  profile_url?: string;
  linkedin_url?: string;
  name?: string;
  full_name?: string;
  headline?: string;
  title?: string;
  location?: string;
  company?: string;
  current_company?: string;
  current_company_name?: string;
  image?: string;
  profile_image?: string;
  profile_picture?: string;
}

interface RapidAPIProfileResponse {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  city?: string;
  email?: string;
  personal_email?: string;
  work_email?: string;
  profile_pic_url?: string;
  company?: string;
  current_company?: string;
  experiences?: Array<{
    company?: string;
    title?: string;
    is_current?: boolean;
  }>;
  position_groups?: Array<{
    company?: { name?: string };
    profile_positions?: Array<{ title?: string }>;
  }>;
}

/**
 * Search LinkedIn for people matching a keyword and optional location.
 */
export async function searchLinkedInPeople(
  keyword: string,
  location: string,
  apiKey: string,
  apiHost: string,
  start: number = 0,
): Promise<LinkedInSearchResult> {
  const params = new URLSearchParams({
    keywords: keyword,
    geo_code: '',
    start: start.toString(),
  });

  if (location) {
    params.set('keywords', `${keyword} ${location}`);
  }

  const url = `https://${apiHost}/search-people?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': apiHost,
    },
  });

  if (res.status === 429) {
    throw new Error('Rate Limit erreicht. Bitte warten und erneut versuchen.');
  }

  if (res.status === 403) {
    throw new Error('API-Zugang verweigert. Bitte RapidAPI-Key und Abo prüfen.');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LinkedIn API Fehler (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // Handle different response formats from various RapidAPI LinkedIn providers
  const items: RapidAPISearchItem[] = Array.isArray(data)
    ? data
    : data?.data || data?.results || data?.people || [];

  const people: LinkedInPerson[] = items.map((item: RapidAPISearchItem) => ({
    fullName: item.name || item.full_name || '',
    profileUrl: item.profile_link || item.profile_url || item.linkedin_url || '',
    headline: item.headline || item.title || '',
    location: item.location || '',
    company: item.company || item.current_company || item.current_company_name || '',
    title: item.headline || item.title || '',
    email: null, // Emails come from profile detail fetch
    profileImageUrl: item.image || item.profile_image || item.profile_picture || null,
  }));

  return {
    people: people.filter(p => p.fullName && p.profileUrl),
    totalResults: data?.total || data?.total_results || people.length,
  };
}

/**
 * Fetch detailed profile data for a single LinkedIn profile URL.
 */
export async function getLinkedInProfile(
  profileUrl: string,
  apiKey: string,
  apiHost: string,
): Promise<LinkedInPerson> {
  const params = new URLSearchParams({
    linkedin_url: profileUrl,
  });

  const url = `https://${apiHost}/get-linkedin-profile?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': apiHost,
    },
  });

  if (res.status === 429) {
    throw new Error('Rate Limit erreicht.');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Profil-Fehler (${res.status}): ${body.slice(0, 200)}`);
  }

  const data: RapidAPIProfileResponse = await res.json();
  const profileData = (data as Record<string, unknown>)?.data
    ? ((data as Record<string, unknown>).data as RapidAPIProfileResponse)
    : data;

  // Extract current company from experiences
  let company = profileData.company || profileData.current_company || '';
  let title = profileData.headline || '';

  if (!company && profileData.experiences) {
    const current = profileData.experiences.find(e => e.is_current);
    if (current) {
      company = current.company || '';
      if (current.title) title = current.title;
    }
  }

  if (!company && profileData.position_groups?.length) {
    company = profileData.position_groups[0]?.company?.name || '';
    if (!title && profileData.position_groups[0]?.profile_positions?.length) {
      title = profileData.position_groups[0].profile_positions[0]?.title || '';
    }
  }

  const fullName = profileData.full_name
    || [profileData.first_name, profileData.last_name].filter(Boolean).join(' ')
    || '';

  return {
    fullName,
    profileUrl,
    headline: profileData.headline || '',
    location: profileData.location || profileData.city || '',
    company,
    title,
    email: profileData.email || profileData.personal_email || profileData.work_email || null,
    profileImageUrl: profileData.profile_pic_url || null,
  };
}

/**
 * Normalize a LinkedIn URL for deduplication.
 */
export function normalizeLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query params and trailing slashes
    return parsed.pathname.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}
