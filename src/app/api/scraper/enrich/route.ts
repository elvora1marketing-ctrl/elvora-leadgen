import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { parseImpressum, type ImpressumData } from '@/lib/impressum-parser';
import { extractEmails } from '@/lib/website-analyzer';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export const runtime = 'nodejs';
export const maxDuration = 120;

const EXTRA_PATHS = [
  '/team', '/ueber-uns', '/about-us', '/about', '/kontakt', '/contact',
  '/datenschutz', '/footer', '/',
];

function rankEmail(email: string): number {
  const e = email.toLowerCase();
  if (e.startsWith('geschaeftsfuehr') || e.startsWith('gf@')) return 100;
  if (e.startsWith('inhaber') || e.startsWith('chef')) return 95;
  if (e.startsWith('ceo') || e.startsWith('leitung')) return 90;
  if (e.match(/^[a-z]+\.[a-z]+@/)) return 80;
  if (e.match(/^[a-z]\.[a-z]+@/)) return 75;
  if (e.startsWith('office') || e.startsWith('mail@')) return 40;
  if (e.startsWith('info@')) return 35;
  if (e.startsWith('kontakt') || e.startsWith('contact')) return 30;
  if (e.startsWith('service') || e.startsWith('support')) return 20;
  if (e.startsWith('noreply') || e.startsWith('no-reply') || e.startsWith('newsletter')) return 5;
  return 50;
}

async function deepScrapeEmails(baseUrl: string): Promise<string[]> {
  let origin: string;
  try {
    const u = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
    origin = u.origin;
  } catch { return []; }

  const allEmails = new Set<string>();

  for (const path of EXTRA_PATHS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${origin}${path}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'de-DE,de;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const html = await res.text();
      const emails = extractEmails(html);
      emails.forEach(e => allEmails.add(e));
    } catch { continue; }
  }

  return Array.from(allEmails);
}

interface EnrichResult {
  lead_id: number;
  lead_name: string;
  website: string;
  emails_found: string[];
  phones_found: string[];
  decision_maker: string | null;
  best_email: string | null;
  updated: boolean;
  error?: string;
}

async function enrichLead(leadId: number, db: ReturnType<typeof getDb>): Promise<EnrichResult> {
  const lead = db.prepare('SELECT id, name, email, phone, website_original, website_normalized, city FROM leads WHERE id = ?').get(leadId) as {
    id: number; name: string; email: string | null; phone: string | null;
    website_original: string | null; website_normalized: string | null; city: string;
  } | undefined;

  if (!lead) return { lead_id: leadId, lead_name: '', website: '', emails_found: [], phones_found: [], decision_maker: null, best_email: null, updated: false, error: 'Lead nicht gefunden' };

  const website = lead.website_normalized || lead.website_original;
  if (!website) return { lead_id: leadId, lead_name: lead.name, website: '', emails_found: [], phones_found: [], decision_maker: null, best_email: null, updated: false, error: 'Keine Website' };

  let impressum: ImpressumData;
  try {
    impressum = await parseImpressum(website);
  } catch {
    return { lead_id: leadId, lead_name: lead.name, website, emails_found: [], phones_found: [], decision_maker: null, best_email: null, updated: false, error: 'Impressum nicht erreichbar' };
  }

  let extraEmails: string[] = [];
  if (impressum.emails.length < 2) {
    extraEmails = await deepScrapeEmails(website);
  }

  const allEmails = Array.from(new Set([...impressum.emails, ...extraEmails]));
  allEmails.sort((a, b) => rankEmail(b) - rankEmail(a));

  const bestEmail = allEmails[0] || null;
  let updated = false;

  if (!lead.email && bestEmail) {
    db.prepare('UPDATE leads SET email = ?, updated_at = datetime(\'now\') WHERE id = ?').run(bestEmail, leadId);
    updated = true;
  }

  if (!lead.phone && impressum.phones.length > 0) {
    db.prepare('UPDATE leads SET phone = ?, updated_at = datetime(\'now\') WHERE id = ?').run(impressum.phones[0], leadId);
    updated = true;
  }

  return {
    lead_id: leadId,
    lead_name: lead.name,
    website,
    emails_found: allEmails,
    phones_found: impressum.phones,
    decision_maker: impressum.geschaeftsfuehrer,
    best_email: bestEmail,
    updated,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { lead_id, lead_ids, url, bulk } = body;

    const db = getDb();

    // Single URL scrape (standalone tool)
    if (url && !lead_id) {
      const impressum = await parseImpressum(url);
      const extraEmails = await deepScrapeEmails(url);
      const allEmails = Array.from(new Set([...impressum.emails, ...extraEmails]));
      allEmails.sort((a, b) => rankEmail(b) - rankEmail(a));

      return NextResponse.json({
        url,
        emails: allEmails.map(e => ({ email: e, score: rankEmail(e) })),
        phones: impressum.phones,
        decision_maker: impressum.geschaeftsfuehrer,
        ust_id: impressum.ustIdNr,
        handelsregister: impressum.handelsregister,
      });
    }

    // Single lead enrichment
    if (lead_id) {
      const result = await enrichLead(lead_id, db);
      return NextResponse.json(result);
    }

    // Multiple specific leads
    if (lead_ids && Array.isArray(lead_ids)) {
      const results: EnrichResult[] = [];
      for (const id of lead_ids.slice(0, 50)) {
        results.push(await enrichLead(id, db));
      }
      const enriched = results.filter(r => r.updated).length;
      return NextResponse.json({ results, total: results.length, enriched });
    }

    // Bulk: all leads without email
    if (bulk) {
      const limit = body.limit || 0;
      const query = limit > 0
        ? db.prepare(`
            SELECT id FROM leads
            WHERE (email IS NULL OR email = '')
              AND (website_original IS NOT NULL AND website_original != '')
              AND status IN ('qualified', 'pending', 'akquise')
            ORDER BY score ASC, created_at DESC
            LIMIT ?
          `).all(limit)
        : db.prepare(`
            SELECT id FROM leads
            WHERE (email IS NULL OR email = '')
              AND (website_original IS NOT NULL AND website_original != '')
              AND status IN ('qualified', 'pending', 'akquise')
            ORDER BY score ASC, created_at DESC
          `).all();
      const leadsWithoutEmail = query as { id: number }[];

      if (leadsWithoutEmail.length === 0) {
        return NextResponse.json({ results: [], total: 0, enriched: 0, message: 'Keine Leads ohne E-Mail gefunden' });
      }

      const results: EnrichResult[] = [];
      for (const l of leadsWithoutEmail) {
        results.push(await enrichLead(l.id, db));
      }
      const enriched = results.filter(r => r.updated).length;
      return NextResponse.json({ results, total: results.length, enriched });
    }

    return NextResponse.json({ error: 'lead_id, lead_ids, url oder bulk erforderlich' }, { status: 400 });
  } catch (error) {
    console.error('Enrich error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as with_email,
        SUM(CASE WHEN (email IS NULL OR email = '') AND (website_original IS NOT NULL AND website_original != '') THEN 1 ELSE 0 END) as enrichable,
        SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) as without_email
      FROM leads
      WHERE status IN ('qualified', 'pending', 'akquise')
    `).get() as { total_leads: number; with_email: number; enrichable: number; without_email: number };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Enrich stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
