import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ensureDailyReset, getWarmingLimit } from '@/lib/outbound';

export const dynamic = 'force-dynamic';

interface WarmingDomain {
  id: number;
  domain: string;
  status: string;
  warm_start_date: string;
  warm_current_day: number;
  daily_limit: number;
  sent_today: number;
  sent_total: number;
  health_score: number;
  account_id: number | null;
}

const WARMUP_SCHEDULE = [
  { day: 1, limit: 2 },
  { day: 2, limit: 4 },
  { day: 3, limit: 5 },
  { day: 4, limit: 8 },
  { day: 5, limit: 10 },
  { day: 6, limit: 14 },
  { day: 7, limit: 15 },
  { day: 8, limit: 18 },
  { day: 9, limit: 22 },
  { day: 10, limit: 25 },
  { day: 11, limit: 30 },
  { day: 12, limit: 35 },
  { day: 13, limit: 40 },
  { day: 14, limit: 45 },
  { day: 15, limit: 50 },
];

function getWarmupTarget(day: number): number {
  const entry = WARMUP_SCHEDULE.find(e => e.day === day);
  if (entry) return entry.limit;
  if (day > 15) return 50;
  return 2;
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  ensureDailyReset(db);

  const warmingDomains = db.prepare(`
    SELECT d.*, COUNT(i.id) as inbox_count
    FROM sending_domains d
    LEFT JOIN sending_inboxes i ON d.id = i.domain_id AND i.status = 'active'
    WHERE d.status = 'warming'
    GROUP BY d.id
    ORDER BY d.warm_current_day ASC
  `).all() as (WarmingDomain & { inbox_count: number })[];

  const schedule = warmingDomains.map(d => ({
    id: d.id,
    domain: d.domain,
    day: d.warm_current_day,
    totalDays: 15,
    todayTarget: getWarmupTarget(d.warm_current_day),
    todaySent: d.sent_today,
    totalSent: d.sent_total,
    healthScore: d.health_score,
    inboxCount: d.inbox_count,
    accountId: d.account_id,
    startDate: d.warm_start_date,
    progress: Math.min(100, Math.round((d.warm_current_day / 15) * 100)),
  }));

  return NextResponse.json({
    warmingDomains: schedule,
    schedule: WARMUP_SCHEDULE,
  });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const db = getDb();
  ensureDailyReset(db);

  const warmingDomains = db.prepare(`
    SELECT d.id, d.domain, d.warm_current_day, d.sent_today, d.daily_limit
    FROM sending_domains d
    WHERE d.status = 'warming'
  `).all() as WarmingDomain[];

  const inboxes = db.prepare(`
    SELECT i.id, i.email, i.display_name, i.domain_id, i.sent_today, i.daily_limit
    FROM sending_inboxes i
    JOIN sending_domains d ON i.domain_id = d.id
    WHERE i.status = 'active' AND d.status = 'warming'
  `).all() as { id: number; email: string; display_name: string; domain_id: number; sent_today: number; daily_limit: number }[];

  const resendKey = (db.prepare("SELECT value FROM settings WHERE key = 'resend_api_key'").get() as { value: string } | undefined)?.value;
  if (!resendKey) {
    return NextResponse.json({ error: 'Resend API Key nicht konfiguriert' }, { status: 400 });
  }

  let totalSent = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const domain of warmingDomains) {
    const target = getWarmupTarget(domain.warm_current_day);
    const remaining = target - domain.sent_today;
    if (remaining <= 0) { totalSkipped++; continue; }

    const domainInboxes = inboxes.filter(i => i.domain_id === domain.id);
    if (domainInboxes.length === 0) {
      errors.push(`${domain.domain}: Keine aktiven Inboxes`);
      continue;
    }

    // Send warmup emails (internal ping-pong between inboxes on same domain)
    let sent = 0;
    for (let i = 0; i < remaining; i++) {
      const fromInbox = domainInboxes[i % domainInboxes.length];
      const toInbox = domainInboxes.length > 1
        ? domainInboxes[(i + 1) % domainInboxes.length]
        : fromInbox;

      if (fromInbox.sent_today >= fromInbox.daily_limit) continue;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${fromInbox.display_name || 'Warmup'} <${fromInbox.email}>`,
            to: toInbox.email,
            subject: generateWarmupSubject(),
            html: generateWarmupBody(),
          }),
        });

        if (res.ok) {
          sent++;
          fromInbox.sent_today++;
          db.prepare('UPDATE sending_inboxes SET sent_today = sent_today + 1 WHERE id = ?').run(fromInbox.id);
          db.prepare('UPDATE sending_domains SET sent_today = sent_today + 1, sent_total = sent_total + 1 WHERE id = ?').run(domain.id);
        } else {
          const err = await res.text();
          errors.push(`${domain.domain}: ${err}`);
          break;
        }
      } catch (e) {
        errors.push(`${domain.domain}: ${e instanceof Error ? e.message : 'Fehler'}`);
        break;
      }

      // Small delay between sends
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }

    totalSent += sent;
  }

  return NextResponse.json({
    sent: totalSent,
    skipped: totalSkipped,
    domainsProcessed: warmingDomains.length,
    errors: errors.length ? errors : undefined,
  });
}

function generateWarmupSubject(): string {
  const subjects = [
    'Kurze Rückfrage zum Projekt',
    'Re: Terminbestätigung',
    'Danke für die Info',
    'Kurzes Update',
    'Nächste Schritte besprochen',
    'Material wie besprochen',
    'Feedback zum Entwurf',
    'Abstimmung nächste Woche',
    'Re: Angebot erhalten',
    'Zusammenfassung Meeting',
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

function generateWarmupBody(): string {
  const bodies = [
    'Hallo,\n\nDanke für deine Nachricht. Ich schaue mir das heute noch an und melde mich.\n\nViele Grüße',
    'Hi,\n\nKurz zur Info: Der Termin nächste Woche Dienstag passt bei mir. Bitte bestätigen.\n\nBeste Grüße',
    'Moin,\n\nAnbei die Zusammenfassung wie besprochen. Bei Fragen einfach melden.\n\nLG',
    'Hallo zusammen,\n\nDanke für das Update. Sieht gut aus, ich gebe Feedback bis Freitag.\n\nVG',
    'Hi,\n\nAlles klar, ich habe die Unterlagen erhalten. Danke dir!\n\nBis bald',
  ];
  return `<p>${bodies[Math.floor(Math.random() * bodies.length)].replace(/\n/g, '<br>')}</p>`;
}
