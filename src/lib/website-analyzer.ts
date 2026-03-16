/**
 * Website Analyzer v2 - Comprehensive website quality scoring
 *
 * Analyzes lead websites and assigns a quality score (0-100).
 * HIGH score = good/modern website (doesn't need our help)
 * LOW score = bad/outdated website (hot lead!)
 *
 * Categories (100 points total):
 * - SSL/HTTPS (8): certificate, redirect
 * - Mobile (15): viewport, responsive framework, media queries, touch targets
 * - SEO (15): title quality, meta desc quality, headings, OG tags, canonical, alt texts
 * - Security Headers (8): HSTS, CSP, X-Frame, X-Content-Type, Referrer-Policy
 * - Performance (12): response time, compression, caching, resource count
 * - Tech Stack (8): modern vs outdated framework/CMS
 * - Content Quality (10): word count, text-to-HTML ratio, contact info
 * - Legal/DSGVO (8): Impressum, Datenschutz, Cookie Consent
 * - Design/Code (8): modern CSS, legacy tags, minification
 * - Accessibility (8): lang attr, aria, alt text quality, form labels
 */

import { ParsedProblems, ParsedSeoIssue } from './types';

export interface AnalysisResult {
  score: number;
  problems: ParsedProblems[];
  seoIssues: ParsedSeoIssue[];
  contactEmails: string[];
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

const FETCH_TIMEOUT = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Main analysis function - analyzes a website URL and returns a quality score
 */
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
      details: emptyDetails(),
      analyzedAt: new Date().toISOString(),
      responseTimeMs,
    };
  }

  const htmlLower = html.toLowerCase();

  // Run all checks
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

  // SSL
  if (ssl.score === 0) {
    problems.push({ id: 'no_ssl', label: 'Kein SSL-Zertifikat (HTTPS)', severity: 'critical' });
  }

  // Mobile
  if (mobile.score < 6) {
    problems.push({ id: 'not_responsive', label: 'Nicht mobilfreundlich', severity: 'critical' });
  } else if (mobile.score < 10) {
    problems.push({ id: 'partial_responsive', label: 'Eingeschraenkte Mobile-Optimierung', severity: 'major' });
  }

  // SEO
  if (!htmlLower.includes('<title')) {
    seoIssues.push({ id: 'no_title', label: 'Kein Title-Tag vorhanden', impact: 'high' });
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      const len = titleMatch[1].trim().length;
      if (len < 30 || len > 65) {
        seoIssues.push({ id: 'bad_title_length', label: `Title-Laenge suboptimal (${len} Zeichen, ideal: 30-65)`, impact: 'medium' });
      }
    }
  }
  if (!htmlLower.includes('name="description"') && !htmlLower.includes("name='description'")) {
    seoIssues.push({ id: 'no_meta_desc', label: 'Keine Meta-Beschreibung', impact: 'high' });
  }
  if (!htmlLower.includes('<h1')) {
    seoIssues.push({ id: 'no_h1', label: 'Keine H1-Ueberschrift', impact: 'medium' });
  }
  const h1Matches = html.match(/<h1[\s>]/gi) || [];
  if (h1Matches.length > 1) {
    seoIssues.push({ id: 'multiple_h1', label: `Mehrere H1-Ueberschriften (${h1Matches.length})`, impact: 'medium' });
  }
  if (!htmlLower.includes('og:title') && !htmlLower.includes('og:description')) {
    seoIssues.push({ id: 'no_og_tags', label: 'Keine Open Graph Tags', impact: 'low' });
  }

  // Security
  if (security.score < 3) {
    problems.push({ id: 'no_security_headers', label: 'Keine Security-Headers konfiguriert', severity: 'major' });
  }

  // Performance
  if (performance.score < 5) {
    problems.push({ id: 'slow_loading', label: `Schlechte Performance (${(responseTimeMs / 1000).toFixed(1)}s)`, severity: 'major' });
  }

  // Legal
  if (legal.score < 3) {
    problems.push({ id: 'no_impressum', label: 'Kein Impressum gefunden', severity: 'critical' });
  }
  if (!htmlLower.includes('datenschutz') && !htmlLower.includes('privacy')) {
    problems.push({ id: 'no_privacy', label: 'Keine Datenschutzerklaerung', severity: 'major' });
  }

  // Design
  if (design.score < 3) {
    problems.push({ id: 'outdated_design', label: 'Veraltetes Webdesign', severity: 'major' });
  }

  // Content
  if (content.score < 4) {
    problems.push({ id: 'thin_content', label: 'Wenig oder schlechter Seiteninhalt', severity: 'minor' });
  }

  // Tech stack
  if (techStack.score < 3) {
    problems.push({ id: 'outdated_tech', label: 'Veraltete Technologie', severity: 'minor' });
  }

  // Accessibility
  if (accessibility.score < 3) {
    problems.push({ id: 'poor_a11y', label: 'Mangelnde Barrierefreiheit', severity: 'minor' });
  }

  // Extract contact emails from the page
  const contactEmails = extractEmails(html);

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    problems,
    seoIssues,
    contactEmails,
    details: { ssl, mobile, seo, security, performance, techStack, content, legal, design, accessibility },
    analyzedAt: new Date().toISOString(),
    responseTimeMs,
  };
}


// ─── Check Functions ────────────────────────────────────────────────

/**
 * SSL/HTTPS Check (max 8 points)
 */
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

/**
 * Mobile Responsiveness Check (max 15 points)
 */
function checkMobile(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Viewport meta tag (essential, 5 pts)
  if (htmlLower.includes('viewport')) {
    const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
    if (viewportMatch && viewportMatch[1].includes('width=device-width')) {
      score += 5;
      findings.push('Viewport korrekt konfiguriert (width=device-width)');

      if (viewportMatch[1].includes('initial-scale=1')) {
        score += 1;
        findings.push('initial-scale=1 gesetzt');
      }
    } else {
      score += 2;
      findings.push('Viewport Meta-Tag vorhanden, aber nicht optimal');
    }
  } else {
    findings.push('Kein Viewport Meta-Tag — nicht mobilfreundlich');
  }

  // Responsive CSS frameworks (3 pts)
  const responsiveFrameworks = [
    { pattern: 'bootstrap', name: 'Bootstrap' },
    { pattern: 'tailwind', name: 'Tailwind CSS' },
    { pattern: 'foundation', name: 'Foundation' },
    { pattern: 'bulma', name: 'Bulma' },
    { pattern: 'materialize', name: 'Materialize' },
  ];
  for (const fw of responsiveFrameworks) {
    if (htmlLower.includes(fw.pattern)) {
      score += 3;
      findings.push(`Responsive Framework: ${fw.name}`);
      break;
    }
  }

  // Media queries (2 pts)
  if (htmlLower.includes('@media') && (htmlLower.includes('max-width') || htmlLower.includes('min-width'))) {
    score += 2;
    findings.push('Media Queries vorhanden');
  }

  // Responsive images (2 pts)
  if (htmlLower.includes('srcset') || htmlLower.includes('sizes=')) {
    score += 1;
    findings.push('Responsive Bilder (srcset)');
  }

  // Touch-friendly: check for reasonable button/link sizes in CSS
  const hasTouchTarget = /min-height:\s*4[0-9]px|padding:\s*(1[2-9]|[2-9]\d)px|\.btn|\.button/i.test(html);
  if (hasTouchTarget) {
    score += 1;
    findings.push('Touch-freundliche Elemente erkannt');
  }

  return { score: Math.min(15, score), maxScore: 15, findings };
}

/**
 * SEO Check (max 15 points)
 */
function checkSEO(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Title tag quality (0-4 pts)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title.length >= 30 && title.length <= 65) {
      score += 4;
      findings.push(`Title-Tag optimal (${title.length} Zeichen)`);
    } else if (title.length >= 10 && title.length <= 80) {
      score += 2;
      findings.push(`Title-Tag vorhanden, aber suboptimale Laenge (${title.length} Zeichen, ideal: 30-65)`);
    } else if (title.length > 0) {
      score += 1;
      findings.push(`Title-Tag zu ${title.length < 10 ? 'kurz' : 'lang'} (${title.length} Zeichen)`);
    }
  } else {
    findings.push('Kein Title-Tag');
  }

  // Meta description quality (0-3 pts)
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc.length >= 120 && desc.length <= 160) {
      score += 3;
      findings.push(`Meta-Description optimal (${desc.length} Zeichen)`);
    } else if (desc.length >= 50 && desc.length <= 200) {
      score += 2;
      findings.push(`Meta-Description vorhanden (${desc.length} Zeichen, ideal: 120-160)`);
    } else {
      score += 1;
      findings.push(`Meta-Description zu ${desc.length < 50 ? 'kurz' : 'lang'} (${desc.length} Zeichen)`);
    }
  } else {
    findings.push('Keine Meta-Description');
  }

  // Heading hierarchy (0-3 pts)
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  const h2s = (html.match(/<h2[\s>]/gi) || []).length;
  if (h1s === 1) {
    score += 2;
    findings.push('Genau eine H1-Ueberschrift');
    if (h2s >= 1) {
      score += 1;
      findings.push(`${h2s} H2-Ueberschriften vorhanden`);
    }
  } else if (h1s > 1) {
    score += 1;
    findings.push(`Mehrere H1-Ueberschriften (${h1s}) — sollte nur 1 sein`);
  } else {
    findings.push('Keine H1-Ueberschrift');
  }

  // Canonical URL (1 pt)
  if (htmlLower.includes('rel="canonical"') || htmlLower.includes("rel='canonical'")) {
    score += 1;
    findings.push('Canonical URL gesetzt');
  }

  // Open Graph tags (1 pt)
  if (htmlLower.includes('og:title') || htmlLower.includes('og:description')) {
    score += 1;
    findings.push('Open Graph Tags vorhanden');
  } else {
    findings.push('Keine Open Graph Tags');
  }

  // Structured data (1 pt)
  if (htmlLower.includes('application/ld+json') || htmlLower.includes('itemscope')) {
    score += 1;
    findings.push('Strukturierte Daten vorhanden');
  }

  // Image alt tags quality (1 pt)
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  if (imgTags.length > 0) {
    const withAlt = imgTags.filter(img => /alt=["'][^"']+["']/i.test(img));
    const emptyAlt = imgTags.filter(img => /alt=["']\s*["']/i.test(img));
    const altRatio = withAlt.length / imgTags.length;
    if (altRatio >= 0.8 && emptyAlt.length < imgTags.length * 0.2) {
      score += 1;
      findings.push(`Bilder mit sinnvollem Alt-Text: ${Math.round(altRatio * 100)}%`);
    } else {
      findings.push(`Nur ${Math.round(altRatio * 100)}% der Bilder haben Alt-Text`);
    }
  }

  return { score: Math.min(15, score), maxScore: 15, findings };
}

/**
 * Security Headers Check (max 8 points)
 */
function checkSecurityHeaders(headers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // HSTS (2 pts)
  if (headers['strict-transport-security']) {
    score += 2;
    findings.push('HSTS Header vorhanden');
    if (headers['strict-transport-security'].includes('includeSubDomains')) {
      findings.push('HSTS includeSubDomains aktiv');
    }
  } else {
    findings.push('Kein HSTS Header');
  }

  // X-Frame-Options (1 pt)
  if (headers['x-frame-options']) {
    score += 1;
    findings.push(`X-Frame-Options: ${headers['x-frame-options']}`);
  } else {
    findings.push('Kein X-Frame-Options Header');
  }

  // X-Content-Type-Options (1 pt)
  if (headers['x-content-type-options']) {
    score += 1;
    findings.push('X-Content-Type-Options: nosniff');
  } else {
    findings.push('Kein X-Content-Type-Options Header');
  }

  // Content-Security-Policy (2 pts)
  if (headers['content-security-policy'] || headers['content-security-policy-report-only']) {
    score += 2;
    findings.push('Content-Security-Policy vorhanden');
  } else {
    findings.push('Keine Content-Security-Policy');
  }

  // Referrer-Policy (1 pt)
  if (headers['referrer-policy']) {
    score += 1;
    findings.push(`Referrer-Policy: ${headers['referrer-policy']}`);
  } else {
    findings.push('Keine Referrer-Policy');
  }

  // Permissions-Policy (1 pt)
  if (headers['permissions-policy'] || headers['feature-policy']) {
    score += 1;
    findings.push('Permissions-Policy vorhanden');
  } else {
    findings.push('Keine Permissions-Policy');
  }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

/**
 * Performance Check (max 12 points)
 */
function checkPerformance(responseTimeMs: number, html: string, htmlLower: string, headers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: string[] = [];
  const seconds = responseTimeMs / 1000;

  // Response time (0-4 pts)
  findings.push(`Antwortzeit: ${seconds.toFixed(1)}s`);
  if (seconds < 0.5) {
    score += 4;
    findings.push('Exzellente Antwortzeit');
  } else if (seconds < 1) {
    score += 3;
  } else if (seconds < 2) {
    score += 2;
  } else if (seconds < 4) {
    score += 1;
    findings.push('Langsame Antwortzeit');
  } else {
    findings.push('Sehr langsame Antwortzeit');
  }

  // Compression (2 pts)
  const encoding = headers['content-encoding'] || '';
  if (encoding.includes('br')) {
    score += 2;
    findings.push('Brotli-Komprimierung aktiv');
  } else if (encoding.includes('gzip') || encoding.includes('deflate')) {
    score += 1;
    findings.push('Gzip-Komprimierung aktiv');
  } else {
    findings.push('Keine Komprimierung erkannt');
  }

  // Caching (2 pts)
  const cacheControl = headers['cache-control'] || '';
  if (cacheControl && (cacheControl.includes('max-age') || cacheControl.includes('s-maxage'))) {
    score += 2;
    findings.push('Cache-Control Headers gesetzt');
  } else if (headers['etag'] || headers['last-modified']) {
    score += 1;
    findings.push('ETag/Last-Modified vorhanden');
  } else {
    findings.push('Kein Caching konfiguriert');
  }

  // Resource count (2 pts) - count external CSS/JS files
  const cssFiles = (html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []).length;
  const jsFiles = (html.match(/<script[^>]*src=["'][^"']+["'][^>]*>/gi) || []).length;
  const totalResources = cssFiles + jsFiles;
  findings.push(`Externe Ressourcen: ${cssFiles} CSS, ${jsFiles} JS`);
  if (totalResources <= 8) {
    score += 2;
    findings.push('Geringe Anzahl externer Ressourcen');
  } else if (totalResources <= 15) {
    score += 1;
  } else {
    findings.push(`Viele externe Ressourcen (${totalResources})`);
  }

  // Resource hints (1 pt)
  if (htmlLower.includes('preconnect') || htmlLower.includes('preload') || htmlLower.includes('dns-prefetch')) {
    score += 1;
    findings.push('Resource Hints (preconnect/preload) vorhanden');
  }

  // HTML size (1 pt)
  const htmlSizeKB = Math.round(html.length / 1024);
  if (htmlSizeKB < 100) {
    score += 1;
    findings.push(`HTML-Groesse: ${htmlSizeKB} KB (gut)`);
  } else if (htmlSizeKB < 300) {
    findings.push(`HTML-Groesse: ${htmlSizeKB} KB (akzeptabel)`);
  } else {
    findings.push(`HTML-Groesse: ${htmlSizeKB} KB (zu gross)`);
  }

  return { score: Math.min(12, score), maxScore: 12, findings };
}

/**
 * Tech Stack Check (max 8 points)
 */
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
        const category = group === modernTech ? 'Modernes Framework' :
          group === builders ? 'Website-Builder' :
          group === cms ? 'CMS' : 'Veralteter Baukasten';
        findings.push(`${category}: ${tech.name}`);
        detected = true;
        break;
      }
    }
    if (detected) break;
  }

  if (!detected) {
    findings.push('Kein bekanntes Framework/CMS erkannt');
    score = 2;
  }

  // Server info
  const server = headers['server'] || headers['x-powered-by'] || '';
  if (server) {
    findings.push(`Server: ${server}`);
  }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

/**
 * Content Quality Check (max 10 points)
 */
function checkContentQuality(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Extract visible text (strip tags, scripts, styles)
  const cleanText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 1).length;
  findings.push(`Wortanzahl: ${wordCount}`);

  // Word count scoring (0-3 pts)
  if (wordCount >= 300) {
    score += 3;
    findings.push('Ausreichend Content vorhanden');
  } else if (wordCount >= 150) {
    score += 2;
    findings.push('Maessig viel Content');
  } else if (wordCount >= 50) {
    score += 1;
    findings.push('Wenig Content');
  } else {
    findings.push('Sehr wenig Content (Thin Content)');
  }

  // Text-to-HTML ratio (0-2 pts)
  const ratio = cleanText.length / html.length;
  const ratioPercent = Math.round(ratio * 100);
  findings.push(`Text-zu-HTML Ratio: ${ratioPercent}%`);
  if (ratio >= 0.25) {
    score += 2;
    findings.push('Gutes Text-zu-HTML Verhaeltnis');
  } else if (ratio >= 0.10) {
    score += 1;
  } else {
    findings.push('Sehr niedriges Text-zu-HTML Verhaeltnis');
  }

  // Contact information (0-3 pts)
  // Phone number
  const hasPhone = /(\+49|0[0-9]{2,4}[\s/-]?[0-9]{3,}|tel:|phone)/i.test(html);
  if (hasPhone) {
    score += 1;
    findings.push('Telefonnummer vorhanden');
  } else {
    findings.push('Keine Telefonnummer erkannt');
  }

  // Email
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html) || htmlLower.includes('mailto:');
  if (hasEmail) {
    score += 1;
    findings.push('E-Mail-Adresse vorhanden');
  } else {
    findings.push('Keine E-Mail-Adresse erkannt');
  }

  // Contact form or CTA
  const hasForm = htmlLower.includes('<form') || htmlLower.includes('kontakt') || htmlLower.includes('contact');
  if (hasForm) {
    score += 1;
    findings.push('Kontaktformular/Kontaktseite vorhanden');
  }

  // Copyright year (1 pt)
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
    if (age <= 1) {
      score += 1;
      findings.push(`Copyright-Jahr aktuell (${latestYear})`);
    } else {
      findings.push(`Copyright-Jahr veraltet (${latestYear}, ${age} Jahre alt)`);
    }
  } else {
    findings.push('Kein Copyright-Jahr gefunden');
  }

  return { score: Math.min(10, score), maxScore: 10, findings };
}

/**
 * Legal/DSGVO Check (max 8 points)
 */
function checkLegal(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Impressum (3 pts)
  const hasImpressum = [/impressum/i, /imprint/i, /legal\s*notice/i].some(p => p.test(html));
  if (hasImpressum) {
    score += 3;
    findings.push('Impressum-Link vorhanden');
  } else {
    findings.push('Kein Impressum gefunden');
  }

  // Datenschutz (3 pts)
  const hasPrivacy = [/datenschutz/i, /privacy/i, /dsgvo/i].some(p => p.test(html));
  if (hasPrivacy) {
    score += 3;
    findings.push('Datenschutzerklaerung vorhanden');
  } else {
    findings.push('Keine Datenschutzerklaerung');
  }

  // Cookie Consent (2 pts)
  const cookiePatterns = [
    /cookie[-\s]?consent/i, /cookie[-\s]?banner/i, /cookie[-\s]?notice/i,
    /cookiebot/i, /cookieconsent/i, /onetrust/i,
    /consent[-\s]?manager/i, /borlabs/i, /complianz/i, /usercentrics/i,
  ];
  if (cookiePatterns.some(p => p.test(html))) {
    score += 2;
    findings.push('Cookie-Consent vorhanden');
  } else {
    findings.push('Kein Cookie-Consent/Banner');
  }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

/**
 * Design/Code Quality Check (max 8 points)
 */
function checkDesignAge(html: string, htmlLower: string): CheckResult {
  let score = 4; // Start neutral
  const findings: string[] = [];

  // NEGATIVE: Legacy HTML (subtract)
  const oldPatterns = [
    { pattern: /<font[\s>]/i, name: 'Veraltetes <font> Tag', penalty: 2 },
    { pattern: /<center[\s>]/i, name: 'Veraltetes <center> Tag', penalty: 1 },
    { pattern: /<marquee[\s>]/i, name: 'Veraltetes <marquee> Tag', penalty: 2 },
    { pattern: /\.swf|flash/i, name: 'Flash-Inhalte', penalty: 3 },
    { pattern: /<frameset/i, name: 'Frameset-Layout', penalty: 3 },
    { pattern: /bgcolor=/i, name: 'Inline bgcolor', penalty: 1 },
  ];
  for (const old of oldPatterns) {
    if (old.pattern.test(html)) {
      score -= old.penalty;
      findings.push(`Veraltet: ${old.name}`);
    }
  }

  // Table layout detection (nested tables = layout tables)
  const tableCount = (html.match(/<table[\s>]/gi) || []).length;
  if (tableCount > 3) {
    score -= 2;
    findings.push(`Viele Tabellen (${tableCount}) — moeglicherweise Table-Layout`);
  }

  // POSITIVE: Modern patterns (add)
  if (/display:\s*flex|display:\s*grid/i.test(html)) {
    score += 1;
    findings.push('Modernes CSS Layout (Flexbox/Grid)');
  }
  if (/css[-\s]?var|--[a-z]/i.test(html)) {
    score += 1;
    findings.push('CSS Custom Properties');
  }
  if (/<svg[\s>]/i.test(html)) {
    score += 1;
    findings.push('SVG-Grafiken');
  }
  if (htmlLower.includes('.min.css') || htmlLower.includes('.min.js')) {
    score += 1;
    findings.push('Minifizierte Assets');
  }

  // Image optimization indicators
  if (htmlLower.includes('.webp') || htmlLower.includes('.avif') || htmlLower.includes('<picture')) {
    score += 1;
    findings.push('Moderne Bildformate (WebP/AVIF)');
  }

  // Lazy loading
  if (htmlLower.includes('loading="lazy"') || htmlLower.includes("loading='lazy'") || htmlLower.includes('data-src')) {
    score += 1;
    findings.push('Lazy Loading implementiert');
  }

  // Excessive inline styles
  const inlineStyleCount = (html.match(/style="/gi) || []).length;
  if (inlineStyleCount > 30) {
    score -= 1;
    findings.push(`Viele Inline-Styles (${inlineStyleCount})`);
  }

  return { score: Math.max(0, Math.min(8, score)), maxScore: 8, findings };
}

/**
 * Accessibility Check (max 8 points)
 */
function checkAccessibility(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // lang attribute on <html> (2 pts)
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (langMatch) {
    score += 2;
    findings.push(`Sprachattribut gesetzt: ${langMatch[1]}`);
  } else {
    findings.push('Kein lang-Attribut auf <html>');
  }

  // ARIA landmarks/roles (2 pts)
  const ariaPatterns = [/role=["'](main|navigation|banner|contentinfo)["']/i, /aria-label/i, /<nav[\s>]/i, /<main[\s>]/i, /<header[\s>]/i, /<footer[\s>]/i];
  const ariaCount = ariaPatterns.filter(p => p.test(html)).length;
  if (ariaCount >= 3) {
    score += 2;
    findings.push('ARIA Landmarks und semantische HTML-Elemente vorhanden');
  } else if (ariaCount >= 1) {
    score += 1;
    findings.push('Einige semantische Elemente vorhanden');
  } else {
    findings.push('Keine semantischen HTML-Elemente/ARIA-Roles');
  }

  // Image alt texts (1 pt)
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  if (imgTags.length > 0) {
    const withMeaningfulAlt = imgTags.filter(img => {
      const altMatch = img.match(/alt=["']([^"']*)["']/i);
      return altMatch && altMatch[1].trim().length > 3;
    });
    const ratio = withMeaningfulAlt.length / imgTags.length;
    if (ratio >= 0.7) {
      score += 1;
      findings.push(`${Math.round(ratio * 100)}% der Bilder haben sinnvollen Alt-Text`);
    } else {
      findings.push(`Nur ${Math.round(ratio * 100)}% der Bilder haben sinnvollen Alt-Text`);
    }
  } else {
    score += 1; // No images = no issue
  }

  // Form labels (1 pt)
  const inputs = (html.match(/<input[^>]*type=["'](text|email|tel|password|search|url|number)["']/gi) || []).length;
  const labels = (html.match(/<label[\s>]/gi) || []).length;
  if (inputs === 0) {
    score += 1; // No forms = no issue
  } else if (labels >= inputs * 0.5) {
    score += 1;
    findings.push('Formulare haben Labels');
  } else {
    findings.push('Formulare ohne Labels');
  }

  // Skip link (1 pt)
  if (htmlLower.includes('skip') && (htmlLower.includes('#main') || htmlLower.includes('#content') || htmlLower.includes('#inhalt'))) {
    score += 1;
    findings.push('Skip-Navigation vorhanden');
  }

  // Focus styles not removed (1 pt) - check if outline: none/0 is used without replacement
  const outlineNone = /outline:\s*(none|0)/gi.test(html);
  const focusVisible = /focus-visible|:focus/i.test(html);
  if (!outlineNone || focusVisible) {
    score += 1;
    findings.push('Fokus-Stile nicht entfernt');
  } else {
    findings.push('Fokus-Stile moeglicherweise entfernt (outline: none)');
  }

  return { score: Math.min(8, score), maxScore: 8, findings };
}

/**
 * Extract email addresses from HTML content
 * Filters out common false positives (image files, CSS classes, JS variables)
 */
function extractEmails(html: string): string[] {
  // Extract from mailto: links first (highest quality)
  const mailtoEmails: string[] = [];
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    mailtoEmails.push(match[1].toLowerCase());
  }

  // Extract all email-like patterns from visible text (strip scripts/styles first)
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const allEmails: string[] = [];
  while ((match = emailRegex.exec(cleanHtml)) !== null) {
    allEmails.push(match[0].toLowerCase());
  }

  // Combine and deduplicate
  const combined = [...mailtoEmails, ...allEmails];
  const unique = Array.from(new Set(combined));

  // Filter out false positives
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
    // Must have a valid-looking TLD
    const tld = email.split('.').pop() || '';
    if (tld.length < 2 || tld.length > 10) return false;
    return true;
  });
}

/**
 * Helper: Empty details for unreachable websites
 */
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
