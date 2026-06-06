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
  status TEXT DEFAULT 'running' CHECK(status IN ('running','completed','error','stopped')),
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
  panel_password: 'f6a39747405781ec8ad8996a921c53c5b52d8d28192b8326d8250e6c25ed6b4f:b48dec5b63e3ebd2945b773b5239152c118a778524af6beb2e6ff4ab726eb50f686edf1547cbeea62eb21e6e8581cb880d13b8c56d09dc724afb4978e3bb8dda',
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
  searxng_url: 'http://localhost:8888',
  brave_search_api_key: '',
  outreach_default_mails_per_hour: '60',
  outreach_prefer_entscheider: 'true',
  outreach_auto_send_enabled: 'false',
  outreach_auto_send_max_score: '50',
  agency_name: '',
  agency_address: '',
  agency_phone: '',
  agency_email: '',
  agency_tax_id: '',
  agency_bank_iban: '',
  agency_bank_bic: '',
  agency_bank_name: '',
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

    // Migration: Create website_snapshots + trigger_events for Phase 7 (Monitoring)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS website_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          score INTEGER,
          has_ssl INTEGER,
          is_reachable INTEGER DEFAULT 1,
          response_time_ms INTEGER,
          status_code INTEGER,
          problems_count INTEGER DEFAULT 0,
          checked_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_snapshots_lead ON website_snapshots(lead_id, checked_at);

        CREATE TABLE IF NOT EXISTS trigger_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          trigger_type TEXT NOT NULL,
          severity TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
          title TEXT NOT NULL,
          details TEXT,
          is_acted_on INTEGER DEFAULT 0,
          is_dismissed INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_triggers_lead ON trigger_events(lead_id);
        CREATE INDEX IF NOT EXISTS idx_triggers_active ON trigger_events(is_acted_on, is_dismissed, created_at);
      `);
    } catch (e) {
      console.error('[DB] Monitoring tables migration error:', e);
    }

    // Migration: Phase 8 - Konkurrenz-Vergleich
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS competitor_analyses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          competitor_name TEXT NOT NULL,
          competitor_website TEXT,
          competitor_score INTEGER,
          competitor_has_ssl INTEGER,
          competitor_response_ms INTEGER,
          analyzed_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_competitor_lead ON competitor_analyses(lead_id);
      `);
    } catch (e) {
      console.error('[DB] Competitor table migration error:', e);
    }

    // Migration: Phase 9 - Review Snapshots (Google-Bewertungs-Monitor)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS review_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          rating REAL,
          review_count INTEGER,
          checked_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_lead ON review_snapshots(lead_id, checked_at);
      `);
    } catch (e) {
      console.error('[DB] Review snapshots migration error:', e);
    }

    // Migration: Phase 4 - Contacts (Kontaktpersonen)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          role TEXT,
          email TEXT,
          phone TEXT,
          is_primary INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);
      `);
    } catch (e) {
      console.error('[DB] Contacts migration error:', e);
    }

    // Migration: Phase 6 - Proposals (Angebots-Tracking)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS proposals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          amount REAL,
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','viewed','accepted','rejected')),
          sent_at TEXT,
          notes TEXT,
          file_url TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
      `);
    } catch (e) {
      console.error('[DB] Proposals migration error:', e);
    }

    // Migration: Phase 10 - Smart Timing columns + Phase 11 - Predictive Score
    try {
      const cols = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('best_contact_hour')) {
        instance.exec("ALTER TABLE leads ADD COLUMN best_contact_hour INTEGER");
      }
      if (!colNames.includes('best_contact_day')) {
        instance.exec("ALTER TABLE leads ADD COLUMN best_contact_day TEXT");
      }
      if (!colNames.includes('predicted_close_probability')) {
        instance.exec("ALTER TABLE leads ADD COLUMN predicted_close_probability INTEGER");
      }
      if (!colNames.includes('predicted_reasons')) {
        instance.exec("ALTER TABLE leads ADD COLUMN predicted_reasons TEXT");
      }
    } catch (e) {
      console.error('[DB] Smart timing/predict migration error:', e);
    }

    // Migration: Proposal templates table + seed data
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS proposal_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          price_type TEXT DEFAULT 'once' CHECK(price_type IN ('once','monthly')),
          description TEXT,
          services TEXT DEFAULT '[]',
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      const tplCount = instance.prepare('SELECT COUNT(*) as c FROM proposal_templates').get() as { c: number };
      if (tplCount.c === 0) {
        const ins = instance.prepare('INSERT INTO proposal_templates (name, price, price_type, description, services, is_default) VALUES (?, ?, ?, ?, ?, ?)');
        ins.run('Website Relaunch', 2500, 'once', 'Moderner, mobiloptimierter Webauftritt der Kunden überzeugt', JSON.stringify(['Responsive Design', 'SEO-Grundoptimierung', 'Kontaktformular', 'Google Maps Integration', 'SSL-Zertifikat', 'Cookie-Banner (DSGVO)', '3 Unterseiten', 'CMS-Einweisung']), 1);
        ins.run('SEO Paket', 500, 'monthly', 'Monatliche Suchmaschinenoptimierung für mehr Sichtbarkeit', JSON.stringify(['Keyword-Recherche', 'OnPage-Optimierung', 'Google Business Profil', 'Monatliches Reporting', 'Lokale SEO', 'Content-Empfehlungen']), 0);
        ins.run('Komplett-Paket', 3500, 'once', 'Website Relaunch + 6 Monate SEO zum Vorteilspreis', JSON.stringify(['Alles aus Website Relaunch', 'Alles aus SEO Paket (6 Monate)', 'Premium-Design', 'Bis zu 8 Unterseiten', 'Blog-Setup', 'Social Media Verlinkung', 'Priority Support']), 0);
        console.log('[DB] Migration: seeded 3 default proposal templates');
      }
    } catch (e) {
      console.error('[DB] Proposal templates migration error:', e);
    }

    // Migration: Extended proposals columns
    try {
      const cols = instance.prepare("PRAGMA table_info(proposals)").all() as { name: string }[];
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('token')) {
        instance.exec("ALTER TABLE proposals ADD COLUMN token TEXT UNIQUE");
        instance.exec("ALTER TABLE proposals ADD COLUMN template_id INTEGER");
        instance.exec("ALTER TABLE proposals ADD COLUMN services TEXT DEFAULT '[]'");
        instance.exec("ALTER TABLE proposals ADD COLUMN valid_until TEXT");
        instance.exec("ALTER TABLE proposals ADD COLUMN viewed_at TEXT");
        instance.exec("ALTER TABLE proposals ADD COLUMN accepted_at TEXT");
        instance.exec("ALTER TABLE proposals ADD COLUMN rejected_at TEXT");
        instance.exec("ALTER TABLE proposals ADD COLUMN client_message TEXT");
        instance.exec("ALTER TABLE proposals ADD COLUMN lead_data TEXT");
        instance.exec("ALTER TABLE proposals ADD COLUMN views INTEGER DEFAULT 0");
        instance.exec("CREATE INDEX IF NOT EXISTS idx_proposals_token ON proposals(token)");
        console.log('[DB] Migration: added extended proposal columns');
      }
    } catch (e) {
      console.error('[DB] Proposals columns migration error:', e);
    }

    // Migration: Clients + Client Messages + Client Files + MRR Snapshots
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          company_name TEXT NOT NULL,
          contact_name TEXT,
          contact_email TEXT,
          project_type TEXT,
          project_value REAL,
          monthly_value REAL DEFAULT 0,
          status TEXT DEFAULT 'onboarding' CHECK(status IN ('onboarding','active','paused','completed','churned')),
          progress_phase TEXT DEFAULT 'kickoff' CHECK(progress_phase IN ('kickoff','design','development','review','launch','done')),
          questionnaire_data TEXT,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          started_at TEXT,
          completed_at TEXT,
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_clients_lead ON clients(lead_id);
        CREATE INDEX IF NOT EXISTS idx_clients_token ON clients(token);

        CREATE TABLE IF NOT EXISTS client_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER NOT NULL,
          sender TEXT DEFAULT 'agency' CHECK(sender IN ('agency','client')),
          content TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_client_messages_client ON client_messages(client_id);

        CREATE TABLE IF NOT EXISTS client_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          filepath TEXT NOT NULL,
          uploaded_by TEXT DEFAULT 'agency' CHECK(uploaded_by IN ('agency','client')),
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_client_files_client ON client_files(client_id);

        CREATE TABLE IF NOT EXISTS mrr_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT NOT NULL UNIQUE,
          mrr REAL DEFAULT 0,
          active_clients INTEGER DEFAULT 0,
          churned_clients INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.error('[DB] Clients/MRR tables migration error:', e);
    }

    // Migration: Update panel password to new value
    try {
      const newHash = DEFAULT_SETTINGS.panel_password;
      instance.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'panel_password' AND value != ?").run(newHash, newHash);
    } catch (e) {
      console.error('[DB] Panel password migration error:', e);
    }

    // Migration: Add category column to leads
    try {
      const colCheckCat = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNamesCat = colCheckCat.map(c => c.name);
      if (!colNamesCat.includes('category')) {
        instance.exec("ALTER TABLE leads ADD COLUMN category TEXT");
        instance.exec("CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category)");
        console.log('[DB] Migration: added category column');
      }
    } catch (e) {
      console.error('[DB] Category column migration error:', e);
    }

    // Migration: Add multi-email + decision-maker columns
    try {
      const colCheckEmail = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNamesEmail = colCheckEmail.map(c => c.name);
      if (!colNamesEmail.includes('all_emails')) {
        instance.exec("ALTER TABLE leads ADD COLUMN all_emails TEXT");
        console.log('[DB] Migration: added all_emails column');
      }
      if (!colNamesEmail.includes('entscheider_name')) {
        instance.exec("ALTER TABLE leads ADD COLUMN entscheider_name TEXT");
        console.log('[DB] Migration: added entscheider_name column');
      }
      if (!colNamesEmail.includes('entscheider_email')) {
        instance.exec("ALTER TABLE leads ADD COLUMN entscheider_email TEXT");
        console.log('[DB] Migration: added entscheider_email column');
      }
    } catch (e) {
      console.error('[DB] Multi-email columns migration error:', e);
    }

    // Migration: Outreach campaigns + blacklist tables
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS outreach_campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','running','paused','completed','cancelled')),
          filters TEXT DEFAULT '{}',
          lead_count INTEGER DEFAULT 0,
          sent INTEGER DEFAULT 0,
          failed INTEGER DEFAULT 0,
          skipped INTEGER DEFAULT 0,
          opened INTEGER DEFAULT 0,
          replied INTEGER DEFAULT 0,
          bounced INTEGER DEFAULT 0,
          clicked INTEGER DEFAULT 0,
          mails_per_hour INTEGER DEFAULT 60,
          prefer_entscheider INTEGER DEFAULT 1,
          schedule_type TEXT DEFAULT 'immediate' CHECK(schedule_type IN ('immediate','business_hours')),
          subject_variant_b TEXT,
          ab_split INTEGER DEFAULT 0,
          job_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          started_at TEXT,
          completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_campaigns_status ON outreach_campaigns(status);

        CREATE TABLE IF NOT EXISTS outreach_campaign_leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          lead_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','skipped','opened','replied','bounced')),
          recipient TEXT,
          recipient_type TEXT,
          variant TEXT CHECK(variant IN ('A','B')),
          error_message TEXT,
          sent_at TEXT,
          opened_at TEXT,
          replied_at TEXT,
          FOREIGN KEY (campaign_id) REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON outreach_campaign_leads(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON outreach_campaign_leads(lead_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON outreach_campaign_leads(status);

        CREATE TABLE IF NOT EXISTS email_blacklist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          reason TEXT DEFAULT 'manual' CHECK(reason IN ('manual','bounce','unsubscribe','complaint')),
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_blacklist_email ON email_blacklist(email);
      `);
    } catch (e) {
      console.error('[DB] Outreach campaigns migration error:', e);
    }

    // Migration: Deal health + pipeline tracking columns on leads
    try {
      const cols = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('deal_health_score')) {
        instance.exec("ALTER TABLE leads ADD COLUMN deal_health_score INTEGER DEFAULT 50");
      }
      if (!colNames.includes('deal_insights')) {
        instance.exec("ALTER TABLE leads ADD COLUMN deal_insights TEXT DEFAULT '[]'");
      }
      if (!colNames.includes('close_date_changes')) {
        instance.exec("ALTER TABLE leads ADD COLUMN close_date_changes INTEGER DEFAULT 0");
      }
      if (!colNames.includes('last_activity_at')) {
        instance.exec("ALTER TABLE leads ADD COLUMN last_activity_at TEXT");
      }
      if (!colNames.includes('stage_entered_at')) {
        instance.exec("ALTER TABLE leads ADD COLUMN stage_entered_at TEXT");
      }
    } catch (e) {
      console.error('[DB] Deal health columns migration error:', e);
    }

    // Migration: Workflows + Workflow Logs
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS workflows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          trigger_config TEXT DEFAULT '{}',
          conditions TEXT DEFAULT '[]',
          actions TEXT DEFAULT '[]',
          is_active INTEGER DEFAULT 1,
          run_count INTEGER DEFAULT 0,
          last_run_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS workflow_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workflow_id INTEGER NOT NULL,
          lead_id INTEGER,
          trigger_type TEXT,
          actions_executed TEXT DEFAULT '[]',
          status TEXT DEFAULT 'success',
          error TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflow_id);
      `);
    } catch (e) {
      console.error('[DB] Workflows migration error:', e);
    }

    // Migration: Smart Lists
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS smart_lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT DEFAULT 'list',
          color TEXT DEFAULT '#8b5cf6',
          rules TEXT NOT NULL DEFAULT '[]',
          match_type TEXT DEFAULT 'all' CHECK(match_type IN ('all','any')),
          lead_count INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.error('[DB] Smart lists migration error:', e);
    }

    // Migration: Invoices
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT UNIQUE NOT NULL,
          token TEXT UNIQUE NOT NULL,
          lead_id INTEGER,
          client_id INTEGER,
          proposal_id INTEGER,
          recipient_name TEXT NOT NULL,
          recipient_address TEXT,
          recipient_email TEXT,
          items TEXT NOT NULL DEFAULT '[]',
          subtotal REAL NOT NULL DEFAULT 0,
          tax_rate REAL DEFAULT 19,
          tax_amount REAL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          currency TEXT DEFAULT 'EUR',
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','viewed','paid','overdue','cancelled')),
          due_date TEXT,
          paid_at TEXT,
          paid_amount REAL,
          payment_method TEXT,
          notes TEXT,
          is_recurring INTEGER DEFAULT 0,
          recurring_interval TEXT CHECK(recurring_interval IN ('monthly','quarterly','yearly')),
          next_recurring_date TEXT,
          views INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          sent_at TEXT,
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(token);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
      `);
    } catch (e) {
      console.error('[DB] Invoices migration error:', e);
    }

    // Migration: Sequences + Sequence Enrollments
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS sequences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          steps TEXT NOT NULL DEFAULT '[]',
          is_active INTEGER DEFAULT 1,
          enrolled_count INTEGER DEFAULT 0,
          completed_count INTEGER DEFAULT 0,
          reply_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sequence_enrollments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sequence_id INTEGER NOT NULL,
          lead_id INTEGER NOT NULL,
          current_step INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','replied','paused','bounced')),
          next_action_at TEXT,
          started_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT,
          FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON sequence_enrollments(sequence_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON sequence_enrollments(lead_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_next ON sequence_enrollments(next_action_at, status);
      `);
    } catch (e) {
      console.error('[DB] Sequences migration error:', e);
    }

    // Migration: Activity Goals
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS activity_goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_type TEXT NOT NULL,
          period TEXT DEFAULT 'daily' CHECK(period IN ('daily','weekly','monthly')),
          target INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.error('[DB] Activity goals migration error:', e);
    }

    // Migration: Pipeline Snapshots
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS pipeline_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_date TEXT NOT NULL,
          stage TEXT NOT NULL,
          lead_count INTEGER DEFAULT 0,
          total_value REAL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_pipeline_snapshots_date ON pipeline_snapshots(snapshot_date);
      `);
    } catch (e) {
      console.error('[DB] Pipeline snapshots migration error:', e);
    }

    // Migration: Products catalog
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          price_type TEXT DEFAULT 'once' CHECK(price_type IN ('once','monthly','hourly')),
          category TEXT DEFAULT 'service',
          tax_rate REAL DEFAULT 19,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      const prodCount = instance.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
      if (prodCount.c === 0) {
        const ins = instance.prepare('INSERT INTO products (name, description, price, price_type, sort_order) VALUES (?, ?, ?, ?, ?)');
        ins.run('Website Relaunch', 'Moderner, mobiloptimierter Webauftritt', 2500, 'once', 1);
        ins.run('SEO-Optimierung Basis', 'Monatliche SEO-Betreuung', 500, 'monthly', 2);
        ins.run('SEO-Optimierung Premium', 'Umfassende SEO-Strategie + Content', 1200, 'monthly', 3);
        ins.run('Google Ads Management', 'Kampagnen-Setup + monatliche Optimierung', 400, 'monthly', 4);
        ins.run('Logo & Branding', 'Logodesign + Corporate Design Basics', 800, 'once', 5);
        ins.run('Content-Erstellung', 'Texte, Bilder, Videos', 150, 'hourly', 6);
        ins.run('Website-Wartung', 'Updates, Backups, Security', 200, 'monthly', 7);
      }
    } catch (e) {
      console.error('[DB] Products migration error:', e);
    }

    // Migration: Playbooks
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS playbooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          stage TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '{}',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      const pbCount = instance.prepare('SELECT COUNT(*) as c FROM playbooks').get() as { c: number };
      if (pbCount.c === 0) {
        const ins = instance.prepare('INSERT INTO playbooks (name, stage, content) VALUES (?, ?, ?)');
        ins.run('Erstansprache', 'not_contacted', JSON.stringify({
          checklist: ['Website analysiert?', 'Score geprüft?', 'Email-Adresse vorhanden?', 'Ansprechpartner identifiziert?'],
          questions: [],
          objections: [],
          materials: ['Audit-Seite erstellen', 'Personalisierte Email vorbereiten'],
          next_step: 'Personalisierte Erstmail senden'
        }));
        ins.run('Qualifikation', 'called', JSON.stringify({
          checklist: ['Bedarf ermittelt?', 'Budget besprochen?', 'Timeline geklärt?', 'Entscheider identifiziert?'],
          questions: ['Was ist Ihr Hauptziel mit der neuen Website?', 'Welches Budget haben Sie eingeplant?', 'Bis wann soll das Projekt umgesetzt sein?', 'Wer entscheidet bei Ihnen über solche Projekte?'],
          objections: [
            { objection: 'Zu teuer', response: 'Vergleichen Sie den Preis mit dem Umsatz, den Sie durch eine bessere Website gewinnen. Unsere Kunden berichten von 30-50% mehr Anfragen.' },
            { objection: 'Kein Bedarf', response: 'Ihr Score liegt bei {score}/100. Das bedeutet, dass potenzielle Kunden Ihre Konkurrenz bevorzugen, weil deren Website besser performt.' },
            { objection: 'Schon einen Anbieter', response: 'Gerne — aber wenn Sie nicht zufrieden sind, können wir unverbindlich zeigen, was wir anders machen.' }
          ],
          materials: ['Case Study zeigen', 'Konkurrenz-Vergleich vorbereiten', 'ROI-Rechnung aufstellen'],
          next_step: 'Meeting vereinbaren und Angebot vorbereiten'
        }));
        ins.run('Abschluss', 'proposal', JSON.stringify({
          checklist: ['Angebot gesendet?', 'Angebot angesehen?', 'Rückfragen beantwortet?', 'Vertragsbedingungen geklärt?'],
          questions: ['Haben Sie noch Fragen zum Angebot?', 'Passt der Zeitplan für Sie?', 'Gibt es noch andere Entscheider die einbezogen werden müssen?'],
          objections: [
            { objection: 'Muss noch überlegen', response: 'Verstehe ich. Das Angebot ist noch X Tage gültig. Soll ich Ihnen die wichtigsten Punkte nochmal zusammenfassen?' },
            { objection: 'Konkurrenz-Angebot', response: 'Gerne vergleichen — achten Sie auf: Support nach Launch, SEO-Optimierung inklusive, und ob Updates im Preis enthalten sind.' }
          ],
          materials: ['Angebot nochmal senden', 'Referenzen/Testimonials', 'Zeitplan-Vorschlag'],
          next_step: 'Vertrag abschließen und Onboarding starten'
        }));
      }
    } catch (e) {
      console.error('[DB] Playbooks migration error:', e);
    }

    // Add new default settings for deal rotting + invoicing
    const newSettings: Record<string, string> = {
      deal_rot_days_not_contacted: '5',
      deal_rot_days_email_sent: '7',
      deal_rot_days_called: '5',
      deal_rot_days_meeting: '10',
      deal_rot_days_proposal: '14',
      invoice_prefix: 'RE-',
      invoice_next_number: '1001',
      invoice_default_due_days: '14',
      invoice_footer_text: '',
    };
    try {
      for (const [key, value] of Object.entries(newSettings)) {
        instance.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
      }
    } catch (e) {
      console.error('[DB] New settings migration error:', e);
    }

    // === Feature Wave 2: Revenue-Fokus ===

    // Meeting Bookings
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS booking_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_of_week INTEGER NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          is_active INTEGER DEFAULT 1
        );
      `);
      instance.exec(`
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          date TEXT NOT NULL,
          time_slot TEXT NOT NULL,
          duration INTEGER DEFAULT 30,
          message TEXT,
          status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','completed','no_show')),
          token TEXT UNIQUE,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id)
        );
      `);
      instance.exec("CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date, status)");
      const slotCount = instance.prepare('SELECT COUNT(*) as c FROM booking_slots').get() as { c: number };
      if (slotCount.c === 0) {
        const ins = instance.prepare('INSERT INTO booking_slots (day_of_week, start_time, end_time) VALUES (?, ?, ?)');
        for (let day = 0; day < 5; day++) {
          ins.run(day, '09:00', '10:00');
          ins.run(day, '10:00', '11:00');
          ins.run(day, '11:00', '12:00');
          ins.run(day, '14:00', '15:00');
          ins.run(day, '15:00', '16:00');
          ins.run(day, '16:00', '17:00');
        }
      }
    } catch (e) {
      console.error('[DB] Bookings migration error:', e);
    }

    // Referrals
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS referrals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          referrer_client_id INTEGER,
          referrer_name TEXT,
          referred_lead_id INTEGER,
          referred_name TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','contacted','won','lost')),
          deal_value REAL DEFAULT 0,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (referrer_client_id) REFERENCES clients(id),
          FOREIGN KEY (referred_lead_id) REFERENCES leads(id)
        );
      `);
    } catch (e) {
      console.error('[DB] Referrals migration error:', e);
    }

    // A/B Tests
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS ab_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          subject_a TEXT NOT NULL,
          subject_b TEXT NOT NULL,
          body_a TEXT,
          body_b TEXT,
          variant_a_sent INTEGER DEFAULT 0,
          variant_a_opened INTEGER DEFAULT 0,
          variant_a_clicked INTEGER DEFAULT 0,
          variant_a_replied INTEGER DEFAULT 0,
          variant_b_sent INTEGER DEFAULT 0,
          variant_b_opened INTEGER DEFAULT 0,
          variant_b_clicked INTEGER DEFAULT 0,
          variant_b_replied INTEGER DEFAULT 0,
          winner TEXT,
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','running','completed')),
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.error('[DB] AB Tests migration error:', e);
    }

    // Migration: Add account_id to ab_tests
    try {
      const abCols = instance.prepare("PRAGMA table_info(ab_tests)").all() as { name: string }[];
      if (!abCols.find(c => c.name === 'account_id')) {
        instance.exec("ALTER TABLE ab_tests ADD COLUMN account_id INTEGER REFERENCES accounts(id)");
        instance.exec("CREATE INDEX IF NOT EXISTS idx_ab_tests_account_id ON ab_tests(account_id)");
      }
    } catch (e) {
      console.error('[DB] AB tests account_id migration error:', e);
    }

    // Speed-to-lead: first_contacted_at on leads
    try {
      const leadCols2 = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const colNames2 = leadCols2.map(c => c.name);
      if (!colNames2.includes('first_contacted_at')) {
        instance.exec("ALTER TABLE leads ADD COLUMN first_contacted_at TEXT");
      }
      if (!colNames2.includes('referral_source')) {
        instance.exec("ALTER TABLE leads ADD COLUMN referral_source TEXT");
      }
    } catch (e) {
      console.error('[DB] Lead columns wave 2 error:', e);
    }

    // Proposal live tracking: last_viewed_at, view_notified
    try {
      const propCols = instance.prepare("PRAGMA table_info(proposals)").all() as { name: string }[];
      const propColNames = propCols.map(c => c.name);
      if (!propColNames.includes('last_viewed_at')) {
        instance.exec("ALTER TABLE proposals ADD COLUMN last_viewed_at TEXT");
      }
      if (!propColNames.includes('view_notified')) {
        instance.exec("ALTER TABLE proposals ADD COLUMN view_notified INTEGER DEFAULT 0");
      }
    } catch (e) {
      console.error('[DB] Proposal columns error:', e);
    }

    // Booking + revenue settings
    const wave2Settings: Record<string, string> = {
      booking_enabled: '1',
      booking_duration: '30',
      booking_buffer: '15',
      booking_advance_days: '14',
      booking_page_title: 'Termin buchen',
      booking_page_description: 'Wählen Sie einen passenden Termin für ein unverbindliches Erstgespräch.',
    };
    try {
      for (const [key, value] of Object.entries(wave2Settings)) {
        instance.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
      }
    } catch (e) {
      console.error('[DB] Wave 2 settings error:', e);
    }

    // Elvora Calendly: Event Types + Blocked Dates
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS booking_event_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          description TEXT,
          duration INTEGER DEFAULT 30,
          color TEXT DEFAULT '#8B5CF6',
          location TEXT DEFAULT 'Video-Call',
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      instance.exec(`
        CREATE TABLE IF NOT EXISTS booking_blocked_dates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          reason TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      const etCount = instance.prepare('SELECT COUNT(*) as c FROM booking_event_types').get() as { c: number };
      if (etCount.c === 0) {
        instance.prepare(`INSERT INTO booking_event_types (name, slug, description, duration, color, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          'Erstgespräch', 'erstgespraech', 'Kostenloses und unverbindliches Kennenlerngespräch.', 30, '#8B5CF6', 'Video-Call', 0
        );
        instance.prepare(`INSERT INTO booking_event_types (name, slug, description, duration, color, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          'Beratung', 'beratung', 'Ausführliche Beratung zu Ihrem Projekt.', 60, '#EC4899', 'Video-Call', 1
        );
        instance.prepare(`INSERT INTO booking_event_types (name, slug, description, duration, color, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          'Kurzcall', 'kurzcall', 'Schneller Austausch zu einer konkreten Frage.', 15, '#F97316', 'Telefon', 2
        );
      }
    } catch (e) {
      console.error('[DB] Booking event types migration error:', e);
    }

    // Migration: Add event_type_id to bookings
    try {
      const bookingCols = instance.prepare("PRAGMA table_info(bookings)").all() as { name: string }[];
      if (!bookingCols.find(c => c.name === 'event_type_id')) {
        instance.exec("ALTER TABLE bookings ADD COLUMN event_type_id INTEGER REFERENCES booking_event_types(id)");
      }
    } catch (e) {
      console.error('[DB] Bookings event_type_id migration error:', e);
    }

    // Migration: Projects (Auftragsverfolgung)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER,
          lead_id INTEGER,
          token TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          client_name TEXT NOT NULL,
          client_email TEXT,
          client_phone TEXT,
          status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','cancelled')),
          current_phase TEXT DEFAULT 'received',
          phases TEXT NOT NULL DEFAULT '[]',
          total_value REAL,
          start_date TEXT,
          estimated_end_date TEXT,
          completed_at TEXT,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_projects_token ON projects(token);
        CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

        CREATE TABLE IF NOT EXISTS project_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          phase TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          is_public INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);
      `);
    } catch (e) {
      console.error('[DB] Projects migration error:', e);
    }

    // Migration: Audit Log + DSGVO
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id INTEGER,
          details TEXT DEFAULT '{}',
          ip_address TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
      `);
    } catch (e) {
      console.error('[DB] Audit log migration error:', e);
    }

    // DSGVO privacy settings
    const privacySettings: Record<string, string> = {
      privacy_policy_url: '',
      impressum_url: '',
      data_retention_days: '365',
      email_tracking_enabled: '1',
    };
    try {
      for (const [key, value] of Object.entries(privacySettings)) {
        instance.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
      }
    } catch (e) {
      console.error('[DB] Privacy settings error:', e);
    }

    // Migration: Trusted Devices (Geräte-Whitelist)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS trusted_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_token TEXT UNIQUE NOT NULL,
          device_name TEXT,
          ip_address TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          last_used_at TEXT DEFAULT (datetime('now'))
        );
      `);
      instance.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run('device_whitelist_enabled', '0');
    } catch (e) {
      console.error('[DB] Trusted devices migration error:', e);
    }

    // Migration: Outbound Infrastructure (Multi-Domain Cold Email)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS sending_domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'warming' CHECK(status IN ('warming','active','paused','burned')),
          daily_limit INTEGER DEFAULT 50,
          sent_today INTEGER DEFAULT 0,
          sent_total INTEGER DEFAULT 0,
          dns_status TEXT DEFAULT '{"spf":false,"dkim":false,"dmarc":false}',
          health_score INTEGER DEFAULT 100,
          bounce_count INTEGER DEFAULT 0,
          complaint_count INTEGER DEFAULT 0,
          warm_start_date TEXT,
          warm_current_day INTEGER DEFAULT 0,
          resend_domain_id TEXT,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sending_domains_status ON sending_domains(status);

        CREATE TABLE IF NOT EXISTS sending_inboxes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain_id INTEGER NOT NULL,
          email TEXT UNIQUE NOT NULL,
          display_name TEXT,
          status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','burned')),
          sent_today INTEGER DEFAULT 0,
          daily_limit INTEGER DEFAULT 50,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (domain_id) REFERENCES sending_domains(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_sending_inboxes_domain ON sending_inboxes(domain_id);
        CREATE INDEX IF NOT EXISTS idx_sending_inboxes_status ON sending_inboxes(status);
      `);
      instance.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run('outbound_last_reset_date', '');
    } catch (e) {
      console.error('[DB] Outbound infrastructure migration error:', e);
    }

    // Migration: Add sending_domain_ids to outreach_campaigns
    try {
      const cols = instance.prepare("PRAGMA table_info(outreach_campaigns)").all() as { name: string }[];
      if (!cols.find(c => c.name === 'sending_domain_ids')) {
        instance.exec("ALTER TABLE outreach_campaigns ADD COLUMN sending_domain_ids TEXT");
      }
    } catch (e) {
      console.error('[DB] Campaign domain IDs migration error:', e);
    }

    // Migration: Add inbox_id to outreach_campaign_leads
    try {
      const cols = instance.prepare("PRAGMA table_info(outreach_campaign_leads)").all() as { name: string }[];
      if (!cols.find(c => c.name === 'inbox_id')) {
        instance.exec("ALTER TABLE outreach_campaign_leads ADD COLUMN inbox_id INTEGER");
      }
    } catch (e) {
      console.error('[DB] Campaign leads inbox migration error:', e);
    }

    // Migration: Multi-Tenant Accounts (Outbound-as-a-Service)
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          company TEXT,
          contact_name TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          status TEXT DEFAULT 'onboarding' CHECK(status IN ('onboarding','active','paused','churned')),
          icp_description TEXT,
          icp_industries TEXT DEFAULT '[]',
          icp_locations TEXT DEFAULT '[]',
          icp_company_sizes TEXT DEFAULT '[]',
          onboarding_completed INTEGER DEFAULT 0,
          monthly_fee REAL DEFAULT 0,
          contract_start TEXT,
          contract_end TEXT,
          notes TEXT,
          portal_token TEXT UNIQUE,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
        CREATE INDEX IF NOT EXISTS idx_accounts_portal_token ON accounts(portal_token);

        CREATE TABLE IF NOT EXISTS account_blacklists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          email TEXT NOT NULL,
          domain TEXT,
          reason TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_account_blacklists_account ON account_blacklists(account_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_account_blacklists_unique ON account_blacklists(account_id, email);
      `);
    } catch (e) {
      console.error('[DB] Accounts migration error:', e);
    }

    // Migration: Add account_id to key tables for multi-tenant isolation
    try {
      const tables = ['leads', 'outreach_campaigns', 'sending_domains', 'sequences', 'invoices'];
      for (const table of tables) {
        const cols = instance.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        if (!cols.find(c => c.name === 'account_id')) {
          instance.exec(`ALTER TABLE ${table} ADD COLUMN account_id INTEGER REFERENCES accounts(id)`);
          instance.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_account_id ON ${table}(account_id)`);
        }
      }
    } catch (e) {
      console.error('[DB] Account ID columns migration error:', e);
    }

    // Migration: Outgoing webhooks
    try {
      instance.exec(`
        CREATE TABLE IF NOT EXISTS webhook_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          events TEXT NOT NULL DEFAULT '[]',
          secret TEXT,
          active INTEGER DEFAULT 1,
          account_id INTEGER,
          last_triggered_at TEXT,
          last_status INTEGER,
          failure_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subscription_id INTEGER NOT NULL,
          event TEXT NOT NULL,
          payload TEXT,
          response_status INTEGER,
          response_body TEXT,
          duration_ms INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      console.error('[DB] Webhooks migration error:', e);
    }

    // Migration: Add html_signature to sending_inboxes
    try {
      const cols = instance.prepare("PRAGMA table_info(sending_inboxes)").all() as { name: string }[];
      if (!cols.find(c => c.name === 'html_signature')) {
        instance.exec("ALTER TABLE sending_inboxes ADD COLUMN html_signature TEXT");
      }
    } catch (e) {
      console.error('[DB] Inbox signature migration error:', e);
    }

    // Migration: Add config + completed_keywords to scraper_jobs for resume support
    try {
      const cols = instance.prepare("PRAGMA table_info(scraper_jobs)").all() as { name: string }[];
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('config')) {
        instance.exec("ALTER TABLE scraper_jobs ADD COLUMN config TEXT");
        console.log('[DB] Migration: added config column to scraper_jobs');
      }
      if (!colNames.includes('completed_keywords')) {
        instance.exec("ALTER TABLE scraper_jobs ADD COLUMN completed_keywords TEXT DEFAULT '[]'");
        console.log('[DB] Migration: added completed_keywords column to scraper_jobs');
      }
    } catch (e) {
      console.error('[DB] Scraper jobs resume columns migration error:', e);
    }

    // Migration: Allow 'stopped' status in scraper_jobs (SQLite can't ALTER CHECK, so recreate)
    try {
      const tableInfo = instance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='scraper_jobs'").get() as { sql: string } | undefined;
      if (tableInfo?.sql && !tableInfo.sql.includes("'stopped'")) {
        instance.pragma('foreign_keys = OFF');
        instance.exec(`
          CREATE TABLE IF NOT EXISTS scraper_jobs_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL,
            max_pages INTEGER DEFAULT 5,
            status TEXT DEFAULT 'running' CHECK(status IN ('running','completed','error','stopped')),
            businesses_found INTEGER DEFAULT 0,
            businesses_imported INTEGER DEFAULT 0,
            businesses_duplicate INTEGER DEFAULT 0,
            errors TEXT DEFAULT '[]',
            results TEXT DEFAULT '[]',
            config TEXT,
            completed_keywords TEXT DEFAULT '[]',
            started_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT
          );
          INSERT INTO scraper_jobs_new SELECT id, keyword, max_pages, status, businesses_found, businesses_imported, businesses_duplicate, errors, results, config, completed_keywords, started_at, completed_at FROM scraper_jobs;
          DROP TABLE scraper_jobs;
          ALTER TABLE scraper_jobs_new RENAME TO scraper_jobs;
          CREATE INDEX IF NOT EXISTS idx_scraper_status ON scraper_jobs(status);
        `);
        instance.pragma('foreign_keys = ON');
        console.log('[DB] Migration: scraper_jobs status now allows stopped');
      }
    } catch (e) {
      console.error('[DB] Scraper jobs status migration error:', e);
      instance.pragma('foreign_keys = ON');
      try { instance.exec('DROP TABLE IF EXISTS scraper_jobs_new'); } catch { /* ignore */ }
    }

    // Migration: Add lead_type column (entscheider vs business)
    try {
      const cols = instance.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      if (!cols.find(c => c.name === 'lead_type')) {
        instance.exec("ALTER TABLE leads ADD COLUMN lead_type TEXT DEFAULT 'business'");
        instance.exec("CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type)");
        instance.exec("UPDATE leads SET lead_type = 'entscheider' WHERE website_normalized LIKE 'linkedin:%'");
        console.log('[DB] Migration: added lead_type column');
      }
    } catch (e) {
      console.error('[DB] Lead type migration error:', e);
    }

    // Recovery: mark orphaned "running" jobs as "stopped" (resumable)
    // This happens when the server was restarted while jobs were running
    try {
      const orphaned = instance.prepare("UPDATE scraper_jobs SET status = 'stopped' WHERE status = 'running'").run();
      if (orphaned.changes > 0) {
        console.log(`[DB] Recovery: ${orphaned.changes} orphaned running job(s) marked as stopped (resumable)`);
      }
    } catch (e) {
      console.error('[DB] Recovery error:', e);
    }

    // Only set the singleton after ALL initialization succeeds
    db = instance;
  }
  return db;
}

export default getDb;
