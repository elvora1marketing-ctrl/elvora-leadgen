import { NextRequest, NextResponse } from 'next/server';
import { CATEGORIES } from '@/lib/lead-categories';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const categories = CATEGORIES.map(cat => ({
    id: cat.id,
    name: cat.name,
    scrapeKeywords: cat.scrapeKeywords,
    keywordCount: cat.scrapeKeywords.length,
  }));

  return Response.json({ categories });
}
