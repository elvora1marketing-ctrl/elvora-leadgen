import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const showDismissed = searchParams.get('show_dismissed') === '1';
    const showActed = searchParams.get('show_acted') === '1';
    const triggerType = searchParams.get('type') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!showDismissed) conditions.push('t.is_dismissed = 0');
    if (!showActed) conditions.push('t.is_acted_on = 0');
    if (triggerType) {
      conditions.push('t.trigger_type = ?');
      params.push(triggerType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const triggers = db.prepare(`
      SELECT
        t.id, t.lead_id, t.trigger_type, t.severity, t.title, t.details,
        t.is_acted_on, t.is_dismissed, t.created_at,
        l.name as lead_name, l.city as lead_city, l.contact_status, l.priority,
        l.website_original
      FROM trigger_events t
      LEFT JOIN leads l ON t.lead_id = l.id
      ${where}
      ORDER BY
        CASE t.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.created_at DESC
      LIMIT ?
    `).all(...params);

    const counts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_acted_on = 0 AND is_dismissed = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_acted_on = 0 AND is_dismissed = 0 AND severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN is_acted_on = 0 AND is_dismissed = 0 AND severity = 'high' THEN 1 ELSE 0 END) as high
      FROM trigger_events
    `).get() as { total: number; active: number; critical: number; high: number };

    const lastScan = db.prepare(`
      SELECT MAX(checked_at) as last_scan, COUNT(DISTINCT lead_id) as leads_scanned
      FROM website_snapshots
      WHERE checked_at >= datetime('now', '-7 days')
    `).get() as { last_scan: string | null; leads_scanned: number };

    return NextResponse.json({ triggers, counts, lastScan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
