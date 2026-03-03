import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeWebsite } from '@/lib/website-analyzer';
import { normalizeWebsite } from '@/lib/maps-scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, branche, stadt, firmenname, phone, email } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL ist erforderlich' }, { status: 400 });
    }

    // Normalize URL for analysis
    let analyzeUrl = url.trim();
    if (!analyzeUrl.startsWith('http://') && !analyzeUrl.startsWith('https://')) {
      analyzeUrl = 'https://' + analyzeUrl;
    }

    // Run website analysis
    const result = await analyzeWebsite(analyzeUrl);

    const db = getDb();
    const normalized = normalizeWebsite(analyzeUrl);
    const name = firmenname?.trim() || normalized;
    const cityName = stadt || 'Unbekannt';

    // Check if lead already exists
    const existingLead = db.prepare(
      'SELECT id FROM leads WHERE website_normalized = ?'
    ).get(normalized) as { id: number } | undefined;

    let leadId: number;

    if (existingLead) {
      // Update existing lead with fresh analysis
      db.prepare(`
        UPDATE leads SET
          score = ?,
          problems = ?,
          seo_issues = ?,
          updated_at = datetime('now'),
          last_seen_at = datetime('now')
        WHERE id = ?
      `).run(
        result.score,
        JSON.stringify(result.problems),
        JSON.stringify(result.seoIssues),
        existingLead.id
      );
      leadId = existingLead.id;
    } else {
      // Create new inbound lead
      const insert = db.prepare(`
        INSERT INTO leads (
          name, website_original, website_normalized, phone, email,
          city, score, problems, seo_issues, status, source, found_via_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'inbound_check', ?)
      `);
      const res = insert.run(
        name,
        analyzeUrl,
        normalized,
        phone?.trim() || null,
        email?.trim() || null,
        cityName,
        result.score,
        JSON.stringify(result.problems),
        JSON.stringify(result.seoIssues),
        branche || null
      );
      leadId = Number(res.lastInsertRowid);
    }

    // Update check page stats
    if (branche && stadt) {
      db.prepare(`
        INSERT INTO check_page_stats (branche, stadt, branche_slug, stadt_slug, submissions)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(branche_slug, stadt_slug)
        DO UPDATE SET submissions = submissions + 1
      `).run(branche, stadt, branche, stadt);
    }

    return NextResponse.json({
      score: result.score,
      problems: result.problems,
      seoIssues: result.seoIssues,
      leadId,
    });
  } catch (error) {
    console.error('[Check Analyze] Error:', error);
    return NextResponse.json(
      { error: 'Analyse fehlgeschlagen. Bitte überprüfen Sie die URL.' },
      { status: 500 }
    );
  }
}
