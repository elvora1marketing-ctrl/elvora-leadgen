import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { lead_id, template_id, custom_title, custom_amount, custom_services, valid_days } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id ist erforderlich' }, { status: 400 });
    }

    const db = getDb();

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id) as Record<string, unknown> | undefined;
    if (!lead) {
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    let templateData: Record<string, unknown> | null = null;
    if (template_id) {
      templateData = db.prepare('SELECT * FROM proposal_templates WHERE id = ?').get(template_id) as Record<string, unknown> | null;
    }

    const title = custom_title || (templateData ? templateData.name as string : 'Angebot');
    const amount = custom_amount ?? (templateData ? templateData.price as number : 0);
    const priceType = templateData ? templateData.price_type as string : 'once';
    const services = custom_services || (templateData ? JSON.parse(templateData.services as string || '[]') : []);

    const competitors = db.prepare('SELECT * FROM competitor_analyses WHERE lead_id = ?').all(lead_id) as Record<string, unknown>[];

    const leadData = {
      name: lead.name,
      city: lead.city,
      website: lead.website_normalized || lead.website_original || '',
      score: lead.score,
      problems: JSON.parse(lead.problems as string || '[]'),
      seo_issues: JSON.parse(lead.seo_issues as string || '[]'),
      competitors: competitors.map(c => ({
        name: c.competitor_name,
        website: c.competitor_website,
        score: c.competitor_score,
      })),
    };

    const token = randomUUID();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (valid_days || 14));

    const result = db.prepare(`
      INSERT INTO proposals (lead_id, title, amount, status, token, template_id, services, valid_until, lead_data)
      VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `).run(
      lead_id,
      title,
      amount,
      token,
      template_id || null,
      JSON.stringify(services),
      validUntil.toISOString().split('T')[0],
      JSON.stringify(leadData),
    );

    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({
      proposal,
      url: `/proposal/${token}`,
      price_type: priceType,
    });
  } catch (error) {
    console.error('Proposal generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
