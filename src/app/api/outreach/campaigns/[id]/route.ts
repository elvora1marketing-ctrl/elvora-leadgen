import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { cancelJob, getJob, pauseJob, resumeJob } from '@/lib/outreach-jobs';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const leads = db.prepare(`
      SELECT cl.*, l.name, l.city, l.score, l.email, l.entscheider_email, l.entscheider_name
      FROM outreach_campaign_leads cl
      JOIN leads l ON l.id = cl.lead_id
      WHERE cl.campaign_id = ?
      ORDER BY cl.id ASC
    `).all(Number(id));

    const memJob = campaign.job_id ? getJob(campaign.job_id as string) : null;

    return NextResponse.json({
      campaign: {
        ...campaign,
        filters: JSON.parse((campaign.filters as string) || '{}'),
        prefer_entscheider: !!(campaign.prefer_entscheider as number),
        ab_split: !!(campaign.ab_split as number),
      },
      leads,
      liveJob: memJob ? {
        status: memJob.status,
        currentIndex: memJob.currentIndex,
        total: memJob.total,
        sent: memJob.sent,
        failed: memJob.failed,
        skipped: memJob.skipped,
        results: memJob.results.slice(-20),
      } : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const db = getDb();
    const body = await request.json() as { action?: string };
    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    if (body.action === 'pause' && campaign.job_id) {
      pauseJob(campaign.job_id as string);
      db.prepare("UPDATE outreach_campaigns SET status = 'paused' WHERE id = ?").run(Number(id));
      return NextResponse.json({ success: true });
    }
    if (body.action === 'resume' && campaign.job_id) {
      resumeJob(campaign.job_id as string);
      db.prepare("UPDATE outreach_campaigns SET status = 'running' WHERE id = ?").run(Number(id));
      return NextResponse.json({ success: true });
    }
    if (body.action === 'cancel' && campaign.job_id) {
      cancelJob(campaign.job_id as string);
      db.prepare("UPDATE outreach_campaigns SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(Number(id));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    if (campaign.job_id) cancelJob(campaign.job_id as string);
    db.prepare('DELETE FROM outreach_campaign_leads WHERE campaign_id = ?').run(Number(id));
    db.prepare('DELETE FROM outreach_campaigns WHERE id = ?').run(Number(id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
