import { CATEGORIES } from '@/lib/lead-categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = CATEGORIES.map(cat => ({
    id: cat.id,
    name: cat.name,
    scrapeKeywords: cat.scrapeKeywords,
    keywordCount: cat.scrapeKeywords.length,
  }));

  return Response.json({ categories });
}
