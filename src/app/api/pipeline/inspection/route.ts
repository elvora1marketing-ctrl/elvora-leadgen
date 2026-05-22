import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

const STAGE_ORDER: Record<string, number> = {
  not_contacted: 0,
  email_sent: 1,
  called: 2,
  meeting: 3,
  proposal: 4,
  won: 5,
};

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const period = request.nextUrl.searchParams.get('period') === 'month' ? 'month' : 'week';
    const days = period === 'month' ? 30 : 7;

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 19).replace('T', ' ');

    // New leads added in period
    const added = (db.prepare(
      'SELECT COUNT(*) as c FROM leads WHERE created_at >= ?'
    ).get(sinceStr) as { c: number }).c;

    // Status change activities in period
    const statusChanges = db.prepare(
      "SELECT lead_id, metadata, created_at FROM lead_activities WHERE type = 'status_change' AND created_at >= ? ORDER BY created_at ASC"
    ).all(sinceStr) as Array<{ lead_id: number; metadata: string; created_at: string }>;

    let movedForward = 0;
    let movedBack = 0;
    let won = 0;
    let lost = 0;

    const movements: Array<{ lead_id: number; lead_name: string; from_stage: string; to_stage: string; date: string }> = [];

    // Build a map of lead names for movements
    const leadIds = [...new Set(statusChanges.map(sc => sc.lead_id))];
    const leadNames: Record<number, string> = {};
    if (leadIds.length > 0) {
      const placeholders = leadIds.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT id, name FROM leads WHERE id IN (${placeholders})`
      ).all(...leadIds) as Array<{ id: number; name: string }>;
      for (const r of rows) leadNames[r.id] = r.name;
    }

    for (const sc of statusChanges) {
      let meta: { from?: string; to?: string };
      try { meta = JSON.parse(sc.metadata || '{}'); } catch { meta = {}; }
      const from = meta.from;
      const to = meta.to;
      if (!from || !to) continue;

      movements.push({
        lead_id: sc.lead_id,
        lead_name: leadNames[sc.lead_id] || 'Unbekannt',
        from_stage: from,
        to_stage: to,
        date: sc.created_at,
      });

      if (to === 'won') { won++; continue; }
      if (to === 'lost') { lost++; continue; }

      const fromOrder = STAGE_ORDER[from] ?? -1;
      const toOrder = STAGE_ORDER[to] ?? -1;
      if (toOrder > fromOrder) movedForward++;
      else if (toOrder < fromOrder) movedBack++;
    }

    // Stalled: active pipeline leads with no activity in period
    const activeStages = ['email_sent', 'called', 'meeting', 'proposal'];
    const stalledPlaceholders = activeStages.map(() => '?').join(',');
    const stalled = (db.prepare(`
      SELECT COUNT(*) as c FROM leads
      WHERE contact_status IN (${stalledPlaceholders})
        AND id NOT IN (
          SELECT DISTINCT lead_id FROM lead_activities WHERE created_at >= ?
        )
    `).get(...activeStages, sinceStr) as { c: number }).c;

    // Pipeline value change
    const currentValue = (db.prepare(
      "SELECT COALESCE(SUM(deal_value), 0) as v FROM leads WHERE contact_status NOT IN ('won', 'lost')"
    ).get() as { v: number }).v;

    // Value from leads added in period
    const addedValue = (db.prepare(
      "SELECT COALESCE(SUM(deal_value), 0) as v FROM leads WHERE created_at >= ? AND contact_status NOT IN ('won', 'lost')"
    ).get(sinceStr) as { v: number }).v;

    // Value of won deals in period
    const wonValue = (db.prepare(`
      SELECT COALESCE(SUM(l.deal_value), 0) as v FROM leads l
      INNER JOIN lead_activities la ON la.lead_id = l.id
      WHERE la.type = 'status_change' AND la.created_at >= ?
        AND la.metadata LIKE '%"to":"won"%'
    `).get(sinceStr) as { v: number }).v;

    // Value of lost deals in period
    const lostValue = (db.prepare(`
      SELECT COALESCE(SUM(l.deal_value), 0) as v FROM leads l
      INNER JOIN lead_activities la ON la.lead_id = l.id
      WHERE la.type = 'status_change' AND la.created_at >= ?
        AND la.metadata LIKE '%"to":"lost"%'
    `).get(sinceStr) as { v: number }).v;

    const valueChange = addedValue - wonValue - lostValue;

    return NextResponse.json({
      period,
      added,
      movedForward,
      movedBack,
      won,
      lost,
      stalled,
      valueChange,
      movements,
    });
  } catch (error) {
    console.error('[API] Pipeline inspection error:', error);
    return NextResponse.json({ error: 'Pipeline-Analyse fehlgeschlagen' }, { status: 500 });
  }
}
