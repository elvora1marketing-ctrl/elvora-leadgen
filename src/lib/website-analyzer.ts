/**
 * Website Analyzer - Automatic website quality scoring
 *
 * Analyzes lead websites and assigns a quality score (0-100).
 * HIGH score = good/modern website (doesn't need our help)
 * LOW score = bad/outdated website (hot lead!)
 *
 * Checks: SSL, Mobile, SEO, Tech Stack, Copyright Year,
 *         Load Time, Image Optimization, Impressum/DSGVO, Design Age
 */

import { ParsedProblems, ParsedSeoIssue } from './types';

export interface AnalysisResult {
  score: number;
  problems: ParsedProblems[];
  seoIssues: ParsedSeoIssue[];
  details: {
    ssl: CheckResult;
    mobile: CheckResult;
    seo: CheckResult;
    techStack: CheckResult;
    copyrightYear: CheckResult;
    loadTime: CheckResult;
    images: CheckResult;
    legal: CheckResult;
    design: CheckResult;
  };
  analyzedAt: string;
  responseTimeMs: number;
}

interface CheckResult {
  score: number;
  maxScore: number;
  findings: string[];
}

const FETCH_TIMEOUT = 15000; // 15 seconds
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Main analysis function - analyzes a website URL and returns a quality score
 */
export async function analyzeWebsite(url: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'http://' + normalizedUrl;
  }

  // Fetch the website
  let html = '';
  let responseTimeMs = 0;
  let finalUrl = normalizedUrl;
  let hasSSL = false;
  let headers: Record<string, string> = {};
  let fetchError: string | null = null;

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

    // Collect response headers
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    html = await response.text();
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'Unknown fetch error';
    responseTimeMs = Date.now() - startTime;

    // If HTTP failed, try HTTPS
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

  // If we couldn't fetch at all, return minimal result
  if (fetchError && !html) {
    return {
      score: 0,
      problems: [{ id: 'unreachable', label: 'Website nicht erreichbar', severity: 'critical' }],
      seoIssues: [],
      details: emptyDetails(),
      analyzedAt: new Date().toISOString(),
      responseTimeMs,
    };
  }

  const htmlLower = html.toLowerCase();

  // Run all checks
  const ssl = checkSSL(hasSSL, normalizedUrl, finalUrl);
  const mobile = checkMobile(html, htmlLower);
  const seo = checkSEO(html, htmlLower);
  const techStack = checkTechStack(html, htmlLower, headers);
  const copyrightYear = checkCopyrightYear(html);
  const loadTime = checkLoadTime(responseTimeMs);
  const images = checkImages(html, htmlLower);
  const legal = checkLegal(html, htmlLower);
  const design = checkDesignAge(html, htmlLower);

  // Calculate total score
  const totalScore = ssl.score + mobile.score + seo.score + techStack.score +
    copyrightYear.score + loadTime.score + images.score + legal.score + design.score;

  // Build problems and SEO issues arrays (compatible with existing DB schema)
  const problems: ParsedProblems[] = [];
  const seoIssues: ParsedSeoIssue[] = [];

  // SSL problems
  if (ssl.score < ssl.maxScore) {
    problems.push({ id: 'no_ssl', label: 'Kein SSL-Zertifikat (HTTPS)', severity: 'critical' });
  }

  // Mobile problems
  if (mobile.score < 8) {
    problems.push({ id: 'not_responsive', label: 'Nicht mobilfreundlich', severity: 'critical' });
  } else if (mobile.score < mobile.maxScore) {
    problems.push({ id: 'partial_responsive', label: 'Eingeschränkte Mobile-Optimierung', severity: 'major' });
  }

  // SEO issues
  if (!htmlLower.includes('<title')) {
    seoIssues.push({ id: 'no_title', label: 'Kein Title-Tag vorhanden', impact: 'high' });
  }
  if (!htmlLower.includes('meta') || !htmlLower.includes('description')) {
    seoIssues.push({ id: 'no_meta_desc', label: 'Keine Meta-Beschreibung', impact: 'high' });
  }
  if (!htmlLower.includes('<h1')) {
    seoIssues.push({ id: 'no_h1', label: 'Keine H1-Überschrift', impact: 'medium' });
  }

  // Load time problems
  if (loadTime.score < 4) {
    problems.push({ id: 'slow_loading', label: `Langsame Ladezeit (${(responseTimeMs / 1000).toFixed(1)}s)`, severity: 'major' });
  }

  // Legal problems
  if (legal.score < 4) {
    problems.push({ id: 'no_impressum', label: 'Kein Impressum gefunden', severity: 'critical' });
  }
  if (!htmlLower.includes('datenschutz') && !htmlLower.includes('privacy')) {
    problems.push({ id: 'no_privacy', label: 'Keine Datenschutzerklärung', severity: 'major' });
  }

  // Design problems
  if (design.score < 4) {
    problems.push({ id: 'outdated_design', label: 'Veraltetes Webdesign', severity: 'major' });
  }

  // Image problems
  if (images.score < 4) {
    problems.push({ id: 'poor_images', label: 'Bildoptimierung mangelhaft', severity: 'minor' });
  }

  // Tech stack problems
  if (techStack.score < 4) {
    problems.push({ id: 'outdated_tech', label: 'Veraltete Technologie', severity: 'minor' });
  }

  // Copyright year
  if (copyrightYear.score < 4) {
    const yearMatch = copyrightYear.findings.find(f => f.includes('Copyright-Jahr'));
    if (yearMatch) {
      problems.push({ id: 'old_copyright', label: yearMatch, severity: 'minor' });
    }
  }

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    problems,
    seoIssues,
    details: { ssl, mobile, seo, techStack, copyrightYear, loadTime, images, legal, design },
    analyzedAt: new Date().toISOString(),
    responseTimeMs,
  };
}


// ─── Individual Check Functions ──────────────────────────────────────────────

/**
 * SSL/HTTPS Check (max 10 points)
 */
function checkSSL(hasSSL: boolean, originalUrl: string, finalUrl: string): CheckResult {
  const findings: string[] = [];

  if (hasSSL) {
    findings.push('SSL-Zertifikat vorhanden');
    // Check if HTTP redirects to HTTPS
    if (originalUrl.startsWith('http://') && finalUrl.startsWith('https://')) {
      findings.push('HTTP leitet auf HTTPS weiter');
    }
    return { score: 10, maxScore: 10, findings };
  }

  findings.push('Kein SSL-Zertifikat');
  return { score: 0, maxScore: 10, findings };
}

/**
 * Mobile Responsiveness Check (max 15 points)
 */
function checkMobile(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Viewport meta tag (essential)
  if (htmlLower.includes('viewport')) {
    score += 6;
    findings.push('Viewport Meta-Tag vorhanden');

    // Check if it has proper content
    const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
    if (viewportMatch && viewportMatch[1].includes('width=device-width')) {
      score += 2;
      findings.push('width=device-width korrekt gesetzt');
    }
  } else {
    findings.push('Kein Viewport Meta-Tag');
  }

  // Responsive CSS frameworks
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

  // Media queries in inline styles
  if (htmlLower.includes('@media') && (htmlLower.includes('max-width') || htmlLower.includes('min-width'))) {
    score += 2;
    findings.push('Media Queries vorhanden');
  }

  // Responsive images
  if (htmlLower.includes('srcset') || htmlLower.includes('sizes=')) {
    score += 2;
    findings.push('Responsive Bilder (srcset) vorhanden');
  }

  return { score: Math.min(15, score), maxScore: 15, findings };
}

/**
 * SEO Basics Check (max 15 points)
 */
function checkSEO(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title.length >= 10 && title.length <= 70) {
      score += 4;
      findings.push(`Title-Tag vorhanden (${title.length} Zeichen)`);
    } else if (title.length > 0) {
      score += 2;
      findings.push(`Title-Tag vorhanden, aber suboptimale Länge (${title.length} Zeichen)`);
    }
  } else {
    findings.push('Kein Title-Tag');
  }

  // Meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc.length >= 50 && desc.length <= 160) {
      score += 4;
      findings.push(`Meta-Description vorhanden (${desc.length} Zeichen)`);
    } else if (desc.length > 0) {
      score += 2;
      findings.push(`Meta-Description vorhanden, aber suboptimale Länge (${desc.length} Zeichen)`);
    }
  } else {
    findings.push('Keine Meta-Description');
  }

  // H1 tag
  const h1Match = html.match(/<h1[^>]*>(.+?)<\/h1>/is);
  if (h1Match) {
    score += 3;
    findings.push('H1-Überschrift vorhanden');
  } else {
    findings.push('Keine H1-Überschrift');
  }

  // Structured data (JSON-LD, microdata)
  if (htmlLower.includes('application/ld+json') || htmlLower.includes('itemscope') || htmlLower.includes('itemtype')) {
    score += 2;
    findings.push('Strukturierte Daten vorhanden');
  }

  // Image alt tags
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  const imgsWithAlt = imgTags.filter(img => /alt=["'][^"']+["']/i.test(img));
  if (imgTags.length > 0) {
    const altRatio = imgsWithAlt.length / imgTags.length;
    if (altRatio >= 0.8) {
      score += 2;
      findings.push(`Bilder mit Alt-Text: ${Math.round(altRatio * 100)}%`);
    } else {
      findings.push(`Nur ${Math.round(altRatio * 100)}% der Bilder haben Alt-Text`);
    }
  }

  return { score: Math.min(15, score), maxScore: 15, findings };
}

/**
 * Tech Stack Check (max 10 points)
 * Modern stack = high score (good website, doesn't need us)
 * Old/no framework = low score (hot lead)
 */
function checkTechStack(html: string, htmlLower: string, headers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Modern frameworks (high score = good website)
  const modernTech = [
    { pattern: /_next/i, name: 'Next.js', points: 8 },
    { pattern: /nuxt/i, name: 'Nuxt.js', points: 8 },
    { pattern: /__gatsby/i, name: 'Gatsby', points: 8 },
    { pattern: /react/i, name: 'React', points: 7 },
    { pattern: /vue\.?js/i, name: 'Vue.js', points: 7 },
    { pattern: /angular/i, name: 'Angular', points: 7 },
    { pattern: /svelte/i, name: 'Svelte', points: 8 },
  ];

  // Website builders (medium-high score)
  const builders = [
    { pattern: /wix\.com|wixsite/i, name: 'Wix', points: 6 },
    { pattern: /squarespace/i, name: 'Squarespace', points: 7 },
    { pattern: /webflow/i, name: 'Webflow', points: 7 },
    { pattern: /shopify/i, name: 'Shopify', points: 7 },
  ];

  // CMS (medium score)
  const cms = [
    { pattern: /wp-content|wp-includes|wordpress/i, name: 'WordPress', points: 5 },
    { pattern: /joomla/i, name: 'Joomla', points: 4 },
    { pattern: /drupal/i, name: 'Drupal', points: 5 },
    { pattern: /typo3/i, name: 'TYPO3', points: 5 },
  ];

  // Old/basic builders (low score = hot lead)
  const oldTech = [
    { pattern: /jimdo/i, name: 'Jimdo', points: 3 },
    { pattern: /weebly/i, name: 'Weebly', points: 3 },
    { pattern: /1und1|ionos|1&1/i, name: '1&1/IONOS Baukasten', points: 2 },
    { pattern: /strato/i, name: 'Strato Homepage-Baukasten', points: 2 },
  ];

  let detected = false;

  for (const tech of modernTech) {
    if (tech.pattern.test(html)) {
      score = Math.max(score, tech.points);
      findings.push(`Modernes Framework: ${tech.name}`);
      detected = true;
      break;
    }
  }

  if (!detected) {
    for (const builder of builders) {
      if (builder.pattern.test(html)) {
        score = Math.max(score, builder.points);
        findings.push(`Website-Builder: ${builder.name}`);
        detected = true;
        break;
      }
    }
  }

  if (!detected) {
    for (const c of cms) {
      if (c.pattern.test(html)) {
        score = Math.max(score, c.points);
        findings.push(`CMS: ${c.name}`);
        detected = true;
        break;
      }
    }
  }

  if (!detected) {
    for (const old of oldTech) {
      if (old.pattern.test(html)) {
        score = Math.max(score, old.points);
        findings.push(`Veralteter Baukasten: ${old.name}`);
        detected = true;
        break;
      }
    }
  }

  if (!detected) {
    findings.push('Kein bekanntes Framework/CMS erkannt');
    score = 3; // Unknown = probably custom/old
  }

  // Check server header
  const server = headers['server'] || headers['x-powered-by'] || '';
  if (server) {
    findings.push(`Server: ${server}`);
  }

  // HTTP/2 or HTTP/3 hint (via headers)
  if (headers['alt-svc']?.includes('h3') || headers['alt-svc']?.includes('h2')) {
    score = Math.min(10, score + 1);
    findings.push('Modernes HTTP-Protokoll');
  }

  return { score: Math.min(10, score), maxScore: 10, findings };
}

/**
 * Copyright Year Check (max 10 points)
 * Current year = high score (maintained website)
 * Old year = low score (abandoned = hot lead)
 */
function checkCopyrightYear(html: string): CheckResult {
  const findings: string[] = [];
  const currentYear = new Date().getFullYear();

  // Match patterns like © 2024, Copyright 2023, (c) 2022
  const yearPatterns = [
    /(?:©|&copy;|copyright|\(c\))\s*(?:20\d{2}\s*[-–]\s*)?(20\d{2})/gi,
    /(20\d{2})\s*(?:©|&copy;|copyright)/gi,
  ];

  const years: number[] = [];
  for (const pattern of yearPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const year = parseInt(match[1]);
      if (year >= 2010 && year <= currentYear + 1) {
        years.push(year);
      }
    }
  }

  if (years.length === 0) {
    findings.push('Kein Copyright-Jahr gefunden');
    return { score: 3, maxScore: 10, findings };
  }

  const latestYear = Math.max(...years);
  const age = currentYear - latestYear;

  if (age === 0) {
    findings.push(`Copyright-Jahr aktuell (${latestYear})`);
    return { score: 10, maxScore: 10, findings };
  } else if (age === 1) {
    findings.push(`Copyright-Jahr: ${latestYear} (1 Jahr alt)`);
    return { score: 8, maxScore: 10, findings };
  } else if (age <= 2) {
    findings.push(`Copyright-Jahr: ${latestYear} (${age} Jahre alt)`);
    return { score: 6, maxScore: 10, findings };
  } else if (age <= 4) {
    findings.push(`Copyright-Jahr: ${latestYear} (${age} Jahre alt)`);
    return { score: 3, maxScore: 10, findings };
  } else {
    findings.push(`Copyright-Jahr: ${latestYear} (${age} Jahre veraltet!)`);
    return { score: 0, maxScore: 10, findings };
  }
}

/**
 * Load Time Check (max 10 points)
 */
function checkLoadTime(responseTimeMs: number): CheckResult {
  const findings: string[] = [];
  const seconds = responseTimeMs / 1000;

  findings.push(`Antwortzeit: ${seconds.toFixed(1)}s`);

  if (seconds < 1) {
    return { score: 10, maxScore: 10, findings };
  } else if (seconds < 2) {
    return { score: 8, maxScore: 10, findings };
  } else if (seconds < 3) {
    return { score: 5, maxScore: 10, findings };
  } else if (seconds < 5) {
    return { score: 3, maxScore: 10, findings };
  } else {
    findings.push('Sehr langsame Antwortzeit');
    return { score: 0, maxScore: 10, findings };
  }
}

/**
 * Image Optimization Check (max 10 points)
 */
function checkImages(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  const imgTags = html.match(/<img[^>]+>/gi) || [];

  if (imgTags.length === 0) {
    findings.push('Keine Bilder auf der Seite');
    return { score: 5, maxScore: 10, findings };
  }

  findings.push(`${imgTags.length} Bilder gefunden`);

  // Check for lazy loading
  const lazyLoaded = imgTags.filter(img => /loading=["']lazy["']/i.test(img) || /data-src/i.test(img));
  if (lazyLoaded.length > 0) {
    score += 3;
    findings.push(`Lazy Loading: ${lazyLoaded.length}/${imgTags.length} Bilder`);
  } else {
    findings.push('Kein Lazy Loading');
  }

  // Check for modern image formats
  const modernFormats = imgTags.filter(img => /\.(webp|avif)/i.test(img));
  if (modernFormats.length > 0 || htmlLower.includes('<picture')) {
    score += 3;
    findings.push('Moderne Bildformate (WebP/AVIF) verwendet');
  } else {
    findings.push('Keine modernen Bildformate');
  }

  // Check for width/height attributes (prevents layout shift)
  const withDimensions = imgTags.filter(img => /width=/i.test(img) && /height=/i.test(img));
  if (withDimensions.length > imgTags.length * 0.5) {
    score += 2;
    findings.push('Bild-Dimensionen angegeben (gut für CLS)');
  }

  // Check for srcset (responsive images)
  if (htmlLower.includes('srcset')) {
    score += 2;
    findings.push('Responsive Bilder (srcset)');
  }

  return { score: Math.min(10, score), maxScore: 10, findings };
}

/**
 * Impressum & DSGVO Check (max 10 points)
 */
function checkLegal(html: string, htmlLower: string): CheckResult {
  let score = 0;
  const findings: string[] = [];

  // Check for Impressum link
  const impressumPatterns = [/impressum/i, /imprint/i, /legal\s*notice/i];
  const hasImpressum = impressumPatterns.some(p => p.test(html));
  if (hasImpressum) {
    score += 4;
    findings.push('Impressum-Link vorhanden');
  } else {
    findings.push('Kein Impressum gefunden');
  }

  // Check for Datenschutz / Privacy
  const privacyPatterns = [/datenschutz/i, /privacy/i, /dsgvo/i];
  const hasPrivacy = privacyPatterns.some(p => p.test(html));
  if (hasPrivacy) {
    score += 3;
    findings.push('Datenschutzerklärung vorhanden');
  } else {
    findings.push('Keine Datenschutzerklärung');
  }

  // Check for Cookie Consent / Banner
  const cookiePatterns = [
    /cookie[-\s]?consent/i, /cookie[-\s]?banner/i, /cookie[-\s]?notice/i,
    /cookiebot/i, /cookieconsent/i, /gdpr/i, /onetrust/i,
    /consent[-\s]?manager/i, /borlabs/i, /complianz/i,
  ];
  const hasCookieConsent = cookiePatterns.some(p => p.test(html));
  if (hasCookieConsent) {
    score += 3;
    findings.push('Cookie-Consent vorhanden');
  } else {
    findings.push('Kein Cookie-Consent/Banner');
  }

  return { score: Math.min(10, score), maxScore: 10, findings };
}

/**
 * Design Age Check (max 10 points)
 * Modern design patterns = high score
 * Outdated HTML/CSS = low score
 */
function checkDesignAge(html: string, htmlLower: string): CheckResult {
  let score = 5; // Start at middle
  const findings: string[] = [];

  // NEGATIVE indicators (old design) - subtract points
  const oldPatterns = [
    { pattern: /<table[^>]*>(?:(?!<\/table>)[\s\S])*?<td[^>]*>(?:(?!<\/td>)[\s\S])*?<table/i, name: 'Verschachtelte Tabellen (Table-Layout)', penalty: 3 },
    { pattern: /<font[\s>]/i, name: 'Veraltetes <font> Tag', penalty: 2 },
    { pattern: /<center[\s>]/i, name: 'Veraltetes <center> Tag', penalty: 1 },
    { pattern: /<marquee[\s>]/i, name: 'Veraltetes <marquee> Tag', penalty: 2 },
    { pattern: /<blink[\s>]/i, name: 'Veraltetes <blink> Tag', penalty: 2 },
    { pattern: /\.swf|flash/i, name: 'Flash-Inhalte erkannt', penalty: 3 },
    { pattern: /<frameset|<iframe[^>]*width=["']100%/i, name: 'Frameset/Vollbild-iFrame', penalty: 2 },
    { pattern: /bgcolor=/i, name: 'Inline bgcolor Attribut', penalty: 1 },
  ];

  for (const old of oldPatterns) {
    if (old.pattern.test(html)) {
      score -= old.penalty;
      findings.push(`Veraltet: ${old.name}`);
    }
  }

  // POSITIVE indicators (modern design) - add points
  const modernPatterns = [
    { pattern: /display:\s*flex|display:\s*grid/i, name: 'Modernes CSS Layout (Flexbox/Grid)', bonus: 2 },
    { pattern: /css[-\s]?var|--[a-z]/i, name: 'CSS Custom Properties', bonus: 1 },
    { pattern: /<svg[\s>]/i, name: 'SVG-Grafiken', bonus: 1 },
    { pattern: /font-display/i, name: 'Optimierter Font-Loading', bonus: 1 },
    { pattern: /preconnect|preload|prefetch/i, name: 'Resource Hints (Preload/Prefetch)', bonus: 1 },
    { pattern: /service[-\s]?worker|manifest\.json/i, name: 'PWA-Features', bonus: 1 },
  ];

  for (const modern of modernPatterns) {
    if (modern.pattern.test(html)) {
      score += modern.bonus;
      findings.push(`Modern: ${modern.name}`);
    }
  }

  // Check for excessive inline styles (bad practice)
  const inlineStyleCount = (html.match(/style="/gi) || []).length;
  if (inlineStyleCount > 20) {
    score -= 2;
    findings.push(`Viele Inline-Styles (${inlineStyleCount})`);
  }

  // Check for minified CSS/JS (indicates professional build process)
  if (htmlLower.includes('.min.css') || htmlLower.includes('.min.js')) {
    score += 1;
    findings.push('Minifizierte Assets');
  }

  return { score: Math.max(0, Math.min(10, score)), maxScore: 10, findings };
}

/**
 * Helper: Empty details for unreachable websites
 */
function emptyDetails(): AnalysisResult['details'] {
  const empty: CheckResult = { score: 0, maxScore: 0, findings: [] };
  return {
    ssl: { ...empty, maxScore: 10 },
    mobile: { ...empty, maxScore: 15 },
    seo: { ...empty, maxScore: 15 },
    techStack: { ...empty, maxScore: 10 },
    copyrightYear: { ...empty, maxScore: 10 },
    loadTime: { ...empty, maxScore: 10 },
    images: { ...empty, maxScore: 10 },
    legal: { ...empty, maxScore: 10 },
    design: { ...empty, maxScore: 10 },
  };
}
