import crypto from 'crypto';
import getDb from './db';

export type WebhookEvent =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.replied'
  | 'lead.meeting_booked'
  | 'lead.won'
  | 'campaign.started'
  | 'campaign.completed'
  | 'email.sent'
  | 'email.opened'
  | 'email.replied'
  | 'email.bounced';

interface WebhookSubscription {
  id: number;
  url: string;
  events: string;
  secret: string | null;
  active: number;
  account_id: number | null;
}

export function dispatchWebhook(event: WebhookEvent, data: Record<string, unknown>, accountId?: number | null): void {
  try {
    const db = getDb();
    const subs = db.prepare(`
      SELECT * FROM webhook_subscriptions
      WHERE active = 1
    `).all() as WebhookSubscription[];

    for (const sub of subs) {
      const events: string[] = JSON.parse(sub.events || '[]');
      if (events.length > 0 && !events.includes(event) && !events.includes('*')) continue;
      if (sub.account_id && accountId && sub.account_id !== accountId) continue;

      sendWebhook(sub, event, data).catch(() => {});
    }
  } catch {
    // Don't let webhook errors break the main flow
  }
}

async function sendWebhook(sub: WebhookSubscription, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  const db = getDb();
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub.secret) {
    const signature = crypto.createHmac('sha256', sub.secret).update(payload).digest('hex');
    headers['X-Webhook-Signature'] = signature;
  }

  const start = Date.now();
  let status = 0;
  let responseBody = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(sub.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    status = res.status;
    responseBody = await res.text().catch(() => '');
  } catch (e) {
    responseBody = e instanceof Error ? e.message : 'Timeout/Error';
  }

  const duration = Date.now() - start;

  try {
    db.prepare(`
      INSERT INTO webhook_logs (subscription_id, event, payload, response_status, response_body, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sub.id, event, payload, status, responseBody.slice(0, 2000), duration);

    db.prepare(`
      UPDATE webhook_subscriptions SET
        last_triggered_at = datetime('now'),
        last_status = ?,
        failure_count = CASE WHEN ? >= 200 AND ? < 300 THEN 0 ELSE failure_count + 1 END
      WHERE id = ?
    `).run(status, status, status, sub.id);

    // Auto-disable after 10 consecutive failures
    if (status < 200 || status >= 300) {
      const failCount = (db.prepare('SELECT failure_count FROM webhook_subscriptions WHERE id = ?').get(sub.id) as { failure_count: number })?.failure_count || 0;
      if (failCount >= 10) {
        db.prepare('UPDATE webhook_subscriptions SET active = 0 WHERE id = ?').run(sub.id);
      }
    }
  } catch {}
}
