import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { quickCheck } from '@/lib/website-analyzer';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';
export const maxDuration = 300;

interface LeadRow {
  id: number;
  name: string;
  website_original: string;
  score: number;
  contact_status: string;
}

interface SnapshotRow {
  score: number | null;
  has_ssl: number | null;
  is_reachable: number;
  status_code: number | null;
  problems_count: number;
}

/**
 * POST /api/monitoring/run
 * Performs a quickCheck on all active leads with websites and creates trigger events on changes.
 *
 * Body: { limit?: number, lead_id?: number, only_active?: boolean }
 *  - lead_id: scan only one specific lead
 *  - limit: max number of leads to scan (default 100)
 *  - only_active: only scan leads in active status (not lost/won/rejected/archived) - default true
 */
export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json().catch(() => ({}));
    const { limit = 100, lead_id, only_active = true } = body as {
      limit?: number;
      lead_id?: number;
      only_active?: boolean;
    };

    const db = getDb();

    // Get leads to scan
    let leads: LeadRow[];
    if (lead_id) {
      const lead = db.prepare(`
        SELECT id, name, website_original, score, contact_status
        FROM leads
        WHERE id = ? AND website_original IS NOT NULL AND website_original != ''
      `).get(lead_id) as LeadRow | undefined;
      leads = lead ? [lead] : [];
    } else {
      const conditions = [
        "website_original IS NOT NULL",
        "website_original != ''",
      ];
      if (only_active) {
        conditions.push("status NOT IN ('rejected', 'archived')");
        conditions.push("contact_status NOT IN ('won', 'lost')");
      }
      leads = db.prepare(`
        SELECT id, name, website_original, score, contact_status
        FROM leads
        WHERE ${conditions.join(' AND ')}
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(limit) as LeadRow[];
    }

    if (leads.length === 0) {
      return NextResponse.json({ success: true, scanned: 0, triggers: 0 });
    }

    const insertSnapshot = db.prepare(`
      INSERT INTO website_snapshots (lead_id, score, has_ssl, is_reachable, response_time_ms, status_code, problems_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTrigger = db.prepare(`
      INSERT INTO trigger_events (lead_id, trigger_type, severity, title, details)
      VALUES (?, ?, ?, ?, ?)
    `);

    const getLastSnapshot = db.prepare(`
      SELECT score, has_ssl, is_reachable, status_code, problems_count
      FROM website_snapshots
      WHERE lead_id = ?
      ORDER BY checked_at DESC LIMIT 1
    `);

    let triggersCreated = 0;
    const results: Array<{ leadId: number; name: string; reachable: boolean; triggers: string[] }> = [];

    // Sequential to avoid overwhelming external sites
    for (const lead of leads) {
      try {
        const check = await quickCheck(lead.website_original);
        const previous = getLastSnapshot.get(lead.id) as SnapshotRow | undefined;

        insertSnapshot.run(
          lead.id,
          lead.score || null,
          check.hasSSL ? 1 : 0,
          check.isReachable ? 1 : 0,
          check.responseTimeMs,
          check.statusCode,
          0,
        );

        const newTriggers: string[] = [];

        if (previous) {
          // Trigger: website went down
          if (previous.is_reachable === 1 && !check.isReachable) {
            insertTrigger.run(
              lead.id,
              'website_down',
              'critical',
              'Website nicht erreichbar',
              JSON.stringify({ status_code: check.statusCode, error: check.error, was_reachable_before: true }),
            );
            newTriggers.push('website_down');
          }
          // Trigger: website came back online
          else if (previous.is_reachable === 0 && check.isReachable) {
            insertTrigger.run(
              lead.id,
              'website_back_online',
              'medium',
              'Website wieder online',
              JSON.stringify({ status_code: check.statusCode }),
            );
            newTriggers.push('website_back_online');
          }
          // Trigger: SSL plotzlich fehlt (war da, jetzt weg)
          if (previous.has_ssl === 1 && !check.hasSSL && check.isReachable) {
            insertTrigger.run(
              lead.id,
              'ssl_lost',
              'high',
              'SSL-Zertifikat verloren',
              JSON.stringify({ final_url: check.finalUrl }),
            );
            newTriggers.push('ssl_lost');
          }
          // Trigger: Response time massiv verschlechtert (>3x langsamer und >5s)
          if (previous.is_reachable === 1 && check.isReachable) {
            const prevTime = (previous as unknown as { response_time_ms?: number }).response_time_ms || 0;
            if (prevTime > 0 && check.responseTimeMs > 5000 && check.responseTimeMs > prevTime * 3) {
              insertTrigger.run(
                lead.id,
                'performance_degraded',
                'medium',
                'Website extrem langsam geworden',
                JSON.stringify({ previous_ms: prevTime, current_ms: check.responseTimeMs }),
              );
              newTriggers.push('performance_degraded');
            }
          }
        } else {
          // First check - create initial trigger only if website is unreachable or no SSL
          if (!check.isReachable) {
            insertTrigger.run(
              lead.id,
              'website_down',
              'critical',
              'Website nicht erreichbar (erster Scan)',
              JSON.stringify({ status_code: check.statusCode, error: check.error }),
            );
            newTriggers.push('website_down');
          } else if (!check.hasSSL) {
            insertTrigger.run(
              lead.id,
              'no_ssl',
              'high',
              'Kein SSL-Zertifikat',
              JSON.stringify({ final_url: check.finalUrl }),
            );
            newTriggers.push('no_ssl');
          }
        }

        triggersCreated += newTriggers.length;
        results.push({ leadId: lead.id, name: lead.name, reachable: check.isReachable, triggers: newTriggers });

        // Small delay between requests
        if (leads.length > 1) await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`[Monitoring] Error scanning lead ${lead.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      scanned: leads.length,
      triggers: triggersCreated,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[Monitoring API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
