import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { timingSafeEqual } from '@/lib/utils';

/**
 * Validates API key from Authorization header or x-api-key header,
 * OR a valid session cookie (elvora_session).
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  // 1. Check session cookie first (frontend calls)
  const sessionCookie = request.cookies.get('elvora_session')?.value;
  if (sessionCookie) {
    const db = getDb();
    const sessionRow = db.prepare("SELECT value FROM settings WHERE key = 'session_token'").get() as { value: string } | undefined;
    if (sessionRow?.value && sessionCookie.length === sessionRow.value.length && timingSafeEqual(sessionCookie, sessionRow.value)) {
      return null; // Valid session
    }
  }

  // 2. Check API key (external API calls)
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (apiKeyHeader) {
    token = apiKeyHeader;
  }

  if (!token) {
    return NextResponse.json(
      { error: 'API-Key fehlt. Authorization: Bearer <key> oder x-api-key Header setzen.' },
      { status: 401 }
    );
  }

  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'api_key'").get() as { value: string } | undefined;

  if (!row || !row.value) {
    return NextResponse.json(
      { error: 'API-Key nicht konfiguriert. Bitte unter Einstellungen hinterlegen.' },
      { status: 503 }
    );
  }

  // Constant-time comparison to prevent timing attacks
  const expected = row.value;
  if (token.length !== expected.length || !timingSafeEqual(token, expected)) {
    return NextResponse.json({ error: 'Ungültiger API-Key' }, { status: 403 });
  }

  return null;
}
