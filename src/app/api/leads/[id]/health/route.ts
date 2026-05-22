import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { updateDealHealth, calculateDealHealth } from '@/lib/deal-health';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 });
    }

    const db = getDb();

    const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    updateDealHealth(db, leadId);
    const { score, insights } = calculateDealHealth(db, leadId);

    return NextResponse.json({ score, insights });
  } catch (error) {
    console.error('[API] Deal health error:', error);
    return NextResponse.json({ error: 'Fehler bei der Health-Berechnung' }, { status: 500 });
  }
}
