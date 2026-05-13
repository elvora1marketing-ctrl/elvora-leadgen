import getDb from '@/lib/db';
import { notFound } from 'next/navigation';
import ClientPortalClient from './ClientPortalClient';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const db = getDb();
  const client = db.prepare('SELECT company_name FROM clients WHERE token = ?').get(token) as { company_name: string } | undefined;
  return {
    title: client ? `Portal: ${client.company_name}` : 'Portal nicht gefunden',
  };
}

export default async function ClientPortalPage({ params }: Props) {
  const { token } = await params;
  const db = getDb();

  const clientRow = db.prepare('SELECT * FROM clients WHERE token = ?').get(token) as Record<string, unknown> | undefined;
  if (!clientRow) notFound();
  const client = clientRow!;

  const messages = db.prepare('SELECT * FROM client_messages WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
  const files = db.prepare('SELECT id, client_id, filename, uploaded_by, created_at FROM client_files WHERE client_id = ? ORDER BY created_at DESC').all(client.id);

  const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'agency_%'").all() as { key: string; value: string }[];
  const agency: Record<string, string> = {};
  for (const row of settingsRows) {
    agency[row.key] = row.value;
  }

  return (
    <ClientPortalClient
      client={JSON.parse(JSON.stringify(client))}
      messages={JSON.parse(JSON.stringify(messages))}
      files={JSON.parse(JSON.stringify(files))}
      agency={agency}
      token={token}
    />
  );
}
