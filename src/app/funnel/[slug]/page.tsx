import { notFound } from 'next/navigation';
import getDb from '@/lib/db';
import type { FunnelConfig } from '@/lib/funnel-config';

export const dynamic = 'force-dynamic';

export default async function FunnelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM funnel_configs WHERE slug = ? AND is_active = 1').get(slug) as Record<string, unknown> | undefined;
  if (!row) notFound();

  let config: FunnelConfig;
  try { config = JSON.parse(row.config as string); } catch { notFound(); }

  const origin = process.env.NEXT_PUBLIC_BASE_URL || '';

  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{config.meta.title}</title>
        {config.meta.description && <meta name="description" content={config.meta.description} />}
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: ${config.branding.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
            background: ${config.branding.backgroundColor || '#ffffff'};
            color: ${config.branding.textColor || '#1e293b'};
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 24px 16px;
          }
          #elvora-funnel-root {
            width: 100%;
            max-width: 680px;
          }
        `}</style>
      </head>
      <body>
        <div id="elvora-funnel-root" />
        <script
          src={`${origin}/elvora-funnel.js`}
          data-url={origin}
          data-slug={slug}
          data-mode="inline"
          data-target="#elvora-funnel-root"
          defer
        />
      </body>
    </html>
  );
}
