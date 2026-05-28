import { NextRequest, NextResponse } from 'next/server';
import { jobRunner } from '@/lib/scraper-job-runner';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const running = jobRunner.getAllRunning();

  const db = getDb();
  const historyRows = db.prepare(`
    SELECT id, keyword, status, businesses_found, businesses_imported, businesses_duplicate,
           started_at, completed_at, config, completed_keywords
    FROM scraper_jobs
    ORDER BY id DESC
    LIMIT 30
  `).all() as {
    id: number; keyword: string; status: string;
    businesses_found: number; businesses_imported: number; businesses_duplicate: number;
    started_at: string; completed_at: string | null;
    config: string | null; completed_keywords: string | null;
  }[];

  const history = historyRows.map(row => {
    let duration = '';
    if (row.started_at && row.completed_at) {
      const ms = new Date(row.completed_at).getTime() - new Date(row.started_at).getTime();
      const s = Math.round(ms / 1000);
      duration = s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    } else if (row.status === 'running') {
      duration = 'laeuft...';
    }

    let totalSteps = 0;
    let doneSteps = 0;
    if (row.config) {
      try {
        const cfg = JSON.parse(row.config);
        totalSteps = (cfg.keywords?.length || 0) * (cfg.cities?.length || 0);
      } catch { /* */ }
    }
    if (row.completed_keywords) {
      try { doneSteps = JSON.parse(row.completed_keywords).length; } catch { /* */ }
    }

    const canResume = (row.status === 'aborted' || row.status === 'error' || row.status === 'stopped')
      && !!row.config && doneSteps < totalSteps;

    return {
      id: row.id,
      keyword: row.keyword,
      city: '',
      found: row.businesses_found,
      imported: row.businesses_imported,
      status: row.status,
      duration,
      startedAt: row.started_at,
      canResume,
      doneSteps,
      totalSteps,
    };
  });

  return Response.json({
    jobs: running.map(j => ({
      id: j.id,
      status: j.status,
      stats: j.stats,
      progress: j.progress,
      startedAt: j.startedAt,
    })),
    history,
  });
}
