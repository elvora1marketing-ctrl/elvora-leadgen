import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const referrals = db.prepare(`
      SELECT
        r.*,
        c.company_name as referrer_company,
        l.name as referred_lead_name,
        l.city as referred_lead_city,
        l.status as referred_lead_status,
        l.score as referred_lead_score
      FROM referrals r
      LEFT JOIN clients c ON r.referrer_client_id = c.id
      LEFT JOIN leads l ON r.referred_lead_id = l.id
      ORDER BY r.created_at DESC
    `).all();

    const totals = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
        COALESCE(SUM(CASE WHEN status = 'won' THEN deal_value ELSE 0 END), 0) as total_revenue
      FROM referrals
    `).get();

    return NextResponse.json({ referrals, totals });
  } catch (error) {
    console.error('Referrals GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { referrer_client_id, referred_name, referred_lead_id, notes } = body;

    if (!referred_name) {
      return NextResponse.json({ error: 'referred_name ist erforderlich' }, { status: 400 });
    }

    const db = getDb();

    // Get referrer name from client if referrer_client_id is provided
    let referrer_name: string | null = null;
    if (referrer_client_id) {
      const client = db.prepare('SELECT company_name FROM clients WHERE id = ?').get(referrer_client_id) as { company_name: string } | undefined;
      referrer_name = client?.company_name || null;
    }

    const result = db.prepare(`
      INSERT INTO referrals (referrer_client_id, referrer_name, referred_lead_id, referred_name, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      referrer_client_id || null,
      referrer_name,
      referred_lead_id || null,
      referred_name,
      notes || null
    );

    const referral = db.prepare('SELECT * FROM referrals WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ referral }, { status: 201 });
  } catch (error) {
    console.error('Referrals POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
