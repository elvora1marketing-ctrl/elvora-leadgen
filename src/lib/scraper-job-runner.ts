/**
 * Background Scraper Job Runner
 *
 * Jobs laufen unabhängig von HTTP-Verbindungen im Node.js-Prozess.
 * Frontend kann sich jederzeit verbinden/trennen — der Job läuft weiter.
 */

export interface JobLogEntry {
  time: number;
  source: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

export interface JobStats {
  totalFound: number;
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

export interface BackgroundJob {
  id: number;
  status: 'running' | 'completed' | 'error' | 'aborted';
  logs: JobLogEntry[];
  stats: JobStats;
  progress: { current: number; total: number; label: string };
  startedAt: number;
  completedAt: number | null;
}

type JobListener = (log: JobLogEntry) => void;

class JobRunner {
  private jobs = new Map<number, BackgroundJob>();
  private listeners = new Map<number, Set<JobListener>>();
  private abortControllers = new Map<number, AbortController>();

  getJob(id: number): BackgroundJob | undefined {
    return this.jobs.get(id);
  }

  getAllRunning(): BackgroundJob[] {
    return Array.from(this.jobs.values()).filter(j => j.status === 'running');
  }

  createJob(id: number): BackgroundJob {
    const job: BackgroundJob = {
      id,
      status: 'running',
      logs: [],
      stats: { totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [] },
      progress: { current: 0, total: 0, label: '' },
      startedAt: Date.now(),
      completedAt: null,
    };
    this.jobs.set(id, job);
    this.abortControllers.set(id, new AbortController());
    return job;
  }

  getAbortSignal(id: number): AbortSignal | undefined {
    return this.abortControllers.get(id)?.signal;
  }

  abort(id: number): void {
    const controller = this.abortControllers.get(id);
    if (controller) controller.abort();
    const job = this.jobs.get(id);
    if (job && job.status === 'running') {
      job.status = 'aborted';
      job.completedAt = Date.now();
      this.addLog(id, 'System', 'Abgebrochen.', 'warn');
    }
  }

  addLog(id: number, source: string, message: string, type: JobLogEntry['type'] = 'info'): void {
    const job = this.jobs.get(id);
    if (!job) return;
    const entry: JobLogEntry = { time: Date.now(), source, message, type };
    job.logs.push(entry);
    const listeners = this.listeners.get(id);
    if (listeners) {
      for (const fn of listeners) {
        try { fn(entry); } catch { /* listener gone */ }
      }
    }
  }

  updateStats(id: number, stats: Partial<JobStats>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job.stats, stats);
  }

  updateProgress(id: number, current: number, total: number, label: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.progress = { current, total, label };
  }

  complete(id: number, success: boolean): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = success ? 'completed' : 'error';
    job.completedAt = Date.now();
    this.abortControllers.delete(id);
    // Keep job in memory for 30 min after completion for reconnects
    setTimeout(() => this.jobs.delete(id), 30 * 60 * 1000);
  }

  subscribe(id: number, listener: JobListener): () => void {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id)!.add(listener);
    return () => {
      this.listeners.get(id)?.delete(listener);
    };
  }
}

// Singleton — lebt solange der Node.js-Prozess läuft
export const jobRunner = new JobRunner();
