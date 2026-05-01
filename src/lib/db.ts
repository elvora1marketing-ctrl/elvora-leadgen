import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'elvora.db');

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website_original TEXT,
  website_normalized TEXT UNIQUE NOT NULL,
  phone TEXT,
  phone_normalized TEXT,
  email TEXT,
  city TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  rating TEXT DEFAULT 'pending',
  screenshot_desktop TEXT,
  screenshot_mobile TEXT,
  problems TEXT,
  seo_issues TEXT,
  sales_pitch TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','qualified','rejected','archived','akquise')),
  contact_status TEXT DEFAULT 'not_contacted' CHECK(contact_status IN ('not_contacted','email_sent','called','meeting','proposal','won','lost')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
  notes TEXT,
  found_via_keywords TEXT,
  times_found INTEGER DEFAULT 1,
  is_chain BOOLEAN DEFAULT FALSE,
  deal_value REAL,
  followup_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  contacted_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  engagement_score INTEGER DEFAULT 0,
  engagement_signals TEXT DEFAULT '{}');

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_contact_status ON leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website_normalized);

CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  city TEXT NOT NULL,
  leads_found INTEGER DEFAULT 0,
  leads_new INTEGER DEFAULT 0,
  leads_duplicate INTEGER DEFAULT 0,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  city TEXT NOT NULL,
  website TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  problems TEXT DEFAULT '[]',
  seo_issues TEXT DEFAULT '[]',
  calendly_url TEXT,
  views INTEGER DEFAULT 0,
  cta_clicks INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_slug ON audit_pages(slug);
CREATE INDEX IF NOT EXISTS idx_audit_lead ON audit_pages(lead_id);

CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  step INTEGER NOT NULL DEFAULT 1,
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON follow_ups(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON follow_ups(lead_id);

CREATE TABLE IF NOT EXISTS email_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  tracking_id TEXT UNIQUE NOT NULL,
  opened_at TEXT,
  open_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracking_id ON email_tracking(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_lead ON email_tracking(lead_id);

CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('note','call','email','meeting','status_change','whatsapp')),
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON lead_activities(type);

CREATE TABLE IF NOT EXISTS scraper_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  max_pages INTEGER DEFAULT 5,
  status TEXT DEFAULT 'running' CHECK(status IN ('running','completed','error')),
  businesses_found INTEGER DEFAULT 0,
  businesses_imported INTEGER DEFAULT 0,
  businesses_duplicate INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]',
  results TEXT DEFAULT '[]',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_scraper_status ON scraper_jobs(status);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  is_read INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  source TEXT DEFAULT 'resend' CHECK(source IN ('resend','webhook','manual')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_lead ON inbox_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_inbox_read ON inbox_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_inbox_from ON inbox_messages(from_email);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  tracking_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('delivered','opened','clicked','bounced','complained','failed')),
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_events_lead ON email_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);

CREATE TABLE IF NOT EXISTS local_seo_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT UNIQUE NOT NULL,
  branche TEXT NOT NULL,
  stadt TEXT NOT NULL,
  response_data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_local_seo_cache_key ON local_seo_cache(cache_key);
`;

const DEFAULT_SETTINGS: Record<string, string> = {
  target_cities: JSON.stringify(['Essen', 'Dortmund', 'Bochum', 'Duisburg']),
  keywords: JSON.stringify(['Sanitär', 'Heizung', 'Klempner', 'SHK']),
  score_threshold: '85',
  scan_schedule: 'daily_3am',
  calendly_url: 'https://calendly.com/elvora-meeting/30min',
  api_key: '',
  google_maps_api_key: 'AIzaSyBIz-9lWsmnh32gO_SMdRl9w1197g0t7Xk',
  panel_password: '46e31e13945b0ec63966c7f36b05815418894a8cff915e3be9f76f8930522185:52dce6038bf34a3769de20b3fd7eae14aeb180a1d2cae84ba44bab3721bc74003a03526681626e50754aa90773c8e3b9a7d6423055fa1624654c6e7aeb1095dd',
  followup_enabled: 'true',
  followup_sequence: JSON.stringify([
    {
      step: 1,
      days: 3,
      subject: 'Kurze Nachfrage: Website-Analyse für {firmenname}',
      body: 'ich hatte Ihnen vor ein paar Tagen eine Analyse Ihrer Website {website} geschickt. Haben Sie die Mail gesehen?\n\nKurz zusammengefasst: Ihr Website-Score liegt bei {score}/100 – da gibt es ein paar Sachen, die Sie vermutlich Kunden kosten.\n\nFalls Sie Interesse haben, können wir gerne kurz telefonieren. 15 Minuten reichen völlig.',
    },
    {
      step: 2,
      days: 7,
      subject: 'Noch aktuell? Ihre Website-Probleme, {ansprechpartner}',
      body: 'ich melde mich nochmal kurz wegen Ihrer Website. Die Probleme, die wir gefunden haben, sind leider nicht von alleine weggegangen.\n\nAndere Betriebe in {stadt} investieren gerade in ihre Online-Präsenz – das heißt, je länger Sie warten, desto weiter fallen Sie zurück.\n\nSollen wir mal 15 Minuten telefonieren? Ich zeige Ihnen, was wir konkret für {firmenname} tun können.',
    },
    {
      step: 3,
      days: 14,
      subject: 'Letzter Hinweis: {score} Punkte für {firmenname}',
      body: 'letzte Nachricht von mir zu diesem Thema – ich möchte nicht nerven.\n\nIhre Website hat nach wie vor einen Score von {score}/100. Falls Sie in den nächsten Wochen etwas daran ändern möchten, melden Sie sich gerne.\n\nIch wünsche Ihnen alles Gute!',
    },
  ]),
  dataforseo_login: 'info@clean-scene.de',
  dataforseo_password: 'bc4a22162f210771',
  engagement_weights: JSON.stringify({
    email_opened: 15,
    email_opened_multiple: 25,
    audit_viewed: 20,
    audit_cta_clicked: 35,
    replied: 40,
    replied_positive: 50,
    website_score_bad: 10,
    has_phone: 5,
    has_email: 5,
    multiple_found: 5,
  }),
};

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const instance = new Database(DB_PATH);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');

    // Auto-create tables if they don't exist
    instance.exec(SCHEMA);

    // Migration: Update CHECK constraint to allow 'akquise' status
    // SQLite can't ALTER CHECK constraints, so we recreate the table
    try {
      const tableInfo = instance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get() as { sql: string } | undefined;
      if (tableInfo?.sql && !tableInfo.sql.includes("'akquise'")) {
        // Get existing column names to handle INSERT correctly
        const existingCols = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
        const colNames = existingCols.map(c => c.name);

        // Target columns for leads_new (base set without engagement/linkedin columns that are added later)
        const baseCols = [
          'id', 'name', 'website_original', 'website_normalized', 'phone', 'phone_normalized',
          'email', 'city', 'score', 'rating', 'screenshot_desktop', 'screenshot_mobile',
          'problems', 'seo_issues', 'sales_pitch', 'status', 'contact_status', 'priority',
          'notes', 'found_via_keywords', 'times_found', 'is_chain', 'deal_value',
          'followup_date', 'created_at', 'reviewed_at', 'contacted_at', 'updated_at', 'last_seen_at',
        ];
        // Only select columns that exist in both old and new table
        const selectCols = baseCols.filter(c => colNames.includes(c)).join(', ');

        instance.pragma('foreign_keys = OFF');
        instance.exec(`DROP TABLE IF EXISTS leads_new`);
        instance.exec(`
          CREATE TABLE leads_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            website_original TEXT,
            website_normalized TEXT UNIQUE NOT NULL,
            phone TEXT,
            phone_normalized TEXT,
            email TEXT,
            city TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            rating TEXT DEFAULT 'pending',
            screenshot_desktop TEXT,
            screenshot_mobile TEXT,
            problems TEXT,
            seo_issues TEXT,
            sales_pitch TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','qualified','rejected','archived','akquise')),
            contact_status TEXT DEFAULT 'not_contacted' CHECK(contact_status IN ('not_contacted','email_sent','called','meeting','proposal','won','lost')),
            priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
            notes TEXT,
            found_via_keywords TEXT,
            times_found INTEGER DEFAULT 1,
            is_chain BOOLEAN DEFAULT FALSE,
            deal_value REAL,
            followup_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            reviewed_at TEXT,
            contacted_at TEXT,
            updated_at TEXT DEFAULT (datetime('now')),
            last_seen_at TEXT DEFAULT (datetime('now'))
          );
          INSERT INTO leads_new (${selectCols}) SELECT ${selectCols} FROM leads;
          DROP TABLE leads;
          ALTER TABLE leads_new RENAME TO leads;
          CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
          CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
          CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
          CREATE INDEX IF NOT EXISTS idx_leads_contact_status ON leads(contact_status);
          CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website_normalized);
        `);
        instance.pragma('foreign_keys = ON');
        console.log('[DB] Migration: akquise status added to leads table');
      }
    } catch (e) {
      console.error('[DB] Migration error:', e);
      instance.pragma('foreign_keys = ON');
      // Clean up orphan table if migration failed
      try { instance.exec('DROP TABLE IF EXISTS leads_new'); } catch { /* ignore */ }
    }

    // Migration: Add engagement_score and engagement_signals columns if missing
    try {
      const colCheck = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNames = colCheck.map(c => c.name);
      if (!colNames.includes('engagement_score')) {
        instance.exec("ALTER TABLE leads ADD COLUMN engagement_score INTEGER DEFAULT 0");
        console.log('[DB] Migration: added engagement_score column');
      }
      if (!colNames.includes('engagement_signals')) {
        instance.exec("ALTER TABLE leads ADD COLUMN engagement_signals TEXT DEFAULT '{}'");
        console.log('[DB] Migration: added engagement_signals column');
      }
    } catch (e) {
      console.error('[DB] Engagement columns migration error:', e);
    }

    // Migration: Add linkedin_url and company columns if missing
    try {
      const colCheck2 = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNames2 = colCheck2.map(c => c.name);
      if (!colNames2.includes('linkedin_url')) {
        instance.exec("ALTER TABLE leads ADD COLUMN linkedin_url TEXT");
        instance.exec("CREATE INDEX IF NOT EXISTS idx_leads_linkedin ON leads(linkedin_url)");
        console.log('[DB] Migration: added linkedin_url column');
      }
      if (!colNames2.includes('company')) {
        instance.exec("ALTER TABLE leads ADD COLUMN company TEXT");
        console.log('[DB] Migration: added company column');
      }
    } catch (e) {
      console.error('[DB] LinkedIn columns migration error:', e);
    }

    // Insert default settings (only if not already set)
    const insertSetting = instance.prepare(
      "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    );
    const insertDefaults = instance.transaction(() => {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        insertSetting.run(key, value);
      }
    });
    insertDefaults();

    // Migration: Add CRM fields (expected_close_date, win_probability, lost_reason)
    try {
      const colCheckCrm = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNamesCrm = colCheckCrm.map(c => c.name);
      if (!colNamesCrm.includes('expected_close_date')) {
        instance.exec("ALTER TABLE leads ADD COLUMN expected_close_date TEXT");
        console.log('[DB] Migration: added expected_close_date column');
      }
      if (!colNamesCrm.includes('win_probability')) {
        instance.exec("ALTER TABLE leads ADD COLUMN win_probability INTEGER DEFAULT 50");
        console.log('[DB] Migration: added win_probability column');
      }
      if (!colNamesCrm.includes('lost_reason')) {
        instance.exec("ALTER TABLE leads ADD COLUMN lost_reason TEXT");
        console.log('[DB] Migration: added lost_reason column');
      }
    } catch (e) {
      console.error('[DB] CRM columns migration error:', e);
    }

    // Migration: Create tasks table
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER,
          title TEXT NOT NULL,
          description TEXT,
          type TEXT DEFAULT 'todo' CHECK(type IN ('todo','call','email','meeting','follow_up')),
          due_date TEXT,
          due_time TEXT,
          completed_at TEXT,
          is_completed INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, is_completed);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(is_completed);
      `);
    } catch (e) {
      console.error('[DB] Tasks table migration error:', e);
    }

    // Migration: Create tags + lead_tags tables
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT '#8B5CF6',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS lead_tags (
          lead_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (lead_id, tag_id),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_lead_tags_lead ON lead_tags(lead_id);
        CREATE INDEX IF NOT EXISTS idx_lead_tags_tag ON lead_tags(tag_id);
      `);
    } catch (e) {
      console.error('[DB] Tags tables migration error:', e);
    }

    // Migration: Update panel password to new value
    try {
      const newHash = DEFAULT_SETTINGS.panel_password;
      instance.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'panel_password' AND value != ?").run(newHash, newHash);
    } catch (e) {
      console.error('[DB] Panel password migration error:', e);
    }

    // Only set the singleton after ALL initialization succeeds
    db = instance;
  }
  return db;
}

export default getDb;
