import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get target cities and keywords from settings
    const citiesRow = db.prepare("SELECT value FROM settings WHERE key = 'target_cities'").get() as { value: string } | undefined;
    const keywordsRow = db.prepare("SELECT value FROM settings WHERE key = 'keywords'").get() as { value: string } | undefined;

    const cities: string[] = citiesRow ? JSON.parse(citiesRow.value) : ['Essen', 'Dortmund', 'Bochum', 'Duisburg'];
    const keywords: string[] = keywordsRow ? JSON.parse(keywordsRow.value) : ['Sanitär', 'Heizung', 'Klempner', 'SHK'];

    // Log scan start
    const scanResults: Array<{ keyword: string; city: string; status: string }> = [];

    for (const keyword of keywords) {
      for (const city of cities) {
        // Record scan in history
        const result = db.prepare(
          "INSERT INTO scan_history (keyword, city, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
        ).run(keyword, city);

        const scanId = result.lastInsertRowid;

        // TODO: Implement actual Google scraping here
        // For now, mark as completed with placeholder
        db.prepare(
          "UPDATE scan_history SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
        ).run(scanId);

        scanResults.push({ keyword, city, status: 'completed' });
      }
    }

    // Also process any due follow-ups
    const followUpRes = await fetch(new URL('/api/followups/process', request.url).toString(), {
      method: 'POST',
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
    });
    const followUpData = await followUpRes.json();

    return NextResponse.json({
      success: true,
      scans: scanResults,
      cities: cities.length,
      keywords: keywords.length,
      totalScans: scanResults.length,
      followUps: followUpData,
    });
  } catch (error: unknown) {
    console.error('Cron scan error:', error);
    return NextResponse.json({ error: 'Scan-Fehler' }, { status: 500 });
  }
}
