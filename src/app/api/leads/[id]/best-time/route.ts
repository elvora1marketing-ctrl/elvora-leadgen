import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface EventRow {
  hour: number;
  weekday: string;
}

const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * GET /api/leads/[id]/best-time
 * Calculates best contact hour/day for a lead based on email opens/clicks.
 * Updates lead's best_contact_hour + best_contact_day.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();

    // Collect all engagement events with timestamps
    const events = db.prepare(`
      SELECT
        CAST(strftime('%H', et.opened_at) AS INTEGER) as hour,
        strftime('%w', et.opened_at) as weekday
      FROM email_tracking et
      WHERE et.lead_id = ? AND et.opened_at IS NOT NULL
      UNION ALL
      SELECT
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        strftime('%w', created_at) as weekday
      FROM email_events
      WHERE lead_id = ? AND event_type IN ('opened', 'clicked')
    `).all(leadId, leadId) as EventRow[];

    if (events.length === 0) {
      return NextResponse.json({ best_hour: null, best_day: null, message: 'Noch keine Engagement-Daten' });
    }

    // Find most common hour
    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<string, number>();
    for (const e of events) {
      hourCounts.set(e.hour, (hourCounts.get(e.hour) || 0) + 1);
      const dayName = dayNames[parseInt(e.weekday)];
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
    }

    const bestHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const bestDay = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    db.prepare("UPDATE leads SET best_contact_hour = ?, best_contact_day = ? WHERE id = ?")
      .run(bestHour, bestDay, leadId);

    return NextResponse.json({
      best_hour: bestHour,
      best_day: bestDay,
      events_analyzed: events.length,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
