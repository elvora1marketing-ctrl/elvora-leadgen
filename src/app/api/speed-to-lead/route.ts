import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendEmail } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? '';
}

// POST { action: 'test' } — sends a sample notification on the configured channels
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'test') {
      return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
    }

    const results: { channel: string; ok: boolean; reason?: string }[] = [];

    if (getSetting('speedlead_email_enabled') === '1') {
      const email = getSetting('speedlead_email');
      if (!email) {
        results.push({ channel: 'email', ok: false, reason: 'Keine E-Mail-Adresse hinterlegt' });
      } else {
        const html = `
          <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#8B5CF6,#EC4899);padding:24px;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;font-size:18px;margin:0;">🔔 Test — Speed-to-Lead</h1>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;color:#334155;font-size:14px;">
              <p>So sieht eine echte Lead-Benachrichtigung aus:</p>
              <p>Name: Max Mustermann<br>E-Mail: max@beispiel.de<br>Telefon: 0151 23456789</p>
            </div>
          </div>`;
        const ok = await sendEmail(email, '🔔 Test — Speed-to-Lead Benachrichtigung', html);
        results.push({ channel: 'email', ok, reason: ok ? undefined : 'Versand fehlgeschlagen (Resend prüfen)' });
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'Kein Kanal aktiviert. Aktiviere WhatsApp oder E-Mail und speichere zuerst.' }, { status: 400 });
    }

    const anyOk = results.some((r) => r.ok);
    return NextResponse.json({ success: anyOk, results });
  } catch (error) {
    console.error('[speed-to-lead] test error:', error);
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}
