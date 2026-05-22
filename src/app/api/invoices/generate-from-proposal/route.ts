import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const { proposal_id } = await request.json() as { proposal_id: number };

    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 });
    }

    const proposal = db.prepare(`
      SELECT p.*, l.name as lead_name, l.email as lead_email, l.city as lead_city
      FROM proposals p
      LEFT JOIN leads l ON p.lead_id = l.id
      WHERE p.id = ?
    `).get(proposal_id) as {
      id: number; lead_id: number; title: string; amount: number;
      services: string; lead_name: string; lead_email: string; lead_city: string;
    } | undefined;

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('invoice_prefix', 'invoice_next_number', 'invoice_default_due_days')").all() as { key: string; value: string }[];
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    const prefix = settingsMap.invoice_prefix || 'RE-';
    const nextNum = parseInt(settingsMap.invoice_next_number || '1001');
    const dueDays = parseInt(settingsMap.invoice_default_due_days || '14');

    const invoiceNumber = `${prefix}${nextNum}`;
    const token = crypto.randomUUID();
    const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().split('T')[0];

    let items: Array<{ description: string; quantity: number; unit_price: number; total: number }> = [];
    try {
      const services = JSON.parse(proposal.services || '[]');
      if (Array.isArray(services) && services.length > 0) {
        items = services.map((s: { name?: string; description?: string; price?: number }) => ({
          description: s.name || s.description || 'Dienstleistung',
          quantity: 1,
          unit_price: s.price || 0,
          total: s.price || 0,
        }));
      }
    } catch { /* ignore parse errors */ }

    if (items.length === 0 && proposal.amount) {
      items = [{ description: proposal.title || 'Dienstleistung', quantity: 1, unit_price: proposal.amount, total: proposal.amount }];
    }

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxRate = 19;
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, token, lead_id, proposal_id, recipient_name, recipient_email, items, subtotal, tax_rate, tax_amount, total, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceNumber, token, proposal.lead_id, proposal.id,
      proposal.lead_name || 'Unbekannt', proposal.lead_email,
      JSON.stringify(items), subtotal, taxRate, taxAmount, total, dueDate
    );

    db.prepare("UPDATE settings SET value = ? WHERE key = 'invoice_next_number'").run(String(nextNum + 1));

    return NextResponse.json({
      id: result.lastInsertRowid,
      invoice_number: invoiceNumber,
      token,
      total,
    });
  } catch (error: unknown) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({ error: 'Generierung fehlgeschlagen' }, { status: 500 });
  }
}
