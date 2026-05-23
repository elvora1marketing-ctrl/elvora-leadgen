import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const db = getDb();

    const upsert = db.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    );

    const saveMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, value);
      }
    });

    saveMany(Object.entries(body));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
