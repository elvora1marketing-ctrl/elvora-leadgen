import { NextRequest } from 'next/server';
import { jobRunner } from '@/lib/scraper-job-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const jobId = Number(idStr);
  const job = jobRunner.getJob(jobId);

  if (!job) {
    return Response.json({ error: 'Job nicht gefunden' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      }

      // Send all existing logs (replay for reconnects)
      for (const log of job.logs) {
        send({ type: 'log', time: log.time, source: log.source, message: log.message, logType: log.type });
      }

      // Send current stats
      send({ type: 'stats', ...job.stats });
      send({ type: 'progress', ...job.progress });
      send({ type: 'status', jobStatus: job.status });

      if (job.status !== 'running') {
        send({ type: 'done', status: job.status, stats: job.stats });
        controller.close();
        return;
      }

      // Subscribe to new logs
      const unsubscribe = jobRunner.subscribe(jobId, (logEntry) => {
        send({ type: 'log', time: logEntry.time, source: logEntry.source, message: logEntry.message, logType: logEntry.type });
        // Also send updated stats/progress
        const current = jobRunner.getJob(jobId);
        if (current) {
          send({ type: 'stats', ...current.stats });
          send({ type: 'progress', ...current.progress });
          if (current.status !== 'running') {
            send({ type: 'done', status: current.status, stats: current.stats });
            unsubscribe();
            controller.close();
          }
        }
      });

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
