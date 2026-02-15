import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 60);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, calendly_url } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const db = getDb();

    // Get lead data
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id) as Record<string, unknown> | undefined;

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check if audit already exists for this lead
    const existing = db.prepare('SELECT * FROM audit_pages WHERE lead_id = ?').get(lead_id) as Record<string, unknown> | undefined;

    if (existing) {
      return NextResponse.json({
        slug: existing.slug,
        url: `/audit/${existing.slug}`,
        existing: true,
      });
    }

    // Generate unique slug
    let slug = generateSlug(lead.name as string);
    const slugExists = db.prepare('SELECT id FROM audit_pages WHERE slug = ?').get(slug);
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Insert audit page
    db.prepare(`
      INSERT INTO audit_pages (lead_id, slug, business_name, city, website, score, problems, seo_issues, calendly_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lead_id,
      slug,
      lead.name,
      lead.city,
      lead.website_normalized || lead.website_original || '',
      lead.score,
      lead.problems || '[]',
      lead.seo_issues || '[]',
      calendly_url || (db.prepare("SELECT value FROM settings WHERE key = 'calendly_url'").get() as { value: string } | undefined)?.value || null,
    );

    return NextResponse.json({
      slug,
      url: `/audit/${slug}`,
      existing: false,
    });
  } catch (error) {
    console.error('Audit creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
