import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const invoiceId = parseInt(id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Ungültige Rechnungs-ID' }, { status: 400 });
    }

    const db = getDb();
    const invoice = db.prepare('SELECT id, total FROM invoices WHERE id = ?').get(invoiceId) as { id: number; total: number } | undefined;
    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as {
      paid_amount?: number;
      payment_method?: string;
    };

    const paidAmount = body.paid_amount !== undefined ? body.paid_amount : invoice.total;
    const paymentMethod = body.payment_method || null;

    db.prepare(`
      UPDATE invoices
      SET status = 'paid', paid_at = datetime('now'), paid_amount = ?, payment_method = ?
      WHERE id = ?
    `).run(paidAmount, paymentMethod, invoiceId);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
