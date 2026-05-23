import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/leads/[id]/reply
 * Send a direct reply email to a lead from the conversation thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 });
    }

    const { subject, body } = await request.json() as { subject: string; body: string };

    if (!body?.trim()) {
      return NextResponse.json({ error: 'Nachricht darf nicht leer sein' }, { status: 400 });
    }

    const db = getDb();

    // Get lead
    const lead = db.prepare('SELECT id, name, email FROM leads WHERE id = ?').get(leadId) as {
      id: number; name: string; email: string;
    } | undefined;

    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    if (!lead.email) return NextResponse.json({ error: 'Lead hat keine E-Mail' }, { status: 400 });

    // Get email settings
    const settingKeys = ['resend_api_key', 'email_from_name', 'email_from_email'];
    const settings: Record<string, string> = {};
    for (const key of settingKeys) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row) settings[key] = row.value;
    }

    if (!settings.resend_api_key) {
      return NextResponse.json({ error: 'Resend nicht konfiguriert' }, { status: 422 });
    }

    const fromName = settings.email_from_name || 'Luan von Elvora';
    const fromEmail = settings.email_from_email || 'luan@elvora.me';
    const emailSubject = subject || `Re: ${lead.name}`;

    // Build simple reply HTML
    const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:32px;">
      ${body.split('\n').map(p => `<p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 12px 0;">${p || '&nbsp;'}</p>`).join('\n')}
      <p style="color:#64748b;font-size:13px;margin:24px 0 0 0;">
        ${fromName}<br>Elvora
      </p>
    </div>
  </div>
</body>
</html>`;

    // Create tracking pixel
    const trackingId = crypto.randomUUID();
    db.prepare('INSERT INTO email_tracking (lead_id, tracking_id) VALUES (?, ?)').run(leadId, trackingId);
    const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;" alt="" />`;
    const htmlWithTracking = html.replace('</body>', `${trackingPixel}</body>`);

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [lead.email],
        subject: emailSubject,
        html: htmlWithTracking,
        text: `${body}\n\n${fromName}\nElvora`,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({ error: `Senden fehlgeschlagen: ${(errData as { message?: string }).message || 'Unbekannt'}` }, { status: 500 });
    }

    // Log activity
    db.prepare(
      "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
    ).run(
      leadId,
      `Antwort gesendet: "${emailSubject}"`,
      JSON.stringify({ direction: 'outbound', tracking_id: trackingId, subject: emailSubject }),
    );

    return NextResponse.json({ success: true, message: `Antwort an ${lead.email} gesendet` });
  } catch (error) {
    console.error('Reply error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
