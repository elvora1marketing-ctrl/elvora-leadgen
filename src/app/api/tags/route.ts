import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const tags = db.prepare(`
      SELECT t.*, COUNT(lt.lead_id) as usage_count
      FROM tags t
      LEFT JOIN lead_tags lt ON t.id = lt.tag_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all();

    return NextResponse.json({ tags });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as { name: string; color?: string };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Tag-Name erforderlich' }, { status: 400 });
    }

    const result = db.prepare(
      'INSERT INTO tags (name, color) VALUES (?, ?)'
    ).run(body.name.trim(), body.color || '#8B5CF6');

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Tag existiert bereits' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
