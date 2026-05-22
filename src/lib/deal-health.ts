import type Database from 'better-sqlite3';

const STAGE_ORDER: Record<string, number> = {
  not_contacted: 0,
  email_sent: 1,
  called: 2,
  meeting: 3,
  proposal: 4,
  won: 5,
};

const STAGE_SETTING_KEYS: Record<string, string> = {
  not_contacted: 'deal_rot_days_not_contacted',
  email_sent: 'deal_rot_days_email_sent',
  called: 'deal_rot_days_called',
  meeting: 'deal_rot_days_meeting',
  proposal: 'deal_rot_days_proposal',
};

function daysBetween(from: string, to: Date): number {
  const d = new Date(from);
  return Math.floor((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getSetting(db: Database.Database, key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function calculateDealHealth(db: Database.Database, leadId: number): { score: number; insights: string[] } {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as Record<string, any> | undefined;
  if (!lead) return { score: 0, insights: ['Lead nicht gefunden'] };

  const now = new Date();
  let score = 100;
  const insights: string[] = [];

  // --- Inactivity penalty (max -40) ---
  const lastActivity = db.prepare(
    'SELECT created_at FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(leadId) as { created_at: string } | undefined;

  const lastDate = lastActivity?.created_at || lead.last_activity_at || lead.updated_at;
  let inactiveDays = 0;
  if (lastDate) {
    inactiveDays = daysBetween(lastDate, now);
    if (inactiveDays > 30) score -= 40;
    else if (inactiveDays > 14) score -= 30;
    else if (inactiveDays > 7) score -= 20;
    else if (inactiveDays > 3) score -= 10;
  }

  // --- Data completeness bonus (max +10) ---
  if (lead.email) score += 3;
  if (lead.phone) score += 3;
  if (lead.entscheider_name) score += 2;
  if (lead.deal_value && lead.deal_value > 0) score += 2;

  // --- Engagement bonus (max +10) ---
  const eng = lead.engagement_score ?? 0;
  if (eng >= 50) score += 10;
  else if (eng >= 25) score += 5;
  else if (eng >= 10) score += 2;

  // --- Stage velocity penalty (max -20) ---
  const stage = lead.contact_status || 'not_contacted';
  const settingKey = STAGE_SETTING_KEYS[stage];
  if (settingKey && lead.stage_entered_at) {
    const threshold = parseInt(getSetting(db, settingKey, '7'), 10);
    const daysInStage = daysBetween(lead.stage_entered_at, now);
    if (daysInStage > threshold * 2) score -= 20;
    else if (daysInStage > threshold) score -= 10;
  }

  // --- Score quality bonus (max +10) ---
  const websiteScore = lead.score ?? 0;
  if (websiteScore >= 1 && websiteScore <= 30) score += 10;
  else if (websiteScore >= 31 && websiteScore <= 50) score += 5;

  // --- Close date penalty (max -10) ---
  if (lead.expected_close_date) {
    const closeDate = new Date(lead.expected_close_date);
    if (closeDate < now) {
      score -= 10;
      insights.push('Close-Datum überschritten');
    }
  }
  if ((lead.close_date_changes ?? 0) >= 3) {
    score -= 5;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // --- Insights ---
  const rotThreshold = settingKey ? parseInt(getSetting(db, settingKey, '7'), 10) : 7;
  if (inactiveDays > rotThreshold) {
    insights.push(`Seit ${inactiveDays} Tagen keine Aktivität`);
  }

  const openTask = db.prepare(
    'SELECT id FROM tasks WHERE lead_id = ? AND is_completed = 0 LIMIT 1'
  ).get(leadId);
  if (!openTask) {
    insights.push('Kein nächster Schritt geplant');
  }

  if ((lead.close_date_changes ?? 0) >= 2) {
    insights.push(`Close-Datum wurde ${lead.close_date_changes}mal verschoben`);
  }

  // Unanswered proposal
  const unansweredProposal = db.prepare(`
    SELECT created_at FROM proposals
    WHERE lead_id = ? AND status IN ('sent', 'viewed')
    ORDER BY created_at DESC LIMIT 1
  `).get(leadId) as { created_at: string } | undefined;
  if (unansweredProposal) {
    const proposalDays = daysBetween(unansweredProposal.created_at, now);
    if (proposalDays > 7) {
      insights.push(`Angebot seit ${proposalDays} Tagen unbeantwortet`);
    }
  }

  // High engagement — follow up now
  const earlyStages = ['not_contacted', 'email_sent', 'called'];
  if (eng >= 40 && earlyStages.includes(stage)) {
    insights.push('Hoher Engagement-Score — jetzt nachfassen!');
  }

  // Missing data
  if (!lead.email) {
    insights.push('Email-Adresse fehlt');
  }
  if (!lead.entscheider_name) {
    insights.push('Kein Ansprechpartner identifiziert');
  }

  const lateStages = ['meeting', 'proposal', 'won'];
  if ((!lead.deal_value || lead.deal_value <= 0) && lateStages.includes(stage)) {
    insights.push('Deal-Wert nicht festgelegt');
  }

  return { score, insights };
}

export function updateDealHealth(db: Database.Database, leadId: number): void {
  const { score, insights } = calculateDealHealth(db, leadId);
  db.prepare(
    "UPDATE leads SET deal_health_score = ?, deal_insights = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(score, JSON.stringify(insights), leadId);
}
