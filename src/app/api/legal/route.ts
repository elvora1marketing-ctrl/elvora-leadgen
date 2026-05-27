import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const keys = ['privacy_policy_url', 'impressum_url', 'agency_name'];
    const rows = db.prepare(
      `SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`
    ).all(...keys) as { key: string; value: string }[];

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
