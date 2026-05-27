import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const entries = db.prepare('SELECT * FROM email_blacklist ORDER BY created_at DESC').all();
    const count = (db.prepare('SELECT COUNT(*) as c FROM email_blacklist').get() as { c: number }).c;
    return NextResponse.json({ entries, count });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as { email?: string; emails?: string[]; reason?: string };

    const emails = body.emails || (body.email ? [body.email] : []);
    if (emails.length === 0) return NextResponse.json({ error: 'Keine Email angegeben' }, { status: 400 });

    const reason = body.reason || 'manual';
    const insert = db.prepare('INSERT OR IGNORE INTO email_blacklist (email, reason) VALUES (?, ?)');
    let added = 0;
    const tx = db.transaction(() => {
      for (const email of emails) {
        const trimmed = email.trim().toLowerCase();
        if (trimmed && trimmed.includes('@')) {
          const r = insert.run(trimmed, reason);
          if (r.changes > 0) added++;
        }
      }
    });
    tx();

    return NextResponse.json({ success: true, added });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as { id?: number; email?: string };

    if (body.id) {
      db.prepare('DELETE FROM email_blacklist WHERE id = ?').run(body.id);
    } else if (body.email) {
      db.prepare('DELETE FROM email_blacklist WHERE email = ?').run(body.email.toLowerCase().trim());
    } else {
      return NextResponse.json({ error: 'ID oder Email erforderlich' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
