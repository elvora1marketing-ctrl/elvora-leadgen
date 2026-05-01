import { extractEmails } from './website-analyzer';

export interface ImpressumData {
  geschaeftsfuehrer: string | null;
  emails: string[];
  phones: string[];
  address: string | null;
  ustIdNr: string | null;
  handelsregister: string | null;
}

const IMPRESSUM_PATHS = [
  '/impressum',
  '/impressum/',
  '/kontakt',
  '/kontakt/',
  '/contact',
  '/about',
  '/ueber-uns',
  '/legal',
  '/imprint',
];

const PHONE_REGEX = /(?:Tel(?:efon)?|Fon|Phone|Ruf|Mobil|Handy)[.:\s]*\+?[\d\s/()-]{8,20}/gi;
const PHONE_EXTRACT = /(\+?[\d][\d\s/()-]{7,19})/;
const UST_REGEX = /(?:USt-?Id(?:Nr)?\.?|VAT|Steuernummer)[:\s]*(DE\s?\d{9}|\d{2,3}\/\d{3}\/\d{4,5})/i;
const HR_REGEX = /(?:HR[AB]|Handelsregister)[:\s]*([A-Z]*\s*\d{2,6}\s*[A-Z]*)/i;

function extractPhones(text: string): string[] {
  const phones: string[] = [];
  const matches = text.match(PHONE_REGEX);
  if (matches) {
    for (const m of matches) {
      const num = m.match(PHONE_EXTRACT);
      if (num) {
        const cleaned = num[1].replace(/\s+/g, ' ').trim();
        if (cleaned.length >= 8 && !phones.includes(cleaned)) {
          phones.push(cleaned);
        }
      }
    }
  }
  const directPhoneRegex = /(?<!\d)(\+49[\s/-]?\(?\d{2,5}\)?[\s/-]?\d{3,10}[\s/-]?\d{0,6})(?!\d)/g;
  let dm;
  while ((dm = directPhoneRegex.exec(text)) !== null) {
    const cleaned = dm[1].replace(/\s+/g, ' ').trim();
    if (!phones.includes(cleaned)) phones.push(cleaned);
  }
  const localPhone = /(?<!\d)(0\d{2,4}[\s/-]\d{4,10}(?:[\s/-]\d{1,6})?)(?!\d)/g;
  while ((dm = localPhone.exec(text)) !== null) {
    const cleaned = dm[1].replace(/\s+/g, ' ').trim();
    if (!phones.includes(cleaned)) phones.push(cleaned);
  }
  return phones.slice(0, 5);
}

function extractGeschaeftsfuehrer(text: string): string | null {
  const patterns = [
    /(?:Geschäftsführ(?:er|ung|erin)|Inhaber(?:in)?|Geschäftsleitung|Managing\s+Director|CEO|Vorstand|Einzelunternehmer(?:in)?)[:\s]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/,
    /(?:Vertreten\s+durch|Vertretungsberechtig(?:t|te|ter))[:\s]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/,
    /(?:V\.?i\.?S\.?d\.?P\.?)[:\s]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (name.split(/\s+/).length >= 2 && name.length <= 60) {
        return name;
      }
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&uuml;/g, 'ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');
}

export async function parseImpressum(baseUrl: string): Promise<ImpressumData> {
  const result: ImpressumData = {
    geschaeftsfuehrer: null,
    emails: [],
    phones: [],
    address: null,
    ustIdNr: null,
    handelsregister: null,
  };

  let origin: string;
  try {
    const u = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
    origin = u.origin;
  } catch {
    return result;
  }

  const allEmails = new Set<string>();
  const allPhones = new Set<string>();

  for (const path of IMPRESSUM_PATHS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${origin}${path}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'de-DE,de;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) continue;

      const html = await res.text();
      const text = stripHtml(html);

      const emails = extractEmails(html);
      emails.forEach(e => allEmails.add(e));

      const phones = extractPhones(text);
      phones.forEach(p => allPhones.add(p));

      if (!result.geschaeftsfuehrer) {
        result.geschaeftsfuehrer = extractGeschaeftsfuehrer(text);
      }

      if (!result.ustIdNr) {
        const ustMatch = text.match(UST_REGEX);
        if (ustMatch) result.ustIdNr = ustMatch[1];
      }

      if (!result.handelsregister) {
        const hrMatch = text.match(HR_REGEX);
        if (hrMatch) result.handelsregister = hrMatch[1].trim();
      }

      if (result.geschaeftsfuehrer && allEmails.size > 0) break;
    } catch {
      continue;
    }
  }

  result.emails = Array.from(allEmails);
  result.phones = Array.from(allPhones);

  return result;
}
