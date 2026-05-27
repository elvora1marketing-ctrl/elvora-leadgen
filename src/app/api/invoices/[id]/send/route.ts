import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const invoiceId = parseInt(id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Ungültige Rechnungs-ID' }, { status: 400 });
    }

    const db = getDb();
    const invoice = db.prepare('SELECT id, token, status FROM invoices WHERE id = ?').get(invoiceId) as { id: number; token: string; status: string } | undefined;
    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    db.prepare(`
      UPDATE invoices SET status = 'sent', sent_at = datetime('now') WHERE id = ?
    `).run(invoiceId);

    const publicUrl = `/invoice/${invoice.token}`;

    return NextResponse.json({
      success: true,
      public_url: publicUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
