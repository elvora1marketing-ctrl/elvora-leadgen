import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { parseImpressum } from '@/lib/impressum-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SearchResult {
  profileUrl: string;
  snippetName: string;
  snippetHeadline: string;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
];

const DECISION_MAKER_TERMS = [
  'Geschäftsführer', 'Inhaber', 'CEO', 'Managing Director',
  'Geschäftsleitung', 'Eigentümer', 'Gründer', 'Founder',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function cleanLinkedInUrl(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://www.linkedin.com/in/${match[1]}`;
}

function parseSearchTitle(title: string): { name: string; headline: string } {
  const cleaned = title.replace(/\s*[\|–-]\s*LinkedIn\s*$/i, '').replace(/&amp;/g, '&');
  const parts = cleaned.split(/\s*[\|–]\s*/);
  return { name: parts[0]?.trim() || '', headline: parts.slice(1).join(' – ').trim() };
}

async function searchDuckDuckGo(query: string, maxResults: number = 15): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' },
    });
    if (!res.ok) return results;
    const html = await res.text();

    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let actualUrl = match[1];
      const uddgMatch = actualUrl.match(/uddg=([^&]+)/);
      if (uddgMatch) actualUrl = decodeURIComponent(uddgMatch[1]);

      const profileUrl = cleanLinkedInUrl(actualUrl);
      if (!profileUrl) continue;
      if (seenUrls.has(profileUrl)) continue;
      seenUrls.add(profileUrl);

      const parsed = parseSearchTitle(match[2].replace(/<[^>]+>/g, '').trim());
      results.push({ profileUrl, snippetName: parsed.name, snippetHeadline: parsed.headline });
      if (results.length >= maxResults) break;
    }
  } catch { /* silent */ }

  return results;
}

function scoreRelevance(headline: string): number {
  const h = headline.toLowerCase();
  if (h.includes('geschäftsführer') || h.includes('inhaber') || h.includes('ceo') || h.includes('eigentümer')) return 100;
  if (h.includes('gründer') || h.includes('founder') || h.includes('managing director') || h.includes('geschäftsleitung')) return 90;
  if (h.includes('director') || h.includes('leiter') || h.includes('head of')) return 70;
  if (h.includes('manager') || h.includes('partner')) return 60;
  if (h.includes('vorstand')) return 95;
  return 10;
}

interface FoundPerson {
  name: string;
  headline: string;
  linkedinUrl: string;
  relevanceScore: number;
  source: 'linkedin' | 'impressum';
  email: string | null;
  phone: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const db = getDb();
    const lead = db.prepare('SELECT id, name, company, city, website_original, phone, email FROM leads WHERE id = ?').get(leadId) as {
      id: number; name: string; company: string | null; city: string; website_original: string | null; phone: string | null; email: string | null;
    } | undefined;

    if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });

    const body = await request.json().catch(() => ({})) as { autoSave?: boolean };
    const autoSave = body.autoSave !== false;

    const found: FoundPerson[] = [];

    const companyName = lead.company || lead.name;
    const searchTerms = DECISION_MAKER_TERMS.slice(0, 3).join(' OR ');
    const query = `site:linkedin.com/in "${companyName}" ${lead.city ? `"${lead.city}"` : ''} ${searchTerms}`;

    const searchResults = await searchDuckDuckGo(query, 10);

    for (const sr of searchResults) {
      found.push({
        name: sr.snippetName,
        headline: sr.snippetHeadline,
        linkedinUrl: sr.profileUrl,
        relevanceScore: scoreRelevance(sr.snippetHeadline),
        source: 'linkedin',
        email: null,
        phone: null,
      });
    }

    if (searchResults.length < 3) {
      const fallbackQuery = `site:linkedin.com/in "${companyName}" Geschäftsführer OR Inhaber`;
      const fallback = await searchDuckDuckGo(fallbackQuery, 5);
      const seenUrls = new Set(found.map(f => f.linkedinUrl));
      for (const sr of fallback) {
        if (seenUrls.has(sr.profileUrl)) continue;
        found.push({
          name: sr.snippetName,
          headline: sr.snippetHeadline,
          linkedinUrl: sr.profileUrl,
          relevanceScore: scoreRelevance(sr.snippetHeadline),
          source: 'linkedin',
          email: null,
          phone: null,
        });
      }
    }

    let impressum = null;
    if (lead.website_original) {
      impressum = await parseImpressum(lead.website_original);

      if (impressum.geschaeftsfuehrer) {
        found.unshift({
          name: impressum.geschaeftsfuehrer,
          headline: 'Geschäftsführer (Impressum)',
          linkedinUrl: '',
          relevanceScore: 110,
          source: 'impressum',
          email: impressum.emails[0] || null,
          phone: impressum.phones[0] || null,
        });
      }

      if (!lead.email && impressum.emails.length > 0) {
        db.prepare('UPDATE leads SET email = ? WHERE id = ?').run(impressum.emails[0], leadId);
      }
      if (!lead.phone && impressum.phones.length > 0) {
        db.prepare('UPDATE leads SET phone = ? WHERE id = ?').run(impressum.phones[0], leadId);
      }
    }

    found.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const top = found.slice(0, 10);

    if (autoSave && top.length > 0) {
      const best = top[0];
      if (best.name && best.name.split(/\s+/).length >= 2) {
        const existing = db.prepare('SELECT id FROM contacts WHERE lead_id = ? AND name = ?').get(leadId, best.name);
        if (!existing) {
          const currentPrimary = db.prepare('SELECT id FROM contacts WHERE lead_id = ? AND is_primary = 1').get(leadId);
          db.prepare(`
            INSERT INTO contacts (lead_id, name, role, email, phone, is_primary, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            leadId,
            best.name,
            best.headline || 'Geschäftsführer',
            best.email || (impressum?.emails[0]) || null,
            best.phone || (impressum?.phones[0]) || null,
            currentPrimary ? 0 : 1,
            best.linkedinUrl ? `LinkedIn: ${best.linkedinUrl}` : 'Quelle: Impressum',
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: top,
      impressum: impressum ? {
        geschaeftsfuehrer: impressum.geschaeftsfuehrer,
        emails: impressum.emails,
        phones: impressum.phones,
        ustIdNr: impressum.ustIdNr,
      } : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}
