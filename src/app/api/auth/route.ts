import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/utils';

// POST /api/auth – Login
export async function POST(request: NextRequest) {
  try {
    const { password, action } = await request.json() as { password?: string; action?: string };

    // Logout
    if (action === 'logout') {
      const res = NextResponse.json({ ok: true });
      res.cookies.set('elvora_session', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return res;
    }

    // Setup – set initial password
    if (action === 'setup' && password) {
      const db = getDb();
      const existing = db.prepare("SELECT value FROM settings WHERE key = 'panel_password'").get() as { value: string } | undefined;
      if (existing?.value) {
        return NextResponse.json({ error: 'Passwort ist bereits gesetzt. Nutze Einstellungen zum Ändern.' }, { status: 400 });
      }
      const { hash, salt } = hashPassword(password);
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('panel_password', ?, datetime('now'))").run(`${salt}:${hash}`);
      // Auto-login after setup
      const token = crypto.randomUUID();
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('session_token', ?, datetime('now'))").run(token);
      const res = NextResponse.json({ ok: true });
      res.cookies.set('elvora_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 Tage
      });
      return res;
    }

    // Login
    if (!password) {
      return NextResponse.json({ error: 'Passwort fehlt' }, { status: 400 });
    }

    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'panel_password'").get() as { value: string } | undefined;

    if (!row?.value) {
      return NextResponse.json({ error: 'no_password_set', needsSetup: true }, { status: 401 });
    }

    if (!verifyPassword(password, row.value)) {
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
    }

    // Create session
    const token = crypto.randomUUID();
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('session_token', ?, datetime('now'))").run(token);

    const res = NextResponse.json({ ok: true });
    res.cookies.set('elvora_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}

// GET /api/auth – Check session
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Check if password is set at all
    const pwRow = db.prepare("SELECT value FROM settings WHERE key = 'panel_password'").get() as { value: string } | undefined;
    if (!pwRow?.value) {
      return NextResponse.json({ authenticated: false, needsSetup: true });
    }

    // Check session cookie
    const sessionCookie = request.cookies.get('elvora_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false });
    }

    const row = db.prepare("SELECT value FROM settings WHERE key = 'session_token'").get() as { value: string } | undefined;
    if (!row?.value) {
      return NextResponse.json({ authenticated: false });
    }

    // Constant-time comparison
    const a = sessionCookie;
    const b = row.value;
    if (a.length !== b.length) {
      return NextResponse.json({ authenticated: false });
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return NextResponse.json({ authenticated: result === 0 });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
