import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

function safeDelete(db: ReturnType<typeof getDb>, sql: string, params: unknown[]): boolean {
  try {
    db.prepare(sql).run(...params);
    return true;
  } catch {
    return false;
  }
}

function safeUpdate(db: ReturnType<typeof getDb>, sql: string, params: unknown[]): boolean {
  try {
    db.prepare(sql).run(...params);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Felder "type" und "id" sind erforderlich.' },
        { status: 400 }
      );
    }

    if (type !== 'lead' && type !== 'client') {
      return NextResponse.json(
        { error: 'Ungültiger Typ. Erlaubt: "lead" oder "client".' },
        { status: 400 }
      );
    }

    if (typeof id !== 'number' || id <= 0) {
      return NextResponse.json(
        { error: 'Ungültige ID. Muss eine positive Zahl sein.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    if (type === 'lead') {
      const leadId = id;

      // Check if lead exists and get email for blacklist cleanup
      const lead = db.prepare('SELECT id, email FROM leads WHERE id = ?').get(leadId) as { id: number; email: string | null } | undefined;
      if (!lead) {
        return NextResponse.json(
          { error: 'Lead nicht gefunden.' },
          { status: 404 }
        );
      }

      const tablesAffected: string[] = [];

      const deleteLead = db.transaction(() => {
        // 1-18: Cascade delete through all related tables
        if (safeDelete(db, 'DELETE FROM email_tracking WHERE lead_id = ?', [leadId])) tablesAffected.push('email_tracking');
        if (safeDelete(db, 'DELETE FROM email_events WHERE lead_id = ?', [leadId])) tablesAffected.push('email_events');
        if (safeDelete(db, 'DELETE FROM inbox_messages WHERE lead_id = ?', [leadId])) tablesAffected.push('inbox_messages');
        if (safeDelete(db, 'DELETE FROM lead_activities WHERE lead_id = ?', [leadId])) tablesAffected.push('lead_activities');
        if (safeDelete(db, 'DELETE FROM follow_ups WHERE lead_id = ?', [leadId])) tablesAffected.push('follow_ups');
        if (safeDelete(db, 'DELETE FROM contacts WHERE lead_id = ?', [leadId])) tablesAffected.push('contacts');
        if (safeDelete(db, 'DELETE FROM proposals WHERE lead_id = ?', [leadId])) tablesAffected.push('proposals');
        if (safeDelete(db, 'DELETE FROM tasks WHERE lead_id = ?', [leadId])) tablesAffected.push('tasks');
        if (safeDelete(db, 'DELETE FROM lead_tags WHERE lead_id = ?', [leadId])) tablesAffected.push('lead_tags');
        if (safeDelete(db, 'DELETE FROM audit_pages WHERE lead_id = ?', [leadId])) tablesAffected.push('audit_pages');
        if (safeDelete(db, 'DELETE FROM website_snapshots WHERE lead_id = ?', [leadId])) tablesAffected.push('website_snapshots');
        if (safeDelete(db, 'DELETE FROM trigger_events WHERE lead_id = ?', [leadId])) tablesAffected.push('trigger_events');
        if (safeDelete(db, 'DELETE FROM competitor_analyses WHERE lead_id = ?', [leadId])) tablesAffected.push('competitor_analyses');
        if (safeDelete(db, 'DELETE FROM review_snapshots WHERE lead_id = ?', [leadId])) tablesAffected.push('review_snapshots');
        if (safeDelete(db, 'DELETE FROM outreach_campaign_leads WHERE lead_id = ?', [leadId])) tablesAffected.push('outreach_campaign_leads');
        if (safeDelete(db, 'DELETE FROM sequence_enrollments WHERE lead_id = ?', [leadId])) tablesAffected.push('sequence_enrollments');
        if (safeDelete(db, 'DELETE FROM bookings WHERE lead_id = ?', [leadId])) tablesAffected.push('bookings');
        if (safeDelete(db, 'DELETE FROM referrals WHERE referred_lead_id = ?', [leadId])) tablesAffected.push('referrals');

        // 19: Find associated clients and clean up client data
        try {
          const clients = db.prepare('SELECT id FROM clients WHERE lead_id = ?').all(leadId) as { id: number }[];
          for (const client of clients) {
            safeDelete(db, 'DELETE FROM client_messages WHERE client_id = ?', [client.id]);
            safeDelete(db, 'DELETE FROM client_files WHERE client_id = ?', [client.id]);
            safeUpdate(db, "UPDATE invoices SET recipient_name = '[GELÖSCHT]', recipient_email = NULL, recipient_address = NULL WHERE client_id = ?", [client.id]);
            safeUpdate(db, "UPDATE projects SET client_name = '[GELÖSCHT]', client_email = NULL, client_phone = NULL WHERE client_id = ?", [client.id]);
            safeDelete(db, 'DELETE FROM clients WHERE id = ?', [client.id]);
          }
          if (clients.length > 0) {
            tablesAffected.push('client_messages', 'client_files', 'invoices', 'projects', 'clients');
          }
        } catch {
          // clients table might not exist
        }

        // 20: Anonymize invoices/projects directly linked to lead
        if (safeUpdate(db, "UPDATE invoices SET recipient_name = '[GELÖSCHT]', recipient_email = NULL, recipient_address = NULL WHERE lead_id = ?", [leadId])) {
          if (!tablesAffected.includes('invoices')) tablesAffected.push('invoices');
        }
        if (safeUpdate(db, "UPDATE projects SET client_name = '[GELÖSCHT]', client_email = NULL, client_phone = NULL WHERE lead_id = ?", [leadId])) {
          if (!tablesAffected.includes('projects')) tablesAffected.push('projects');
        }

        // 21-22: Remove from email blacklist if email exists
        if (lead.email) {
          if (safeDelete(db, 'DELETE FROM email_blacklist WHERE email = ?', [lead.email])) {
            tablesAffected.push('email_blacklist');
          }
        }

        // 23: Delete project updates for projects linked to this lead
        if (safeDelete(db, 'DELETE FROM project_updates WHERE project_id IN (SELECT id FROM projects WHERE lead_id = ?)', [leadId])) {
          tablesAffected.push('project_updates');
        }

        // 24: Delete the lead itself
        safeDelete(db, 'DELETE FROM leads WHERE id = ?', [leadId]);
        tablesAffected.push('leads');
      });

      deleteLead();

      // 25: Log audit event
      logAudit('data_erasure', { type: 'lead', id: leadId, tables_affected: tablesAffected }, 'lead', leadId, ip);

      return NextResponse.json({
        success: true,
        deleted: { lead_id: leadId },
      });
    }

    // type === 'client'
    const clientId = id;

    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId) as { id: number } | undefined;
    if (!client) {
      return NextResponse.json(
        { error: 'Kunde nicht gefunden.' },
        { status: 404 }
      );
    }

    const tablesAffected: string[] = [];

    const deleteClient = db.transaction(() => {
      if (safeDelete(db, 'DELETE FROM client_messages WHERE client_id = ?', [clientId])) tablesAffected.push('client_messages');
      if (safeDelete(db, 'DELETE FROM client_files WHERE client_id = ?', [clientId])) tablesAffected.push('client_files');
      if (safeUpdate(db, "UPDATE invoices SET recipient_name = '[GELÖSCHT]', recipient_email = NULL, recipient_address = NULL WHERE client_id = ?", [clientId])) tablesAffected.push('invoices');
      if (safeUpdate(db, "UPDATE projects SET client_name = '[GELÖSCHT]', client_email = NULL, client_phone = NULL WHERE client_id = ?", [clientId])) tablesAffected.push('projects');

      // Delete project updates for projects linked to this client
      if (safeDelete(db, 'DELETE FROM project_updates WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)', [clientId])) {
        tablesAffected.push('project_updates');
      }

      // Delete client record
      safeDelete(db, 'DELETE FROM clients WHERE id = ?', [clientId]);
      tablesAffected.push('clients');
    });

    deleteClient();

    logAudit('data_erasure', { type: 'client', id: clientId, tables_affected: tablesAffected }, 'client', clientId, ip);

    return NextResponse.json({
      success: true,
      deleted: { client_id: clientId },
    });
  } catch (error) {
    console.error('[DSGVO] Löschung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Datenlöschung fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
