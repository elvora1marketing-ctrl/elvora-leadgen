import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ensureDailyReset } from '@/lib/outbound';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    ensureDailyReset(db);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const domains = db.prepare(`
      SELECT d.*, COUNT(i.id) as inbox_count
      FROM sending_domains d
      LEFT JOIN sending_inboxes i ON d.id = i.domain_id
      ${accountId ? 'WHERE d.account_id = ?' : ''}
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `).all(...(accountId ? [accountId] : []));

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('Domains list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Domains' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json();

    if (!body.domain || !body.domain.trim()) {
      return NextResponse.json({ error: 'Domain darf nicht leer sein' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    const result = db.prepare(`
      INSERT INTO sending_domains (domain, status, daily_limit, warm_start_date, warm_current_day, resend_domain_id, notes, account_id)
      VALUES (?, 'warming', ?, ?, 1, ?, ?, ?)
    `).run(
      body.domain.trim(),
      body.daily_limit ?? 50,
      today,
      body.resend_domain_id ?? null,
      body.notes ?? null,
      body.account_id ?? null,
    );

    const domain = db.prepare('SELECT * FROM sending_domains WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ success: true, domain });
  } catch (error) {
    console.error('Domain create error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen der Domain' }, { status: 500 });
  }
}
