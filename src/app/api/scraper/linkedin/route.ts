import { NextRequest } from 'next/server';
import getDb from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/scraper/linkedin - Fetch LinkedIn scraper job history
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (jobId) {
    const job = db.prepare('SELECT * FROM scraper_jobs WHERE id = ?').get(Number(jobId));
    if (!job) {
      return Response.json({ error: 'Job nicht gefunden' }, { status: 404 });
    }
    return Response.json(job);
  }

  const jobs = db.prepare(
    "SELECT * FROM scraper_jobs WHERE keyword LIKE 'LinkedIn:%' ORDER BY id DESC LIMIT 50"
  ).all();

  return Response.json({ jobs });
}
