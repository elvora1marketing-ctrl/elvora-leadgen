import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { testSearchEngines, type SearchEngineConfig } from '@/lib/linkedin-scraper-free';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  const searxngUrl = (db.prepare("SELECT value FROM settings WHERE key = 'searxng_url'").get() as { value: string } | undefined)?.value || '';
  const googleCseKey = (db.prepare("SELECT value FROM settings WHERE key = 'google_cse_key'").get() as { value: string } | undefined)?.value || '';
  const googleCseCx = (db.prepare("SELECT value FROM settings WHERE key = 'google_cse_cx'").get() as { value: string } | undefined)?.value || '';

  const config: SearchEngineConfig = {
    searxngUrl: searxngUrl || undefined,
    googleCseKey: googleCseKey || undefined,
    googleCseCx: googleCseCx || undefined,
  };

  const results = await testSearchEngines(config);

  return NextResponse.json({ engines: results });
}
