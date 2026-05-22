import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const conditions: string[] = [];
    const params: any[] = [];

    const year = searchParams.get('year');
    if (year) {
      conditions.push("strftime('%Y', created_at) = ?");
      params.push(year);
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT invoice_number, recipient_name, subtotal, tax_amount, total, status, due_date, paid_at, created_at FROM invoices${where} ORDER BY created_at DESC`).all(...params) as any[];

    const header = ['Rechnungsnr', 'Empfänger', 'Betrag Netto', 'MwSt', 'Betrag Brutto', 'Status', 'Fällig am', 'Bezahlt am', 'Erstellt'];
    const csvRows = [header.join(';')];

    for (const row of rows) {
      csvRows.push([
        csvEscape(row.invoice_number),
        csvEscape(row.recipient_name),
        csvEscape(row.subtotal),
        csvEscape(row.tax_amount),
        csvEscape(row.total),
        csvEscape(row.status),
        csvEscape(formatDate(row.due_date)),
        csvEscape(formatDate(row.paid_at)),
        csvEscape(formatDate(row.created_at)),
      ].join(';'));
    }

    const today = new Date().toISOString().slice(0, 10);
    const csv = '﻿' + csvRows.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoices-export-${today}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
