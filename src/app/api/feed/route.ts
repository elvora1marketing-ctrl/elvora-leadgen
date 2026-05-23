import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const ICON_MAP: Record<string, string> = {
  email: 'mail',
  call: 'phone',
  meeting: 'calendar',
  note: 'edit',
  status_change: 'arrow',
  whatsapp: 'message-circle',
  email_opened: 'eye',
  email_clicked: 'mouse-pointer',
  email_bounced: 'alert-triangle',
  trigger_fired: 'alert',
  email_received: 'inbox',
  workflow_executed: 'zap',
};

interface FeedItem {
  id: string;
  type: string;
  icon: string;
  title: string;
  description: string;
  lead_id: number | null;
  lead_name: string | null;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const since = searchParams.get('since');
    const typeFilter = searchParams.get('type');

    const items: FeedItem[] = [];

    // 1. Lead activities
    {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (since) {
        conditions.push('la.created_at >= ?');
        params.push(since);
      }
      if (typeFilter && ['note', 'call', 'email', 'meeting', 'status_change', 'whatsapp'].includes(typeFilter)) {
        conditions.push('la.type = ?');
        params.push(typeFilter);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const activities = db.prepare(`
        SELECT la.id, la.type, la.content, la.lead_id, la.created_at,
               l.name as lead_name
        FROM lead_activities la
        LEFT JOIN leads l ON la.lead_id = l.id
        ${where}
        ORDER BY la.created_at DESC
        LIMIT ?
      `).all(...params, limit) as Array<{
        id: number; type: string; content: string; lead_id: number;
        created_at: string; lead_name: string | null;
      }>;

      for (const a of activities) {
        items.push({
          id: `activity_${a.id}`,
          type: a.type,
          icon: ICON_MAP[a.type] || 'activity',
          title: formatActivityTitle(a.type, a.lead_name),
          description: a.content || '',
          lead_id: a.lead_id,
          lead_name: a.lead_name,
          timestamp: a.created_at,
        });
      }
    }

    // 2. Email events
    if (!typeFilter || ['email_opened', 'email_clicked', 'email_bounced'].includes(typeFilter)) {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (since) {
        conditions.push('ee.created_at >= ?');
        params.push(since);
      }
      if (typeFilter) {
        const eventTypeMap: Record<string, string> = {
          email_opened: 'opened',
          email_clicked: 'clicked',
          email_bounced: 'bounced',
        };
        if (eventTypeMap[typeFilter]) {
          conditions.push('ee.event_type = ?');
          params.push(eventTypeMap[typeFilter]);
        }
      } else {
        conditions.push("ee.event_type IN ('opened', 'clicked', 'bounced')");
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const events = db.prepare(`
        SELECT ee.id, ee.event_type, ee.lead_id, ee.created_at,
               l.name as lead_name
        FROM email_events ee
        LEFT JOIN leads l ON ee.lead_id = l.id
        ${where}
        ORDER BY ee.created_at DESC
        LIMIT ?
      `).all(...params, limit) as Array<{
        id: number; event_type: string; lead_id: number | null;
        created_at: string; lead_name: string | null;
      }>;

      for (const e of events) {
        const feedType = `email_${e.event_type}`;
        items.push({
          id: `email_event_${e.id}`,
          type: feedType,
          icon: ICON_MAP[feedType] || 'mail',
          title: formatEmailEventTitle(e.event_type, e.lead_name),
          description: '',
          lead_id: e.lead_id,
          lead_name: e.lead_name,
          timestamp: e.created_at,
        });
      }
    }

    // 3. Trigger events
    if (!typeFilter || typeFilter === 'trigger_fired') {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (since) {
        conditions.push('te.created_at >= ?');
        params.push(since);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const triggers = db.prepare(`
        SELECT te.id, te.trigger_type, te.title as trigger_title, te.details, te.lead_id, te.created_at,
               l.name as lead_name
        FROM trigger_events te
        LEFT JOIN leads l ON te.lead_id = l.id
        ${where}
        ORDER BY te.created_at DESC
        LIMIT ?
      `).all(...params, limit) as Array<{
        id: number; trigger_type: string; trigger_title: string; details: string | null;
        lead_id: number; created_at: string; lead_name: string | null;
      }>;

      for (const t of triggers) {
        items.push({
          id: `trigger_${t.id}`,
          type: 'trigger_fired',
          icon: ICON_MAP['trigger_fired'],
          title: t.trigger_title || `Trigger: ${t.trigger_type}`,
          description: t.details || '',
          lead_id: t.lead_id,
          lead_name: t.lead_name,
          timestamp: t.created_at,
        });
      }
    }

    // 4. Inbox messages
    if (!typeFilter || typeFilter === 'email_received') {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (since) {
        conditions.push('im.created_at >= ?');
        params.push(since);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const messages = db.prepare(`
        SELECT im.id, im.from_email, im.from_name, im.subject, im.lead_id, im.created_at,
               l.name as lead_name
        FROM inbox_messages im
        LEFT JOIN leads l ON im.lead_id = l.id
        ${where}
        ORDER BY im.created_at DESC
        LIMIT ?
      `).all(...params, limit) as Array<{
        id: number; from_email: string; from_name: string | null; subject: string | null;
        lead_id: number | null; created_at: string; lead_name: string | null;
      }>;

      for (const m of messages) {
        items.push({
          id: `inbox_${m.id}`,
          type: 'email_received',
          icon: ICON_MAP['email_received'],
          title: `Email from ${m.from_name || m.from_email}`,
          description: m.subject || '',
          lead_id: m.lead_id,
          lead_name: m.lead_name,
          timestamp: m.created_at,
        });
      }
    }

    // 5. Workflow logs (optional table, wrap in try/catch)
    if (!typeFilter || typeFilter === 'workflow_executed') {
      try {
        const conditions: string[] = [];
        const params: (string | number)[] = [];

        if (since) {
          conditions.push('wl.created_at >= ?');
          params.push(since);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const logs = db.prepare(`
          SELECT wl.id, wl.workflow_id, wl.lead_id, wl.trigger_type, wl.status, wl.created_at,
                 w.name as workflow_name,
                 l.name as lead_name
          FROM workflow_logs wl
          LEFT JOIN workflows w ON wl.workflow_id = w.id
          LEFT JOIN leads l ON wl.lead_id = l.id
          ${where}
          ORDER BY wl.created_at DESC
          LIMIT ?
        `).all(...params, limit) as Array<{
          id: number; workflow_id: number; lead_id: number | null;
          trigger_type: string | null; status: string; created_at: string;
          workflow_name: string | null; lead_name: string | null;
        }>;

        for (const wl of logs) {
          items.push({
            id: `workflow_${wl.id}`,
            type: 'workflow_executed',
            icon: ICON_MAP['workflow_executed'],
            title: `Workflow: ${wl.workflow_name || 'Unknown'}`,
            description: `Status: ${wl.status}${wl.lead_name ? ` - ${wl.lead_name}` : ''}`,
            lead_id: wl.lead_id,
            lead_name: wl.lead_name,
            timestamp: wl.created_at,
          });
        }
      } catch {
        // workflow_logs table may not exist
      }
    }

    // Sort all items by timestamp descending and apply limit
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const result = items.slice(0, limit);

    return NextResponse.json({ items: result, count: result.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatActivityTitle(type: string, leadName: string | null): string {
  const name = leadName || 'Unknown';
  switch (type) {
    case 'note': return `Note added for ${name}`;
    case 'call': return `Call logged with ${name}`;
    case 'email': return `Email sent to ${name}`;
    case 'meeting': return `Meeting with ${name}`;
    case 'status_change': return `Status changed for ${name}`;
    case 'whatsapp': return `WhatsApp message to ${name}`;
    default: return `Activity for ${name}`;
  }
}

function formatEmailEventTitle(eventType: string, leadName: string | null): string {
  const name = leadName || 'Unknown';
  switch (eventType) {
    case 'opened': return `${name} opened email`;
    case 'clicked': return `${name} clicked email link`;
    case 'bounced': return `Email bounced for ${name}`;
    default: return `Email event for ${name}`;
  }
}
