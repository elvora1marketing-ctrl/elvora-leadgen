import { NextRequest, NextResponse } from 'next/server';
import { jobRunner } from '@/lib/scraper-job-runner';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const running = jobRunner.getAllRunning();
  return Response.json({
    jobs: running.map(j => ({
      id: j.id,
      status: j.status,
      stats: j.stats,
      progress: j.progress,
      startedAt: j.startedAt,
    })),
  });
}
