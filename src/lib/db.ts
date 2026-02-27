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
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','qualified','rejected','archived')),
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
`;

const DEFAULT_SETTINGS: Record<string, string> = {
  target_cities: JSON.stringify(['Essen', 'Dortmund', 'Bochum', 'Duisburg']),
  keywords: JSON.stringify(['Sanitär', 'Heizung', 'Klempner', 'SHK']),
  score_threshold: '85',
  scan_schedule: 'daily_3am',
  calendly_url: 'https://calendly.com/elvora-meeting/30min',
  api_key: '',
  google_maps_api_key: 'AIzaSyBIz-9lWsmnh32gO_SMdRl9w1197g0t7Xk',
  panel_password: '3ca8179b59ca670d0ed2cbe30ffea83993928f5b152bb1910221f44077f50a8a:95cc9e8e2affb49415041c7fc0a8203a8b6f2efab9f5df4f7ee994edade94e96e4e730c7e91bbddd30ee24c562728ceb6ba0f8c8fe1e920f4e0de6001de360c2',
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
  }
  return db;
}

export default getDb;
