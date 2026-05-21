import { NextRequest, NextResponse } from 'next/server';
import { cancelJob, getJob, pauseJob, resumeJob } from '@/lib/outreach-jobs';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = cancelJob(id);
  if (!ok) return NextResponse.json({ error: 'Job nicht abbrechbar' }, { status: 400 });
  return NextResponse.json({ success: true, job: getJob(id) });
}
