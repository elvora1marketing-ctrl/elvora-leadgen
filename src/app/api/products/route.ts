import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const products = db.prepare(
      'SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    ).all();

    return NextResponse.json({ products });
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
    const body = await request.json() as {
      name: string;
      description?: string;
      price: number;
      price_type?: string;
      category?: string;
      tax_rate?: number;
      sort_order?: number;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Produktname erforderlich' }, { status: 400 });
    }
    if (body.price === undefined || body.price < 0) {
      return NextResponse.json({ error: 'Gültiger Preis erforderlich' }, { status: 400 });
    }

    const validPriceTypes = ['once', 'monthly', 'hourly'];
    const priceType = body.price_type && validPriceTypes.includes(body.price_type) ? body.price_type : 'once';

    const result = db.prepare(`
      INSERT INTO products (name, description, price, price_type, category, tax_rate, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.name.trim(),
      body.description?.trim() || null,
      body.price,
      priceType,
      body.category?.trim() || 'service',
      body.tax_rate !== undefined ? body.tax_rate : 19,
      body.sort_order !== undefined ? body.sort_order : 0,
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
