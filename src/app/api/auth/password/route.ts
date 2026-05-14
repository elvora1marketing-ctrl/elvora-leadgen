import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { hashPassword } from '@/lib/utils';

function isHttps(request: NextRequest): boolean {
  if (request.url.startsWith('https://')) return true;
  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto.split(',')[0].trim() === 'https') return true;
  return false;
}

// POST /api/auth/password – Change password (requires valid session)
export async function POST(request: NextRequest) {
  try {
    const db = getDb();

    // Verify session first
    const sessionCookie = request.cookies.get('elvora_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const sessionRow = db.prepare("SELECT value FROM settings WHERE key = 'session_token'").get() as { value: string } | undefined;
    if (!sessionRow?.value || sessionCookie !== sessionRow.value) {
      return NextResponse.json({ error: 'Ungültige Sitzung' }, { status: 401 });
    }

    const { newPassword } = await request.json() as { newPassword: string };

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 });
    }

    // Hash and store new password
    const { hash, salt } = hashPassword(newPassword);
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('panel_password', ?, datetime('now'))").run(`${salt}:${hash}`);

    // Refresh session token
    const newToken = crypto.randomUUID();
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('session_token', ?, datetime('now'))").run(newToken);

    const res = NextResponse.json({ ok: true });
    res.cookies.set('elvora_session', newToken, {
      httpOnly: true,
      secure: isHttps(request),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}
