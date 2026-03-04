import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = request.nextUrl;

    const status = url.searchParams.get('status');
    const contactStatus = url.searchParams.get('contact_status');
    const city = url.searchParams.get('city');
    const minScore = url.searchParams.get('min_score');
    const search = url.searchParams.get('search');
    const hasWebsite = url.searchParams.get('has_website');
    const hasPhone = url.searchParams.get('has_phone');
    const hasEmail = url.searchParams.get('has_email');
    const keyword = url.searchParams.get('keyword');
    const includeMeta = url.searchParams.get('include_meta') === '1';
    const sortBy = url.searchParams.get('sort') || 'score';
    const sortDir = url.searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (status) {
      conditions.push('l.status = ?');
      values.push(status);
    }
    if (contactStatus) {
      conditions.push('l.contact_status = ?');
      values.push(contactStatus);
    }
    if (city) {
      // Smart city filter: "Düsseldorf" matches "Düsseldorf", "Düsseldorf-Bilk", etc.
      conditions.push("(l.city = ? OR l.city LIKE ? || ' %' OR l.city LIKE ? || '-%')");
      values.push(city, city, city);
    }
    if (minScore) {
      conditions.push('l.score >= ?');
      values.push(parseInt(minScore));
    }
    if (search) {
      conditions.push("(l.name LIKE ? OR l.city LIKE ? OR l.website_original LIKE ? OR l.phone LIKE ? OR l.found_via_keywords LIKE ?)");
      const term = `%${search}%`;
      values.push(term, term, term, term, term);
    }
    if (hasWebsite === '1') {
      conditions.push("l.website_original IS NOT NULL AND l.website_original != ''");
    } else if (hasWebsite === '0') {
      conditions.push("(l.website_original IS NULL OR l.website_original = '')");
    }
    if (hasPhone === '1') {
      conditions.push("l.phone IS NOT NULL AND l.phone != ''");
    }
    if (hasEmail === '1') {
      conditions.push("l.email IS NOT NULL AND l.email != ''");
    }
    if (keyword) {
      // Smart keyword filter: matches partial keywords too
      // "Pflegedienst" matches "Pflegedienst Düsseldorf", "Pflegedienst Köln", etc.
      conditions.push("l.found_via_keywords LIKE '%' || ? || '%'");
      values.push(keyword);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSorts: Record<string, string> = {
      score: 'l.score', name: 'l.name', city: 'l.city',
      created_at: 'l.created_at', updated_at: 'l.updated_at',
      times_found: 'l.times_found', engagement: 'l.engagement_score',
    };
    const orderCol = validSorts[sortBy] || 'l.score';

    const leads = db.prepare(`
      SELECT l.id, l.name, l.email, l.phone, l.city, l.website_original as website,
             l.score, l.status, l.contact_status, l.priority, l.deal_value,
             l.notes, l.followup_date, l.problems, l.seo_issues,
             l.found_via_keywords, l.times_found, l.rating,
             l.engagement_score, l.engagement_signals,
             l.created_at, l.contacted_at, l.updated_at,
             (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending') as pending_followups,
             (SELECT MAX(open_count) FROM email_tracking et WHERE et.lead_id = l.id) as email_opens
      FROM leads l
      ${where}
      ORDER BY ${orderCol} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as count FROM leads l ${where}`).get(...values) as { count: number };

    const result: Record<string, unknown> = {
      leads,
      total: total.count,
      limit,
      offset,
    };

    // Only compute metadata (cities, keywords, status counts) when requested
    if (includeMeta) {
      const citiesList = db.prepare("SELECT DISTINCT city FROM leads WHERE city IS NOT NULL AND city != '' ORDER BY city").all() as { city: string }[];
      result.cities = citiesList.map(c => c.city);

      // Status counts for category overview
      const statusCounts = db.prepare("SELECT status, COUNT(*) as count FROM leads GROUP BY status").all() as { status: string; count: number }[];
      result.statusCounts = statusCounts;

      // City counts — group by main city (e.g. "Düsseldorf-Bilk" → "Düsseldorf")
      const rawCityCounts = db.prepare("SELECT city, COUNT(*) as count FROM leads WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY count DESC").all() as { city: string; count: number }[];
      const groupedCities: Record<string, number> = {};
      for (const row of rawCityCounts) {
        // Extract main city: split on "-", " ", "/" and take first part
        // "Düsseldorf-Bilk" → "Düsseldorf", "Köln Ehrenfeld" → "Köln", "Frankfurt am Main" stays
        let mainCity = row.city.trim();
        // Handle "Stadt-Stadtteil" pattern
        const dashParts = mainCity.split('-');
        if (dashParts.length > 1 && dashParts[0].length >= 3) {
          mainCity = dashParts[0].trim();
        }
        // Handle "Stadt Stadtteil" but not "Frankfurt am Main" or "Freiburg im Breisgau"
        const spaceParts = mainCity.split(' ');
        if (spaceParts.length > 1 && !['am', 'im', 'an', 'ob', 'bei', 'in'].includes(spaceParts[1].toLowerCase())) {
          mainCity = spaceParts[0].trim();
        }
        groupedCities[mainCity] = (groupedCities[mainCity] || 0) + row.count;
      }
      result.cityCounts = Object.entries(groupedCities)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count);

      // Keyword counts — group by service type (strip city from keyword)
      // Keywords ALWAYS follow "[Service] [City]" pattern, e.g. "Sanitär Essen", "Pflegedienst Düsseldorf"
      // Simple approach: the LAST word is always the city, everything before is the service
      const keywordRows = db.prepare("SELECT found_via_keywords FROM leads WHERE found_via_keywords IS NOT NULL AND found_via_keywords != ''").all() as { found_via_keywords: string }[];

      const keywordCounts: Record<string, number> = {};
      for (const row of keywordRows) {
        row.found_via_keywords.split(',').forEach(k => {
          const trimmed = k.trim();
          if (!trimmed) return;

          const words = trimmed.split(/\s+/);
          // Strip last word (always the city) — keep everything before as service
          // "Pflegedienst Düsseldorf" → "Pflegedienst"
          // "Pflegedienst Dubai" → "Pflegedienst"
          // "SHK Betrieb Köln" → "SHK Betrieb"
          // Single word = keep as-is (it's just a service name without city)
          const service = words.length > 1 ? words.slice(0, -1).join(' ') : words[0];

          if (service) {
            keywordCounts[service] = (keywordCounts[service] || 0) + 1;
          }
        });
      }
      result.keywords = Object.entries(keywordCounts)
        .map(([kw, count]) => ({ keyword: kw, count }))
        .sort((a, b) => b.count - a.count);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}
