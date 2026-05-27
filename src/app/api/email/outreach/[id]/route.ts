import { NextRequest, NextResponse } from 'next/server';
import { cancelJob, getJob, pauseJob, resumeJob } from '@/lib/outreach-jobs';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: string };

  if (body.action === 'pause') {
    const ok = pauseJob(id);
    if (!ok) return NextResponse.json({ error: 'Pause nicht möglich' }, { status: 400 });
    return NextResponse.json({ success: true, job: getJob(id) });
  }
  if (body.action === 'resume') {
    const ok = resumeJob(id);
    if (!ok) return NextResponse.json({ error: 'Resume nicht möglich' }, { status: 400 });
    return NextResponse.json({ success: true, job: getJob(id) });
  }
  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const ok = cancelJob(id);
  if (!ok) return NextResponse.json({ error: 'Job nicht abbrechbar' }, { status: 400 });
  return NextResponse.json({ success: true, job: getJob(id) });
}
