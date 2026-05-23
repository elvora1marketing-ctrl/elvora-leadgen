import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const clients = db.prepare(`
      SELECT c.*, l.name as lead_name, l.city as lead_city, l.website_normalized as lead_website
      FROM clients c
      LEFT JOIN leads l ON c.lead_id = l.id
      ORDER BY c.created_at DESC
    `).all();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
