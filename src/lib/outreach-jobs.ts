import { sendLeadEmail, type SendResult } from './email-sender';

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

export function createJob(opts: {
  leadIds: number[];
  throttleMs: number;
  preferEntscheider: boolean;
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
  runJob(id, '').catch(() => { /* errors captured in job state */ });
  return true;
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
        return;
      }
      if (job.pauseRequested) {
        job.status = 'paused';
        return;
      }

      const leadId = job.leadIds[job.currentIndex];
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
      } catch (err: unknown) {
        job.failed++;
        job.results.push({
          leadId,
          recipient: null,
          type: null,
          success: false,
          error: err instanceof Error ? err.message : 'Unbekannter Fehler',
          at: new Date().toISOString(),
        });
      }

      // Throttle delay (skip after last item)
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
  } catch (err: unknown) {
    job.status = 'error';
    job.errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
    job.completedAt = new Date().toISOString();
  }
}
