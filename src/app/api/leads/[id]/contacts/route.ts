import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  const db = getDb();
  const contacts = db.prepare(`
    SELECT * FROM contacts WHERE lead_id = ? ORDER BY is_primary DESC, name ASC
  `).all(leadId);
  return NextResponse.json({ contacts });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json() as {
      name: string; role?: string; email?: string; phone?: string; is_primary?: boolean; notes?: string;
    };
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 });

    const db = getDb();
    if (body.is_primary) {
      db.prepare('UPDATE contacts SET is_primary = 0 WHERE lead_id = ?').run(leadId);
    }
    const result = db.prepare(`
      INSERT INTO contacts (lead_id, name, role, email, phone, is_primary, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(leadId, body.name.trim(), body.role || null, body.email || null, body.phone || null, body.is_primary ? 1 : 0, body.notes || null);

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, contact }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
