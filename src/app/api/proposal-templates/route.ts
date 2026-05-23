import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const templates = db.prepare('SELECT * FROM proposal_templates ORDER BY is_default DESC, created_at DESC').all();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { name, price, price_type, description, services } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name und Preis sind erforderlich' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO proposal_templates (name, price, price_type, description, services)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name,
      price,
      price_type || 'once',
      description || null,
      JSON.stringify(services || []),
    );

    const template = db.prepare('SELECT * FROM proposal_templates WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
