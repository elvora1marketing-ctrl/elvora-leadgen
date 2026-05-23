import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

const CLIENT_STATUS_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  churned: 'Abgewandert',
};

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();

    const rows = db.prepare(`SELECT company_name, contact_name, contact_email, project_type, project_value, monthly_value, status, progress_phase, created_at FROM clients ORDER BY created_at DESC`).all() as any[];

    const header = ['Firma', 'Kontakt', 'Email', 'Projekttyp', 'Projektwert', 'Monatswert', 'Status', 'Phase', 'Erstellt'];
    const csvRows = [header.join(';')];

    for (const row of rows) {
      csvRows.push([
        csvEscape(row.company_name),
        csvEscape(row.contact_name),
        csvEscape(row.contact_email),
        csvEscape(row.project_type),
        csvEscape(row.project_value),
        csvEscape(row.monthly_value),
        csvEscape(CLIENT_STATUS_LABELS[row.status] || row.status),
        csvEscape(row.progress_phase),
        csvEscape(formatDate(row.created_at)),
      ].join(';'));
    }

    const today = new Date().toISOString().slice(0, 10);
    const csv = '﻿' + csvRows.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="clients-export-${today}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
