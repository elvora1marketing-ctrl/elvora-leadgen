import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

function safeQuery(db: ReturnType<typeof getDb>, sql: string, params: unknown[]): unknown[] {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

function safeQueryOne(db: ReturnType<typeof getDb>, sql: string, params: unknown[]): unknown | null {
  try {
    return db.prepare(sql).get(...params) || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const idParam = searchParams.get('id');

    if (!type || !idParam) {
      return NextResponse.json(
        { error: 'Parameter "type" und "id" sind erforderlich.' },
        { status: 400 }
      );
    }

    if (type !== 'lead' && type !== 'client') {
      return NextResponse.json(
        { error: 'Ungültiger Typ. Erlaubt: "lead" oder "client".' },
        { status: 400 }
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'Ungültige ID. Muss eine positive Zahl sein.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    if (type === 'lead') {
      const person = safeQueryOne(db, 'SELECT * FROM leads WHERE id = ?', [id]);
      if (!person) {
        return NextResponse.json(
          { error: 'Lead nicht gefunden.' },
          { status: 404 }
        );
      }

      const exportData = {
        export_date: new Date().toISOString(),
        type: 'lead',
        person,
        contacts: safeQuery(db, 'SELECT * FROM contacts WHERE lead_id = ?', [id]),
        activities: safeQuery(db, 'SELECT * FROM lead_activities WHERE lead_id = ?', [id]),
        emails_sent: safeQuery(db, 'SELECT * FROM inbox_messages WHERE lead_id = ?', [id]),
        email_tracking: safeQuery(db, 'SELECT * FROM email_tracking WHERE lead_id = ?', [id]),
        email_events: safeQuery(db, 'SELECT * FROM email_events WHERE lead_id = ?', [id]),
        proposals: safeQuery(db, 'SELECT * FROM proposals WHERE lead_id = ?', [id]),
        tasks: safeQuery(db, 'SELECT * FROM tasks WHERE lead_id = ?', [id]),
        bookings: safeQuery(db, 'SELECT * FROM bookings WHERE lead_id = ?', [id]),
        follow_ups: safeQuery(db, 'SELECT * FROM follow_ups WHERE lead_id = ?', [id]),
        invoices: safeQuery(db, 'SELECT * FROM invoices WHERE lead_id = ?', [id]),
        projects: safeQuery(db, 'SELECT * FROM projects WHERE lead_id = ?', [id]),
        tags: safeQuery(db, 'SELECT t.* FROM tags t JOIN lead_tags lt ON t.id = lt.tag_id WHERE lt.lead_id = ?', [id]),
        outreach: safeQuery(db, 'SELECT * FROM outreach_campaign_leads WHERE lead_id = ?', [id]),
        sequences: safeQuery(db, 'SELECT * FROM sequence_enrollments WHERE lead_id = ?', [id]),
        client: safeQueryOne(db, 'SELECT * FROM clients WHERE lead_id = ?', [id]),
      };

      logAudit('data_export', { type, id }, type, id, ip);

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="dsgvo-export-lead-${id}.json"`,
        },
      });
    }

    // type === 'client'
    const person = safeQueryOne(db, 'SELECT * FROM clients WHERE id = ?', [id]);
    if (!person) {
      return NextResponse.json(
        { error: 'Kunde nicht gefunden.' },
        { status: 404 }
      );
    }

    const exportData = {
      export_date: new Date().toISOString(),
      type: 'client',
      person,
      messages: safeQuery(db, 'SELECT * FROM client_messages WHERE client_id = ?', [id]),
      files: safeQuery(db, 'SELECT * FROM client_files WHERE client_id = ?', [id]),
      invoices: safeQuery(db, 'SELECT * FROM invoices WHERE client_id = ?', [id]),
      projects: safeQuery(db, 'SELECT * FROM projects WHERE client_id = ?', [id]),
    };

    logAudit('data_export', { type, id }, type, id, ip);

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="dsgvo-export-client-${id}.json"`,
      },
    });
  } catch (error) {
    console.error('[DSGVO] Export fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Datenexport fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
