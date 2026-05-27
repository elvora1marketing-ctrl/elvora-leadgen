import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const db = getDb();

  const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get() as { value: string } | undefined)?.value || 'RE-';
  const dueDays = Number((db.prepare("SELECT value FROM settings WHERE key = 'invoice_default_due_days'").get() as { value: string } | undefined)?.value || '14');

  const dueInvoices = db.prepare(`
    SELECT * FROM invoices
    WHERE is_recurring = 1
      AND next_recurring_date <= date('now')
      AND status != 'cancelled'
  `).all() as Record<string, unknown>[];

  let generated = 0;
  const errors: string[] = [];

  for (const inv of dueInvoices) {
    try {
      const lastNumber = (db.prepare("SELECT MAX(CAST(REPLACE(invoice_number, ?, '') AS INTEGER)) as num FROM invoices").get(prefix) as { num: number | null })?.num || 0;
      const newNumber = `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
      const newToken = crypto.randomBytes(16).toString('hex');
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      db.prepare(`
        INSERT INTO invoices (
          invoice_number, token, client_id, account_id, items, subtotal, tax_rate, tax_amount, total,
          status, due_date, notes, is_recurring, recurring_interval, next_recurring_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 0, NULL, NULL, datetime('now'))
      `).run(
        newNumber,
        newToken,
        inv.client_id,
        inv.account_id,
        inv.items,
        inv.subtotal,
        inv.tax_rate,
        inv.tax_amount,
        inv.total,
        dueDate.toISOString().split('T')[0],
        inv.notes,
      );

      const interval = inv.recurring_interval as string;
      let nextDate = new Date(inv.next_recurring_date as string);
      if (interval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (interval === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      else if (interval === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

      db.prepare('UPDATE invoices SET next_recurring_date = ? WHERE id = ?').run(
        nextDate.toISOString().split('T')[0],
        inv.id,
      );

      generated++;
    } catch (e) {
      errors.push(`Invoice ${inv.id}: ${e instanceof Error ? e.message : 'Fehler'}`);
    }
  }

  return NextResponse.json({
    generated,
    checked: dueInvoices.length,
    errors: errors.length ? errors : undefined,
  });
}
