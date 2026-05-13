import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tid = parseInt(id);
    if (isNaN(tid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
    if (body.price !== undefined) { updates.push('price = ?'); values.push(body.price); }
    if (body.price_type !== undefined) { updates.push('price_type = ?'); values.push(body.price_type); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description || null); }
    if (body.services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(body.services)); }
    if (body.is_default !== undefined) { updates.push('is_default = ?'); values.push(body.is_default ? 1 : 0); }

    if (updates.length === 0) return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });

    values.push(tid);
    getDb().prepare(`UPDATE proposal_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const template = getDb().prepare('SELECT * FROM proposal_templates WHERE id = ?').get(tid);
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tid = parseInt(id);
    if (isNaN(tid)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    getDb().prepare('DELETE FROM proposal_templates WHERE id = ?').run(tid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
