const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'elvora.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('Setting up Elvora database at:', DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
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
`;

// Execute schema
db.exec(schema);
console.log('Tables created successfully.');

// Insert default settings
const insertSetting = db.prepare(
  'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
);

const defaults = {
  target_cities: JSON.stringify(['Essen', 'Dortmund', 'Bochum', 'Duisburg']),
  keywords: JSON.stringify(['Sanitär', 'Heizung', 'Klempner', 'SHK']),
  score_threshold: '85',
  scan_schedule: 'daily_3am',
  calendly_url: 'https://calendly.com/elvora-meeting/30min',
};

const insertMany = db.transaction((settings) => {
  for (const [key, value] of Object.entries(settings)) {
    insertSetting.run(key, value);
  }
});

insertMany(defaults);
console.log('Default settings inserted.');

// Verify
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
console.log(`Settings in database: ${settingsCount.count}`);

db.close();
console.log('Database setup complete.');
