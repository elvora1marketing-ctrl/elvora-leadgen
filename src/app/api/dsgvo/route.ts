import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeQuery(db: ReturnType<typeof getDb>, sql: string, params: unknown[]): unknown[] {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

function safeRun(db: ReturnType<typeof getDb>, sql: string, params: unknown[]): number {
  try {
    const result = db.prepare(sql).run(...params);
    return result.changes;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// GET  ?action=export&email=X
// GET  ?action=retention_stats
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { error: 'Parameter "action" ist erforderlich. Erlaubt: "export", "retention_stats".' },
        { status: 400 }
      );
    }

    const db = getDb();

    // -----------------------------------------------------------------------
    // action=export
    // -----------------------------------------------------------------------
    if (action === 'export') {
      const email = searchParams.get('email');
      if (!email) {
        return NextResponse.json(
          { error: 'Parameter "email" ist erforderlich.' },
          { status: 400 }
        );
      }

      const leads = safeQuery(db, 'SELECT * FROM leads WHERE email = ?', [email]);
      const contacts = safeQuery(db, 'SELECT * FROM contacts WHERE email = ?', [email]);
      const bookings = safeQuery(db, 'SELECT * FROM bookings WHERE email = ?', [email]);
      const chatConversations = safeQuery(db, 'SELECT * FROM chat_conversations WHERE visitor_email = ?', [email]);

      // Gather chat messages for every matching conversation
      const conversationIds = (chatConversations as { id: number }[]).map((c) => c.id);
      let chatMessages: unknown[] = [];
      if (conversationIds.length > 0) {
        const placeholders = conversationIds.map(() => '?').join(',');
        chatMessages = safeQuery(
          db,
          `SELECT * FROM chat_messages WHERE conversation_id IN (${placeholders})`,
          conversationIds
        );
      }

      // contact_submissions: the email lives inside the JSON "data" column
      const allSubmissions = safeQuery(db, 'SELECT * FROM contact_submissions', []);
      const contactSubmissions = (allSubmissions as { data: string }[]).filter((s) => {
        try {
          return s.data && s.data.includes(email);
        } catch {
          return false;
        }
      });

      const inboxMessages = safeQuery(db, 'SELECT * FROM inbox_messages WHERE from_email = ?', [email]);

      const exportData = {
        export_date: new Date().toISOString(),
        email,
        leads,
        contacts,
        bookings,
        chat_conversations: chatConversations,
        chat_messages: chatMessages,
        contact_submissions: contactSubmissions,
        inbox_messages: inboxMessages,
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="dsgvo-export-${encodeURIComponent(email)}.json"`,
        },
      });
    }

    // -----------------------------------------------------------------------
    // action=retention_stats
    // -----------------------------------------------------------------------
    if (action === 'retention_stats') {
      const retentionRow = db
        .prepare("SELECT value FROM settings WHERE key = 'data_retention_days'")
        .get() as { value: string } | undefined;
      const retentionDays = retentionRow ? parseInt(retentionRow.value, 10) : 365;

      const cutoff = `-${retentionDays} days`;

      const chatConversationsOld = safeQuery(
        db,
        "SELECT COUNT(*) as count FROM chat_conversations WHERE created_at < datetime('now', ?)",
        [cutoff]
      ) as { count: number }[];

      const contactSubmissionsOld = safeQuery(
        db,
        "SELECT COUNT(*) as count FROM contact_submissions WHERE created_at < datetime('now', ?)",
        [cutoff]
      ) as { count: number }[];

      const bookingsOld = safeQuery(
        db,
        "SELECT COUNT(*) as count FROM bookings WHERE created_at < datetime('now', ?)",
        [cutoff]
      ) as { count: number }[];

      return NextResponse.json({
        retention_days: retentionDays,
        older_than_retention: {
          chat_conversations: chatConversationsOld[0]?.count ?? 0,
          contact_submissions: contactSubmissionsOld[0]?.count ?? 0,
          bookings: bookingsOld[0]?.count ?? 0,
        },
      });
    }

    return NextResponse.json(
      { error: 'Unbekannte Aktion. Erlaubt: "export", "retention_stats".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DSGVO] GET Fehler:', error);
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST  { action: 'delete_by_email', email }
// POST  { action: 'cleanup_old' }
// POST  { action: 'anonymize_ip' }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Feld "action" ist erforderlich. Erlaubt: "delete_by_email", "cleanup_old", "anonymize_ip".' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // -----------------------------------------------------------------------
    // action: delete_by_email
    // -----------------------------------------------------------------------
    if (action === 'delete_by_email') {
      const { email } = body;
      if (!email || typeof email !== 'string') {
        return NextResponse.json(
          { error: 'Feld "email" ist erforderlich.' },
          { status: 400 }
        );
      }

      const counts: Record<string, number> = {};

      const deleteAll = db.transaction(() => {
        counts.leads = safeRun(db, 'DELETE FROM leads WHERE email = ?', [email]);
        counts.contacts = safeRun(db, 'DELETE FROM contacts WHERE email = ?', [email]);
        counts.bookings = safeRun(db, 'DELETE FROM bookings WHERE email = ?', [email]);

        // Chat: find conversations, delete messages first, then conversations
        const conversations = safeQuery(
          db,
          'SELECT id FROM chat_conversations WHERE visitor_email = ?',
          [email]
        ) as { id: number }[];

        let chatMessagesDeleted = 0;
        if (conversations.length > 0) {
          const placeholders = conversations.map(() => '?').join(',');
          const ids = conversations.map((c) => c.id);
          chatMessagesDeleted = safeRun(
            db,
            `DELETE FROM chat_messages WHERE conversation_id IN (${placeholders})`,
            ids
          );
        }
        counts.chat_messages = chatMessagesDeleted;
        counts.chat_conversations = safeRun(
          db,
          'DELETE FROM chat_conversations WHERE visitor_email = ?',
          [email]
        );

        // contact_submissions: search inside JSON data column
        const allSubmissions = safeQuery(db, 'SELECT id, data FROM contact_submissions', []) as {
          id: number;
          data: string;
        }[];
        const matchingIds = allSubmissions
          .filter((s) => {
            try {
              return s.data && s.data.includes(email);
            } catch {
              return false;
            }
          })
          .map((s) => s.id);

        let submissionsDeleted = 0;
        if (matchingIds.length > 0) {
          const placeholders = matchingIds.map(() => '?').join(',');
          submissionsDeleted = safeRun(
            db,
            `DELETE FROM contact_submissions WHERE id IN (${placeholders})`,
            matchingIds
          );
        }
        counts.contact_submissions = submissionsDeleted;

        // Anonymize inbox_messages instead of deleting
        counts.inbox_messages = safeRun(
          db,
          "UPDATE inbox_messages SET from_email = 'deleted@dsgvo.local', from_name = 'Gelöscht' WHERE from_email = ?",
          [email]
        );
      });

      deleteAll();

      logAudit(
        'dsgvo_delete_by_email',
        { email, counts },
        'dsgvo',
        undefined,
        ip
      );

      return NextResponse.json({ success: true, email, deleted: counts });
    }

    // -----------------------------------------------------------------------
    // action: cleanup_old
    // -----------------------------------------------------------------------
    if (action === 'cleanup_old') {
      const retentionRow = db
        .prepare("SELECT value FROM settings WHERE key = 'data_retention_days'")
        .get() as { value: string } | undefined;
      const retentionDays = retentionRow ? parseInt(retentionRow.value, 10) : 365;

      const cutoff = `-${retentionDays} days`;
      const counts: Record<string, number> = {};

      const cleanup = db.transaction(() => {
        // Delete chat_messages belonging to old conversations
        const oldConversations = safeQuery(
          db,
          "SELECT id FROM chat_conversations WHERE created_at < datetime('now', ?)",
          [cutoff]
        ) as { id: number }[];

        let chatMessagesDeleted = 0;
        if (oldConversations.length > 0) {
          const placeholders = oldConversations.map(() => '?').join(',');
          const ids = oldConversations.map((c) => c.id);
          chatMessagesDeleted = safeRun(
            db,
            `DELETE FROM chat_messages WHERE conversation_id IN (${placeholders})`,
            ids
          );
        }
        counts.chat_messages = chatMessagesDeleted;

        counts.chat_conversations = safeRun(
          db,
          "DELETE FROM chat_conversations WHERE created_at < datetime('now', ?)",
          [cutoff]
        );

        // Only delete read contact_submissions older than retention period
        counts.contact_submissions = safeRun(
          db,
          "DELETE FROM contact_submissions WHERE is_read = 1 AND created_at < datetime('now', ?)",
          [cutoff]
        );
      });

      cleanup();

      logAudit(
        'dsgvo_cleanup_old',
        { retention_days: retentionDays, counts },
        'dsgvo',
        undefined,
        ip
      );

      return NextResponse.json({
        success: true,
        retention_days: retentionDays,
        deleted: counts,
      });
    }

    // -----------------------------------------------------------------------
    // action: anonymize_ip
    // -----------------------------------------------------------------------
    if (action === 'anonymize_ip') {
      // Find contact_submissions older than 7 days with a non-anonymized IP
      const rows = safeQuery(
        db,
        "SELECT id, ip_address FROM contact_submissions WHERE ip_address IS NOT NULL AND ip_address != '' AND created_at < datetime('now', '-7 days')",
        []
      ) as { id: number; ip_address: string }[];

      let anonymized = 0;
      for (const row of rows) {
        const parts = row.ip_address.split('.');
        // Only anonymize valid IPv4 addresses that are not already anonymized
        if (parts.length === 4 && parts[3] !== '0') {
          parts[3] = '0';
          const anonymizedIp = parts.join('.');
          const changed = safeRun(
            db,
            'UPDATE contact_submissions SET ip_address = ? WHERE id = ?',
            [anonymizedIp, row.id]
          );
          anonymized += changed;
        }
      }

      logAudit(
        'dsgvo_anonymize_ip',
        { anonymized },
        'dsgvo',
        undefined,
        ip
      );

      return NextResponse.json({ success: true, anonymized });
    }

    return NextResponse.json(
      { error: 'Unbekannte Aktion. Erlaubt: "delete_by_email", "cleanup_old", "anonymize_ip".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DSGVO] POST Fehler:', error);
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 });
  }
}
