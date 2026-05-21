import { sendLeadEmail, type SendResult } from './email-sender';
import getDb from './db';

export interface OutreachJob {
  id: string;
  leadIds: number[];
  status: 'pending' | 'running' | 'paused' | 'done' | 'cancelled' | 'error';
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  currentIndex: number;
  results: Array<{ leadId: number; recipient: string | null; type: SendResult['recipientType']; success: boolean; error?: string; at: string }>;
  throttleMs: number;
  preferEntscheider: boolean;
  startedAt: string;
  completedAt: string | null;
  cancelRequested: boolean;
  pauseRequested: boolean;
  errorMessage: string | null;
  campaignId?: number;
  scheduleType: 'immediate' | 'business_hours';
  subjectVariantB?: string;
  abSplit: boolean;
}

const jobs = new Map<string, OutreachJob>();

const MAX_JOBS_KEPT = 20;

function pruneOldJobs() {
  if (jobs.size <= MAX_JOBS_KEPT) return;
  const sorted = Array.from(jobs.values())
    .filter(j => j.status === 'done' || j.status === 'cancelled' || j.status === 'error')
    .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''));
  while (jobs.size > MAX_JOBS_KEPT && sorted.length > 0) {
    const j = sorted.shift();
    if (j) jobs.delete(j.id);
  }
}

function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

export function createJob(opts: {
  leadIds: number[];
  throttleMs: number;
  preferEntscheider: boolean;
  campaignId?: number;
  scheduleType?: 'immediate' | 'business_hours';
  subjectVariantB?: string;
  abSplit?: boolean;
}): OutreachJob {
  const id = `outreach_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const job: OutreachJob = {
    id,
    leadIds: opts.leadIds,
    status: 'pending',
    total: opts.leadIds.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    currentIndex: 0,
    results: [],
    throttleMs: Math.max(opts.throttleMs, 1000),
    preferEntscheider: opts.preferEntscheider,
    startedAt: new Date().toISOString(),
    completedAt: null,
    cancelRequested: false,
    pauseRequested: false,
    errorMessage: null,
    campaignId: opts.campaignId,
    scheduleType: opts.scheduleType || 'immediate',
    subjectVariantB: opts.subjectVariantB,
    abSplit: opts.abSplit || false,
  };
  jobs.set(id, job);
  pruneOldJobs();
  return job;
}

export function getJob(id: string): OutreachJob | null {
  return jobs.get(id) || null;
}

export function listJobs(): OutreachJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === 'done' || job.status === 'cancelled' || job.status === 'error') return false;
  job.cancelRequested = true;
  return true;
}

export function pauseJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status !== 'running') return false;
  job.pauseRequested = true;
  return true;
}

export function resumeJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status !== 'paused') return false;
  job.pauseRequested = false;
  runJob(id, '').catch(() => {});
  return true;
}

function syncCampaignStats(job: OutreachJob) {
  if (!job.campaignId) return;
  try {
    const db = getDb();
    db.prepare(`
      UPDATE outreach_campaigns SET sent = ?, failed = ?, skipped = ?
      WHERE id = ?
    `).run(job.sent, job.failed, job.skipped, job.campaignId);
  } catch { /* silent */ }
}

function updateCampaignLeadStatus(campaignId: number, leadId: number, status: string, recipient: string | null, recipientType: string | null, error: string | null) {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE outreach_campaign_leads SET status = ?, recipient = ?, recipient_type = ?, error_message = ?, sent_at = datetime('now')
      WHERE campaign_id = ? AND lead_id = ?
    `).run(status, recipient, recipientType, error, campaignId, leadId);
  } catch { /* silent */ }
}

export async function runJob(id: string, baseUrl: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;
  if (job.status === 'running') return;

  job.status = 'running';

  try {
    for (; job.currentIndex < job.leadIds.length; job.currentIndex++) {
      if (job.cancelRequested) {
        job.status = 'cancelled';
        job.completedAt = new Date().toISOString();
        syncCampaignStats(job);
        if (job.campaignId) {
          try { getDb().prepare("UPDATE outreach_campaigns SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(job.campaignId); } catch {}
        }
        return;
      }
      if (job.pauseRequested) {
        job.status = 'paused';
        syncCampaignStats(job);
        if (job.campaignId) {
          try { getDb().prepare("UPDATE outreach_campaigns SET status = 'paused' WHERE id = ?").run(job.campaignId); } catch {}
        }
        return;
      }

      if (job.scheduleType === 'business_hours' && !isBusinessHours()) {
        job.status = 'paused';
        job.pauseRequested = true;
        syncCampaignStats(job);
        if (job.campaignId) {
          try { getDb().prepare("UPDATE outreach_campaigns SET status = 'paused' WHERE id = ?").run(job.campaignId); } catch {}
        }
        return;
      }

      const leadId = job.leadIds[job.currentIndex];

      const blacklisted = checkBlacklist(leadId);
      if (blacklisted) {
        job.skipped++;
        job.results.push({ leadId, recipient: null, type: null, success: false, error: 'Blacklisted', at: new Date().toISOString() });
        if (job.campaignId) updateCampaignLeadStatus(job.campaignId, leadId, 'skipped', null, null, 'Blacklisted');
        continue;
      }

      try {
        const result = await sendLeadEmail({ leadId, preferEntscheider: job.preferEntscheider, baseUrl });
        if (result.success) job.sent++;
        else if (!result.recipient) job.skipped++;
        else job.failed++;

        job.results.push({
          leadId,
          recipient: result.recipient,
          type: result.recipientType,
          success: result.success,
          error: result.error,
          at: new Date().toISOString(),
        });

        if (job.campaignId) {
          const status = result.success ? 'sent' : (!result.recipient ? 'skipped' : 'failed');
          updateCampaignLeadStatus(job.campaignId, leadId, status, result.recipient, result.recipientType, result.error || null);
        }
      } catch (err: unknown) {
        job.failed++;
        const errMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
        job.results.push({ leadId, recipient: null, type: null, success: false, error: errMsg, at: new Date().toISOString() });
        if (job.campaignId) updateCampaignLeadStatus(job.campaignId, leadId, 'failed', null, null, errMsg);
      }

      if (job.currentIndex % 10 === 0) syncCampaignStats(job);

      if (job.currentIndex < job.leadIds.length - 1) {
        const sleepUntil = Date.now() + job.throttleMs;
        while (Date.now() < sleepUntil) {
          if (job.cancelRequested || job.pauseRequested) break;
          await new Promise(r => setTimeout(r, Math.min(500, sleepUntil - Date.now())));
        }
      }
    }

    if (job.cancelRequested) {
      job.status = 'cancelled';
    } else {
      job.status = 'done';
    }
    job.completedAt = new Date().toISOString();
    syncCampaignStats(job);
    if (job.campaignId) {
      const finalStatus = job.status === 'cancelled' ? 'cancelled' : 'completed';
      try { getDb().prepare(`UPDATE outreach_campaigns SET status = ?, completed_at = datetime('now') WHERE id = ?`).run(finalStatus, job.campaignId); } catch {}
    }
  } catch (err: unknown) {
    job.status = 'error';
    job.errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
    job.completedAt = new Date().toISOString();
    syncCampaignStats(job);
    if (job.campaignId) {
      try { getDb().prepare("UPDATE outreach_campaigns SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(job.campaignId); } catch {}
    }
  }
}

function checkBlacklist(leadId: number): boolean {
  try {
    const db = getDb();
    const lead = db.prepare('SELECT email, entscheider_email, all_emails FROM leads WHERE id = ?').get(leadId) as { email: string | null; entscheider_email: string | null; all_emails: string | null } | undefined;
    if (!lead) return false;

    const emails: string[] = [];
    if (lead.email) emails.push(lead.email.toLowerCase());
    if (lead.entscheider_email) emails.push(lead.entscheider_email.toLowerCase());
    if (lead.all_emails) {
      try { const arr = JSON.parse(lead.all_emails) as string[]; arr.forEach(e => emails.push(e.toLowerCase())); } catch {}
    }

    if (emails.length === 0) return false;
    const placeholders = emails.map(() => '?').join(',');
    const blocked = db.prepare(`SELECT COUNT(*) as c FROM email_blacklist WHERE email IN (${placeholders})`).get(...emails) as { c: number };
    return blocked.c === emails.length;
  } catch {
    return false;
  }
}
