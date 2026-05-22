import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token erforderlich' }, { status: 400 });
    }

    const db = getDb();
    const invoice = db.prepare('SELECT * FROM invoices WHERE token = ?').get(token) as Record<string, unknown> | undefined;
    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    // Increment views
    db.prepare('UPDATE invoices SET views = views + 1 WHERE token = ?').run(token);

    // Fetch agency settings
    const agencyKeys = [
      'agency_name', 'agency_address', 'agency_phone', 'agency_email',
      'agency_tax_id', 'agency_bank_iban', 'agency_bank_bic', 'agency_bank_name',
    ];
    const placeholders = agencyKeys.map(() => '?').join(',');
    const settingsRows = db.prepare(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`
    ).all(...agencyKeys) as { key: string; value: string }[];

    const agency: Record<string, string> = {};
    for (const row of settingsRows) {
      agency[row.key] = row.value;
    }

    return NextResponse.json({
      invoice: { ...invoice, views: (invoice.views as number) + 1 },
      agency,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
