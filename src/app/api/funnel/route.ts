import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateConfig } from '@/lib/funnel-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const funnels = db.prepare(`
    SELECT fc.*, COUNT(fl.id) as lead_count
    FROM funnel_configs fc
    LEFT JOIN funnel_leads fl ON fl.funnel_id = fc.id
    GROUP BY fc.id ORDER BY fc.created_at DESC
  `).all();

  return NextResponse.json({ funnels });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { name, slug, config } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name und Slug sind Pflicht' }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug: nur Kleinbuchstaben, Zahlen, Bindestriche' }, { status: 400 });
  }

  const configObj = typeof config === 'string' ? JSON.parse(config) : config;
  if (!validateConfig(configObj)) {
    return NextResponse.json({ error: 'Config-Schema ungültig' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM funnel_configs WHERE slug = ?').get(slug);
  if (existing) {
    return NextResponse.json({ error: 'Slug existiert bereits' }, { status: 409 });
  }

  const result = db.prepare(
    "INSERT INTO funnel_configs (slug, name, config) VALUES (?, ?, ?)"
  ).run(slug, name, JSON.stringify(configObj));

  return NextResponse.json({ id: result.lastInsertRowid, slug }, { status: 201 });
}
