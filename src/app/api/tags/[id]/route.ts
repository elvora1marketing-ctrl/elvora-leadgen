import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const tagId = parseInt(id);
    if (isNaN(tagId)) {
      return NextResponse.json({ error: 'Ungültige Tag-ID' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Tag nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
