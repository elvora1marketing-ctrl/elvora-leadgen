import { NextRequest, NextResponse } from 'next/server';

import getDb from '@/lib/db';

/**
 * PATCH /api/leads/bulk - Bulk update lead status
 * Body: { ids: number[], status?: string, contact_status?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      ids: number[];
      status?: string;
      contact_status?: string;
    };

    if (!body.ids?.length) {
      return NextResponse.json({ error: 'Keine Lead-IDs angegeben' }, { status: 400 });
    }

    const db = getDb();
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.status) {
      const valid = ['pending', 'qualified', 'rejected', 'archived', 'akquise'];
      if (!valid.includes(body.status)) {
        return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
      }
      updates.push('status = ?');
      values.push(body.status);
    }

    if (body.contact_status) {
      const valid = ['not_contacted', 'email_sent', 'called', 'meeting', 'proposal', 'won', 'lost'];
      if (!valid.includes(body.contact_status)) {
        return NextResponse.json({ error: 'Ungültiger Kontaktstatus' }, { status: 400 });
      }
      updates.push('contact_status = ?');
      values.push(body.contact_status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");

    const placeholders = body.ids.map(() => '?').join(',');
    const stmt = db.prepare(
      `UPDATE leads SET ${updates.join(', ')} WHERE id IN (${placeholders})`
    );
    const result = stmt.run(...values, ...body.ids);

    return NextResponse.json({ success: true, updated: result.changes });
  } catch (error: unknown) {
    console.error('Bulk update error:', error);
    return NextResponse.json({ error: 'Bulk-Update fehlgeschlagen' }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/bulk - Bulk delete leads
 * Body: { ids: number[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { ids: number[] };

    if (!body.ids?.length) {
      return NextResponse.json({ error: 'Keine Lead-IDs angegeben' }, { status: 400 });
    }

    const db = getDb();
    const placeholders = body.ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...body.ids);

    return NextResponse.json({ success: true, deleted: result.changes });
  } catch (error: unknown) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Bulk-Löschen fehlgeschlagen' }, { status: 500 });
  }
}
