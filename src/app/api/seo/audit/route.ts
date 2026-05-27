import { NextRequest, NextResponse } from 'next/server';
import { runSeoAudit } from '@/lib/seo-analyzer';
import { requireAuth } from '@/lib/auth';

export const dynamic = "force-dynamic";

/**
 * POST /api/seo/audit - Run deep SEO audit on a URL
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json() as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: 'URL ist erforderlich' }, { status: 400 });
    }

    const result = await runSeoAudit(body.url);

    return NextResponse.json({
      success: true,
      audit: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[SEO Audit API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
