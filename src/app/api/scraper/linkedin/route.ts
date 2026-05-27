import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/scraper/linkedin - Fetch LinkedIn scraper job history
 */
export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (jobId) {
    const job = db.prepare('SELECT * FROM scraper_jobs WHERE id = ?').get(Number(jobId)) as Record<string, unknown> | undefined;
    if (!job) {
      return Response.json({ error: 'Job nicht gefunden' }, { status: 404 });
    }
    // Parse config for the client
    let config = null;
    let completedKeywords: string[] = [];
    try { config = job.config ? JSON.parse(job.config as string) : null; } catch { /* ignore */ }
    try { completedKeywords = job.completed_keywords ? JSON.parse(job.completed_keywords as string) : []; } catch { /* ignore */ }
    const totalKeywords = config?.keywords?.length || 0;
    return Response.json({
      ...job,
      parsedConfig: config,
      parsedCompletedKeywords: completedKeywords,
      remainingKeywords: totalKeywords - completedKeywords.length,
      canResume: job.status === 'stopped' && completedKeywords.length < totalKeywords,
    });
  }

  const jobs = db.prepare(
    "SELECT * FROM scraper_jobs WHERE keyword LIKE 'LinkedIn:%' ORDER BY id DESC LIMIT 50"
  ).all() as Record<string, unknown>[];

  // Add resume info to each job
  const enrichedJobs = jobs.map(job => {
    let config = null;
    let completedKeywords: string[] = [];
    try { config = job.config ? JSON.parse(job.config as string) : null; } catch { /* ignore */ }
    try { completedKeywords = job.completed_keywords ? JSON.parse(job.completed_keywords as string) : []; } catch { /* ignore */ }
    const totalKeywords = config?.keywords?.length || 0;
    return {
      ...job,
      totalKeywords,
      completedKeywordCount: completedKeywords.length,
      canResume: (job.status === 'stopped' || job.status === 'error') && completedKeywords.length < totalKeywords,
    };
  });

  return Response.json({ jobs: enrichedJobs });
}
