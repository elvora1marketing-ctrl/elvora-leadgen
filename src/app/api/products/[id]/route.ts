import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Ungültige Produkt-ID' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      description?: string;
      price?: number;
      price_type?: string;
      category?: string;
      tax_rate?: number;
      sort_order?: number;
      is_active?: boolean;
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description?.trim() || null);
    }
    if (body.price !== undefined) {
      updates.push('price = ?');
      values.push(body.price);
    }
    if (body.price_type !== undefined) {
      const validPriceTypes = ['once', 'monthly', 'hourly'];
      if (validPriceTypes.includes(body.price_type)) {
        updates.push('price_type = ?');
        values.push(body.price_type);
      }
    }
    if (body.category !== undefined) {
      updates.push('category = ?');
      values.push(body.category?.trim() || null);
    }
    if (body.tax_rate !== undefined) {
      updates.push('tax_rate = ?');
      values.push(body.tax_rate);
    }
    if (body.sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(body.sort_order);
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
    }

    values.push(productId);
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Ungültige Produkt-ID' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    // Soft delete
    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(productId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
