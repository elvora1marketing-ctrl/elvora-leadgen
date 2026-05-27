import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const entries = db.prepare('SELECT * FROM account_blacklists WHERE account_id = ? ORDER BY created_at DESC').all(params.id);
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const body = await request.json();
  const { emails, reason } = body as { emails: string[]; reason?: string };

  if (!emails?.length) {
    return NextResponse.json({ error: 'E-Mails erforderlich' }, { status: 400 });
  }

  let added = 0;
  let skipped = 0;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO account_blacklists (account_id, email, domain, reason)
    VALUES (?, ?, ?, ?)
  `);

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;
    const domain = trimmed.includes('@') ? trimmed.split('@')[1] : null;
    const result = insert.run(params.id, trimmed, domain, reason || null);
    if (result.changes > 0) added++;
    else skipped++;
  }

  return NextResponse.json({ added, skipped });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'E-Mail Parameter erforderlich' }, { status: 400 });
  }

  db.prepare('DELETE FROM account_blacklists WHERE account_id = ? AND email = ?').run(params.id, email.toLowerCase());
  return NextResponse.json({ success: true });
}
