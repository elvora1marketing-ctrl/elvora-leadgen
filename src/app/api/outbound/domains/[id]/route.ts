import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const domainId = parseInt(id);
    if (isNaN(domainId)) {
      return NextResponse.json({ error: 'Ungültige Domain-ID' }, { status: 400 });
    }

    const db = getDb();
    const domain = db.prepare('SELECT * FROM sending_domains WHERE id = ?').get(domainId);
    if (!domain) {
      return NextResponse.json({ error: 'Domain nicht gefunden' }, { status: 404 });
    }

    const inboxes = db.prepare('SELECT * FROM sending_inboxes WHERE domain_id = ? ORDER BY created_at DESC').all(domainId);

    return NextResponse.json({ domain, inboxes });
  } catch (error) {
    console.error('Domain detail error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Domain' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const domainId = parseInt(id);
    if (isNaN(domainId)) {
      return NextResponse.json({ error: 'Ungültige Domain-ID' }, { status: 400 });
    }

    const db = getDb();
    const body = await request.json();

    const domain = db.prepare('SELECT * FROM sending_domains WHERE id = ?').get(domainId);
    if (!domain) {
      return NextResponse.json({ error: 'Domain nicht gefunden' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
    if (body.daily_limit !== undefined) { updates.push('daily_limit = ?'); values.push(body.daily_limit); }
    if (body.dns_status !== undefined) { updates.push('dns_status = ?'); values.push(body.dns_status); }
    if (body.notes !== undefined) { updates.push('notes = ?'); values.push(body.notes); }
    if (body.resend_domain_id !== undefined) { updates.push('resend_domain_id = ?'); values.push(body.resend_domain_id); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(domainId);

    db.prepare(`UPDATE sending_domains SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Domain update error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Domain' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const domainId = parseInt(id);
    if (isNaN(domainId)) {
      return NextResponse.json({ error: 'Ungültige Domain-ID' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM sending_domains WHERE id = ?').run(domainId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Domain delete error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen der Domain' }, { status: 500 });
  }
}
