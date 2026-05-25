import getDb from './db';

type DB = ReturnType<typeof getDb>;

export function getWarmingLimit(warmCurrentDay: number): number {
  if (warmCurrentDay <= 3) return 5;
  if (warmCurrentDay <= 7) return 15;
  if (warmCurrentDay <= 14) return 30;
  return 50;
}

export function ensureDailyReset(db: DB): void {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare("SELECT value FROM settings WHERE key = 'outbound_last_reset_date'").get() as { value: string } | undefined;

  if (row?.value === today) return;

  const reset = db.transaction(() => {
    db.prepare("UPDATE sending_inboxes SET sent_today = 0").run();
    db.prepare("UPDATE sending_domains SET sent_today = 0").run();

    // Advance warming day for warming domains
    const warmingDomains = db.prepare("SELECT id, warm_current_day FROM sending_domains WHERE status = 'warming'").all() as { id: number; warm_current_day: number }[];
    for (const d of warmingDomains) {
      const newDay = d.warm_current_day + 1;
      db.prepare("UPDATE sending_domains SET warm_current_day = ?, updated_at = datetime('now') WHERE id = ?").run(newDay, d.id);

      // Auto-activate after warming period (15 days)
      if (newDay > 15) {
        db.prepare("UPDATE sending_domains SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(d.id);
      }
    }

    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('outbound_last_reset_date', ?, datetime('now'))").run(today);
  });

  reset();
}

export function pickSendingInbox(db: DB, campaignDomainIds?: number[]): { inboxId: number; email: string; displayName: string } | null {
  ensureDailyReset(db);

  let sql = `
    SELECT i.id as inbox_id, i.email, i.display_name, i.sent_today as inbox_sent, i.daily_limit as inbox_limit,
           d.id as domain_id, d.sent_today as domain_sent, d.daily_limit as domain_limit, d.status as domain_status, d.warm_current_day
    FROM sending_inboxes i
    JOIN sending_domains d ON i.domain_id = d.id
    WHERE i.status = 'active'
      AND d.status IN ('warming', 'active')
      AND i.sent_today < i.daily_limit
      AND d.sent_today < d.daily_limit
  `;

  const params: unknown[] = [];

  if (campaignDomainIds && campaignDomainIds.length > 0) {
    sql += ` AND d.id IN (${campaignDomainIds.map(() => '?').join(',')})`;
    params.push(...campaignDomainIds);
  }

  sql += ' ORDER BY i.sent_today ASC LIMIT 10';

  const rows = db.prepare(sql).all(...params) as {
    inbox_id: number; email: string; display_name: string;
    inbox_sent: number; inbox_limit: number;
    domain_id: number; domain_sent: number; domain_limit: number;
    domain_status: string; warm_current_day: number;
  }[];

  for (const row of rows) {
    if (row.domain_status === 'warming') {
      const warmLimit = getWarmingLimit(row.warm_current_day);
      if (row.domain_sent >= warmLimit) continue;
    }
    return { inboxId: row.inbox_id, email: row.email, displayName: row.display_name || '' };
  }

  return null;
}

export function incrementInboxCounters(db: DB, inboxId: number): void {
  db.prepare("UPDATE sending_inboxes SET sent_today = sent_today + 1 WHERE id = ?").run(inboxId);
  db.prepare(`
    UPDATE sending_domains SET sent_today = sent_today + 1, sent_total = sent_total + 1, updated_at = datetime('now')
    WHERE id = (SELECT domain_id FROM sending_inboxes WHERE id = ?)
  `).run(inboxId);
}

export function calculateHealthScore(sentTotal: number, bounceCount: number, complaintCount: number): number {
  if (sentTotal === 0) return 100;
  const bounceRate = bounceCount / sentTotal;
  const complaintRate = complaintCount / sentTotal;
  return Math.max(0, Math.min(100, Math.round(100 - bounceRate * 1000 - complaintRate * 5000)));
}

export function updateDomainHealth(db: DB, domainId: number, eventType: 'bounce' | 'complaint'): void {
  const col = eventType === 'bounce' ? 'bounce_count' : 'complaint_count';
  db.prepare(`UPDATE sending_domains SET ${col} = ${col} + 1 WHERE id = ?`).run(domainId);

  const domain = db.prepare("SELECT sent_total, bounce_count, complaint_count FROM sending_domains WHERE id = ?").get(domainId) as { sent_total: number; bounce_count: number; complaint_count: number } | undefined;
  if (!domain) return;

  const health = calculateHealthScore(domain.sent_total, domain.bounce_count, domain.complaint_count);
  db.prepare("UPDATE sending_domains SET health_score = ?, updated_at = datetime('now') WHERE id = ?").run(health, domainId);

  if (health < 50) {
    db.prepare("UPDATE sending_domains SET status = 'paused', updated_at = datetime('now') WHERE id = ? AND status != 'burned'").run(domainId);
  }
}
