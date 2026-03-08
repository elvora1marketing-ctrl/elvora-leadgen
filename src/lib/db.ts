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
  panel_password: 'e73f1685eeddd9c19c38e969b940a9f23ff4c82dc78e864d5ea4f41ab80dd985:87c73de3caeebf9129742b16a1a020631b6f42bbc2855f60f67474c61936aba80ad4020659f01a2240249e8dadfcd4b02865f6debb1a8881544300ed2b44a640',
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

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Auto-create tables if they don't exist
    db.exec(SCHEMA);

    // Migration: Update CHECK constraint to allow 'akquise' status
    // SQLite can't ALTER CHECK constraints, so we recreate the table
    try {
      const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get() as { sql: string } | undefined;
      if (tableInfo?.sql && !tableInfo.sql.includes("'akquise'")) {
        db.pragma('foreign_keys = OFF');
        db.exec(`
          CREATE TABLE IF NOT EXISTS leads_new (
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
          INSERT INTO leads_new SELECT * FROM leads;
          DROP TABLE leads;
          ALTER TABLE leads_new RENAME TO leads;
          CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
          CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
          CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
          CREATE INDEX IF NOT EXISTS idx_leads_contact_status ON leads(contact_status);
          CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website_normalized);
        `);
        db.pragma('foreign_keys = ON');
        console.log('[DB] Migration: akquise status added to leads table');
      }
    } catch (e) {
      console.error('[DB] Migration error:', e);
      db.pragma('foreign_keys = ON');
    }

    // Migration: Add engagement_score and engagement_signals columns if missing
    try {
      const colCheck = db.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNames = colCheck.map(c => c.name);
      if (!colNames.includes('engagement_score')) {
        db.exec("ALTER TABLE leads ADD COLUMN engagement_score INTEGER DEFAULT 0");
        console.log('[DB] Migration: added engagement_score column');
      }
      if (!colNames.includes('engagement_signals')) {
        db.exec("ALTER TABLE leads ADD COLUMN engagement_signals TEXT DEFAULT '{}'");
        console.log('[DB] Migration: added engagement_signals column');
      }
    } catch (e) {
      console.error('[DB] Engagement columns migration error:', e);
    }

    // Insert default settings (only if not already set)
    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    );
    const insertDefaults = db.transaction(() => {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        insertSetting.run(key, value);
      }
    });
    insertDefaults();

    // Migration: Update panel password to new value
    try {
      const newHash = DEFAULT_SETTINGS.panel_password;
      db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'panel_password' AND value != ?").run(newHash, newHash);
    } catch (e) {
      console.error('[DB] Panel password migration error:', e);
    }
  }
  return db;
}

export default getDb;
