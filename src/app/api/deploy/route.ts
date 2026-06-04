import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEPLOY_DIR = '/opt/elvora-leadgen';
const DEFAULT_BRANCH = 'claude/extract-chat-info-X4Ud2';

let deployRunning = false;

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  if (deployRunning) {
    return Response.json({ error: 'Deploy laeuft bereits' }, { status: 409 });
  }

  let branch = DEFAULT_BRANCH;
  try {
    const body = await request.json();
    if (body.branch) branch = body.branch;
  } catch { /* use default */ }

  deployRunning = true;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      }

      function runStep(label: string, cmd: string, cwd: string): Promise<boolean> {
        return new Promise((resolve) => {
          send({ type: 'step', label, status: 'running' });
          const proc = spawn('bash', ['-c', cmd], { cwd, env: { ...process.env, FORCE_COLOR: '0' } });

          proc.stdout.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              send({ type: 'log', step: label, message: line });
            }
          });

          proc.stderr.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              send({ type: 'log', step: label, message: line });
            }
          });

          proc.on('close', (code) => {
            send({ type: 'step', label, status: code === 0 ? 'done' : 'error', code });
            resolve(code === 0);
          });

          proc.on('error', (err) => {
            send({ type: 'log', step: label, message: `Fehler: ${err.message}` });
            send({ type: 'step', label, status: 'error' });
            resolve(false);
          });
        });
      }

      (async () => {
        try {
          send({ type: 'start', branch });

          const pullOk = await runStep(
            'Git Pull',
            `git pull origin ${branch} 2>&1`,
            DEPLOY_DIR,
          );
          if (!pullOk) {
            send({ type: 'done', success: false, message: 'Git pull fehlgeschlagen' });
            return;
          }

          const installOk = await runStep(
            'Dependencies',
            'npm install --no-audit --no-fund 2>&1',
            DEPLOY_DIR,
          );
          if (!installOk) {
            send({ type: 'done', success: false, message: 'npm install fehlgeschlagen' });
            return;
          }

          const buildOk = await runStep(
            'Build',
            'npm run build 2>&1',
            DEPLOY_DIR,
          );
          if (!buildOk) {
            send({ type: 'done', success: false, message: 'Build fehlgeschlagen' });
            return;
          }

          send({ type: 'step', label: 'Neustart', status: 'running' });
          send({ type: 'log', step: 'Neustart', message: 'Server wird neu gestartet...' });
          send({ type: 'done', success: true, message: 'Deploy erfolgreich! Server startet neu...' });

          controller.close();

          setTimeout(() => {
            const restart = spawn('pm2', ['restart', '0'], {
              cwd: DEPLOY_DIR,
              detached: true,
              stdio: 'ignore',
            });
            restart.unref();
          }, 500);
        } catch (err) {
          send({ type: 'done', success: false, message: `Fehler: ${err}` });
          controller.close();
        } finally {
          deployRunning = false;
        }
      })();
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
