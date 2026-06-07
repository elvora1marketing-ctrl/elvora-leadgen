import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const clientId = parseInt(token);
    if (isNaN(clientId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json();
    const db = getDb();

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status !== undefined) {
      const valid = ['onboarding', 'active', 'paused', 'completed', 'churned'];
      if (!valid.includes(body.status)) return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
      updates.push('status = ?');
      values.push(body.status);
      if (body.status === 'active' && !body.started_at) { updates.push("started_at = datetime('now')"); }
      if (body.status === 'completed') { updates.push("completed_at = datetime('now')"); }
    }

    if (body.progress_phase !== undefined) {
      const valid = ['kickoff', 'design', 'development', 'review', 'launch', 'done'];
      if (!valid.includes(body.progress_phase)) return NextResponse.json({ error: 'Ungültige Phase' }, { status: 400 });
      updates.push('progress_phase = ?');
      values.push(body.progress_phase);
    }

    if (body.monthly_value !== undefined) {
      updates.push('monthly_value = ?');
      values.push(body.monthly_value);
    }

    if (body.project_value !== undefined) {
      updates.push('project_value = ?');
      values.push(body.project_value);
    }

    if (body.contact_name !== undefined) {
      updates.push('contact_name = ?');
      values.push(body.contact_name);
    }

    if (body.contact_email !== undefined) {
      updates.push('contact_email = ?');
      values.push(body.contact_email);
    }

    if (body.project_type !== undefined) {
      updates.push('project_type = ?');
      values.push(body.project_type);
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes);
    }

    // Live-ROI dashboard config
    if (body.dashboard_enabled !== undefined) {
      updates.push('dashboard_enabled = ?');
      values.push(body.dashboard_enabled ? 1 : 0);
    }
    if (body.lead_value !== undefined) {
      updates.push('lead_value = ?');
      values.push(Number(body.lead_value) || 0);
    }
    if (body.form_slugs !== undefined) {
      updates.push('form_slugs = ?');
      values.push(JSON.stringify(Array.isArray(body.form_slugs) ? body.form_slugs : []));
    }
    if (body.chat_widget_ids !== undefined) {
      updates.push('chat_widget_ids = ?');
      values.push(JSON.stringify(Array.isArray(body.chat_widget_ids) ? body.chat_widget_ids : []));
    }
    if (body.track_bookings !== undefined) {
      updates.push('track_bookings = ?');
      values.push(body.track_bookings ? 1 : 0);
    }

    if (updates.length === 0) return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 });

    values.push(clientId);
    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client status update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
