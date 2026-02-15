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

  // Increment view count
  db.prepare('UPDATE audit_pages SET views = views + 1 WHERE id = ?').run(audit.id);

  // Parse JSON fields
  let problems: { id: string; label: string; severity: string }[] = [];
  let seoIssues: { id: string; label: string; impact: string }[] = [];

  try {
    problems = JSON.parse(audit.problems || '[]');
  } catch {
    problems = [];
  }

  try {
    seoIssues = JSON.parse(audit.seo_issues || '[]');
  } catch {
    seoIssues = [];
  }

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
    />
  );
}
