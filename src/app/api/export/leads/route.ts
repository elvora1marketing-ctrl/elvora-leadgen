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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  qualified: 'Qualifiziert',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
  akquise: 'Akquise',
};

const CONTACT_STATUS_LABELS: Record<string, string> = {
  not_contacted: 'Nicht kontaktiert',
  email_sent: 'Email gesendet',
  called: 'Angerufen',
  meeting: 'Meeting',
  proposal: 'Angebot',
  won: 'Gewonnen',
  lost: 'Verloren',
};

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { searchParams } = new URL(request.url);

    const conditions: string[] = [];
    const params: any[] = [];

    const status = searchParams.get('status');
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const contactStatus = searchParams.get('contact_status');
    if (contactStatus) {
      conditions.push('contact_status = ?');
      params.push(contactStatus);
    }

    const city = searchParams.get('city');
    if (city) {
      conditions.push('city = ?');
      params.push(city);
    }

    const minScore = searchParams.get('min_score');
    if (minScore) {
      conditions.push('score >= ?');
      params.push(Number(minScore));
    }

    const maxScore = searchParams.get('max_score');
    if (maxScore) {
      conditions.push('score <= ?');
      params.push(Number(maxScore));
    }

    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT name, website_original, email, phone, city, score, status, contact_status, priority, deal_value, engagement_score, created_at, updated_at FROM leads${where} ORDER BY created_at DESC`).all(...params) as any[];

    const header = ['Name', 'Website', 'Email', 'Telefon', 'Stadt', 'Score', 'Status', 'Kontaktstatus', 'Priorität', 'Deal-Wert', 'Engagement', 'Erstellt', 'Aktualisiert'];
    const csvRows = [header.join(';')];

    for (const row of rows) {
      csvRows.push([
        csvEscape(row.name),
        csvEscape(row.website_original),
        csvEscape(row.email),
        csvEscape(row.phone),
        csvEscape(row.city),
        csvEscape(row.score),
        csvEscape(STATUS_LABELS[row.status] || row.status),
        csvEscape(CONTACT_STATUS_LABELS[row.contact_status] || row.contact_status),
        csvEscape(row.priority),
        csvEscape(row.deal_value),
        csvEscape(row.engagement_score),
        csvEscape(formatDate(row.created_at)),
        csvEscape(formatDate(row.updated_at)),
      ].join(';'));
    }

    const today = new Date().toISOString().slice(0, 10);
    const csv = '﻿' + csvRows.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-export-${today}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
