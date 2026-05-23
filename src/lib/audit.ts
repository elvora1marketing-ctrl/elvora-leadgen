import getDb from '@/lib/db';

export function logAudit(
  action: string,
  details: Record<string, unknown>,
  entityType?: string,
  entityId?: number,
  ipAddress?: string
) {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO audit_log (action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?)"
    ).run(action, entityType ?? null, entityId ?? null, JSON.stringify(details), ipAddress ?? null);
  } catch (e) {
    console.error('[Audit] Log error:', e);
  }
}
