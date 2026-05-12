import { notFound } from 'next/navigation';
import getDb from '@/lib/db';
import type { Metadata } from 'next';
import AuditPageClient from './AuditPageClient';

interface AuditRow {
  id: number;
  lead_id: number;
  slug: string;
  business_name: string;
  city: string;
  website: string;
  score: number;
  problems: string;
  seo_issues: string;
  calendly_url: string | null;
  views: number;
  cta_clicks: number;
  created_at: string;
  expires_at: string | null;
}

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const db = getDb();
  const audit = db.prepare('SELECT business_name FROM audit_pages WHERE slug = ?').get(params.slug) as { business_name: string } | undefined;

  if (!audit) {
    return { title: 'Audit nicht gefunden' };
  }

  return {
    title: `Website-Audit: ${audit.business_name}`,
    description: `Kostenloser Website-Audit Report für ${audit.business_name}. Erfahren Sie, wie Sie mehr Kunden über Ihre Website gewinnen.`,
  };
}

export default function AuditPage({ params }: PageProps) {
  const db = getDb();
  const audit = db.prepare('SELECT * FROM audit_pages WHERE slug = ?').get(params.slug) as AuditRow | undefined;

  if (!audit) {
    notFound();
  }

  db.prepare('UPDATE audit_pages SET views = views + 1 WHERE id = ?').run(audit.id);

  let problems: { id: string; label: string; severity: string }[] = [];
  let seoIssues: { id: string; label: string; impact: string }[] = [];

  try { problems = JSON.parse(audit.problems || '[]'); } catch { problems = []; }
  try { seoIssues = JSON.parse(audit.seo_issues || '[]'); } catch { seoIssues = []; }

  // Load competitor data for this lead
  let competitors: { name: string; score: number; hasSSL: boolean }[] = [];
  try {
    // First try: competitor_analyses table (manually triggered)
    const analyzed = db.prepare(`
      SELECT competitor_name, competitor_score, competitor_has_ssl
      FROM competitor_analyses
      WHERE lead_id = ?
      ORDER BY competitor_score DESC
      LIMIT 5
    `).all(audit.lead_id) as { competitor_name: string; competitor_score: number; competitor_has_ssl: number }[];

    if (analyzed.length > 0) {
      competitors = analyzed.map(c => ({
        name: c.competitor_name,
        score: c.competitor_score ?? 0,
        hasSSL: c.competitor_has_ssl === 1,
      }));
    } else {
      // Fallback: other leads in the same city with scores as natural competitors
      const peers = db.prepare(`
        SELECT name, score
        FROM leads
        WHERE city = ? AND id != ? AND score > 0 AND website_original IS NOT NULL
        ORDER BY score DESC
        LIMIT 5
      `).all(audit.city, audit.lead_id) as { name: string; score: number }[];

      competitors = peers.map(p => ({
        name: p.name,
        score: p.score,
        hasSSL: true,
      }));
    }
  } catch { /* silent */ }

  return (
    <AuditPageClient
      businessName={audit.business_name}
      city={audit.city}
      website={audit.website}
      score={audit.score}
      problems={problems}
      seoIssues={seoIssues}
      calendlyUrl={audit.calendly_url}
      createdAt={audit.created_at}
      competitors={competitors}
    />
  );
}
