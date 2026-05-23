import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id, tagId } = await params;
    const leadId = parseInt(id);
    const tId = parseInt(tagId);

    if (isNaN(leadId) || isNaN(tId)) {
      return NextResponse.json({ error: 'Ungültige IDs' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?').run(leadId, tId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
