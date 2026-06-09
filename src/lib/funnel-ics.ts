export function generateICS(opts: {
  summary: string;
  description?: string;
  dateStr: string;
  durationMinutes?: number;
  organizer?: string;
  attendee?: string;
}): string {
  const start = new Date(opts.dateStr);
  const end = new Date(start.getTime() + (opts.durationMinutes || 30) * 60_000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `elvora-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@elvora.me`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Elvora//Funnel//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.summary)}`,
  ];
  if (opts.description) lines.push(`DESCRIPTION:${esc(opts.description)}`);
  if (opts.organizer) lines.push(`ORGANIZER:mailto:${opts.organizer}`);
  if (opts.attendee) lines.push(`ATTENDEE:mailto:${opts.attendee}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
