import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const subs = db.prepare('SELECT * FROM webhook_subscriptions ORDER BY created_at DESC').all();
  return NextResponse.json({ webhooks: subs });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const body = await request.json();
  const { url, events, account_id } = body as { url: string; events?: string[]; account_id?: number };

  if (!url?.trim()) {
    return NextResponse.json({ error: 'URL erforderlich' }, { status: 400 });
  }

  const secret = crypto.randomBytes(32).toString('hex');

  const result = db.prepare(`
    INSERT INTO webhook_subscriptions (url, events, secret, account_id)
    VALUES (?, ?, ?, ?)
  `).run(url.trim(), JSON.stringify(events || ['*']), secret, account_id || null);

  const webhook = db.prepare('SELECT * FROM webhook_subscriptions WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(webhook, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 });

  db.prepare('DELETE FROM webhook_subscriptions WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const body = await request.json();
  const { id, active, url, events } = body;

  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
  if (url !== undefined) { updates.push('url = ?'); values.push(url); }
  if (events !== undefined) { updates.push('events = ?'); values.push(JSON.stringify(events)); }

  if (updates.length === 0) return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });

  values.push(id);
  db.prepare(`UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const webhook = db.prepare('SELECT * FROM webhook_subscriptions WHERE id = ?').get(id);
  return NextResponse.json(webhook);
}
