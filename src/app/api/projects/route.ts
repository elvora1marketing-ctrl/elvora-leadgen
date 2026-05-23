import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('client_id');

    let sql = 'SELECT * FROM projects';
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }
    if (clientId) {
      conditions.push('client_id = ?');
      values.push(parseInt(clientId));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const projects = db.prepare(sql).all(...values);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Projects list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json();

    const token = crypto.randomUUID();

    const defaultPhases = [
      { key: 'received', label: 'Auftrag erhalten', icon: 'inbox' },
      { key: 'planning', label: 'Planung', icon: 'clipboard' },
      { key: 'design', label: 'Design', icon: 'palette' },
      { key: 'development', label: 'Entwicklung', icon: 'code' },
      { key: 'seo', label: 'SEO-Optimierung', icon: 'search' },
      { key: 'review', label: 'Review & QA', icon: 'check' },
      { key: 'launch', label: 'Launch', icon: 'rocket' },
      { key: 'done', label: 'Abgeschlossen', icon: 'flag' },
    ];

    const phases = body.phases && body.phases.length > 0 ? body.phases : defaultPhases;

    const result = db.prepare(`
      INSERT INTO projects (token, title, description, client_name, client_email, client_phone, client_id, lead_id, current_phase, phases, total_value, start_date, estimated_end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token,
      body.title || 'Neues Projekt',
      body.description || null,
      body.client_name,
      body.client_email || null,
      body.client_phone || null,
      body.client_id ?? null,
      body.lead_id ?? null,
      phases[0].key,
      JSON.stringify(phases),
      body.total_value ?? null,
      body.start_date || new Date().toISOString().split('T')[0],
      body.estimated_end_date || null,
      body.notes || null
    );

    db.prepare(
      "INSERT INTO project_updates (project_id, phase, title, description) VALUES (?, ?, ?, ?)"
    ).run(result.lastInsertRowid, phases[0].key, 'Auftrag erstellt', body.description || 'Projekt wurde angelegt.');

    return NextResponse.json({
      success: true,
      project_id: result.lastInsertRowid,
      token,
      tracking_url: `/tracking/${token}`,
    });
  } catch (error) {
    console.error('Project create error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 });
  }
}
