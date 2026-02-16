import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const db = getDb();
    const url = request.nextUrl;

    const status = url.searchParams.get('status');
    const contactStatus = url.searchParams.get('contact_status');
    const city = url.searchParams.get('city');
    const minScore = url.searchParams.get('min_score');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }
    if (contactStatus) {
      conditions.push('contact_status = ?');
      values.push(contactStatus);
    }
    if (city) {
      conditions.push('city = ?');
      values.push(city);
    }
    if (minScore) {
      conditions.push('score >= ?');
      values.push(parseInt(minScore));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.id, l.name, l.email, l.phone, l.city, l.website_original as website,
             l.score, l.status, l.contact_status, l.priority, l.deal_value,
             l.notes, l.followup_date, l.problems, l.seo_issues,
             l.created_at, l.contacted_at, l.updated_at,
             (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending') as pending_followups,
             (SELECT MAX(open_count) FROM email_tracking et WHERE et.lead_id = l.id) as email_opens
      FROM leads l
      ${where}
      ORDER BY l.score DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as count FROM leads ${where}`).get(...values) as { count: number };

    return NextResponse.json({
      leads,
      total: total.count,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}
