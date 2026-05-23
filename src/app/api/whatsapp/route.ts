import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * WhatsApp-Nachricht senden via OpenClaw Gateway
 *
 * POST /api/whatsapp
 * Body: { lead_id, message } oder { phone, message }
 *
 * Benötigt: openclaw_url und openclaw_api_key in settings
 */

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as {
      lead_id?: number;
      phone?: string;
      message?: string;
      template?: 'pitch' | 'followup' | 'reminder';
    };

    // Get OpenClaw settings
    const openclawUrlRow = db.prepare("SELECT value FROM settings WHERE key = 'openclaw_url'").get() as { value: string } | undefined;
    const openclawKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'openclaw_api_key'").get() as { value: string } | undefined;

    if (!openclawUrlRow?.value) {
      return NextResponse.json({ error: 'OpenClaw URL nicht konfiguriert. Unter Einstellungen hinterlegen.' }, { status: 400 });
    }

    let phone = body.phone;
    let leadName = '';
    let leadId = body.lead_id;

    // Get lead data if lead_id provided
    if (body.lead_id) {
      const lead = db.prepare(`
        SELECT id, name, phone, phone_normalized, city, website_original, score, problems
        FROM leads WHERE id = ?
      `).get(body.lead_id) as {
        id: number; name: string; phone: string; phone_normalized: string;
        city: string; website_original: string; score: number; problems: string;
      } | undefined;

      if (!lead) {
        return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
      }

      phone = lead.phone_normalized || lead.phone;
      leadName = lead.name;
      leadId = lead.id;

      // Generate message from template if not provided
      if (!body.message && body.template) {
        const fromNameRow = db.prepare("SELECT value FROM settings WHERE key = 'email_from_name'").get() as { value: string } | undefined;
        const senderName = fromNameRow?.value || 'Elvora';

        let problems = [];
        try { problems = JSON.parse(lead.problems || '[]'); } catch { /* skip */ }
        const topProblem = problems[0]?.label || 'veraltete Website';

        switch (body.template) {
          case 'pitch':
            body.message = `Hallo! Hier ist ${senderName}. Ich habe mir die Website von ${lead.name} angeschaut und ein paar Sachen gefunden, die Sie vermutlich Kunden kosten – z.B. ${topProblem}. Hätten Sie kurz 5 Minuten Zeit für ein Gespräch? Ich zeige Ihnen gerne, wie wir das schnell lösen können. 🙂`;
            break;
          case 'followup':
            body.message = `Hallo nochmal! Ich hatte Ihnen letzte Woche bezüglich ${lead.name} geschrieben. Wollte kurz nachfragen, ob Sie sich die Analyse anschauen konnten? Falls Sie Fragen haben, bin ich gerne erreichbar. Viele Grüße, ${senderName}`;
            break;
          case 'reminder':
            body.message = `Hi! Letzte Erinnerung von mir – wir hatten wegen der Website von ${lead.name} geschrieben. Falls Sie Interesse haben, melden Sie sich einfach. Kein Stress! 👋 ${senderName}`;
            break;
        }
      }
    }

    if (!phone) {
      return NextResponse.json({ error: 'Keine Telefonnummer vorhanden' }, { status: 400 });
    }

    if (!body.message) {
      return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });
    }

    // Normalize phone number for WhatsApp
    let waPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (waPhone.startsWith('0')) {
      waPhone = '49' + waPhone.slice(1);
    }
    if (waPhone.startsWith('+')) {
      waPhone = waPhone.slice(1);
    }

    // Send via OpenClaw
    const openclawUrl = openclawUrlRow.value.replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (openclawKeyRow?.value) {
      headers['Authorization'] = `Bearer ${openclawKeyRow.value}`;
    }

    const waRes = await fetch(`${openclawUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: waPhone,
        message: body.message,
        lead_id: leadId,
      }),
    });

    if (!waRes.ok) {
      const errData = await waRes.json().catch(() => ({ error: 'OpenClaw nicht erreichbar' }));
      return NextResponse.json({ error: errData.error || 'WhatsApp-Versand fehlgeschlagen' }, { status: 502 });
    }

    // Log activity
    if (leadId) {
      db.prepare(`
        INSERT INTO lead_activities (lead_id, type, content, metadata, created_at)
        VALUES (?, 'whatsapp', ?, '{}', datetime('now'))
      `).run(leadId, `WhatsApp an ${waPhone}: ${body.message.substring(0, 100)}...`);
    }

    return NextResponse.json({
      ok: true,
      phone: waPhone,
      leadName: leadName || undefined,
    });
  } catch (error) {
    console.error('WhatsApp error:', error);
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
  }
}
