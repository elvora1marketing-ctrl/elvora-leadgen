import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateConfig } from '@/lib/funnel-config';

export const dynamic = 'force-dynamic';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM funnel_configs WHERE slug = ? AND is_active = 1').get(slug) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: 'Funnel nicht gefunden' }, { status: 404, headers: cors() });

  let config;
  try { config = JSON.parse(row.config as string); } catch { config = {}; }

  return NextResponse.json({ id: row.id, slug: row.slug, name: row.name, config }, { headers: cors() });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const body = await request.json();
  const db = getDb();
  const row = db.prepare('SELECT id FROM funnel_configs WHERE slug = ?').get(slug) as { id: number } | undefined;
  if (!row) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  if (body.config !== undefined) {
    const configObj = typeof body.config === 'string' ? JSON.parse(body.config) : body.config;
    if (!validateConfig(configObj)) {
      return NextResponse.json({ error: 'Config-Schema ungültig' }, { status: 400 });
    }
    db.prepare("UPDATE funnel_configs SET config = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(configObj), row.id);
  }
  if (body.name !== undefined) {
    db.prepare("UPDATE funnel_configs SET name = ?, updated_at = datetime('now') WHERE id = ?").run(body.name, row.id);
  }
  if (body.is_active !== undefined) {
    db.prepare("UPDATE funnel_configs SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(body.is_active ? 1 : 0, row.id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const db = getDb();
  db.prepare('DELETE FROM funnel_configs WHERE slug = ?').run(slug);
  return NextResponse.json({ ok: true });
}
