import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

/**
 * Validates API key from Authorization header or x-api-key header.
 * API key is stored in settings table as 'api_key'.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
