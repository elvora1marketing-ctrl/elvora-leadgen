import { ParsedProblems, ParsedSeoIssue } from './types';

export interface AnalysisResult {
  score: number;
  problems: ParsedProblems[];
  seoIssues: ParsedSeoIssue[];
  contactEmails: string[];
  entscheiderName: string | null;
  entscheiderEmail: string | null;
  details: {
    ssl: CheckResult;
    mobile: CheckResult;
    seo: CheckResult;
    security: CheckResult;
    performance: CheckResult;
    techStack: CheckResult;
    content: CheckResult;
    legal: CheckResult;
    design: CheckResult;
    accessibility: CheckResult;
  };
  analyzedAt: string;
  responseTimeMs: number;
}

interface CheckResult {
  score: number;
  maxScore: number;
  findings: string[];
}

const FETCH_TIMEOUT = 8000;
const SUBPAGE_TIMEOUT = 4000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SUBPAGE_KEYWORDS = ['impressum', 'kontakt', 'contact', 'team', 'ueber-uns', 'about', 'über-uns', 'imprint', 'wir', 'ansprechpartner'];

export interface QuickCheckResult {
  isReachable: boolean;
  hasSSL: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  finalUrl: string;
  error: string | null;
}

export async function quickCheck(url: string): Promise<QuickCheckResult> {
  const startTime = Date.now();
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'http://' + normalizedUrl;
  }

  const tryFetch = async (u: string): Promise<QuickCheckResult> => {
    const fetchStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(u, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        method: 'GET',
      });
      clearTimeout(timeout);
      try { await response.text(); } catch { /* ignore */ }
      return {
        isReachable: response.status < 500,
        hasSSL: response.url.startsWith('https://'),
        statusCode: response.status,
        responseTimeMs: Date.now() - fetchStart,
        finalUrl: response.url,
        error: null,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      return {
        isReachable: false,
        hasSSL: false,
        statusCode: null,
        responseTimeMs: Date.now() - fetchStart,
        finalUrl: u,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  let result = await tryFetch(normalizedUrl);
  if (!result.isReachable && normalizedUrl.startsWith('http://')) {
    result = await tryFetch(normalizedUrl.replace('http://', 'https://'));
  }
  if (result.responseTimeMs === 0) result.responseTimeMs = Date.now() - startTime;
  return result;
}

// ─── Email Ranking ─────────────────────────────────────────────────
function rankEmail(email: string): number {
  const e = email.toLowerCase();
  if (e.startsWith('geschaeftsfuehr') || e.startsWith('gf@')) return 100;
  if (e.startsWith('inhaber') || e.startsWith('chef')) return 95;
  if (e.startsWith('ceo') || e.startsWith('leitung')) return 90;
  if (/^[a-z]+\.[a-z]+@/.test(e)) return 80;
  if (/^[a-z]\.[a-z]+@/.test(e)) return 75;
  if (e.startsWith('office') || e.startsWith('mail@')) return 40;
  if (e.startsWith('info@')) return 35;
  if (e.startsWith('kontakt') || e.startsWith('contact')) return 30;
  if (e.startsWith('service') || e.startsWith('support')) return 20;
  if (e.startsWith('noreply') || e.startsWith('no-reply') || e.startsWith('newsletter') || e.startsWith('bewerbung') || e.startsWith('karriere')) return 5;
  return 50;
}

// ─── Decision Maker Extraction ─────────────────────────────────────
const GF_PATTERNS = [
  /(?:Geschäftsführ(?:er|ung|erin)|Inhaber(?:in)?|Geschäftsleitung|Managing\s+Director|CEO|Vorstand|Einzelunternehmer(?:in)?)[:\s]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/,
  /(?:Vertreten\s+durch|Vertretungsberechtig(?:t|te|ter))[:\s]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/,
  /(?:V\.?i\.?S\.?d\.?P\.?)[:\s]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/,
];

function extractDecisionMakerName(text: string): string | null {
  for (const pattern of GF_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (name.split(/\s+/).length >= 2 && name.length <= 60) return name;
    }
  }
  return null;
}

function matchEmailToName(name: string, emails: string[]): string | null {
  const parts = name.toLowerCase().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];

  for (const email of emails) {
    const e = email.toLowerCase().split('@')[0];
    if (e.includes(first) && e.includes(last)) return email;
  }
  for (const email of emails) {
    const e = email.toLowerCase().split('@')[0];
    if (e.includes(last)) return email;
  }
  for (const email of emails) {
    if (/^[a-z]+\.[a-z]+@/.test(email.toLowerCase())) return email;
  }
  return null;
}

// ─── Subpage Scraping ──────────────────────────────────────────────
function findSubpageUrls(html: string, origin: string): string[] {
  const found = new Set<string>();
  const linkRegex = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const hrefLower = href.toLowerCase();
    if (SUBPAGE_KEYWORDS.some(kw => hrefLower.includes(kw))) {
      try {
        const url = new URL(href, origin);
        if (url.origin === origin && url.pathname !== '/') {
          found.add(url.pathname);
        }
      } catch { /* ignore invalid URLs */ }
    }
  }
  // Always try standard paths as fallback
  const standard = ['/impressum', '/kontakt', '/team', '/ueber-uns', '/about', '/contact'];
  for (const p of standard) found.add(p);
  return Array.from(found).slice(0, 12);
}

interface SubpageResult {
  emails: string[];
  decisionMakerName: string | null;
  texts: string[];
}

async function scrapeSubpages(origin: string, subpagePaths: string[]): Promise<SubpageResult> {
  const allEmails = new Set<string>();
  let dmName: string | null = null;
  const texts: string[] = [];

  const fetchPage = async (pagePath: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBPAGE_TIMEOUT);
    try {
      const res = await fetch(`${origin}${pagePath}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return;
      const html = await res.text();
      const emails = extractEmails(html);
      emails.forEach(e => allEmails.add(e));

      const text = stripHtmlToText(html);
      texts.push(text);
      if (!dmName) {
        dmName = extractDecisionMakerName(text);
      }
    } catch {
      clearTimeout(timeout);
    }
  };

  await Promise.allSettled(subpagePaths.map(p => fetchPage(p)));

  return {
    emails: Array.from(allEmails),
    decisionMakerName: dmName,
    texts,
  };
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü').replace(/&szlig;/g, 'ß')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');
}

// ─── Main Analysis ─────────────────────────────────────────────────
export async function analyzeWebsite(url: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'http://' + normalizedUrl;
  }

  let html = '';
  let responseTimeMs = 0;
  let finalUrl = normalizedUrl;
  let hasSSL = false;
  let headers: Record<string, string> = {};
  let fetchError: string | null = null;
  let redirectCount = 0;

  try {
    const fetchStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    responseTimeMs = Date.now() - fetchStart;
    finalUrl = response.url;
    hasSSL = finalUrl.startsWith('https://');
    redirectCount = response.redirected ? 1 : 0;

    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    html = await response.text();
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'Unknown fetch error';
    responseTimeMs = Date.now() - startTime;

    if (normalizedUrl.startsWith('http://')) {
      try {
        const httpsUrl = normalizedUrl.replace('http://', 'https://');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(httpsUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'follow',
        });

        clearTimeout(timeout);
        responseTimeMs = Date.now() - startTime;
        finalUrl = response.url;
        hasSSL = true;
        fetchError = null;

        response.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });

        html = await response.text();
      } catch {
        // Both failed
      }
    }
  }

  if (fetchError && !html) {
    return {
      score: 0,
      problems: [{ id: 'unreachable', label: 'Website nicht erreichbar', severity: 'critical' }],
      seoIssues: [],
      contactEmails: [],
      entscheiderName: null,
      entscheiderEmail: null,
      details: emptyDetails(),
      analyzedAt: new Date().toISOString(),
      responseTimeMs,
    };
  }

  // Get origin for subpage scraping
  let origin: string;
  try {
    origin = new URL(finalUrl).origin;
  } catch {
    origin = '';
  }

  // Find subpage URLs from homepage links
  const subpageUrls = origin ? findSubpageUrls(html, origin) : [];

  // Scrape subpages in parallel (fire immediately, don't block scoring)
  const subpagePromise = origin && subpageUrls.length > 0
    ? scrapeSubpages(origin, subpageUrls)
    : Promise.resolve({ emails: [], decisionMakerName: null, texts: [] } as SubpageResult);

  // Run all scoring checks (synchronous, instant)
  const htmlLower = html.toLowerCase();
  const ssl = checkSSL(hasSSL, normalizedUrl, finalUrl, redirectCount);
  const mobile = checkMobile(html, htmlLower);
  const seo = checkSEO(html, htmlLower);
  const security = checkSecurityHeaders(headers);
  const performance = checkPerformance(responseTimeMs, html, htmlLower, headers);
  const techStack = checkTechStack(html, htmlLower, headers);
  const content = checkContentQuality(html, htmlLower);
  const legal = checkLegal(html, htmlLower);
  const design = checkDesignAge(html, htmlLower);
  const accessibility = checkAccessibility(html, htmlLower);

  const totalScore = ssl.score + mobile.score + seo.score + security.score +
    performance.score + techStack.score + content.score + legal.score +
    design.score + accessibility.score;

  // Build problems and SEO issues
  const problems: ParsedProblems[] = [];
  const seoIssues: ParsedSeoIssue[] = [];

  if (ssl.score === 0) problems.push({ id: 'no_ssl', label: 'Kein SSL-Zertifikat (HTTPS)', severity: 'critical' });
  if (mobile.score < 6) problems.push({ id: 'not_responsive', label: 'Nicht mobilfreundlich', severity: 'critical' });
  else if (mobile.score < 10) problems.push({ id: 'partial_responsive', label: 'Eingeschraenkte Mobile-Optimierung', severity: 'major' });

  if (!htmlLower.includes('<title')) {
    seoIssues.push({ id: 'no_title', label: 'Kein Title-Tag vorhanden', impact: 'high' });
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      const len = titleMatch[1].trim().length;
      if (len < 30 || len > 65) seoIssues.push({ id: 'bad_title_length', label: `Title-Laenge suboptimal (${len} Zeichen, ideal: 30-65)`, impact: 'medium' });
    }
  }
  if (!htmlLower.includes('name="description"') && !htmlLower.includes("name='description'")) seoIssues.push({ id: 'no_meta_desc', label: 'Keine Meta-Beschreibung', impact: 'high' });
  if (!htmlLower.includes('<h1')) seoIssues.push({ id: 'no_h1', label: 'Keine H1-Ueberschrift', impact: 'medium' });
  const h1Matches = html.match(/<h1[\s>]/gi) || [];
  if (h1Matches.length > 1) seoIssues.push({ id: 'multiple_h1', label: `Mehrere H1-Ueberschriften (${h1Matches.length})`, impact: 'medium' });
  if (!htmlLower.includes('og:title') && !htmlLower.includes('og:description')) seoIssues.push({ id: 'no_og_tags', label: 'Keine Open Graph Tags', impact: 'low' });

  if (security.score < 3) problems.push({ id: 'no_security_headers', label: 'Keine Security-Headers konfiguriert', severity: 'major' });
  if (performance.score < 5) problems.push({ id: 'slow_loading', label: `Schlechte Performance (${(responseTimeMs / 1000).toFixed(1)}s)`, severity: 'major' });
  if (legal.score < 3) problems.push({ id: 'no_impressum', label: 'Kein Impressum gefunden', severity: 'critical' });
  if (!htmlLower.includes('datenschutz') && !htmlLower.includes('privacy')) problems.push({ id: 'no_privacy', label: 'Keine Datenschutzerklaerung', severity: 'major' });
  if (design.score < 3) problems.push({ id: 'outdated_design', label: 'Veraltetes Webdesign', severity: 'major' });
  if (content.score < 4) problems.push({ id: 'thin_content', label: 'Wenig oder schlechter Seiteninhalt', severity: 'minor' });
  if (techStack.score < 3) problems.push({ id: 'outdated_tech', label: 'Veraltete Technologie', severity: 'minor' });
  if (accessibility.score < 3) problems.push({ id: 'poor_a11y', label: 'Mangelnde Barrierefreiheit', severity: 'minor' });

  // Extract homepage emails
  const homepageEmails = extractEmails(html);

  // Wait for subpage results
  const subpageData = await subpagePromise;

  // Merge all emails, deduplicate, rank
  const allEmailSet = new Set<string>([...homepageEmails, ...subpageData.emails]);
  const allEmails = Array.from(allEmailSet).sort((a, b) => rankEmail(b) - rankEmail(a));

  // Find decision maker
  const homepageText = stripHtmlToText(html);
  let entscheiderName = extractDecisionMakerName(homepageText) || subpageData.decisionMakerName;
  let entscheiderEmail: string | null = null;

  if (entscheiderName && allEmails.length > 0) {
    entscheiderEmail = matchEmailToName(entscheiderName, allEmails);
  }
  if (!entscheiderName) {
    // Check all subpage texts for decision maker
    for (const text of subpageData.texts) {
      entscheiderName = extractDecisionMakerName(text);
      if (entscheiderName) {
        if (allEmails.length > 0) entscheiderEmail = matchEmailToName(entscheiderName, allEmails);
        break;
      }
    }
  }

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    problems,
    seoIssues,
    contactEmails: allEmails,
    entscheiderName,
    entscheiderEmail,
    details: { ssl, mobile, seo, security, performance, techStack, content, legal, design, accessibility },
    analyzedAt: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
  };
}


// ─── Check Functions ────────────────────────────────────────────────

function checkSSL(hasSSL: boolean, originalUrl: string, finalUrl: string, redirectCount: number): CheckResult {
  const findings: string[] = [];
  if (!hasSSL) {
    findings.push('Kein SSL-Zertifikat');
    return { score: 0, maxScore: 8, findings };
  }
  let score = 6;
  findings.push('SSL-Zertifikat vorhanden');
  if (originalUrl.startsWith('http://') && finalUrl.startsWith('https://')) {
    score += 2;
    findings.push('HTTP leitet auf HTTPS weiter');
  } else if (originalUrl.startsWith('https://')) {
    score += 2;
  }
  if (redirectCount > 1) {
    score -= 1;
    findings.push(`Mehrfache Weiterleitungen (${redirectCount})`);
  }
  return { score: Math.max(0, Math.min(8, score)), maxScore: 8, findings };
}

function checkMobile(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  if (htmlLower.includes('viewport')) {
    const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
    if (viewportMatch && viewportMatch[1].includes('width=device-width')) {
      score += 5;
      findings.push('Viewport korrekt konfiguriert (width=device-width)');
      if (viewportMatch[1].includes('initial-scale=1')) { score += 1; findings.push('initial-scale=1 gesetzt'); }
    } else {
      score += 2;
      findings.push('Viewport Meta-Tag vorhanden, aber nicht optimal');
    }
  } else {
    findings.push('Kein Viewport Meta-Tag — nicht mobilfreundlich');
  }

  const responsiveFrameworks = [
    { pattern: 'bootstrap', name: 'Bootstrap' },
    { pattern: 'tailwind', name: 'Tailwind CSS' },
    { pattern: 'foundation', name: 'Foundation' },
    { pattern: 'bulma', name: 'Bulma' },
    { pattern: 'materialize', name: 'Materialize' },
  ];
  for (const fw of responsiveFrameworks) {
    if (htmlLower.includes(fw.pattern)) { score += 3; findings.push(`Responsive Framework: ${fw.name}`); break; }
  }

  if (htmlLower.includes('@media') && (htmlLower.includes('max-width') || htmlLower.includes('min-width'))) { score += 2; findings.push('Media Queries vorhanden'); }
  if (htmlLower.includes('srcset') || htmlLower.includes('sizes=')) { score += 1; findings.push('Responsive Bilder (srcset)'); }
  if (/min-height:\s*4[0-9]px|padding:\s*(1[2-9]|[2-9]\d)px|\.btn|\.button/i.test(html)) { score += 1; findings.push('Touch-freundliche Elemente erkannt'); }

  return { score: Math.min(15, score), maxScore: 15, findings };
}

function checkSEO(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title.length >= 30 && title.length <= 65) { score += 4; findings.push(`Title-Tag optimal (${title.length} Zeichen)`); }
    else if (title.length >= 10 && title.length <= 80) { score += 2; findings.push(`Title-Tag vorhanden, aber suboptimale Laenge (${title.length} Zeichen, ideal: 30-65)`); }
    else if (title.length > 0) { score += 1; findings.push(`Title-Tag zu ${title.length < 10 ? 'kurz' : 'lang'} (${title.length} Zeichen)`); }
  } else {
    findings.push('Kein Title-Tag');
  }

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc.length >= 120 && desc.length <= 160) { score += 3; findings.push(`Meta-Description optimal (${desc.length} Zeichen)`); }
    else if (desc.length >= 50 && desc.length <= 200) { score += 2; findings.push(`Meta-Description vorhanden (${desc.length} Zeichen, ideal: 120-160)`); }
    else { score += 1; findings.push(`Meta-Description zu ${desc.length < 50 ? 'kurz' : 'lang'} (${desc.length} Zeichen)`); }
  } else {
    findings.push('Keine Meta-Description');
  }

  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  const h2s = (html.match(/<h2[\s>]/gi) || []).length;
  if (h1s === 1) { score += 2; findings.push('Genau eine H1-Ueberschrift'); if (h2s >= 1) { score += 1; findings.push(`${h2s} H2-Ueberschriften vorhanden`); } }
  else if (h1s > 1) { score += 1; findings.push(`Mehrere H1-Ueberschriften (${h1s}) — sollte nur 1 sein`); }
  else { findings.push('Keine H1-Ueberschrift'); }

  if (htmlLower.includes('rel="canonical"') || htmlLower.includes("rel='canonical'")) { score += 1; findings.push('Canonical URL gesetzt'); }
  if (htmlLower.includes('og:title') || htmlLower.includes('og:description')) { score += 1; findings.push('Open Graph Tags vorhanden'); }
  else { findings.push('Keine Open Graph Tags'); }
  if (htmlLower.includes('application/ld+json') || htmlLower.includes('itemscope')) { score += 1; findings.push('Strukturierte Daten vorhanden'); }

  const imgTags = html.match(/<img[^>]+>/gi) || [];
  if (imgTags.length > 0) {
    const withAlt = imgTags.filter(img => /alt=["'][^"']+["']/i.test(img));
    const emptyAlt = imgTags.filter(img => /alt=["']\s*["']/i.test(img));
    const altRatio = withAlt.length / imgTags.length;
    if (altRatio >= 0.8 && emptyAlt.length < imgTags.length * 0.2) { score += 1; findings.push(`Bilder mit sinnvollem Alt-Text: ${Math.round(altRatio * 100)}%`); }
    else { findings.push(`Nur ${Math.round(altRatio * 100)}% der Bilder haben Alt-Text`); }
  }

  return { score: Math.min(15, score), maxScore: 15, findings };
}

function checkSecurityHeaders(headers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: string[] = [];

  if (headers['strict-transport-security']) { score += 2; findings.push('HSTS Header vorhanden'); if (headers['strict-transport-security'].includes('includeSubDomains')) findings.push('HSTS includeSubDomains aktiv'); }
  else { findings.push('Kein HSTS Header'); }
  if (headers['x-frame-options']) { score += 1; findings.push(`X-Frame-Options: ${headers['x-frame-options']}`); }
  else { findings.push('Kein X-Frame-Options Header'); }
  if (headers['x-content-type-options']) { score += 1; findings.push('X-Content-Type-Options: nosniff'); }
  else { findings.push('Kein X-Content-Type-Options Header'); }
  if (headers['content-security-policy'] || headers['content-security-policy-report-only']) { score += 2; findings.push('Content-Security-Policy vorhanden'); }
  else { findings.push('Keine Content-Security-Policy'); }
  if (headers['referrer-policy']) { score += 1; findings.push(`Referrer-Policy: ${headers['referrer-policy']}`); }
  else { findings.push('Keine Referrer-Policy'); }
  if (headers['permissions-policy'] || headers['feature-policy']) { score += 1; findings.push('Permissions-Policy vorhanden'); }
  else { findings.push('Keine Permissions-Policy'); }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

function checkPerformance(responseTimeMs: number, html: string, htmlLower: string, headers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: string[] = [];
  const seconds = responseTimeMs / 1000;

  findings.push(`Antwortzeit: ${seconds.toFixed(1)}s`);
  if (seconds < 0.5) { score += 4; findings.push('Exzellente Antwortzeit'); }
  else if (seconds < 1) { score += 3; }
  else if (seconds < 2) { score += 2; }
  else if (seconds < 4) { score += 1; findings.push('Langsame Antwortzeit'); }
  else { findings.push('Sehr langsame Antwortzeit'); }

  const encoding = headers['content-encoding'] || '';
  if (encoding.includes('br')) { score += 2; findings.push('Brotli-Komprimierung aktiv'); }
  else if (encoding.includes('gzip') || encoding.includes('deflate')) { score += 1; findings.push('Gzip-Komprimierung aktiv'); }
  else { findings.push('Keine Komprimierung erkannt'); }

  const cacheControl = headers['cache-control'] || '';
  if (cacheControl && (cacheControl.includes('max-age') || cacheControl.includes('s-maxage'))) { score += 2; findings.push('Cache-Control Headers gesetzt'); }
  else if (headers['etag'] || headers['last-modified']) { score += 1; findings.push('ETag/Last-Modified vorhanden'); }
  else { findings.push('Kein Caching konfiguriert'); }

  const cssFiles = (html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []).length;
  const jsFiles = (html.match(/<script[^>]*src=["'][^"']+["'][^>]*>/gi) || []).length;
  const totalResources = cssFiles + jsFiles;
  findings.push(`Externe Ressourcen: ${cssFiles} CSS, ${jsFiles} JS`);
  if (totalResources <= 8) { score += 2; findings.push('Geringe Anzahl externer Ressourcen'); }
  else if (totalResources <= 15) { score += 1; }
  else { findings.push(`Viele externe Ressourcen (${totalResources})`); }

  if (htmlLower.includes('preconnect') || htmlLower.includes('preload') || htmlLower.includes('dns-prefetch')) { score += 1; findings.push('Resource Hints (preconnect/preload) vorhanden'); }

  const htmlSizeKB = Math.round(html.length / 1024);
  if (htmlSizeKB < 100) { score += 1; findings.push(`HTML-Groesse: ${htmlSizeKB} KB (gut)`); }
  else if (htmlSizeKB < 300) { findings.push(`HTML-Groesse: ${htmlSizeKB} KB (akzeptabel)`); }
  else { findings.push(`HTML-Groesse: ${htmlSizeKB} KB (zu gross)`); }

  return { score: Math.min(12, score), maxScore: 12, findings };
}

function checkTechStack(html: string, htmlLower: string, headers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: string[] = [];

  const modernTech = [
    { pattern: /_next/i, name: 'Next.js', points: 8 },
    { pattern: /nuxt/i, name: 'Nuxt.js', points: 8 },
    { pattern: /__gatsby/i, name: 'Gatsby', points: 8 },
    { pattern: /svelte/i, name: 'Svelte', points: 8 },
    { pattern: /react/i, name: 'React', points: 7 },
    { pattern: /vue\.?js/i, name: 'Vue.js', points: 7 },
    { pattern: /angular/i, name: 'Angular', points: 7 },
  ];
  const builders = [
    { pattern: /squarespace/i, name: 'Squarespace', points: 6 },
    { pattern: /webflow/i, name: 'Webflow', points: 6 },
    { pattern: /shopify/i, name: 'Shopify', points: 6 },
    { pattern: /wix\.com|wixsite/i, name: 'Wix', points: 5 },
  ];
  const cms = [
    { pattern: /wp-content|wp-includes|wordpress/i, name: 'WordPress', points: 4 },
    { pattern: /typo3/i, name: 'TYPO3', points: 5 },
    { pattern: /drupal/i, name: 'Drupal', points: 5 },
    { pattern: /joomla/i, name: 'Joomla', points: 3 },
    { pattern: /contao/i, name: 'Contao', points: 4 },
  ];
  const oldTech = [
    { pattern: /jimdo/i, name: 'Jimdo', points: 2 },
    { pattern: /weebly/i, name: 'Weebly', points: 2 },
    { pattern: /1und1|ionos|1&1/i, name: '1&1/IONOS Baukasten', points: 1 },
    { pattern: /strato/i, name: 'Strato Baukasten', points: 1 },
    { pattern: /homepagebaukasten/i, name: 'Homepage-Baukasten', points: 1 },
  ];

  let detected = false;
  for (const group of [modernTech, builders, cms, oldTech]) {
    for (const tech of group) {
      if (tech.pattern.test(html)) {
        score = tech.points;
        const category = group === modernTech ? 'Modernes Framework' : group === builders ? 'Website-Builder' : group === cms ? 'CMS' : 'Veralteter Baukasten';
        findings.push(`${category}: ${tech.name}`);
        detected = true;
        break;
      }
    }
    if (detected) break;
  }
  if (!detected) { findings.push('Kein bekanntes Framework/CMS erkannt'); score = 2; }

  const server = headers['server'] || headers['x-powered-by'] || '';
  if (server) findings.push(`Server: ${server}`);

  return { score: Math.min(8, score), maxScore: 8, findings };
}

function checkContentQuality(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  const cleanText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 1).length;
  findings.push(`Wortanzahl: ${wordCount}`);
  if (wordCount >= 300) { score += 3; findings.push('Ausreichend Content vorhanden'); }
  else if (wordCount >= 150) { score += 2; findings.push('Maessig viel Content'); }
  else if (wordCount >= 50) { score += 1; findings.push('Wenig Content'); }
  else { findings.push('Sehr wenig Content (Thin Content)'); }

  const ratio = cleanText.length / html.length;
  const ratioPercent = Math.round(ratio * 100);
  findings.push(`Text-zu-HTML Ratio: ${ratioPercent}%`);
  if (ratio >= 0.25) { score += 2; findings.push('Gutes Text-zu-HTML Verhaeltnis'); }
  else if (ratio >= 0.10) { score += 1; }
  else { findings.push('Sehr niedriges Text-zu-HTML Verhaeltnis'); }

  const hasPhone = /(\+49|0[0-9]{2,4}[\s/-]?[0-9]{3,}|tel:|phone)/i.test(html);
  if (hasPhone) { score += 1; findings.push('Telefonnummer vorhanden'); }
  else { findings.push('Keine Telefonnummer erkannt'); }

  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html) || htmlLower.includes('mailto:');
  if (hasEmail) { score += 1; findings.push('E-Mail-Adresse vorhanden'); }
  else { findings.push('Keine E-Mail-Adresse erkannt'); }

  const hasForm = htmlLower.includes('<form') || htmlLower.includes('kontakt') || htmlLower.includes('contact');
  if (hasForm) { score += 1; findings.push('Kontaktformular/Kontaktseite vorhanden'); }

  const currentYear = new Date().getFullYear();
  const yearPatterns = [
    /(?:©|&copy;|copyright|\(c\))\s*(?:20\d{2}\s*[-–]\s*)?(20\d{2})/gi,
    /(20\d{2})\s*(?:©|&copy;|copyright)/gi,
  ];
  const years: number[] = [];
  for (const pattern of yearPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const year = parseInt(match[1]);
      if (year >= 2010 && year <= currentYear + 1) years.push(year);
    }
  }
  if (years.length > 0) {
    const latestYear = Math.max(...years);
    const age = currentYear - latestYear;
    if (age <= 1) { score += 1; findings.push(`Copyright-Jahr aktuell (${latestYear})`); }
    else { findings.push(`Copyright-Jahr veraltet (${latestYear}, ${age} Jahre alt)`); }
  } else {
    findings.push('Kein Copyright-Jahr gefunden');
  }

  return { score: Math.min(10, score), maxScore: 10, findings };
}

function checkLegal(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  if ([/impressum/i, /imprint/i, /legal\s*notice/i].some(p => p.test(html))) { score += 3; findings.push('Impressum-Link vorhanden'); }
  else { findings.push('Kein Impressum gefunden'); }

  if ([/datenschutz/i, /privacy/i, /dsgvo/i].some(p => p.test(html))) { score += 3; findings.push('Datenschutzerklaerung vorhanden'); }
  else { findings.push('Keine Datenschutzerklaerung'); }

  const cookiePatterns = [
    /cookie[-\s]?consent/i, /cookie[-\s]?banner/i, /cookie[-\s]?notice/i,
    /cookiebot/i, /cookieconsent/i, /onetrust/i,
    /consent[-\s]?manager/i, /borlabs/i, /complianz/i, /usercentrics/i,
  ];
  if (cookiePatterns.some(p => p.test(html))) { score += 2; findings.push('Cookie-Consent vorhanden'); }
  else { findings.push('Kein Cookie-Consent/Banner'); }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

function checkDesignAge(html: string, htmlLower: string): CheckResult {
  let score = 4;
  const findings: string[] = [];

  const oldPatterns = [
    { pattern: /<font[\s>]/i, name: 'Veraltetes <font> Tag', penalty: 2 },
    { pattern: /<center[\s>]/i, name: 'Veraltetes <center> Tag', penalty: 1 },
    { pattern: /<marquee[\s>]/i, name: 'Veraltetes <marquee> Tag', penalty: 2 },
    { pattern: /\.swf|flash/i, name: 'Flash-Inhalte', penalty: 3 },
    { pattern: /<frameset/i, name: 'Frameset-Layout', penalty: 3 },
    { pattern: /bgcolor=/i, name: 'Inline bgcolor', penalty: 1 },
  ];
  for (const old of oldPatterns) { if (old.pattern.test(html)) { score -= old.penalty; findings.push(`Veraltet: ${old.name}`); } }

  const tableCount = (html.match(/<table[\s>]/gi) || []).length;
  if (tableCount > 3) { score -= 2; findings.push(`Viele Tabellen (${tableCount}) — moeglicherweise Table-Layout`); }

  if (/display:\s*flex|display:\s*grid/i.test(html)) { score += 1; findings.push('Modernes CSS Layout (Flexbox/Grid)'); }
  if (/css[-\s]?var|--[a-z]/i.test(html)) { score += 1; findings.push('CSS Custom Properties'); }
  if (/<svg[\s>]/i.test(html)) { score += 1; findings.push('SVG-Grafiken'); }
  if (htmlLower.includes('.min.css') || htmlLower.includes('.min.js')) { score += 1; findings.push('Minifizierte Assets'); }
  if (htmlLower.includes('.webp') || htmlLower.includes('.avif') || htmlLower.includes('<picture')) { score += 1; findings.push('Moderne Bildformate (WebP/AVIF)'); }
  if (htmlLower.includes('loading="lazy"') || htmlLower.includes("loading='lazy'") || htmlLower.includes('data-src')) { score += 1; findings.push('Lazy Loading implementiert'); }

  const inlineStyleCount = (html.match(/style="/gi) || []).length;
  if (inlineStyleCount > 30) { score -= 1; findings.push(`Viele Inline-Styles (${inlineStyleCount})`); }

  return { score: Math.max(0, Math.min(8, score)), maxScore: 8, findings };
}

function checkAccessibility(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (langMatch) { score += 2; findings.push(`Sprachattribut gesetzt: ${langMatch[1]}`); }
  else { findings.push('Kein lang-Attribut auf <html>'); }

  const ariaPatterns = [/role=["'](main|navigation|banner|contentinfo)["']/i, /aria-label/i, /<nav[\s>]/i, /<main[\s>]/i, /<header[\s>]/i, /<footer[\s>]/i];
  const ariaCount = ariaPatterns.filter(p => p.test(html)).length;
  if (ariaCount >= 3) { score += 2; findings.push('ARIA Landmarks und semantische HTML-Elemente vorhanden'); }
  else if (ariaCount >= 1) { score += 1; findings.push('Einige semantische Elemente vorhanden'); }
  else { findings.push('Keine semantischen HTML-Elemente/ARIA-Roles'); }

  const imgTags = html.match(/<img[^>]+>/gi) || [];
  if (imgTags.length > 0) {
    const withMeaningfulAlt = imgTags.filter(img => {
      const altMatch = img.match(/alt=["']([^"']*)["']/i);
      return altMatch && altMatch[1].trim().length > 3;
    });
    const imgRatio = withMeaningfulAlt.length / imgTags.length;
    if (imgRatio >= 0.7) { score += 1; findings.push(`${Math.round(imgRatio * 100)}% der Bilder haben sinnvollen Alt-Text`); }
    else { findings.push(`Nur ${Math.round(imgRatio * 100)}% der Bilder haben sinnvollen Alt-Text`); }
  } else { score += 1; }

  const inputs = (html.match(/<input[^>]*type=["'](text|email|tel|password|search|url|number)["']/gi) || []).length;
  const labels = (html.match(/<label[\s>]/gi) || []).length;
  if (inputs === 0) { score += 1; }
  else if (labels >= inputs * 0.5) { score += 1; findings.push('Formulare haben Labels'); }
  else { findings.push('Formulare ohne Labels'); }

  if (htmlLower.includes('skip') && (htmlLower.includes('#main') || htmlLower.includes('#content') || htmlLower.includes('#inhalt'))) { score += 1; findings.push('Skip-Navigation vorhanden'); }

  const outlineNone = /outline:\s*(none|0)/gi.test(html);
  const focusVisible = /focus-visible|:focus/i.test(html);
  if (!outlineNone || focusVisible) { score += 1; findings.push('Fokus-Stile nicht entfernt'); }
  else { findings.push('Fokus-Stile moeglicherweise entfernt (outline: none)'); }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

// ─── Email Extraction ──────────────────────────────────────────────
export function extractEmails(html: string): string[] {
  const mailtoEmails: string[] = [];
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    mailtoEmails.push(match[1].toLowerCase());
  }

  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const allEmails: string[] = [];
  while ((match = emailRegex.exec(cleanHtml)) !== null) {
    allEmails.push(match[0].toLowerCase());
  }

  const combined = [...mailtoEmails, ...allEmails];
  const unique = Array.from(new Set(combined));

  const blacklistPatterns = [
    /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/i,
    /^[0-9]+@/,
    /example\.(com|org|net)/i,
    /wixpress\.com/i,
    /sentry\.io/i,
    /webpack/i,
    /localhost/i,
    /\.local$/i,
    /schema\.org/i,
  ];

  return unique.filter(email => {
    if (email.length < 6 || email.length > 254) return false;
    if (blacklistPatterns.some(p => p.test(email))) return false;
    const tld = email.split('.').pop() || '';
    if (tld.length < 2 || tld.length > 10) return false;
    return true;
  });
}

function emptyDetails(): AnalysisResult['details'] {
  const empty: CheckResult = { score: 0, maxScore: 0, findings: [] };
  return {
    ssl: { ...empty, maxScore: 8 },
    mobile: { ...empty, maxScore: 15 },
    seo: { ...empty, maxScore: 15 },
    security: { ...empty, maxScore: 8 },
    performance: { ...empty, maxScore: 12 },
    techStack: { ...empty, maxScore: 8 },
    content: { ...empty, maxScore: 10 },
    legal: { ...empty, maxScore: 8 },
    design: { ...empty, maxScore: 8 },
    accessibility: { ...empty, maxScore: 8 },
  };
}
