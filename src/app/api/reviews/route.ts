import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Table bootstrap — runs once per process via a module-level flag
// ---------------------------------------------------------------------------
let tablesReady = false;

function ensureTables() {
  if (tablesReady) return;
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS review_widgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        business_name TEXT DEFAULT '',
        google_place_id TEXT,
        display_mode TEXT DEFAULT 'carousel' CHECK(display_mode IN ('carousel','grid','badge','wall')),
        theme TEXT DEFAULT 'light' CHECK(theme IN ('light','dark')),
        color TEXT DEFAULT '#8B5CF6',
        max_display INTEGER DEFAULT 6,
        min_rating INTEGER DEFAULT 4,
        show_rating_summary INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS review_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        author_avatar TEXT,
        rating INTEGER NOT NULL DEFAULT 5,
        text TEXT,
        source TEXT DEFAULT 'manual' CHECK(source IN ('manual','google')),
        review_date TEXT,
        is_visible INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (widget_id) REFERENCES review_widgets(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_review_entries_widget ON review_entries(widget_id);
    `);

    // Seed default widget + sample reviews
    const existing = db.prepare("SELECT id FROM review_widgets WHERE slug = 'default'").get();
    if (!existing) {
      const res = db.prepare(
        "INSERT INTO review_widgets (name, slug, business_name, display_mode, theme, color, max_display, min_rating, show_rating_summary) VALUES (?, ?, ?, 'carousel', 'light', '#8B5CF6', 6, 4, 1)"
      ).run('Bewertungen', 'default', 'Mein Unternehmen');

      const wid = res.lastInsertRowid;
      const ins = db.prepare(
        "INSERT INTO review_entries (widget_id, author_name, rating, text, source, review_date, is_visible) VALUES (?, ?, ?, ?, 'manual', ?, 1)"
      );

      ins.run(wid, 'Thomas Mueller', 5,
        'Hervorragende Arbeit! Die neue Website sieht nicht nur fantastisch aus, sondern hat unsere Anfragen um 40% gesteigert. Das Team war jederzeit erreichbar und hat unsere Wuensche perfekt umgesetzt. Absolute Empfehlung fuer jeden Handwerksbetrieb!',
        '2025-11-15');

      ins.run(wid, 'Sandra Weber', 5,
        'Wir sind begeistert von der neuen Website. Endlich werden wir bei Google gefunden und bekommen regelmaessig neue Kundenanfragen. Der gesamte Prozess war unkompliziert und professionell. Vielen Dank!',
        '2025-12-03');

      ins.run(wid, 'Michael Braun', 4,
        'Sehr gute Zusammenarbeit und tolles Ergebnis. Die Website ist modern, schnell und mobiloptimiert. Einzig die Abstimmungsphase haette etwas kuerzer sein koennen, aber das Endergebnis ueberzeugt voll und ganz.',
        '2026-01-20');

      ins.run(wid, 'Christina Hoffmann', 5,
        'Von der Beratung bis zur fertigen Website alles aus einem Guss. Besonders beeindruckt hat mich die SEO-Optimierung — wir sind jetzt auf Seite 1 bei Google fuer unsere wichtigsten Suchbegriffe. Top Service!',
        '2026-03-08');
    }

    tablesReady = true;
  } catch (e) {
    console.error('[Reviews] Table bootstrap error:', e);
  }
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  ensureTables();
  const db = getDb();
  const url = request.nextUrl;
  const action = url.searchParams.get('action');

  // ---- PUBLIC: widget + reviews for embed ----
  if (action === 'widget') {
    const slug = url.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });
    }

    const widget = db.prepare(
      "SELECT * FROM review_widgets WHERE slug = ? AND is_active = 1"
    ).get(slug) as Record<string, unknown> | undefined;

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    const reviews = db.prepare(
      "SELECT id, author_name, author_avatar, rating, text, source, review_date FROM review_entries WHERE widget_id = ? AND is_visible = 1 AND rating >= ? ORDER BY review_date DESC LIMIT ?"
    ).all(widget.id, widget.min_rating, widget.max_display);

    // Allow cross-origin access for the embed script
    return NextResponse.json({ widget, reviews }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  }

  // ---- All remaining GET actions require auth ----
  const authError = requireAuth(request);
  if (authError) return authError;

  if (action === 'widgets') {
    const widgets = db.prepare("SELECT * FROM review_widgets ORDER BY created_at DESC").all() as Record<string, unknown>[];

    // Attach review count + average for each widget
    for (const w of widgets) {
      const stats = db.prepare(
        "SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg_rating FROM review_entries WHERE widget_id = ? AND is_visible = 1"
      ).get(w.id) as { count: number; avg_rating: number };
      w.review_count = stats.count;
      w.avg_rating = Math.round(stats.avg_rating * 10) / 10;
    }

    return NextResponse.json({ widgets });
  }

  if (action === 'reviews') {
    const widgetId = url.searchParams.get('widget_id');
    if (!widgetId) {
      return NextResponse.json({ error: 'widget_id parameter required' }, { status: 400 });
    }
    const reviews = db.prepare(
      "SELECT * FROM review_entries WHERE widget_id = ? ORDER BY created_at DESC"
    ).all(parseInt(widgetId));

    return NextResponse.json({ reviews });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  ensureTables();

  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const body = await request.json();
  const { action } = body;

  // ---- create_widget ----
  if (action === 'create_widget') {
    const { name, slug, business_name, google_place_id, display_mode, theme, color, max_display, min_rating, show_rating_summary } = body;
    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    }
    try {
      const res = db.prepare(`
        INSERT INTO review_widgets (name, slug, business_name, google_place_id, display_mode, theme, color, max_display, min_rating, show_rating_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        slug,
        business_name || '',
        google_place_id || null,
        display_mode || 'carousel',
        theme || 'light',
        color || '#8B5CF6',
        max_display ?? 6,
        min_rating ?? 4,
        show_rating_summary ?? 1
      );
      return NextResponse.json({ success: true, id: res.lastInsertRowid });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE')) {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      }
      throw e;
    }
  }

  // ---- update_widget ----
  if (action === 'update_widget') {
    const { id, name, slug, business_name, google_place_id, display_mode, theme, color, max_display, min_rating, show_rating_summary, is_active } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    db.prepare(`
      UPDATE review_widgets
      SET name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          business_name = COALESCE(?, business_name),
          google_place_id = COALESCE(?, google_place_id),
          display_mode = COALESCE(?, display_mode),
          theme = COALESCE(?, theme),
          color = COALESCE(?, color),
          max_display = COALESCE(?, max_display),
          min_rating = COALESCE(?, min_rating),
          show_rating_summary = COALESCE(?, show_rating_summary),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name ?? null,
      slug ?? null,
      business_name ?? null,
      google_place_id ?? null,
      display_mode ?? null,
      theme ?? null,
      color ?? null,
      max_display ?? null,
      min_rating ?? null,
      show_rating_summary ?? null,
      is_active ?? null,
      id
    );
    return NextResponse.json({ success: true });
  }

  // ---- delete_widget ----
  if (action === 'delete_widget') {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    db.prepare("DELETE FROM review_widgets WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  }

  // ---- add_review ----
  if (action === 'add_review') {
    const { widget_id, author_name, author_avatar, rating, text, source, review_date } = body;
    if (!widget_id || !author_name) {
      return NextResponse.json({ error: 'widget_id and author_name are required' }, { status: 400 });
    }
    const res = db.prepare(`
      INSERT INTO review_entries (widget_id, author_name, author_avatar, rating, text, source, review_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      widget_id,
      author_name,
      author_avatar || null,
      rating ?? 5,
      text || null,
      source || 'manual',
      review_date || new Date().toISOString().split('T')[0]
    );
    return NextResponse.json({ success: true, id: res.lastInsertRowid });
  }

  // ---- update_review ----
  if (action === 'update_review') {
    const { id, author_name, rating, text, is_visible } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    db.prepare(`
      UPDATE review_entries
      SET author_name = COALESCE(?, author_name),
          rating = COALESCE(?, rating),
          text = COALESCE(?, text),
          is_visible = COALESCE(?, is_visible)
      WHERE id = ?
    `).run(
      author_name ?? null,
      rating ?? null,
      text ?? null,
      is_visible ?? null,
      id
    );
    return NextResponse.json({ success: true });
  }

  // ---- delete_review ----
  if (action === 'delete_review') {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    db.prepare("DELETE FROM review_entries WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
