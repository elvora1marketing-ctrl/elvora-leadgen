import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { lead_ids } = await request.json() as { lead_ids?: number[] };
    const db = getDb();

    // Check if AI personalization is enabled
    const aiEnabledRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_personalization_enabled'").get() as { value: string } | undefined;
    const aiEnabled = aiEnabledRow?.value === 'true';

    // If no specific IDs, get all qualified leads that haven't been contacted
    let leads;
    if (lead_ids && lead_ids.length > 0) {
      const placeholders = lead_ids.map(() => '?').join(',');
      leads = db.prepare(`
        SELECT id, name, email, city, score, problems, seo_issues
        FROM leads
        WHERE id IN (${placeholders})
          AND email IS NOT NULL AND email != ''
          AND contact_status = 'not_contacted'
      `).all(...lead_ids) as Array<{
        id: number;
        name: string;
        email: string;
        city: string;
        score: number;
        problems: string;
        seo_issues: string;
      }>;
    } else {
      leads = db.prepare(`
        SELECT id, name, email, city, score, problems, seo_issues
        FROM leads
        WHERE status = 'qualified'
          AND email IS NOT NULL AND email != ''
          AND contact_status = 'not_contacted'
        ORDER BY score DESC
        LIMIT 100
      `).all() as Array<{
        id: number;
        name: string;
        email: string;
        city: string;
        score: number;
        problems: string;
        seo_issues: string;
      }>;
    }

    if (leads.length === 0) {
      return NextResponse.json({ error: 'Keine Leads zum Senden gefunden' }, { status: 404 });
    }

    let sent = 0;
    let errors = 0;
    const results: Array<{ lead_id: number; name: string; status: 'sent' | 'error'; error?: string }> = [];

    // Send emails sequentially with small delay to respect rate limits
    for (const lead of leads) {
      try {
        const problems = lead.problems ? JSON.parse(lead.problems) : [];
        const seoIssues = lead.seo_issues ? JSON.parse(lead.seo_issues) : [];

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
                ansprechpartner: lead.name.split(' ')[0] || 'Geschäftsführer/in',
                website: lead.name,
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

        const res = await fetch(new URL('/api/email/send', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            lead_name: lead.name,
            lead_email: lead.email,
            ansprechpartner: 'Herr/Frau Geschäftsführer',
            website: lead.name,
            city: lead.city,
            score: lead.score,
            problems,
            seo_issues: seoIssues,
            personalized_subject: personalized.subject,
            personalized_intro: personalized.intro,
            personalized_pitch: personalized.pitch,
          }),
        });

        if (res.ok) {
          sent++;
          results.push({ lead_id: lead.id, name: lead.name, status: 'sent' });
        } else {
          const data = await res.json().catch(() => ({}));
          errors++;
          results.push({ lead_id: lead.id, name: lead.name, status: 'error', error: (data as { error?: string }).error });
        }
      } catch {
        errors++;
        results.push({ lead_id: lead.id, name: lead.name, status: 'error', error: 'Netzwerkfehler' });
      }
    }

    return NextResponse.json({
      success: true,
      total: leads.length,
      sent,
      errors,
      results,
    });
  } catch (error: unknown) {
    console.error('Bulk send error:', error);
    return NextResponse.json({ error: 'Fehler beim Bulk-Versand' }, { status: 500 });
  }
}
