import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat
 * Actions:
 *   ?action=widget&id=X       — public: returns widget config
 *   ?action=conversations      — auth: returns all conversations with last message
 *   ?action=messages&conversation_id=X — auth: returns messages for a conversation
 *   ?action=widgets            — auth: returns all widgets
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    // Public endpoint: get widget config
    if (action === 'widget') {
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: 'Widget-ID fehlt' }, { status: 400 });
      }
      const widget = db.prepare(
        'SELECT id, name, greeting_message, placeholder_text, color, position, offline_message, auto_replies, is_active FROM chat_widgets WHERE id = ?'
      ).get(Number(id));
      if (!widget) {
        return NextResponse.json({ error: 'Widget nicht gefunden' }, { status: 404 });
      }
      return NextResponse.json({ widget });
    }

    // Public: get messages for a conversation (needed by widget polling)
    if (action === 'messages') {
      const conversationId = searchParams.get('conversation_id');
      if (!conversationId) {
        return NextResponse.json({ error: 'conversation_id fehlt' }, { status: 400 });
      }
      const messages = db.prepare(
        'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC'
      ).all(Number(conversationId));
      return NextResponse.json({ messages });
    }

    // All other actions require auth
    const authError = requireAuth(request);
    if (authError) return authError;

    if (action === 'conversations') {
      const status = searchParams.get('status');
      const whereClause = status ? 'WHERE c.status = ?' : '';
      const params = status ? [status] : [];
      const conversations = db.prepare(`
        SELECT c.*,
          (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT sender FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sender,
          (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
          w.name as widget_name
        FROM chat_conversations c
        LEFT JOIN chat_widgets w ON c.widget_id = w.id
        ${whereClause}
        ORDER BY c.updated_at DESC
      `).all(...params);
      return NextResponse.json({ conversations });
    }

    if (action === 'widgets') {
      const widgets = db.prepare(
        'SELECT * FROM chat_widgets ORDER BY created_at DESC'
      ).all();
      return NextResponse.json({ widgets });
    }

    return NextResponse.json({ error: 'Ungueltige Aktion' }, { status: 400 });
  } catch (error) {
    console.error('Chat GET error:', error);
    return NextResponse.json({ error: 'Chat-Fehler' }, { status: 500 });
  }
}

/**
 * POST /api/chat
 * Body: { action: string, ...params }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { action } = body;

    // Public actions (no auth required)
    if (action === 'send_message') {
      const { conversation_id, sender, content } = body;
      if (!conversation_id || !sender || !content) {
        return NextResponse.json({ error: 'conversation_id, sender und content sind erforderlich' }, { status: 400 });
      }

      // Insert the message
      const result = db.prepare(
        'INSERT INTO chat_messages (conversation_id, sender, content) VALUES (?, ?, ?)'
      ).run(conversation_id, sender, content);

      const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid);

      // Update conversation timestamp
      db.prepare(
        "UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?"
      ).run(conversation_id);

      // If visitor, increment unread count
      if (sender === 'visitor') {
        db.prepare(
          'UPDATE chat_conversations SET unread_count = unread_count + 1 WHERE id = ?'
        ).run(conversation_id);

        // Check auto-replies
        const conversation = db.prepare(
          'SELECT widget_id FROM chat_conversations WHERE id = ?'
        ).get(conversation_id) as { widget_id: number } | undefined;

        if (conversation) {
          const widget = db.prepare(
            'SELECT auto_replies FROM chat_widgets WHERE id = ?'
          ).get(conversation.widget_id) as { auto_replies: string } | undefined;

          if (widget?.auto_replies) {
            try {
              const autoReplies = JSON.parse(widget.auto_replies) as Array<{ q: string; a: string }>;
              const lowerContent = content.toLowerCase();

              // Find first matching auto-reply
              const match = autoReplies.find(
                (entry) => lowerContent.includes(entry.q.toLowerCase())
              );

              if (match) {
                db.prepare(
                  'INSERT INTO chat_messages (conversation_id, sender, content) VALUES (?, ?, ?)'
                ).run(conversation_id, 'bot', match.a);
                db.prepare(
                  "UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?"
                ).run(conversation_id);
              }
            } catch {
              // Invalid JSON in auto_replies, skip
            }
          }
        }
      }

      // Return all messages for the conversation (includes any auto-reply)
      const messages = db.prepare(
        'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC'
      ).all(conversation_id);

      return NextResponse.json({ message, messages });
    }

    if (action === 'new_conversation') {
      const { widget_id, visitor_name, visitor_email, visitor_page } = body;
      if (!widget_id) {
        return NextResponse.json({ error: 'widget_id ist erforderlich' }, { status: 400 });
      }

      // Verify widget exists and is active
      const widget = db.prepare(
        'SELECT * FROM chat_widgets WHERE id = ? AND is_active = 1'
      ).get(widget_id) as { id: number; greeting_message: string } | undefined;

      if (!widget) {
        return NextResponse.json({ error: 'Widget nicht gefunden oder inaktiv' }, { status: 404 });
      }

      // Create conversation
      const result = db.prepare(
        'INSERT INTO chat_conversations (widget_id, visitor_name, visitor_email, visitor_page) VALUES (?, ?, ?, ?)'
      ).run(widget_id, visitor_name || '', visitor_email || '', visitor_page || '');

      const conversationId = result.lastInsertRowid;

      // Auto-send greeting message as bot
      if (widget.greeting_message) {
        db.prepare(
          'INSERT INTO chat_messages (conversation_id, sender, content) VALUES (?, ?, ?)'
        ).run(conversationId, 'bot', widget.greeting_message);
      }

      const conversation = db.prepare(
        'SELECT * FROM chat_conversations WHERE id = ?'
      ).get(conversationId);
      const messages = db.prepare(
        'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC'
      ).all(conversationId);

      return NextResponse.json({ conversation, messages });
    }

    // All remaining actions require auth
    const authError = requireAuth(request);
    if (authError) return authError;

    if (action === 'update_widget') {
      const { id, ...fields } = body;
      if (!id) {
        return NextResponse.json({ error: 'Widget-ID fehlt' }, { status: 400 });
      }

      // Remove action from fields
      delete fields.action;

      const allowedFields = ['name', 'greeting_message', 'placeholder_text', 'color', 'position', 'offline_message', 'auto_replies', 'is_active'];
      const updates: string[] = [];
      const values: (string | number)[] = [];

      for (const [key, value] of Object.entries(fields)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value as string | number);
        }
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'Keine gueltigen Felder zum Aktualisieren' }, { status: 400 });
      }

      values.push(id);
      db.prepare(`UPDATE chat_widgets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const widget = db.prepare('SELECT * FROM chat_widgets WHERE id = ?').get(id);
      return NextResponse.json({ widget });
    }

    if (action === 'create_widget') {
      const { name, greeting_message, placeholder_text, color, position, offline_message, auto_replies, is_active } = body;
      if (!name) {
        return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
      }

      const result = db.prepare(`
        INSERT INTO chat_widgets (name, greeting_message, placeholder_text, color, position, offline_message, auto_replies, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        greeting_message || '',
        placeholder_text || '',
        color || '#8B5CF6',
        position || 'bottom-right',
        offline_message || '',
        typeof auto_replies === 'object' ? JSON.stringify(auto_replies) : (auto_replies || '[]'),
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      );

      const widget = db.prepare('SELECT * FROM chat_widgets WHERE id = ?').get(result.lastInsertRowid);
      return NextResponse.json({ widget });
    }

    if (action === 'delete_widget') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'Widget-ID fehlt' }, { status: 400 });
      }

      db.prepare('DELETE FROM chat_widgets WHERE id = ?').run(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'resolve') {
      const { conversation_id } = body;
      if (!conversation_id) {
        return NextResponse.json({ error: 'conversation_id fehlt' }, { status: 400 });
      }

      db.prepare(
        "UPDATE chat_conversations SET status = 'resolved', updated_at = datetime('now') WHERE id = ?"
      ).run(conversation_id);

      const conversation = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(conversation_id);
      return NextResponse.json({ conversation });
    }

    if (action === 'mark_read') {
      const { conversation_id } = body;
      if (!conversation_id) {
        return NextResponse.json({ error: 'conversation_id fehlt' }, { status: 400 });
      }

      db.prepare(
        "UPDATE chat_conversations SET unread_count = 0, updated_at = datetime('now') WHERE id = ?"
      ).run(conversation_id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ungueltige Aktion' }, { status: 400 });
  } catch (error) {
    console.error('Chat POST error:', error);
    return NextResponse.json({ error: 'Chat-Fehler' }, { status: 500 });
  }
}
