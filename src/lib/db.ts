import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'elvora.db');

let db: Database.Database | null = null;

function lockFiles() {
  for (const ext of ['', '-wal', '-shm']) {
    const p = DB_PATH + ext;
    try { if (fs.existsSync(p)) fs.chmodSync(p, 0o600); } catch { /* Windows */ }
  }
}

// ---------------------------------------------------------------------------
// Default settings — INSERT OR IGNORE in migration 0
// ---------------------------------------------------------------------------

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
    { step: 1, days: 3, subject: 'Kurze Nachfrage: Website-Analyse für {firmenname}', body: 'ich hatte Ihnen vor ein paar Tagen eine Analyse Ihrer Website {website} geschickt. Haben Sie die Mail gesehen?\n\nKurz zusammengefasst: Ihr Website-Score liegt bei {score}/100 – da gibt es ein paar Sachen, die Sie vermutlich Kunden kosten.\n\nFalls Sie Interesse haben, können wir gerne kurz telefonieren. 15 Minuten reichen völlig.' },
    { step: 2, days: 7, subject: 'Noch aktuell? Ihre Website-Probleme, {ansprechpartner}', body: 'ich melde mich nochmal kurz wegen Ihrer Website. Die Probleme, die wir gefunden haben, sind leider nicht von alleine weggegangen.\n\nAndere Betriebe in {stadt} investieren gerade in ihre Online-Präsenz – das heißt, je länger Sie warten, desto weiter fallen Sie zurück.\n\nSollen wir mal 15 Minuten telefonieren? Ich zeige Ihnen, was wir konkret für {firmenname} tun können.' },
    { step: 3, days: 14, subject: 'Letzter Hinweis: {score} Punkte für {firmenname}', body: 'letzte Nachricht von mir zu diesem Thema – ich möchte nicht nerven.\n\nIhre Website hat nach wie vor einen Score von {score}/100. Falls Sie in den nächsten Wochen etwas daran ändern möchten, melden Sie sich gerne.\n\nIch wünsche Ihnen alles Gute!' },
  ]),
  dataforseo_login: 'info@clean-scene.de',
  dataforseo_password: 'bc4a22162f210771',
  engagement_weights: JSON.stringify({ email_opened: 15, email_opened_multiple: 25, audit_viewed: 20, audit_cta_clicked: 35, replied: 40, replied_positive: 50, website_score_bad: 10, has_phone: 5, has_email: 5, multiple_found: 5 }),
  searxng_url: 'http://localhost:8888',
  brave_search_api_key: '',
  outreach_default_mails_per_hour: '60',
  outreach_prefer_entscheider: 'true',
  outreach_auto_send_enabled: 'false',
  outreach_auto_send_max_score: '50',
  agency_name: '', agency_address: '', agency_phone: '', agency_email: '',
  agency_tax_id: '', agency_bank_iban: '', agency_bank_bic: '', agency_bank_name: '',
  deal_rot_days_not_contacted: '5', deal_rot_days_email_sent: '7',
  deal_rot_days_called: '5', deal_rot_days_meeting: '10', deal_rot_days_proposal: '14',
  invoice_prefix: 'RE-', invoice_next_number: '1001', invoice_default_due_days: '14', invoice_footer_text: '',
  booking_enabled: '1', booking_duration: '30', booking_buffer: '15', booking_advance_days: '14',
  booking_page_title: 'Termin buchen',
  booking_page_description: 'Wählen Sie einen passenden Termin für ein unverbindliches Erstgespräch.',
  privacy_policy_url: '', impressum_url: '', data_retention_days: '365', email_tracking_enabled: '1',
  device_whitelist_enabled: '0',
  chat_notification_email: '',
  outbound_last_reset_date: '',
  review_autopilot_enabled: '0', review_autopilot_delay_hours: '24', review_autopilot_channel: 'email',
  review_google_url: '',
  review_autopilot_subject: 'Wie war Ihr Termin bei uns?',
  review_autopilot_message: 'Hallo {{name}},\n\nvielen Dank für Ihren Besuch! Wenn Sie zufrieden waren, würden wir uns riesig über eine kurze Google-Bewertung freuen. Das dauert nur 30 Sekunden:\n\n{{link}}\n\nHerzlichen Dank!',
};

// ---------------------------------------------------------------------------
// Migrations — append-only, never change an existing entry
// ---------------------------------------------------------------------------

const migrations: ((inst: Database.Database) => void)[] = [
  // 0: Full consolidated schema (2026-06-09)
  (inst) => {
    inst.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        website_original TEXT,
        website_normalized TEXT UNIQUE NOT NULL,
        phone TEXT, phone_normalized TEXT, email TEXT,
        city TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        rating TEXT DEFAULT 'pending',
        screenshot_desktop TEXT, screenshot_mobile TEXT,
        problems TEXT, seo_issues TEXT, sales_pitch TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','qualified','rejected','archived','akquise')),
        contact_status TEXT DEFAULT 'not_contacted' CHECK(contact_status IN ('not_contacted','email_sent','called','meeting','proposal','won','lost')),
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
        notes TEXT, found_via_keywords TEXT,
        times_found INTEGER DEFAULT 1,
        is_chain BOOLEAN DEFAULT FALSE,
        deal_value REAL, followup_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        reviewed_at TEXT, contacted_at TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        last_seen_at TEXT DEFAULT (datetime('now')),
        engagement_score INTEGER DEFAULT 0,
        engagement_signals TEXT DEFAULT '{}',
        linkedin_url TEXT, company TEXT,
        expected_close_date TEXT,
        win_probability INTEGER DEFAULT 50,
        lost_reason TEXT,
        best_contact_hour INTEGER, best_contact_day TEXT,
        predicted_close_probability INTEGER, predicted_reasons TEXT,
        category TEXT,
        all_emails TEXT, entscheider_name TEXT, entscheider_email TEXT,
        deal_health_score INTEGER DEFAULT 50,
        deal_insights TEXT DEFAULT '[]',
        close_date_changes INTEGER DEFAULT 0,
        last_activity_at TEXT, stage_entered_at TEXT,
        first_contacted_at TEXT, referral_source TEXT,
        lead_type TEXT DEFAULT 'business',
        account_id INTEGER REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
      CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
      CREATE INDEX IF NOT EXISTS idx_leads_contact_status ON leads(contact_status);
      CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website_normalized);
      CREATE INDEX IF NOT EXISTS idx_leads_linkedin ON leads(linkedin_url);
      CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
      CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
      CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);

      CREATE TABLE IF NOT EXISTS scan_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL, city TEXT NOT NULL,
        leads_found INTEGER DEFAULT 0, leads_new INTEGER DEFAULT 0, leads_duplicate INTEGER DEFAULT 0,
        started_at TEXT DEFAULT (datetime('now')), completed_at TEXT,
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
        business_name TEXT NOT NULL, city TEXT NOT NULL, website TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        problems TEXT DEFAULT '[]', seo_issues TEXT DEFAULT '[]',
        calendly_url TEXT,
        views INTEGER DEFAULT 0, cta_clicks INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), expires_at TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_audit_slug ON audit_pages(slug);
      CREATE INDEX IF NOT EXISTS idx_audit_lead ON audit_pages(lead_id);

      CREATE TABLE IF NOT EXISTS follow_ups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        step INTEGER NOT NULL DEFAULT 1,
        scheduled_at TEXT NOT NULL, sent_at TEXT,
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
        opened_at TEXT, open_count INTEGER DEFAULT 0,
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
        businesses_found INTEGER DEFAULT 0, businesses_imported INTEGER DEFAULT 0, businesses_duplicate INTEGER DEFAULT 0,
        errors TEXT DEFAULT '[]', results TEXT DEFAULT '[]',
        config TEXT, completed_keywords TEXT DEFAULT '[]',
        started_at TEXT DEFAULT (datetime('now')), completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_scraper_status ON scraper_jobs(status);

      CREATE TABLE IF NOT EXISTS inbox_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        from_email TEXT NOT NULL, from_name TEXT, to_email TEXT,
        subject TEXT, body_text TEXT, body_html TEXT,
        message_id TEXT, in_reply_to TEXT,
        is_read INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0,
        source TEXT DEFAULT 'resend' CHECK(source IN ('resend','webhook','manual')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inbox_lead ON inbox_messages(lead_id);
      CREATE INDEX IF NOT EXISTS idx_inbox_read ON inbox_messages(is_read);
      CREATE INDEX IF NOT EXISTS idx_inbox_from ON inbox_messages(from_email);

      CREATE TABLE IF NOT EXISTS email_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER, tracking_id TEXT,
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
        branche TEXT NOT NULL, stadt TEXT NOT NULL,
        response_data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_local_seo_cache_key ON local_seo_cache(cache_key);

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        title TEXT NOT NULL, description TEXT,
        type TEXT DEFAULT 'todo' CHECK(type IN ('todo','call','email','meeting','follow_up')),
        due_date TEXT, due_time TEXT, completed_at TEXT,
        is_completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, is_completed);
      CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(is_completed);

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#8B5CF6',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS lead_tags (
        lead_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
        PRIMARY KEY (lead_id, tag_id),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_lead_tags_lead ON lead_tags(lead_id);
      CREATE INDEX IF NOT EXISTS idx_lead_tags_tag ON lead_tags(tag_id);

      CREATE TABLE IF NOT EXISTS website_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        score INTEGER, has_ssl INTEGER, is_reachable INTEGER DEFAULT 1,
        response_time_ms INTEGER, status_code INTEGER, problems_count INTEGER DEFAULT 0,
        checked_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_lead ON website_snapshots(lead_id, checked_at);

      CREATE TABLE IF NOT EXISTS trigger_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        trigger_type TEXT NOT NULL,
        severity TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
        title TEXT NOT NULL, details TEXT,
        is_acted_on INTEGER DEFAULT 0, is_dismissed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_triggers_lead ON trigger_events(lead_id);
      CREATE INDEX IF NOT EXISTS idx_triggers_active ON trigger_events(is_acted_on, is_dismissed, created_at);

      CREATE TABLE IF NOT EXISTS competitor_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        competitor_name TEXT NOT NULL, competitor_website TEXT,
        competitor_score INTEGER, competitor_has_ssl INTEGER, competitor_response_ms INTEGER,
        analyzed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_competitor_lead ON competitor_analyses(lead_id);

      CREATE TABLE IF NOT EXISTS review_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        rating REAL, review_count INTEGER,
        checked_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_lead ON review_snapshots(lead_id, checked_at);

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        name TEXT NOT NULL, role TEXT, email TEXT, phone TEXT,
        is_primary INTEGER DEFAULT 0, notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);

      CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        title TEXT NOT NULL, amount REAL,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','viewed','accepted','rejected')),
        sent_at TEXT, notes TEXT, file_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        token TEXT UNIQUE, template_id INTEGER,
        services TEXT DEFAULT '[]', valid_until TEXT,
        viewed_at TEXT, accepted_at TEXT, rejected_at TEXT,
        client_message TEXT, lead_data TEXT,
        views INTEGER DEFAULT 0,
        last_viewed_at TEXT, view_notified INTEGER DEFAULT 0,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
      CREATE INDEX IF NOT EXISTS idx_proposals_token ON proposals(token);

      CREATE TABLE IF NOT EXISTS proposal_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, price REAL NOT NULL,
        price_type TEXT DEFAULT 'once' CHECK(price_type IN ('once','monthly')),
        description TEXT, services TEXT DEFAULT '[]',
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, company TEXT,
        contact_name TEXT, contact_email TEXT, contact_phone TEXT,
        status TEXT DEFAULT 'onboarding' CHECK(status IN ('onboarding','active','paused','churned')),
        icp_description TEXT,
        icp_industries TEXT DEFAULT '[]', icp_locations TEXT DEFAULT '[]', icp_company_sizes TEXT DEFAULT '[]',
        onboarding_completed INTEGER DEFAULT 0,
        monthly_fee REAL DEFAULT 0,
        contract_start TEXT, contract_end TEXT,
        notes TEXT, portal_token TEXT UNIQUE,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
      CREATE INDEX IF NOT EXISTS idx_accounts_portal_token ON accounts(portal_token);

      CREATE TABLE IF NOT EXISTS account_blacklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL, email TEXT NOT NULL, domain TEXT, reason TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_account_blacklists_account ON account_blacklists(account_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_account_blacklists_unique ON account_blacklists(account_id, email);

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        contact_name TEXT, contact_email TEXT,
        project_type TEXT, project_value REAL,
        monthly_value REAL DEFAULT 0,
        status TEXT DEFAULT 'onboarding' CHECK(status IN ('onboarding','active','paused','completed','churned')),
        progress_phase TEXT DEFAULT 'kickoff' CHECK(progress_phase IN ('kickoff','design','development','review','launch','done')),
        questionnaire_data TEXT, notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT, completed_at TEXT,
        dashboard_enabled INTEGER DEFAULT 0,
        lead_value REAL DEFAULT 0,
        form_slugs TEXT DEFAULT '[]',
        chat_widget_ids TEXT DEFAULT '[]',
        track_bookings INTEGER DEFAULT 1,
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
        filename TEXT NOT NULL, filepath TEXT NOT NULL,
        uploaded_by TEXT DEFAULT 'agency' CHECK(uploaded_by IN ('agency','client')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_client_files_client ON client_files(client_id);

      CREATE TABLE IF NOT EXISTS mrr_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL UNIQUE,
        mrr REAL DEFAULT 0, active_clients INTEGER DEFAULT 0, churned_clients INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS outreach_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','running','paused','completed','cancelled')),
        filters TEXT DEFAULT '{}',
        lead_count INTEGER DEFAULT 0,
        sent INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, skipped INTEGER DEFAULT 0,
        opened INTEGER DEFAULT 0, replied INTEGER DEFAULT 0, bounced INTEGER DEFAULT 0, clicked INTEGER DEFAULT 0,
        mails_per_hour INTEGER DEFAULT 60,
        prefer_entscheider INTEGER DEFAULT 1,
        schedule_type TEXT DEFAULT 'immediate' CHECK(schedule_type IN ('immediate','business_hours')),
        subject_variant_b TEXT, ab_split INTEGER DEFAULT 0,
        job_id TEXT,
        created_at TEXT DEFAULT (datetime('now')), started_at TEXT, completed_at TEXT,
        sending_domain_ids TEXT,
        account_id INTEGER REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON outreach_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_account_id ON outreach_campaigns(account_id);

      CREATE TABLE IF NOT EXISTS outreach_campaign_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL, lead_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','skipped','opened','replied','bounced')),
        recipient TEXT, recipient_type TEXT,
        variant TEXT CHECK(variant IN ('A','B')),
        error_message TEXT, sent_at TEXT, opened_at TEXT, replied_at TEXT,
        inbox_id INTEGER,
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

      CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, trigger_type TEXT NOT NULL,
        trigger_config TEXT DEFAULT '{}', conditions TEXT DEFAULT '[]', actions TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1, run_count INTEGER DEFAULT 0, last_run_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS workflow_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL, lead_id INTEGER,
        trigger_type TEXT, actions_executed TEXT DEFAULT '[]',
        status TEXT DEFAULT 'success', error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflow_id);

      CREATE TABLE IF NOT EXISTS smart_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, icon TEXT DEFAULT 'list', color TEXT DEFAULT '#8b5cf6',
        rules TEXT NOT NULL DEFAULT '[]',
        match_type TEXT DEFAULT 'all' CHECK(match_type IN ('all','any')),
        lead_count INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL,
        lead_id INTEGER, client_id INTEGER, proposal_id INTEGER,
        recipient_name TEXT NOT NULL, recipient_address TEXT, recipient_email TEXT,
        items TEXT NOT NULL DEFAULT '[]',
        subtotal REAL NOT NULL DEFAULT 0, tax_rate REAL DEFAULT 19, tax_amount REAL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0, currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','viewed','paid','overdue','cancelled')),
        due_date TEXT, paid_at TEXT, paid_amount REAL, payment_method TEXT, notes TEXT,
        is_recurring INTEGER DEFAULT 0,
        recurring_interval TEXT CHECK(recurring_interval IN ('monthly','quarterly','yearly')),
        next_recurring_date TEXT, views INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), sent_at TEXT,
        account_id INTEGER REFERENCES accounts(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(token);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_account_id ON invoices(account_id);

      CREATE TABLE IF NOT EXISTS sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, steps TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        enrolled_count INTEGER DEFAULT 0, completed_count INTEGER DEFAULT 0, reply_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        account_id INTEGER REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_sequences_account_id ON sequences(account_id);

      CREATE TABLE IF NOT EXISTS sequence_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sequence_id INTEGER NOT NULL, lead_id INTEGER NOT NULL,
        current_step INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','replied','paused','bounced')),
        next_action_at TEXT,
        started_at TEXT DEFAULT (datetime('now')), completed_at TEXT,
        FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON sequence_enrollments(sequence_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON sequence_enrollments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_next ON sequence_enrollments(next_action_at, status);

      CREATE TABLE IF NOT EXISTS activity_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_type TEXT NOT NULL,
        period TEXT DEFAULT 'daily' CHECK(period IN ('daily','weekly','monthly')),
        target INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pipeline_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date TEXT NOT NULL, stage TEXT NOT NULL,
        lead_count INTEGER DEFAULT 0, total_value REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_pipeline_snapshots_date ON pipeline_snapshots(snapshot_date);

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, description TEXT,
        price REAL NOT NULL,
        price_type TEXT DEFAULT 'once' CHECK(price_type IN ('once','monthly','hourly')),
        category TEXT DEFAULT 'service', tax_rate REAL DEFAULT 19,
        is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS playbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, stage TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS booking_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL, end_time TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS booking_event_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
        duration INTEGER DEFAULT 30, color TEXT DEFAULT '#8B5CF6',
        location TEXT DEFAULT 'Video-Call',
        is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER, name TEXT NOT NULL, email TEXT, phone TEXT,
        date TEXT NOT NULL, time_slot TEXT NOT NULL, duration INTEGER DEFAULT 30,
        message TEXT,
        status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','completed','no_show')),
        token TEXT UNIQUE,
        event_type_id INTEGER REFERENCES booking_event_types(id),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date, status);

      CREATE TABLE IF NOT EXISTS booking_blocked_dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE, reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_client_id INTEGER, referrer_name TEXT,
        referred_lead_id INTEGER, referred_name TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','contacted','won','lost')),
        deal_value REAL DEFAULT 0, notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (referrer_client_id) REFERENCES clients(id),
        FOREIGN KEY (referred_lead_id) REFERENCES leads(id)
      );

      CREATE TABLE IF NOT EXISTS ab_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject_a TEXT NOT NULL, subject_b TEXT NOT NULL,
        body_a TEXT, body_b TEXT,
        variant_a_sent INTEGER DEFAULT 0, variant_a_opened INTEGER DEFAULT 0,
        variant_a_clicked INTEGER DEFAULT 0, variant_a_replied INTEGER DEFAULT 0,
        variant_b_sent INTEGER DEFAULT 0, variant_b_opened INTEGER DEFAULT 0,
        variant_b_clicked INTEGER DEFAULT 0, variant_b_replied INTEGER DEFAULT 0,
        winner TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','running','completed')),
        created_at TEXT DEFAULT (datetime('now')),
        account_id INTEGER REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ab_tests_account_id ON ab_tests(account_id);

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER, lead_id INTEGER,
        token TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL, description TEXT,
        client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','cancelled')),
        current_phase TEXT DEFAULT 'received',
        phases TEXT NOT NULL DEFAULT '[]',
        total_value REAL,
        start_date TEXT, estimated_end_date TEXT, completed_at TEXT,
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
        phase TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
        is_public INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL, entity_type TEXT, entity_id INTEGER,
        details TEXT DEFAULT '{}', ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

      CREATE TABLE IF NOT EXISTS trusted_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_token TEXT UNIQUE NOT NULL, device_name TEXT, ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sending_domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'warming' CHECK(status IN ('warming','active','paused','burned')),
        daily_limit INTEGER DEFAULT 50, sent_today INTEGER DEFAULT 0, sent_total INTEGER DEFAULT 0,
        dns_status TEXT DEFAULT '{"spf":false,"dkim":false,"dmarc":false}',
        health_score INTEGER DEFAULT 100, bounce_count INTEGER DEFAULT 0, complaint_count INTEGER DEFAULT 0,
        warm_start_date TEXT, warm_current_day INTEGER DEFAULT 0,
        resend_domain_id TEXT, notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        account_id INTEGER REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_sending_domains_status ON sending_domains(status);
      CREATE INDEX IF NOT EXISTS idx_sending_domains_account_id ON sending_domains(account_id);

      CREATE TABLE IF NOT EXISTS sending_inboxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL,
        email TEXT UNIQUE NOT NULL, display_name TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','burned')),
        sent_today INTEGER DEFAULT 0, daily_limit INTEGER DEFAULT 50,
        html_signature TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (domain_id) REFERENCES sending_domains(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sending_inboxes_domain ON sending_inboxes(domain_id);
      CREATE INDEX IF NOT EXISTS idx_sending_inboxes_status ON sending_inboxes(status);

      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL, events TEXT NOT NULL DEFAULT '[]',
        secret TEXT, active INTEGER DEFAULT 1,
        account_id INTEGER,
        last_triggered_at TEXT, last_status INTEGER, failure_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL,
        event TEXT NOT NULL, payload TEXT,
        response_status INTEGER, response_body TEXT, duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chat_widgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        greeting_message TEXT DEFAULT '', placeholder_text TEXT DEFAULT '',
        color TEXT DEFAULT '#8B5CF6',
        position TEXT DEFAULT 'bottom-right' CHECK(position IN ('bottom-right','bottom-left')),
        offline_message TEXT DEFAULT '',
        auto_replies TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        ai_enabled INTEGER DEFAULT 0,
        knowledge_base TEXT DEFAULT '[]',
        ai_instructions TEXT DEFAULT '',
        ai_fallback_message TEXT DEFAULT 'Ich leite Ihre Anfrage an einen Mitarbeiter weiter. Einen Moment bitte.',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id INTEGER NOT NULL,
        visitor_name TEXT DEFAULT '', visitor_email TEXT DEFAULT '',
        visitor_page TEXT DEFAULT '',
        status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','archived')),
        unread_count INTEGER DEFAULT 0,
        consent_given INTEGER DEFAULT 0,
        consent_text TEXT DEFAULT '',
        consent_at TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (widget_id) REFERENCES chat_widgets(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_widget ON chat_conversations(widget_id);
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender TEXT NOT NULL CHECK(sender IN ('visitor','agent','bot')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);

      CREATE TABLE IF NOT EXISTS contact_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
        fields TEXT NOT NULL DEFAULT '[]',
        submit_label TEXT DEFAULT 'Absenden',
        success_message TEXT DEFAULT 'Vielen Dank! Wir melden uns bei Ihnen.',
        color TEXT DEFAULT '#8B5CF6',
        notify_email TEXT, create_lead INTEGER DEFAULT 1, redirect_url TEXT,
        is_active INTEGER DEFAULT 1, submissions_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS contact_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        lead_id INTEGER, page_url TEXT, ip_address TEXT,
        is_read INTEGER DEFAULT 0,
        consent_given INTEGER DEFAULT 0,
        consent_text TEXT DEFAULT '',
        consent_at TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (form_id) REFERENCES contact_forms(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_form ON contact_submissions(form_id);
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_read ON contact_submissions(is_read);

      CREATE TABLE IF NOT EXISTS review_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER, lead_id INTEGER,
        customer_name TEXT DEFAULT '', customer_email TEXT DEFAULT '', customer_phone TEXT DEFAULT '',
        channel TEXT DEFAULT 'email',
        scheduled_at TEXT NOT NULL, sent_at TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','skipped','failed')),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_review_requests_due ON review_requests(status, scheduled_at);
    `);

    // ---- Seed: default settings ----
    const ins = inst.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))");
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);

    // ---- Seed: proposal templates ----
    const tplCount = inst.prepare('SELECT COUNT(*) as c FROM proposal_templates').get() as { c: number };
    if (tplCount.c === 0) {
      const t = inst.prepare('INSERT INTO proposal_templates (name, price, price_type, description, services, is_default) VALUES (?, ?, ?, ?, ?, ?)');
      t.run('Website Relaunch', 2500, 'once', 'Moderner, mobiloptimierter Webauftritt der Kunden überzeugt', JSON.stringify(['Responsive Design', 'SEO-Grundoptimierung', 'Kontaktformular', 'Google Maps Integration', 'SSL-Zertifikat', 'Cookie-Banner (DSGVO)', '3 Unterseiten', 'CMS-Einweisung']), 1);
      t.run('SEO Paket', 500, 'monthly', 'Monatliche Suchmaschinenoptimierung für mehr Sichtbarkeit', JSON.stringify(['Keyword-Recherche', 'OnPage-Optimierung', 'Google Business Profil', 'Monatliches Reporting', 'Lokale SEO', 'Content-Empfehlungen']), 0);
      t.run('Komplett-Paket', 3500, 'once', 'Website Relaunch + 6 Monate SEO zum Vorteilspreis', JSON.stringify(['Alles aus Website Relaunch', 'Alles aus SEO Paket (6 Monate)', 'Premium-Design', 'Bis zu 8 Unterseiten', 'Blog-Setup', 'Social Media Verlinkung', 'Priority Support']), 0);
    }

    // ---- Seed: products ----
    const prodCount = inst.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
    if (prodCount.c === 0) {
      const p = inst.prepare('INSERT INTO products (name, description, price, price_type, sort_order) VALUES (?, ?, ?, ?, ?)');
      p.run('Website Relaunch', 'Moderner, mobiloptimierter Webauftritt', 2500, 'once', 1);
      p.run('SEO-Optimierung Basis', 'Monatliche SEO-Betreuung', 500, 'monthly', 2);
      p.run('SEO-Optimierung Premium', 'Umfassende SEO-Strategie + Content', 1200, 'monthly', 3);
      p.run('Google Ads Management', 'Kampagnen-Setup + monatliche Optimierung', 400, 'monthly', 4);
      p.run('Logo & Branding', 'Logodesign + Corporate Design Basics', 800, 'once', 5);
      p.run('Content-Erstellung', 'Texte, Bilder, Videos', 150, 'hourly', 6);
      p.run('Website-Wartung', 'Updates, Backups, Security', 200, 'monthly', 7);
    }

    // ---- Seed: playbooks ----
    const pbCount = inst.prepare('SELECT COUNT(*) as c FROM playbooks').get() as { c: number };
    if (pbCount.c === 0) {
      const pb = inst.prepare('INSERT INTO playbooks (name, stage, content) VALUES (?, ?, ?)');
      pb.run('Erstansprache', 'not_contacted', JSON.stringify({
        checklist: ['Website analysiert?', 'Score geprüft?', 'Email-Adresse vorhanden?', 'Ansprechpartner identifiziert?'],
        questions: [], objections: [],
        materials: ['Audit-Seite erstellen', 'Personalisierte Email vorbereiten'],
        next_step: 'Personalisierte Erstmail senden',
      }));
      pb.run('Qualifikation', 'called', JSON.stringify({
        checklist: ['Bedarf ermittelt?', 'Budget besprochen?', 'Timeline geklärt?', 'Entscheider identifiziert?'],
        questions: ['Was ist Ihr Hauptziel mit der neuen Website?', 'Welches Budget haben Sie eingeplant?', 'Bis wann soll das Projekt umgesetzt sein?', 'Wer entscheidet bei Ihnen über solche Projekte?'],
        objections: [
          { objection: 'Zu teuer', response: 'Vergleichen Sie den Preis mit dem Umsatz, den Sie durch eine bessere Website gewinnen. Unsere Kunden berichten von 30-50% mehr Anfragen.' },
          { objection: 'Kein Bedarf', response: 'Ihr Score liegt bei {score}/100. Das bedeutet, dass potenzielle Kunden Ihre Konkurrenz bevorzugen, weil deren Website besser performt.' },
          { objection: 'Schon einen Anbieter', response: 'Gerne — aber wenn Sie nicht zufrieden sind, können wir unverbindlich zeigen, was wir anders machen.' },
        ],
        materials: ['Case Study zeigen', 'Konkurrenz-Vergleich vorbereiten', 'ROI-Rechnung aufstellen'],
        next_step: 'Meeting vereinbaren und Angebot vorbereiten',
      }));
      pb.run('Abschluss', 'proposal', JSON.stringify({
        checklist: ['Angebot gesendet?', 'Angebot angesehen?', 'Rückfragen beantwortet?', 'Vertragsbedingungen geklärt?'],
        questions: ['Haben Sie noch Fragen zum Angebot?', 'Passt der Zeitplan für Sie?', 'Gibt es noch andere Entscheider die einbezogen werden müssen?'],
        objections: [
          { objection: 'Muss noch überlegen', response: 'Verstehe ich. Das Angebot ist noch X Tage gültig. Soll ich Ihnen die wichtigsten Punkte nochmal zusammenfassen?' },
          { objection: 'Konkurrenz-Angebot', response: 'Gerne vergleichen — achten Sie auf: Support nach Launch, SEO-Optimierung inklusive, und ob Updates im Preis enthalten sind.' },
        ],
        materials: ['Angebot nochmal senden', 'Referenzen/Testimonials', 'Zeitplan-Vorschlag'],
        next_step: 'Vertrag abschließen und Onboarding starten',
      }));
    }

    // ---- Seed: booking slots (Mo-Fr) ----
    const slotCount = inst.prepare('SELECT COUNT(*) as c FROM booking_slots').get() as { c: number };
    if (slotCount.c === 0) {
      const s = inst.prepare('INSERT INTO booking_slots (day_of_week, start_time, end_time) VALUES (?, ?, ?)');
      for (let day = 0; day < 5; day++) {
        s.run(day, '09:00', '10:00'); s.run(day, '10:00', '11:00'); s.run(day, '11:00', '12:00');
        s.run(day, '14:00', '15:00'); s.run(day, '15:00', '16:00'); s.run(day, '16:00', '17:00');
      }
    }

    // ---- Seed: booking event types ----
    const etCount = inst.prepare('SELECT COUNT(*) as c FROM booking_event_types').get() as { c: number };
    if (etCount.c === 0) {
      const e = inst.prepare('INSERT INTO booking_event_types (name, slug, description, duration, color, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
      e.run('Erstgespräch', 'erstgespraech', 'Kostenloses und unverbindliches Kennenlerngespräch.', 30, '#8B5CF6', 'Video-Call', 0);
      e.run('Beratung', 'beratung', 'Ausführliche Beratung zu Ihrem Projekt.', 60, '#EC4899', 'Video-Call', 1);
      e.run('Kurzcall', 'kurzcall', 'Schneller Austausch zu einer konkreten Frage.', 15, '#F97316', 'Telefon', 2);
    }

    // ---- Seed: default chat widget ----
    const widgetCount = inst.prepare('SELECT COUNT(*) as c FROM chat_widgets').get() as { c: number };
    if (widgetCount.c === 0) {
      inst.prepare(
        'INSERT INTO chat_widgets (name, greeting_message, placeholder_text, color, position, offline_message, auto_replies, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      ).run(
        'Support Chat',
        'Hallo! Wie koennen wir Ihnen helfen?',
        'Schreiben Sie eine Nachricht...',
        '#8B5CF6', 'bottom-right',
        'Wir sind gerade nicht erreichbar. Hinterlassen Sie uns eine Nachricht und wir melden uns!',
        JSON.stringify([
          { q: 'Preis', a: 'Unsere Preise richten sich nach dem Umfang des Projekts. Vereinbaren Sie ein kostenloses Erstgespräch für ein individuelles Angebot.' },
          { q: 'Kontakt', a: 'Sie erreichen uns unter der auf unserer Website angegebenen Nummer oder per E-Mail.' },
        ]),
      );
    }

    // ---- Seed: default contact form ----
    const formCount = inst.prepare('SELECT COUNT(*) as c FROM contact_forms').get() as { c: number };
    if (formCount.c === 0) {
      inst.prepare('INSERT INTO contact_forms (name, slug, fields, submit_label, success_message) VALUES (?, ?, ?, ?, ?)').run(
        'Kontaktformular', 'kontakt',
        JSON.stringify([
          { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Ihr Name' },
          { name: 'email', label: 'E-Mail', type: 'email', required: true, placeholder: 'ihre@email.de' },
          { name: 'phone', label: 'Telefon', type: 'tel', required: false, placeholder: '+49 123 456 789' },
          { name: 'service', label: 'Anliegen', type: 'select', required: true, options: ['Allgemeine Anfrage', 'Angebot anfordern', 'Support', 'Sonstiges'] },
          { name: 'message', label: 'Nachricht', type: 'textarea', required: true, placeholder: 'Wie koennen wir Ihnen helfen?' },
        ]),
        'Anfrage senden',
        'Vielen Dank fuer Ihre Anfrage! Wir melden uns innerhalb von 24 Stunden bei Ihnen.',
      );
    }
  },

  // Future migrations go here — append only
  // (inst) => { inst.exec(`ALTER TABLE ...`); },
];

// ---------------------------------------------------------------------------
// Migration runner — each migration runs exactly once, atomically
// ---------------------------------------------------------------------------

function runMigrations(instance: Database.Database) {
  const current = instance.pragma('user_version', { simple: true }) as number;
  for (let i = current; i < migrations.length; i++) {
    instance.transaction(() => {
      migrations[i](instance);
      instance.pragma(`user_version = ${i + 1}`);
    })();
    console.log(`[DB] Migration ${i} applied → user_version = ${i + 1}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const key = process.env.ELVORA_DB_KEY;
    if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(
        'ELVORA_DB_KEY fehlt oder ungültig. Erwartet: 64 Hex-Zeichen (32 Byte).\n' +
        'Generieren: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    const instance = new Database(DB_PATH);

    // Encryption key MUST be the very first statement after open
    instance.pragma(`key = "x'${key}'"`);

    // Verify the key actually works
    try {
      instance.prepare('SELECT count(*) FROM sqlite_master').get();
    } catch {
      instance.close();
      throw new Error(
        'ELVORA_DB_KEY ist falsch — die Datenbank konnte nicht entschlüsselt werden.'
      );
    }

    // WAL must NOT be set inside a transaction
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');

    runMigrations(instance);

    // Recovery: mark orphaned running scraper jobs as stopped
    try {
      const orphaned = instance.prepare("UPDATE scraper_jobs SET status = 'stopped' WHERE status = 'running'").run();
      if (orphaned.changes > 0) {
        console.log(`[DB] Recovery: ${orphaned.changes} orphaned job(s) → stopped`);
      }
    } catch { /* table might not exist on very first run before migration */ }

    lockFiles();
    db = instance;
  }
  return db;
}

/** Art. 17 DSGVO: physisches Löschen — WAL checkpoint + VACUUM, dann chmod 600. */
export function purge(): void {
  const d = getDb();
  d.pragma('wal_checkpoint(TRUNCATE)');
  d.exec('VACUUM');
  lockFiles();
}

export default getDb;
