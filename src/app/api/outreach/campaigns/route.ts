import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { createJob, runJob, listJobs as listMemJobs } from '@/lib/outreach-jobs';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';

interface CampaignRow {
  id: number;
  name: string;
  status: string;
  filters: string;
  lead_count: number;
  sent: number;
  failed: number;
  skipped: number;
  opened: number;
  replied: number;
  bounced: number;
  clicked: number;
  mails_per_hour: number;
  prefer_entscheider: number;
  schedule_type: string;
  subject_variant_b: string | null;
  ab_split: number;
  job_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const accountId = searchParams.get('account_id');
    let query = 'SELECT * FROM outreach_campaigns';
    const params: string[] = [];
    const conditions: string[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (accountId) { conditions.push('account_id = ?'); params.push(accountId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const campaigns = db.prepare(query).all(...params) as CampaignRow[];

    const memJobs = listMemJobs();

    const enriched = campaigns.map(c => {
      const memJob = c.job_id ? memJobs.find(j => j.id === c.job_id) : null;
      const liveStatus = memJob ? memJob.status : null;
      const liveProgress = memJob ? {
        currentIndex: memJob.currentIndex,
        total: memJob.total,
        sent: memJob.sent,
        failed: memJob.failed,
        skipped: memJob.skipped,
        results: memJob.results.slice(-10),
      } : null;

      return {
        ...c,
        filters: JSON.parse(c.filters || '{}'),
        prefer_entscheider: !!c.prefer_entscheider,
        ab_split: !!c.ab_split,
        liveStatus,
        liveProgress,
        openRate: c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0,
        replyRate: c.sent > 0 ? Math.round((c.replied / c.sent) * 100) : 0,
        bounceRate: c.sent > 0 ? Math.round((c.bounced / c.sent) * 100) : 0,
      };
    });

    return NextResponse.json({ campaigns: enriched });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const body = await request.json() as {
      name: string;
      action?: 'create' | 'start';
      filters?: Record<string, unknown>;
      mailsPerHour?: number;
      preferEntscheider?: boolean;
      scheduleType?: 'immediate' | 'business_hours';
      subjectVariantB?: string;
      abSplit?: boolean;
      campaignId?: number;
    };

    if (body.action === 'start' && body.campaignId) {
      return startCampaign(db, body.campaignId, request);
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Kampagnenname erforderlich' }, { status: 400 });
    }

    const filters = body.filters || {};
    const conditions: string[] = ["status != 'rejected'"];
    const params: (string | number)[] = [];

    const f = filters as Record<string, string | number | boolean | undefined>;
    if (f.onlyWithEmail !== false) {
      conditions.push("((email IS NOT NULL AND email != '') OR (entscheider_email IS NOT NULL AND entscheider_email != '') OR (all_emails IS NOT NULL AND all_emails != '' AND all_emails != '[]'))");
    }
    if (f.city) {
      conditions.push("(city = ? OR city LIKE ? || ' %' OR city LIKE ? || '-%')");
      params.push(String(f.city), String(f.city), String(f.city));
    }
    if (typeof f.minScore === 'number') { conditions.push("score >= ?"); params.push(f.minScore); }
    if (typeof f.maxScore === 'number') { conditions.push("score <= ?"); params.push(f.maxScore); }
    if (f.keyword) {
      conditions.push("(found_via_keywords LIKE '%' || ? || '%' OR category LIKE '%' || ? || '%')");
      params.push(String(f.keyword), String(f.keyword));
    }
    if (f.contactStatus) { conditions.push("contact_status = ?"); params.push(String(f.contactStatus)); }

    const blacklisted = db.prepare('SELECT email FROM email_blacklist').all() as { email: string }[];
    const blacklistSet = new Set(blacklisted.map(b => b.email.toLowerCase()));

    const rows = db.prepare(`SELECT id, email, entscheider_email, all_emails FROM leads WHERE ${conditions.join(' AND ')} ORDER BY score ASC, created_at DESC`).all(...params) as { id: number; email: string | null; entscheider_email: string | null; all_emails: string | null }[];

    const filteredLeads = rows.filter(r => {
      const emails = [r.email, r.entscheider_email].filter(Boolean).map(e => e!.toLowerCase());
      if (r.all_emails) {
        try { const arr = JSON.parse(r.all_emails) as string[]; arr.forEach(e => emails.push(e.toLowerCase())); } catch {}
      }
      return !emails.every(e => blacklistSet.has(e));
    });

    const result = db.prepare(`
      INSERT INTO outreach_campaigns (name, status, filters, lead_count, mails_per_hour, prefer_entscheider, schedule_type, subject_variant_b, ab_split, account_id)
      VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.name.trim(),
      JSON.stringify(filters),
      filteredLeads.length,
      body.mailsPerHour || 60,
      body.preferEntscheider !== false ? 1 : 0,
      body.scheduleType || 'immediate',
      body.subjectVariantB || null,
      body.abSplit ? 1 : 0,
      (body as Record<string, unknown>).accountId || null,
    );

    const campaignId = result.lastInsertRowid as number;
    const insertLead = db.prepare('INSERT INTO outreach_campaign_leads (campaign_id, lead_id, variant) VALUES (?, ?, ?)');
    const insertAll = db.transaction(() => {
      for (let i = 0; i < filteredLeads.length; i++) {
        const variant = body.abSplit ? (i % 2 === 0 ? 'A' : 'B') : 'A';
        insertLead.run(campaignId, filteredLeads[i].id, variant);
      }
    });
    insertAll();

    const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(campaignId) as CampaignRow;

    return NextResponse.json({
      campaign: {
        ...campaign,
        filters: JSON.parse(campaign.filters || '{}'),
        prefer_entscheider: !!campaign.prefer_entscheider,
        ab_split: !!campaign.ab_split,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

async function startCampaign(db: ReturnType<typeof getDb>, campaignId: number, request: NextRequest) {
  const campaign = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(campaignId) as CampaignRow | undefined;
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden' }, { status: 404 });
  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    return NextResponse.json({ error: 'Kampagne kann nicht gestartet werden' }, { status: 400 });
  }

  const leadRows = db.prepare("SELECT lead_id FROM outreach_campaign_leads WHERE campaign_id = ? AND status = 'pending' ORDER BY id ASC").all(campaignId) as { lead_id: number }[];
  if (leadRows.length === 0) return NextResponse.json({ error: 'Keine Leads in der Kampagne' }, { status: 400 });

  const campData = campaign as CampaignRow & { account_id?: number | null };
  const job = createJob({
    leadIds: leadRows.map(r => r.lead_id),
    throttleMs: Math.floor(3_600_000 / (campaign.mails_per_hour || 60)),
    preferEntscheider: !!campaign.prefer_entscheider,
    campaignId,
    scheduleType: campaign.schedule_type as 'immediate' | 'business_hours',
    subjectVariantB: campaign.subject_variant_b || undefined,
    abSplit: !!campaign.ab_split,
    accountId: campData.account_id || null,
  });

  db.prepare("UPDATE outreach_campaigns SET status = 'running', job_id = ?, started_at = datetime('now') WHERE id = ?").run(job.id, campaignId);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  runJob(job.id, baseUrl).catch(err => {
    console.error('[Campaign Job]', job.id, err);
  });

  return NextResponse.json({ success: true, jobId: job.id, campaignId });
}
