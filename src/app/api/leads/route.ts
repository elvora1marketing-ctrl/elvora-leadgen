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
      conditions.push('l.city = ?');
      values.push(city);
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
      conditions.push("(',' || l.found_via_keywords || ',') LIKE ('%,' || ? || ',%')");
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

    // Get distinct cities for filter dropdown
    const citiesList = db.prepare("SELECT DISTINCT city FROM leads WHERE city IS NOT NULL AND city != '' ORDER BY city").all() as { city: string }[];

    // Get distinct keywords with counts
    const keywordRows = db.prepare("SELECT found_via_keywords FROM leads WHERE found_via_keywords IS NOT NULL AND found_via_keywords != ''").all() as { found_via_keywords: string }[];
    const keywordCounts: Record<string, number> = {};
    for (const row of keywordRows) {
      row.found_via_keywords.split(',').forEach(k => {
        const trimmed = k.trim();
        if (trimmed) {
          keywordCounts[trimmed] = (keywordCounts[trimmed] || 0) + 1;
        }
      });
    }
    const keywordsWithCounts = Object.entries(keywordCounts)
      .map(([kw, count]) => ({ keyword: kw, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      leads,
      total: total.count,
      limit,
      offset,
      cities: citiesList.map(c => c.city),
      keywords: keywordsWithCounts,
    });
  } catch (error: unknown) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}
