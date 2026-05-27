import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

// GET /api/leads/hot – Leads die auf den Audit reagiert haben
export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const hotLeads = db.prepare(`
      SELECT
        l.id, l.name, l.city, l.score, l.phone, l.email,
        l.website_original as website,
        l.contact_status, l.priority, l.deal_value,
        l.problems, l.seo_issues,
        ap.views as audit_views,
        ap.cta_clicks,
        ap.slug as audit_slug,
        ap.created_at as audit_created,
        et.open_count as email_opens,
        et.opened_at as email_opened_at
      FROM leads l
      LEFT JOIN audit_pages ap ON ap.lead_id = l.id
      LEFT JOIN email_tracking et ON et.lead_id = l.id
      WHERE (
        (ap.views > 0 OR ap.cta_clicks > 0)
        OR (et.open_count >= 2)
      )
      AND l.status = 'qualified'
      ORDER BY
        ap.cta_clicks DESC,
        et.open_count DESC,
        ap.views DESC
      LIMIT 20
    `).all();

    return NextResponse.json({ hotLeads });
  } catch (error) {
    console.error('Hot leads error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
