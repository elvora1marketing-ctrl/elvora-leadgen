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
  const proposals = getDb().prepare('SELECT * FROM proposals WHERE lead_id = ? ORDER BY created_at DESC').all(leadId);
  return NextResponse.json({ proposals });
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
      title: string; amount?: number; status?: string; notes?: string; file_url?: string;
    };
    if (!body.title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 });
    const validStatus = ['draft', 'sent', 'viewed', 'accepted', 'rejected'];
    const status = body.status && validStatus.includes(body.status) ? body.status : 'draft';

    const result = getDb().prepare(`
      INSERT INTO proposals (lead_id, title, amount, status, notes, file_url, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(leadId, body.title.trim(), body.amount || null, status, body.notes || null, body.file_url || null, status === 'sent' ? new Date().toISOString() : null);

    const proposal = getDb().prepare('SELECT * FROM proposals WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, proposal }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
