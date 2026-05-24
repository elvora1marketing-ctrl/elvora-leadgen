import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/utils';
import { logAudit } from '@/lib/audit';

function isHttps(request: NextRequest): boolean {
  if (request.url.startsWith('https://')) return true;
  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto.split(',')[0].trim() === 'https') return true;
  return false;
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unbekanntes Gerät';
  let browser = 'Browser';
  let os = '';
  if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  return os ? `${browser} auf ${os}` : browser;
}

function setCookieOpts(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge };
}

// POST /api/auth – Login
export async function POST(request: NextRequest) {
  try {
    const { password, action } = await request.json() as { password?: string; action?: string };
    const useSecure = isHttps(request);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Logout
    if (action === 'logout') {
      logAudit('logout', {}, undefined, undefined, ip);
      const res = NextResponse.json({ ok: true });
      res.cookies.set('elvora_session', '', setCookieOpts(useSecure, 0));
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

      const token = crypto.randomUUID();
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('session_token', ?, datetime('now'))").run(token);

      // Trust first device automatically
      const deviceToken = crypto.randomUUID();
      const deviceName = parseUserAgent(request.headers.get('user-agent') || '');
      db.prepare("INSERT INTO trusted_devices (device_token, device_name, ip_address) VALUES (?, ?, ?)").run(deviceToken, deviceName, ip);

      const res = NextResponse.json({ ok: true });
      res.cookies.set('elvora_session', token, setCookieOpts(useSecure, 60 * 60 * 24 * 30));
      res.cookies.set('elvora_device', deviceToken, setCookieOpts(useSecure, 60 * 60 * 24 * 365));
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
      logAudit('login_failed', {}, undefined, undefined, ip);
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
    }

    // Check device whitelist
    const whitelistEnabled = (db.prepare("SELECT value FROM settings WHERE key = 'device_whitelist_enabled'").get() as { value: string } | undefined)?.value === '1';
    const existingDeviceCookie = request.cookies.get('elvora_device')?.value;

    if (whitelistEnabled) {
      if (!existingDeviceCookie) {
        logAudit('login_blocked_unknown_device', { ip }, undefined, undefined, ip);
        return NextResponse.json({ error: 'Dieses Gerät ist nicht autorisiert. Aktiviere es über ein bereits vertrauenswürdiges Gerät in den Einstellungen.' }, { status: 403 });
      }
      const trusted = db.prepare("SELECT id FROM trusted_devices WHERE device_token = ?").get(existingDeviceCookie) as { id: number } | undefined;
      if (!trusted) {
        logAudit('login_blocked_unknown_device', { ip }, undefined, undefined, ip);
        return NextResponse.json({ error: 'Dieses Gerät ist nicht autorisiert. Aktiviere es über ein bereits vertrauenswürdiges Gerät in den Einstellungen.' }, { status: 403 });
      }
      db.prepare("UPDATE trusted_devices SET last_used_at = datetime('now'), ip_address = ? WHERE id = ?").run(ip, trusted.id);
    }

    logAudit('login', {}, undefined, undefined, ip);

    // Create session
    const token = crypto.randomUUID();
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('session_token', ?, datetime('now'))").run(token);

    const res = NextResponse.json({ ok: true });
    res.cookies.set('elvora_session', token, setCookieOpts(useSecure, 60 * 60 * 24 * 30));

    // If device not yet trusted (whitelist off or new login), trust it
    if (existingDeviceCookie) {
      const exists = db.prepare("SELECT id FROM trusted_devices WHERE device_token = ?").get(existingDeviceCookie);
      if (exists) {
        db.prepare("UPDATE trusted_devices SET last_used_at = datetime('now'), ip_address = ? WHERE device_token = ?").run(ip, existingDeviceCookie);
      } else {
        const deviceName = parseUserAgent(request.headers.get('user-agent') || '');
        db.prepare("INSERT INTO trusted_devices (device_token, device_name, ip_address) VALUES (?, ?, ?)").run(existingDeviceCookie, deviceName, ip);
      }
    } else {
      const deviceToken = crypto.randomUUID();
      const deviceName = parseUserAgent(request.headers.get('user-agent') || '');
      db.prepare("INSERT INTO trusted_devices (device_token, device_name, ip_address) VALUES (?, ?, ?)").run(deviceToken, deviceName, ip);
      res.cookies.set('elvora_device', deviceToken, setCookieOpts(useSecure, 60 * 60 * 24 * 365));
    }

    return res;
  } catch {
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}

// GET /api/auth – Check session
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    const pwRow = db.prepare("SELECT value FROM settings WHERE key = 'panel_password'").get() as { value: string } | undefined;
    if (!pwRow?.value) {
      return NextResponse.json({ authenticated: false, needsSetup: true });
    }

    const sessionCookie = request.cookies.get('elvora_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false });
    }

    const row = db.prepare("SELECT value FROM settings WHERE key = 'session_token'").get() as { value: string } | undefined;
    if (!row?.value) {
      return NextResponse.json({ authenticated: false });
    }

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
