import getDb from '@/lib/db';
import { notFound } from 'next/navigation';
import ProposalPageClient from './ProposalPageClient';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const db = getDb();
  const proposal = db.prepare('SELECT title FROM proposals WHERE token = ?').get(token) as { title: string } | undefined;
  return {
    title: proposal ? `Angebot: ${proposal.title}` : 'Angebot nicht gefunden',
  };
}

export default async function ProposalPage({ params }: Props) {
  const { token } = await params;
  const db = getDb();

  const proposal = db.prepare('SELECT * FROM proposals WHERE token = ?').get(token) as Record<string, unknown> | undefined;
  if (!proposal) notFound();

  db.prepare("UPDATE proposals SET views = COALESCE(views, 0) + 1, last_viewed_at = datetime('now'), view_notified = 0 WHERE token = ?").run(token);

  if (proposal.status === 'sent' || proposal.status === 'draft') {
    db.prepare("UPDATE proposals SET status = 'viewed', viewed_at = datetime('now'), updated_at = datetime('now') WHERE token = ? AND status IN ('sent', 'draft')").run(token);
    proposal.status = 'viewed';
  }

  const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'agency_%'").all() as { key: string; value: string }[];
  const agency: Record<string, string> = {};
  for (const row of settingsRows) {
    agency[row.key] = row.value;
  }

  return (
    <ProposalPageClient
      proposal={JSON.parse(JSON.stringify(proposal))}
      agency={agency}
      token={token}
    />
  );
}
