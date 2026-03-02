import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

/**
 * Autopilot Engine – läuft als Cronjob oder manuell
 *
 * Pipeline:
 * 1. Auto-Qualify: Leads mit Score >= Threshold automatisch qualifizieren
 * 2. Auto-Email: Qualifizierte, nicht kontaktierte Leads automatisch anmailen
 * 3. Follow-Ups: Fällige Follow-Up Mails verschicken
 * 4. Hot-Lead Detection: Audit-Views/CTA-Klicks → Lead als "hot" markieren
 */

interface AutopilotResult {
  qualified: number;
  emailsSent: number;
  emailErrors: number;
  followUpsSent: number;
  hotLeadsDetected: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const result: AutopilotResult = {
      qualified: 0,
      emailsSent: 0,
      emailErrors: 0,
      followUpsSent: 0,
      hotLeadsDetected: 0,
      errors: [],
    };

    // Get settings
    const thresholdRow = db.prepare("SELECT value FROM settings WHERE key = 'score_threshold'").get() as { value: string } | undefined;
    const threshold = thresholdRow ? parseInt(thresholdRow.value) : 85;

    const autopilotRow = db.prepare("SELECT value FROM settings WHERE key = 'autopilot_enabled'").get() as { value: string } | undefined;
    const autopilotEnabled = autopilotRow?.value === 'true';

    // Allow manual trigger even if autopilot is off
    const body = await request.json().catch(() => ({})) as { force?: boolean };
    if (!autopilotEnabled && !body.force) {
      return NextResponse.json({ ...result, message: 'Autopilot ist deaktiviert. In Einstellungen aktivieren oder mit { "force": true } erzwingen.' });
    }

    // ─── STEP 1: Auto-Qualify ───
    const pendingLeads = db.prepare(`
      SELECT id, score FROM leads
      WHERE status = 'pending' AND score >= ?
    `).all(threshold) as { id: number; score: number }[];

    if (pendingLeads.length > 0) {
      const qualifyStmt = db.prepare(`
        UPDATE leads SET status = 'qualified', reviewed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `);
      const qualifyAll = db.transaction(() => {
        for (const lead of pendingLeads) {
          qualifyStmt.run(lead.id);
        }
      });
      qualifyAll();
      result.qualified = pendingLeads.length;
    }

    // ─── STEP 2: Auto-Email (with optional AI personalization) ───
    const aiEnabledRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_personalization_enabled'").get() as { value: string } | undefined;
    const aiEnabled = aiEnabledRow?.value === 'true';

    const uncontactedLeads = db.prepare(`
      SELECT id, name, email, phone, website_original as website, city, score, problems, seo_issues
      FROM leads
      WHERE status = 'qualified'
        AND contact_status = 'not_contacted'
        AND email IS NOT NULL
        AND email != ''
      ORDER BY score DESC
      LIMIT 50
    `).all() as Array<{
      id: number; name: string; email: string; phone: string;
      website: string; city: string; score: number;
      problems: string; seo_issues: string;
    }>;

    for (const lead of uncontactedLeads) {
      try {
        let problems = [];
        let seoIssues = [];
        try { problems = JSON.parse(lead.problems || '[]'); } catch { /* skip */ }
        try { seoIssues = JSON.parse(lead.seo_issues || '[]'); } catch { /* skip */ }

        // Try AI personalization if enabled
        let personalized: { subject?: string; intro?: string; pitch?: string } = {};
        if (aiEnabled) {
          try {
            const aiRes = await fetch(new URL('/api/ai/personalize', request.url).toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_id: lead.id,
                lead_name: lead.name,
                ansprechpartner: lead.name.split(' ')[0] || '',
                website: lead.website || '',
                city: lead.city,
                score: lead.score,
                problems,
                seo_issues: seoIssues,
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              personalized = { subject: aiData.subject, intro: aiData.intro, pitch: aiData.pitch };
            }
          } catch {
            // AI failed silently, continue with template
          }
        }

        const emailRes = await fetch(new URL('/api/email/send', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            lead_name: lead.name,
            lead_email: lead.email,
            ansprechpartner: '',
            website: lead.website || '',
            city: lead.city,
            score: lead.score,
            problems,
            seo_issues: seoIssues,
            personalized_subject: personalized.subject,
            personalized_intro: personalized.intro,
            personalized_pitch: personalized.pitch,
          }),
        });

        if (emailRes.ok) {
          result.emailsSent++;
        } else {
          result.emailErrors++;
          const errData = await emailRes.json().catch(() => ({ error: 'Unknown' }));
          result.errors.push(`Email an ${lead.name}: ${errData.error}`);
        }

        // Rate limit: 200ms between emails
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        result.emailErrors++;
        result.errors.push(`Email an ${lead.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // ─── STEP 3: Follow-Ups ───
    try {
      const followUpRes = await fetch(new URL('/api/followups/process', request.url).toString(), {
        method: 'POST',
      });
      if (followUpRes.ok) {
        const fuData = await followUpRes.json();
        result.followUpsSent = fuData.sent || 0;
      }
    } catch {
      result.errors.push('Follow-Up Verarbeitung fehlgeschlagen');
    }

    // ─── STEP 4: Hot-Lead Detection ───
    // Mark leads as high priority when their audit was viewed or CTA clicked
    const hotLeadsUpdated = db.prepare(`
      UPDATE leads SET
        priority = 'high',
        notes = CASE
          WHEN notes IS NULL THEN '🔥 Hot Lead: Audit wurde angesehen'
          WHEN notes NOT LIKE '%Hot Lead%' THEN notes || char(10) || '🔥 Hot Lead: Audit wurde angesehen'
          ELSE notes
        END,
        updated_at = datetime('now')
      WHERE id IN (
        SELECT l.id FROM leads l
        JOIN audit_pages ap ON ap.lead_id = l.id
        WHERE (ap.views > 0 OR ap.cta_clicks > 0)
          AND l.priority != 'high'
      )
    `).run();
    result.hotLeadsDetected = hotLeadsUpdated.changes;

    // Log autopilot run
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('last_autopilot_run', ?, datetime('now'))
    `).run(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...result,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Autopilot error:', error);
    return NextResponse.json({ error: 'Autopilot-Fehler' }, { status: 500 });
  }
}

// GET: Autopilot status
export async function GET() {
  try {
    const db = getDb();

    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'autopilot_enabled'").get() as { value: string } | undefined;
    const lastRunRow = db.prepare("SELECT value FROM settings WHERE key = 'last_autopilot_run'").get() as { value: string } | undefined;

    let lastRun = null;
    if (lastRunRow?.value) {
      try { lastRun = JSON.parse(lastRunRow.value); } catch { /* skip */ }
    }

    return NextResponse.json({
      enabled: enabledRow?.value === 'true',
      lastRun,
    });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
