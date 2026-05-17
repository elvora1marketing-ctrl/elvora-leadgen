import { jobRunner } from '@/lib/scraper-job-runner';

export const dynamic = 'force-dynamic';

export async function GET() {
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
