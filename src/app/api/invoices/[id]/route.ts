import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest,
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
    const invoice = db.prepare(`
      SELECT i.*, c.company_name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
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
    const invoiceId = parseInt(id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Ungültige Rechnungs-ID' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    const body = await request.json() as {
      items?: { description: string; quantity: number; unit_price: number }[];
      status?: string;
      notes?: string;
      recipient_name?: string;
      recipient_address?: string;
      recipient_email?: string;
      due_date?: string;
      paid_at?: string;
      paid_amount?: number;
      payment_method?: string;
      tax_rate?: number;
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    // Simple string/number fields
    if (body.recipient_name !== undefined) {
      updates.push('recipient_name = ?');
      values.push(body.recipient_name.trim());
    }
    if (body.recipient_address !== undefined) {
      updates.push('recipient_address = ?');
      values.push(body.recipient_address?.trim() || null);
    }
    if (body.recipient_email !== undefined) {
      updates.push('recipient_email = ?');
      values.push(body.recipient_email?.trim() || null);
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes?.trim() || null);
    }
    if (body.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(body.due_date || null);
    }
    if (body.paid_at !== undefined) {
      updates.push('paid_at = ?');
      values.push(body.paid_at || null);
    }
    if (body.paid_amount !== undefined) {
      updates.push('paid_amount = ?');
      values.push(body.paid_amount);
    }
    if (body.payment_method !== undefined) {
      updates.push('payment_method = ?');
      values.push(body.payment_method || null);
    }
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'];
      if (validStatuses.includes(body.status)) {
        updates.push('status = ?');
        values.push(body.status);
      }
    }

    // Recalculate totals if items or tax_rate changed
    if (body.items !== undefined) {
      updates.push('items = ?');
      values.push(JSON.stringify(body.items));

      const taxRate = body.tax_rate !== undefined ? body.tax_rate : (existing.tax_rate as number);
      const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const taxAmount = Math.round(subtotal * taxRate) / 100;
      const total = subtotal + taxAmount;

      updates.push('subtotal = ?');
      values.push(subtotal);
      updates.push('tax_rate = ?');
      values.push(taxRate);
      updates.push('tax_amount = ?');
      values.push(taxAmount);
      updates.push('total = ?');
      values.push(total);
    } else if (body.tax_rate !== undefined) {
      const subtotal = existing.subtotal as number;
      const taxAmount = Math.round(subtotal * body.tax_rate) / 100;
      const total = subtotal + taxAmount;

      updates.push('tax_rate = ?');
      values.push(body.tax_rate);
      updates.push('tax_amount = ?');
      values.push(taxAmount);
      updates.push('total = ?');
      values.push(total);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
    }

    values.push(invoiceId);
    db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    return NextResponse.json({ success: true, invoice });
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
    const invoiceId = parseInt(id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Ungültige Rechnungs-ID' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Nur Entwürfe können gelöscht werden' }, { status: 400 });
    }

    db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
