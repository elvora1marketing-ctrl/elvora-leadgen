import getDb from './db';

const HANDOFF_STATUSES = ['replied', 'meeting', 'won'];

export function checkLeadHandoff(leadId: number, newStatus: string): void {
  if (!HANDOFF_STATUSES.includes(newStatus)) return;

  try {
    const db = getDb();

    const lead = db.prepare(`
      SELECT l.id, l.name, l.email, l.company, l.city, l.contact_status, l.account_id,
             a.contact_email as account_email, a.contact_name as account_contact, a.name as account_name
      FROM leads l
      LEFT JOIN accounts a ON l.account_id = a.id
      WHERE l.id = ?
    `).get(leadId) as {
      id: number; name: string; email: string | null; company: string | null;
      city: string | null; contact_status: string; account_id: number | null;
      account_email: string | null; account_contact: string | null; account_name: string | null;
    } | undefined;

    if (!lead || !lead.account_id || !lead.account_email) return;
    if (lead.contact_status === newStatus) return;

    const resendKey = (db.prepare("SELECT value FROM settings WHERE key = 'resend_api_key'").get() as { value: string } | undefined)?.value;
    const fromEmail = (db.prepare("SELECT value FROM settings WHERE key = 'email_from_email'").get() as { value: string } | undefined)?.value || 'noreply@elvora.me';
    const fromName = (db.prepare("SELECT value FROM settings WHERE key = 'email_from_name'").get() as { value: string } | undefined)?.value || 'Elvora';

    if (!resendKey) return;

    const statusLabels: Record<string, string> = {
      replied: 'hat geantwortet',
      meeting: 'Meeting gebucht',
      won: 'Deal gewonnen',
    };

    const subject = `Lead-Update: ${lead.name} — ${statusLabels[newStatus] || newStatus}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Lead-Übergabe</h2>
        <p>Hallo ${lead.account_contact || 'Team'},</p>
        <p>Ein Lead aus Ihrem Konto <strong>${lead.account_name}</strong> hat einen wichtigen Status erreicht:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${lead.name}</td></tr>
          ${lead.email ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">E-Mail</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.email}</td></tr>` : ''}
          ${lead.company ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Firma</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.company}</td></tr>` : ''}
          ${lead.city ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Ort</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.city}</td></tr>` : ''}
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Neuer Status</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #22c55e;">${statusLabels[newStatus] || newStatus}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Sie können den Lead in Ihrem Portal einsehen.</p>
        <p style="color: #999; font-size: 12px;">— ${fromName}</p>
      </div>
    `;

    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: lead.account_email,
        subject,
        html,
      }),
    }).catch(() => {});

    // Log the handoff
    try {
      db.prepare(`
        INSERT INTO lead_activities (lead_id, type, description, created_at)
        VALUES (?, 'handoff', ?, datetime('now'))
      `).run(leadId, `Lead-Übergabe an ${lead.account_name}: ${statusLabels[newStatus]}`);
    } catch {}

  } catch (e) {
    console.error('[Lead Handoff] Error:', e);
  }
}
