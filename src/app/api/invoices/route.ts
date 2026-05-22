import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('client_id');
    const year = searchParams.get('year');

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('i.status = ?');
      params.push(status);
    }
    if (clientId) {
      conditions.push('i.client_id = ?');
      params.push(parseInt(clientId));
    }
    if (year) {
      conditions.push("strftime('%Y', i.created_at) = ?");
      params.push(year);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const invoices = db.prepare(`
      SELECT i.*, c.company_name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ${where}
      ORDER BY i.created_at DESC
    `).all(...params);

    return NextResponse.json({ invoices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json() as {
      recipient_name: string;
      recipient_address?: string;
      recipient_email?: string;
      lead_id?: number;
      client_id?: number;
      proposal_id?: number;
      items: { description: string; quantity: number; unit_price: number }[];
      tax_rate?: number;
      notes?: string;
      is_recurring?: boolean;
      recurring_interval?: string;
      due_days?: number;
    };

    if (!body.recipient_name?.trim()) {
      return NextResponse.json({ error: 'Empfängername erforderlich' }, { status: 400 });
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Mindestens eine Position erforderlich' }, { status: 400 });
    }

    // Get settings for invoice number generation
    const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get() as { value: string } | undefined;
    const nextNumRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_next_number'").get() as { value: string } | undefined;
    const defaultDueDaysRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_default_due_days'").get() as { value: string } | undefined;

    const prefix = prefixRow?.value || 'RE-';
    const nextNumber = parseInt(nextNumRow?.value || '1001');
    const defaultDueDays = parseInt(defaultDueDaysRow?.value || '14');

    const invoiceNumber = `${prefix}${nextNumber}`;
    const token = crypto.randomUUID();

    // Calculate totals
    const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const taxRate = body.tax_rate !== undefined ? body.tax_rate : 19;
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    // Calculate due date
    const dueDays = body.due_days !== undefined ? body.due_days : defaultDueDays;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const result = db.prepare(`
      INSERT INTO invoices (
        invoice_number, token, lead_id, client_id, proposal_id,
        recipient_name, recipient_address, recipient_email,
        items, subtotal, tax_rate, tax_amount, total, currency,
        status, due_date, notes, is_recurring, recurring_interval
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', 'draft', ?, ?, ?, ?)
    `).run(
      invoiceNumber,
      token,
      body.lead_id || null,
      body.client_id || null,
      body.proposal_id || null,
      body.recipient_name.trim(),
      body.recipient_address?.trim() || null,
      body.recipient_email?.trim() || null,
      JSON.stringify(body.items),
      subtotal,
      taxRate,
      taxAmount,
      total,
      dueDateStr,
      body.notes?.trim() || null,
      body.is_recurring ? 1 : 0,
      body.recurring_interval || null,
    );

    // Increment next invoice number
    db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'invoice_next_number'")
      .run(String(nextNumber + 1));

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
