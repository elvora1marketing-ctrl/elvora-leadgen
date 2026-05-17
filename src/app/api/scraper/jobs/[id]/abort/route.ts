import { NextRequest } from 'next/server';
import { jobRunner } from '@/lib/scraper-job-runner';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const jobId = Number(idStr);
  const job = jobRunner.getJob(jobId);

  if (!job) {
    return Response.json({ error: 'Job nicht gefunden' }, { status: 404 });
  }

  jobRunner.abort(jobId);
  return Response.json({ success: true });
}
