/**
 * Deep SEO Analyzer — Comprehensive technical SEO audit
 *
 * Categories (total 100 points):
 * - Meta Tags (15): title, description, OG tags, canonical
 * - Headings (10): H1 present, proper hierarchy
 * - Links (10): internal/external count, broken link indicators
 * - Performance (15): load time, page size, minification
 * - Indexability (15): sitemap.xml, robots.txt, canonical, noindex
 * - Schema (10): JSON-LD, microdata, structured data types
 * - Security (10): HTTPS, security headers (HSTS, CSP, etc.)
 * - Mobile (10): viewport, responsive patterns
 * - Content (5): word count, text-to-HTML ratio
 */

export interface SeoCategory {
  name: string;
  score: number;
  maxScore: number;
  issues: SeoIssueDetail[];
}

export interface SeoIssueDetail {
  id: string;
  label: string;
  severity: 'critical' | 'major' | 'minor' | 'info' | 'pass';
  description: string;
  recommendation?: string;
}

export interface SeoAuditResult {
  url: string;
  finalUrl: string;
  totalScore: number;
  categories: {
    metaTags: SeoCategory;
    headings: SeoCategory;
    links: SeoCategory;
    performance: SeoCategory;
    indexability: SeoCategory;
    schema: SeoCategory;
    security: SeoCategory;
    mobile: SeoCategory;
    content: SeoCategory;
  };
  summary: {
    critical: number;
    major: number;
    minor: number;
    passed: number;
  };
  analyzedAt: string;
  responseTimeMs: number;
}

export interface RankingResult {
  keyword: string;
  city: string;
  targetUrl: string;
  position: number | null; // null = not found
  totalResults: number;
  competitors: RankingCompetitor[];
  mapsPackPositions: RankingCompetitor[];
  checkedAt: string;
}

export interface RankingCompetitor {
  position: number;
  title: string;
  url: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
}

const FETCH_TIMEOUT = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ─── Main SEO Audit Function ────────────────────────────────────────────────

export async function runSeoAudit(url: string): Promise<SeoAuditResult> {
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
  let pageSize = 0;

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

    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    html = await response.text();
    pageSize = new Blob([html]).size;
  } catch {
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

        response.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });

        html = await response.text();
        pageSize = new Blob([html]).size;
      } catch {
        // Both failed
      }
    }
  }

  // If we couldn't fetch, return unreachable result
  if (!html) {
    return unreachableResult(url, Date.now() - startTime);
  }

  const htmlLower = html.toLowerCase();
  const baseUrl = new URL(finalUrl).origin;

  // Fetch additional resources in parallel
  const [sitemapExists, robotsTxt] = await Promise.all([
    checkUrlExists(baseUrl + '/sitemap.xml'),
    fetchRobotsTxt(baseUrl),
  ]);

  // Run all category checks
  const metaTags = checkMetaTags(html, htmlLower);
  const headings = checkHeadings(html);
  const links = checkLinks(html, baseUrl);
  const performance = checkPerformance(responseTimeMs, pageSize, html, htmlLower);
  const indexability = checkIndexability(html, htmlLower, sitemapExists, robotsTxt, finalUrl);
  const schema = checkSchema(html, htmlLower);
  const security = checkSecurity(hasSSL, headers);
  const mobile = checkMobile(html, htmlLower);
  const content = checkContent(html, htmlLower);

  const totalScore = metaTags.score + headings.score + links.score +
    performance.score + indexability.score + schema.score +
    security.score + mobile.score + content.score;

  // Count issues by severity
  const allIssues = [
    ...metaTags.issues, ...headings.issues, ...links.issues,
    ...performance.issues, ...indexability.issues, ...schema.issues,
    ...security.issues, ...mobile.issues, ...content.issues,
  ];

  return {
    url: normalizedUrl,
    finalUrl,
    totalScore: Math.max(0, Math.min(100, totalScore)),
    categories: { metaTags, headings, links, performance, indexability, schema, security, mobile, content },
    summary: {
      critical: allIssues.filter(i => i.severity === 'critical').length,
      major: allIssues.filter(i => i.severity === 'major').length,
      minor: allIssues.filter(i => i.severity === 'minor').length,
      passed: allIssues.filter(i => i.severity === 'pass').length,
    },
    analyzedAt: new Date().toISOString(),
    responseTimeMs,
  };
}


// ─── Category: Meta Tags (15 points) ────────────────────────────────────────

function checkMetaTags(html: string, htmlLower: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // Title tag (4 pts)
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title.length >= 30 && title.length <= 60) {
      score += 4;
      issues.push({ id: 'title_ok', label: `Title-Tag vorhanden (${title.length} Zeichen)`, severity: 'pass', description: `"${title.substring(0, 60)}"` });
    } else if (title.length > 0) {
      score += 2;
      const problem = title.length < 30 ? 'zu kurz' : 'zu lang';
      issues.push({ id: 'title_length', label: `Title-Tag ${problem} (${title.length} Zeichen)`, severity: 'minor', description: `Optimale Länge: 30-60 Zeichen. Aktuell: "${title.substring(0, 80)}"`, recommendation: 'Title auf 30-60 Zeichen optimieren, Hauptkeyword am Anfang' });
    }
  } else {
    issues.push({ id: 'no_title', label: 'Kein Title-Tag vorhanden', severity: 'critical', description: 'Der Title-Tag ist das wichtigste On-Page SEO Element und fehlt komplett.', recommendation: 'Title-Tag mit Hauptkeyword + Firmenname + Stadt hinzufügen' });
  }

  // Meta Description (4 pts)
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc.length >= 120 && desc.length <= 160) {
      score += 4;
      issues.push({ id: 'desc_ok', label: `Meta-Description vorhanden (${desc.length} Zeichen)`, severity: 'pass', description: desc.substring(0, 160) });
    } else if (desc.length > 0) {
      score += 2;
      const problem = desc.length < 120 ? 'zu kurz' : 'zu lang';
      issues.push({ id: 'desc_length', label: `Meta-Description ${problem} (${desc.length} Zeichen)`, severity: 'minor', description: `Optimale Länge: 120-160 Zeichen`, recommendation: 'Meta-Description auf 120-160 Zeichen optimieren mit Call-to-Action' });
    }
  } else {
    issues.push({ id: 'no_desc', label: 'Keine Meta-Description', severity: 'critical', description: 'Die Meta-Description bestimmt den Snippet-Text in Google Suchergebnissen.', recommendation: 'Meta-Description mit Keywords, Alleinstellungsmerkmal und Call-to-Action hinzufügen' });
  }

  // Open Graph Tags (3 pts)
  const hasOgTitle = htmlLower.includes('og:title');
  const hasOgDesc = htmlLower.includes('og:description');
  const hasOgImage = htmlLower.includes('og:image');
  const ogCount = [hasOgTitle, hasOgDesc, hasOgImage].filter(Boolean).length;

  if (ogCount === 3) {
    score += 3;
    issues.push({ id: 'og_ok', label: 'Open Graph Tags vollständig', severity: 'pass', description: 'og:title, og:description und og:image sind vorhanden' });
  } else if (ogCount > 0) {
    score += 1;
    const missing = [!hasOgTitle && 'og:title', !hasOgDesc && 'og:description', !hasOgImage && 'og:image'].filter(Boolean);
    issues.push({ id: 'og_partial', label: `Open Graph unvollständig (${missing.join(', ')} fehlt)`, severity: 'minor', description: 'Open Graph Tags steuern wie die Seite in Social Media geteilt wird.', recommendation: 'Fehlende OG-Tags hinzufügen für bessere Social-Media-Darstellung' });
  } else {
    issues.push({ id: 'no_og', label: 'Keine Open Graph Tags', severity: 'minor', description: 'Ohne OG-Tags wird die Seite beim Teilen auf Social Media schlecht dargestellt.', recommendation: 'og:title, og:description und og:image hinzufügen' });
  }

  // Canonical URL (2 pts)
  const hasCanonical = htmlLower.includes('rel="canonical"') || htmlLower.includes("rel='canonical'");
  if (hasCanonical) {
    score += 2;
    issues.push({ id: 'canonical_ok', label: 'Canonical-Tag vorhanden', severity: 'pass', description: 'Verhindert Duplicate Content Probleme' });
  } else {
    issues.push({ id: 'no_canonical', label: 'Kein Canonical-Tag', severity: 'major', description: 'Ohne Canonical-Tag kann Google die Seite unter verschiedenen URLs indexieren (Duplicate Content).', recommendation: 'Canonical-Tag mit der bevorzugten URL hinzufügen' });
  }

  // Language attribute (2 pts)
  const hasLang = html.match(/<html[^>]*lang=["'][^"']+["']/i);
  if (hasLang) {
    score += 2;
    issues.push({ id: 'lang_ok', label: 'Sprach-Attribut vorhanden', severity: 'pass', description: 'html lang-Attribut ist gesetzt' });
  } else {
    issues.push({ id: 'no_lang', label: 'Kein Sprach-Attribut (lang)', severity: 'minor', description: 'Das lang-Attribut hilft Suchmaschinen die Sprache der Seite zu erkennen.', recommendation: 'lang="de" zum <html> Tag hinzufügen' });
  }

  return { name: 'Meta-Tags', score: Math.min(15, score), maxScore: 15, issues };
}


// ─── Category: Headings (10 points) ─────────────────────────────────────────

function checkHeadings(html: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // Count all heading levels
  const h1s = html.match(/<h1[\s>]/gi) || [];
  const h2s = html.match(/<h2[\s>]/gi) || [];
  const h3s = html.match(/<h3[\s>]/gi) || [];
  const h4s = html.match(/<h4[\s>]/gi) || [];
  const h5s = html.match(/<h5[\s>]/gi) || [];
  const h6s = html.match(/<h6[\s>]/gi) || [];

  // H1 present (4 pts)
  if (h1s.length === 1) {
    score += 4;
    const h1Content = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = h1Content ? h1Content[1].replace(/<[^>]+>/g, '').trim().substring(0, 80) : '';
    issues.push({ id: 'h1_ok', label: 'Genau eine H1-Überschrift', severity: 'pass', description: h1Text ? `"${h1Text}"` : 'H1 vorhanden' });
  } else if (h1s.length === 0) {
    issues.push({ id: 'no_h1', label: 'Keine H1-Überschrift vorhanden', severity: 'critical', description: 'Die H1 ist die wichtigste Überschrift der Seite und fehlt.', recommendation: 'Eine H1 mit dem Hauptkeyword + Standort hinzufügen' });
  } else {
    score += 1;
    issues.push({ id: 'multiple_h1', label: `${h1s.length} H1-Überschriften (nur 1 empfohlen)`, severity: 'major', description: 'Mehrere H1-Tags verwässern die Keyword-Relevanz.', recommendation: 'Auf genau eine H1 pro Seite reduzieren' });
  }

  // H2 subheadings (3 pts)
  if (h2s.length >= 2) {
    score += 3;
    issues.push({ id: 'h2_ok', label: `${h2s.length} H2-Überschriften vorhanden`, severity: 'pass', description: 'Gute Inhaltsstrukturierung' });
  } else if (h2s.length === 1) {
    score += 1;
    issues.push({ id: 'h2_few', label: 'Nur 1 H2-Überschrift', severity: 'minor', description: 'Mehr H2-Überschriften helfen bei der Inhaltsstrukturierung.', recommendation: 'Weitere H2-Abschnitte für Services, Vorteile etc. hinzufügen' });
  } else {
    issues.push({ id: 'no_h2', label: 'Keine H2-Überschriften', severity: 'major', description: 'H2-Überschriften strukturieren den Inhalt und sind wichtig für SEO.', recommendation: 'H2-Überschriften für verschiedene Seitenabschnitte hinzufügen' });
  }

  // Heading hierarchy (3 pts)
  const levels = [h1s.length, h2s.length, h3s.length, h4s.length, h5s.length, h6s.length];
  let hierarchyOk = true;

  // Check for skipped levels (e.g., H1 → H3 without H2)
  let lastUsed = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] > 0) {
      if (i > lastUsed + 1 && lastUsed > 0) {
        hierarchyOk = false;
        break;
      }
      lastUsed = i;
    }
  }

  if (hierarchyOk && h1s.length > 0 && h2s.length > 0) {
    score += 3;
    issues.push({ id: 'hierarchy_ok', label: 'Überschriften-Hierarchie korrekt', severity: 'pass', description: `H1: ${h1s.length}, H2: ${h2s.length}, H3: ${h3s.length}, H4: ${h4s.length}` });
  } else if (!hierarchyOk) {
    score += 1;
    issues.push({ id: 'hierarchy_skip', label: 'Überschriften-Ebenen übersprungen', severity: 'minor', description: 'Es werden Heading-Ebenen übersprungen (z.B. H1 → H3 ohne H2).', recommendation: 'Überschriften in logischer Reihenfolge verwenden: H1 → H2 → H3' });
  }

  return { name: 'Überschriften', score: Math.min(10, score), maxScore: 10, issues };
}


// ─── Category: Links (10 points) ────────────────────────────────────────────

function checkLinks(html: string, baseUrl: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  const links = html.match(/<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi) || [];
  const hrefs = links.map(link => {
    const match = link.match(/href=["']([^"'#]+)["']/i);
    return match ? match[1] : '';
  }).filter(Boolean);

  const domain = new URL(baseUrl).hostname;
  const internalLinks = hrefs.filter(href => {
    try {
      if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) return true;
      const linkDomain = new URL(href).hostname;
      return linkDomain === domain || linkDomain.endsWith('.' + domain);
    } catch { return false; }
  });
  const externalLinks = hrefs.filter(href => {
    try {
      if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) return false;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
      const linkDomain = new URL(href).hostname;
      return linkDomain !== domain;
    } catch { return false; }
  });

  // Internal links (4 pts)
  if (internalLinks.length >= 5) {
    score += 4;
    issues.push({ id: 'int_links_ok', label: `${internalLinks.length} interne Links`, severity: 'pass', description: 'Gute interne Verlinkung' });
  } else if (internalLinks.length >= 2) {
    score += 2;
    issues.push({ id: 'int_links_few', label: `Nur ${internalLinks.length} interne Links`, severity: 'minor', description: 'Mehr interne Links verbessern die Seitenstruktur für Google.', recommendation: 'Interne Links zu Unterseiten (Services, Kontakt, Blog) hinzufügen' });
  } else {
    issues.push({ id: 'int_links_none', label: 'Kaum interne Links', severity: 'major', description: 'Interne Verlinkung ist entscheidend für SEO.', recommendation: 'Navigation und Content-Links zu wichtigen Unterseiten hinzufügen' });
  }

  // External links (2 pts)
  if (externalLinks.length >= 1 && externalLinks.length <= 20) {
    score += 2;
    issues.push({ id: 'ext_links_ok', label: `${externalLinks.length} externe Links`, severity: 'pass', description: 'Ausgehende Links vorhanden' });
  } else if (externalLinks.length === 0) {
    score += 1;
    issues.push({ id: 'ext_links_none', label: 'Keine externen Links', severity: 'info', description: 'Externe Links zu relevanten Quellen können Trust signalisieren.' });
  } else {
    issues.push({ id: 'ext_links_many', label: `${externalLinks.length} externe Links (viele)`, severity: 'minor', description: 'Zu viele ausgehende Links können PageRank verwässern.' });
  }

  // Nofollow usage on external links (2 pts)
  const nofollowLinks = links.filter(l => /rel=["'][^"']*nofollow/i.test(l));
  if (externalLinks.length > 0 && nofollowLinks.length > 0) {
    score += 2;
    issues.push({ id: 'nofollow_ok', label: 'rel="nofollow" wird verwendet', severity: 'pass', description: 'Externe Links werden kontrolliert' });
  } else if (externalLinks.length > 3) {
    issues.push({ id: 'no_nofollow', label: 'Keine nofollow-Links', severity: 'info', description: 'rel="nofollow" auf nicht vertrauenswürdigen Links setzen' });
  } else {
    score += 2;
  }

  // Phone/Contact links (2 pts)
  const telLinks = hrefs.filter(h => h.startsWith('tel:'));
  const mailLinks = hrefs.filter(h => h.startsWith('mailto:'));
  if (telLinks.length > 0 && mailLinks.length > 0) {
    score += 2;
    issues.push({ id: 'contact_links_ok', label: 'Telefon- und E-Mail-Links vorhanden', severity: 'pass', description: 'Klickbare Kontaktdaten für mobile Nutzer' });
  } else if (telLinks.length > 0 || mailLinks.length > 0) {
    score += 1;
    const missing = telLinks.length === 0 ? 'Telefon' : 'E-Mail';
    issues.push({ id: 'contact_links_partial', label: `${missing}-Link fehlt`, severity: 'minor', description: `Klickbare ${missing}-Links verbessern die mobile Nutzererfahrung.`, recommendation: `${missing}-Link mit tel: oder mailto: hinzufügen` });
  } else {
    issues.push({ id: 'no_contact_links', label: 'Keine klickbaren Kontakt-Links', severity: 'major', description: 'Weder tel: noch mailto: Links gefunden.', recommendation: 'Telefonnummer als tel:-Link und E-Mail als mailto:-Link einbinden' });
  }

  return { name: 'Verlinkung', score: Math.min(10, score), maxScore: 10, issues };
}


// ─── Category: Performance (15 points) ──────────────────────────────────────

function checkPerformance(responseTimeMs: number, pageSize: number, html: string, htmlLower: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];
  const seconds = responseTimeMs / 1000;
  const pageSizeKB = Math.round(pageSize / 1024);

  // Response time (5 pts)
  if (seconds < 1) {
    score += 5;
    issues.push({ id: 'speed_ok', label: `Ladezeit: ${seconds.toFixed(1)}s (schnell)`, severity: 'pass', description: 'Server antwortet schnell' });
  } else if (seconds < 2) {
    score += 3;
    issues.push({ id: 'speed_ok2', label: `Ladezeit: ${seconds.toFixed(1)}s (gut)`, severity: 'pass', description: 'Akzeptable Serverantwortzeit' });
  } else if (seconds < 4) {
    score += 1;
    issues.push({ id: 'speed_slow', label: `Ladezeit: ${seconds.toFixed(1)}s (langsam)`, severity: 'major', description: 'Google empfiehlt < 2 Sekunden.', recommendation: 'Server-Performance optimieren, Caching einrichten' });
  } else {
    issues.push({ id: 'speed_critical', label: `Ladezeit: ${seconds.toFixed(1)}s (sehr langsam)`, severity: 'critical', description: 'Extrem langsame Ladezeit. Google bestraft langsame Seiten im Ranking.', recommendation: 'Dringend: Server-Hosting upgraden, Caching aktivieren, Assets komprimieren' });
  }

  // Page size (4 pts)
  if (pageSizeKB < 100) {
    score += 4;
    issues.push({ id: 'size_ok', label: `Seitengröße: ${pageSizeKB} KB (optimal)`, severity: 'pass', description: 'Kompakte Seitengröße' });
  } else if (pageSizeKB < 300) {
    score += 3;
    issues.push({ id: 'size_ok2', label: `Seitengröße: ${pageSizeKB} KB (gut)`, severity: 'pass', description: 'Akzeptable Seitengröße' });
  } else if (pageSizeKB < 800) {
    score += 1;
    issues.push({ id: 'size_large', label: `Seitengröße: ${pageSizeKB} KB (groß)`, severity: 'minor', description: 'Die Seite ist relativ groß. Das kann die Ladezeit verschlechtern.', recommendation: 'HTML minimieren, nicht genutzte CSS/JS entfernen' });
  } else {
    issues.push({ id: 'size_huge', label: `Seitengröße: ${pageSizeKB} KB (zu groß)`, severity: 'major', description: 'Übergroße Seite — verlangsamt den Seitenaufbau erheblich.', recommendation: 'Dringend Seite verschlanken: Inline-CSS entfernen, Bilder optimieren, Code splitten' });
  }

  // Minification (2 pts)
  const hasMinifiedCSS = htmlLower.includes('.min.css');
  const hasMinifiedJS = htmlLower.includes('.min.js');
  if (hasMinifiedCSS || hasMinifiedJS) {
    score += 2;
    issues.push({ id: 'minified_ok', label: 'Minifizierte Assets vorhanden', severity: 'pass', description: 'CSS/JS werden komprimiert ausgeliefert' });
  } else {
    issues.push({ id: 'no_minified', label: 'Keine minifizierten Assets erkannt', severity: 'minor', description: 'CSS und JavaScript sollten minifiziert werden.', recommendation: 'Build-Prozess mit Minifizierung einrichten' });
  }

  // Compression (2 pts)
  // Can't check gzip from HTML alone, but check for preload/preconnect hints
  const hasPreload = htmlLower.includes('rel="preload"') || htmlLower.includes("rel='preload'");
  const hasPreconnect = htmlLower.includes('rel="preconnect"') || htmlLower.includes("rel='preconnect'");
  if (hasPreload || hasPreconnect) {
    score += 2;
    issues.push({ id: 'resource_hints_ok', label: 'Resource Hints vorhanden (Preload/Preconnect)', severity: 'pass', description: 'Browser lädt kritische Ressourcen früher' });
  } else {
    issues.push({ id: 'no_resource_hints', label: 'Keine Resource Hints', severity: 'info', description: 'Preload/Preconnect-Hints beschleunigen das Laden.', recommendation: 'rel="preconnect" für externe Domains und rel="preload" für kritische Assets' });
  }

  // Image optimization (2 pts)
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  const lazyLoaded = imgTags.filter(img => /loading=["']lazy["']/i.test(img) || /data-src/i.test(img));
  const modernFormats = imgTags.filter(img => /\.(webp|avif)/i.test(img));

  if (imgTags.length === 0 || (lazyLoaded.length > 0 && modernFormats.length > 0)) {
    score += 2;
    issues.push({ id: 'img_perf_ok', label: 'Bilder performance-optimiert', severity: 'pass', description: imgTags.length === 0 ? 'Keine Bilder auf der Seite' : 'Lazy Loading und moderne Formate verwendet' });
  } else if (lazyLoaded.length > 0 || modernFormats.length > 0) {
    score += 1;
    issues.push({ id: 'img_perf_partial', label: 'Bilder teilweise optimiert', severity: 'minor', description: `${lazyLoaded.length}/${imgTags.length} lazy, ${modernFormats.length} WebP/AVIF`, recommendation: 'Alle Bilder mit Lazy Loading und WebP-Format ausliefern' });
  } else if (imgTags.length > 0) {
    issues.push({ id: 'img_perf_bad', label: 'Bilder nicht optimiert', severity: 'major', description: `${imgTags.length} Bilder ohne Lazy Loading oder moderne Formate.`, recommendation: 'loading="lazy" und WebP-Format für alle Bilder einsetzen' });
  }

  return { name: 'Performance', score: Math.min(15, score), maxScore: 15, issues };
}


// ─── Category: Indexability (15 points) ──────────────────────────────────────

function checkIndexability(html: string, htmlLower: string, sitemapExists: boolean, robotsTxt: string | null, finalUrl: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // Sitemap.xml (4 pts)
  if (sitemapExists) {
    score += 4;
    issues.push({ id: 'sitemap_ok', label: 'Sitemap.xml vorhanden', severity: 'pass', description: 'Google kann alle Seiten finden' });
  } else {
    issues.push({ id: 'no_sitemap', label: 'Keine Sitemap.xml gefunden', severity: 'critical', description: 'Ohne Sitemap kann Google wichtige Unterseiten übersehen.', recommendation: 'Sitemap.xml erstellen und in der Google Search Console einreichen' });
  }

  // robots.txt (4 pts)
  if (robotsTxt !== null) {
    score += 3;
    issues.push({ id: 'robots_ok', label: 'robots.txt vorhanden', severity: 'pass', description: 'Crawler-Steuerung eingerichtet' });

    // Check if sitemap is referenced in robots.txt
    if (robotsTxt.toLowerCase().includes('sitemap:')) {
      score += 1;
      issues.push({ id: 'robots_sitemap', label: 'Sitemap in robots.txt referenziert', severity: 'pass', description: 'Best Practice für Indexierung' });
    } else {
      issues.push({ id: 'robots_no_sitemap', label: 'Sitemap nicht in robots.txt', severity: 'minor', description: 'Die Sitemap sollte in robots.txt referenziert werden.', recommendation: 'Sitemap: URL in robots.txt einfügen' });
    }

    // Check for Disallow: /
    if (robotsTxt.includes('Disallow: /') && !robotsTxt.includes('Disallow: /wp-admin') && !robotsTxt.includes('Disallow: /admin')) {
      issues.push({ id: 'robots_block_all', label: 'robots.txt blockiert möglicherweise alles', severity: 'critical', description: 'Disallow: / könnte die gesamte Seite blockieren!', recommendation: 'robots.txt überprüfen — eventuell wird Google komplett ausgesperrt' });
      score -= 3;
    }
  } else {
    issues.push({ id: 'no_robots', label: 'Keine robots.txt vorhanden', severity: 'major', description: 'Die robots.txt kontrolliert welche Seiten Google crawlen darf.', recommendation: 'robots.txt mit Sitemap-Verweis erstellen' });
  }

  // Noindex check (3 pts)
  const hasNoindex = htmlLower.includes('noindex');
  if (hasNoindex) {
    issues.push({ id: 'noindex', label: 'NOINDEX Tag gefunden!', severity: 'critical', description: 'Die Seite wird von Google NICHT indexiert! Das ist ein gravierendes Problem.', recommendation: 'Sofort noindex entfernen, wenn die Seite in Google erscheinen soll' });
    score -= 3;
  } else {
    score += 3;
    issues.push({ id: 'indexable', label: 'Seite ist indexierbar', severity: 'pass', description: 'Kein noindex-Tag gefunden' });
  }

  // Canonical matches current URL (2 pts)
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch) {
    const canonicalUrl = canonicalMatch[1];
    try {
      const canonical = new URL(canonicalUrl, finalUrl).href;
      if (canonical === finalUrl || canonical === finalUrl + '/' || canonical + '/' === finalUrl) {
        score += 2;
        issues.push({ id: 'canonical_match', label: 'Canonical-URL stimmt überein', severity: 'pass', description: 'Canonical zeigt auf die aktuelle Seite' });
      } else {
        issues.push({ id: 'canonical_mismatch', label: 'Canonical-URL weicht ab', severity: 'minor', description: `Canonical zeigt auf: ${canonicalUrl}`, recommendation: 'Prüfen ob die Canonical-URL korrekt ist' });
      }
    } catch {
      score += 1;
    }
  } else {
    score += 1; // Not having canonical is handled in meta tags
  }

  // hreflang (2 pts) - bonus for multilingual
  const hasHreflang = htmlLower.includes('hreflang');
  if (hasHreflang) {
    score += 2;
    issues.push({ id: 'hreflang_ok', label: 'hreflang-Tags vorhanden', severity: 'pass', description: 'Mehrsprachige Konfiguration erkannt' });
  }

  return { name: 'Indexierbarkeit', score: Math.max(0, Math.min(15, score)), maxScore: 15, issues };
}


// ─── Category: Schema/Structured Data (10 points) ───────────────────────────

function checkSchema(html: string, htmlLower: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // JSON-LD (5 pts)
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  if (jsonLdMatches.length > 0) {
    score += 4;
    const types: string[] = [];

    for (const match of jsonLdMatches) {
      const content = match.replace(/<script[^>]*>|<\/script>/gi, '');
      try {
        const data = JSON.parse(content);
        const type = data['@type'] || (data['@graph'] ? 'Graph' : 'Unknown');
        if (Array.isArray(type)) {
          types.push(...type);
        } else {
          types.push(type);
        }
      } catch {
        types.push('(Parse-Fehler)');
      }
    }

    issues.push({ id: 'jsonld_ok', label: `JSON-LD Structured Data (${types.join(', ')})`, severity: 'pass', description: `${jsonLdMatches.length} Schema-Block(s) gefunden` });

    // Check for LocalBusiness schema (bonus for local SEO)
    const hasLocalBusiness = types.some(t =>
      t.toLowerCase().includes('localbusiness') ||
      t.toLowerCase().includes('organization') ||
      t.toLowerCase().includes('store') ||
      t.toLowerCase().includes('plumber') ||
      t.toLowerCase().includes('hvac')
    );
    if (hasLocalBusiness) {
      score += 1;
      issues.push({ id: 'local_schema', label: 'LocalBusiness/Organization Schema vorhanden', severity: 'pass', description: 'Optimal für lokale Suchergebnisse' });
    }
  } else {
    issues.push({ id: 'no_jsonld', label: 'Kein JSON-LD Structured Data', severity: 'major', description: 'Strukturierte Daten helfen Google den Inhalt besser zu verstehen und ermöglichen Rich Snippets.', recommendation: 'LocalBusiness Schema mit Name, Adresse, Telefon, Öffnungszeiten hinzufügen' });
  }

  // Microdata (3 pts)
  const hasMicrodata = htmlLower.includes('itemscope') || htmlLower.includes('itemtype');
  if (hasMicrodata && jsonLdMatches.length === 0) {
    score += 3;
    issues.push({ id: 'microdata_ok', label: 'Microdata Markup vorhanden', severity: 'pass', description: 'Alternative zu JSON-LD für strukturierte Daten' });
  } else if (hasMicrodata) {
    score += 1;
    issues.push({ id: 'microdata_extra', label: 'Zusätzliches Microdata vorhanden', severity: 'pass', description: 'Sowohl JSON-LD als auch Microdata erkannt' });
  }

  // Review/Rating schema (2 pts)
  const hasReviewSchema = htmlLower.includes('"aggregaterating"') || htmlLower.includes('"review"') ||
    htmlLower.includes('aggregaterating') || htmlLower.includes('itemreviewed');
  if (hasReviewSchema) {
    score += 2;
    issues.push({ id: 'review_schema', label: 'Bewertungs-Schema vorhanden', severity: 'pass', description: 'Ermöglicht Sterne in Google Suchergebnissen' });
  } else if (score < 5) {
    issues.push({ id: 'no_review_schema', label: 'Kein Bewertungs-Schema', severity: 'minor', description: 'AggregateRating Schema zeigt Sterne in Suchergebnissen.', recommendation: 'Review/Rating Schema hinzufügen für Sterne-Darstellung in Google' });
  }

  return { name: 'Schema & Structured Data', score: Math.min(10, score), maxScore: 10, issues };
}


// ─── Category: Security (10 points) ─────────────────────────────────────────

function checkSecurity(hasSSL: boolean, headers: Record<string, string>): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // HTTPS (5 pts)
  if (hasSSL) {
    score += 5;
    issues.push({ id: 'https_ok', label: 'HTTPS/SSL aktiv', severity: 'pass', description: 'Verschlüsselte Verbindung' });
  } else {
    issues.push({ id: 'no_https', label: 'Kein HTTPS/SSL', severity: 'critical', description: 'Google markiert HTTP-Seiten als "Nicht sicher" und rankt sie schlechter.', recommendation: 'SSL-Zertifikat installieren und HTTP auf HTTPS weiterleiten' });
  }

  // HSTS (2 pts)
  if (headers['strict-transport-security']) {
    score += 2;
    issues.push({ id: 'hsts_ok', label: 'HSTS Header vorhanden', severity: 'pass', description: 'Strict-Transport-Security aktiv' });
  } else if (hasSSL) {
    issues.push({ id: 'no_hsts', label: 'Kein HSTS Header', severity: 'minor', description: 'HSTS verhindert Downgrade-Angriffe auf HTTP.', recommendation: 'Strict-Transport-Security Header setzen' });
  }

  // X-Content-Type-Options (1 pt)
  if (headers['x-content-type-options']) {
    score += 1;
    issues.push({ id: 'xcto_ok', label: 'X-Content-Type-Options vorhanden', severity: 'pass', description: 'MIME-Typ Sniffing verhindert' });
  }

  // Content-Security-Policy (1 pt)
  if (headers['content-security-policy']) {
    score += 1;
    issues.push({ id: 'csp_ok', label: 'Content-Security-Policy vorhanden', severity: 'pass', description: 'CSP Header schützt vor XSS' });
  }

  // X-Frame-Options (1 pt)
  if (headers['x-frame-options']) {
    score += 1;
    issues.push({ id: 'xfo_ok', label: 'X-Frame-Options vorhanden', severity: 'pass', description: 'Clickjacking-Schutz aktiv' });
  }

  // Summary of missing security headers
  const missingHeaders = [];
  if (!headers['strict-transport-security'] && hasSSL) missingHeaders.push('HSTS');
  if (!headers['x-content-type-options']) missingHeaders.push('X-Content-Type-Options');
  if (!headers['content-security-policy']) missingHeaders.push('CSP');
  if (!headers['x-frame-options']) missingHeaders.push('X-Frame-Options');

  if (missingHeaders.length > 0 && missingHeaders.length <= 3) {
    issues.push({ id: 'missing_sec_headers', label: `${missingHeaders.length} Security-Header fehlen`, severity: 'info', description: `Fehlend: ${missingHeaders.join(', ')}`, recommendation: 'Security-Headers im Webserver konfigurieren' });
  }

  return { name: 'Sicherheit', score: Math.min(10, score), maxScore: 10, issues };
}


// ─── Category: Mobile (10 points) ───────────────────────────────────────────

function checkMobile(html: string, htmlLower: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // Viewport meta tag (4 pts)
  const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
  if (viewportMatch) {
    const content = viewportMatch[1];
    if (content.includes('width=device-width')) {
      score += 4;
      issues.push({ id: 'viewport_ok', label: 'Viewport Meta-Tag korrekt', severity: 'pass', description: 'width=device-width korrekt gesetzt' });
    } else {
      score += 2;
      issues.push({ id: 'viewport_partial', label: 'Viewport Tag vorhanden, aber suboptimal', severity: 'minor', description: `Content: ${content}`, recommendation: 'Auf width=device-width, initial-scale=1 setzen' });
    }

    // Check user-scalable=no (bad practice)
    if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
      issues.push({ id: 'no_zoom', label: 'Zoom deaktiviert', severity: 'minor', description: 'user-scalable=no oder maximum-scale=1 verhindert Zoom.', recommendation: 'Zoom-Einschränkung entfernen — beeinträchtigt Barrierefreiheit' });
      score -= 1;
    }
  } else {
    issues.push({ id: 'no_viewport', label: 'Kein Viewport Meta-Tag', severity: 'critical', description: 'Ohne Viewport-Tag wird die Seite nicht mobile-optimiert dargestellt.', recommendation: '<meta name="viewport" content="width=device-width, initial-scale=1"> hinzufügen' });
  }

  // Responsive framework/CSS (3 pts)
  const responsivePatterns = [
    { pattern: /bootstrap/i, name: 'Bootstrap' },
    { pattern: /tailwind/i, name: 'Tailwind' },
    { pattern: /foundation/i, name: 'Foundation' },
    { pattern: /materialize/i, name: 'Materialize' },
  ];
  let hasFramework = false;
  for (const fw of responsivePatterns) {
    if (fw.pattern.test(html)) {
      score += 3;
      issues.push({ id: 'responsive_fw', label: `Responsive Framework: ${fw.name}`, severity: 'pass', description: 'Mobile-optimiertes CSS-Framework' });
      hasFramework = true;
      break;
    }
  }

  if (!hasFramework) {
    // Check for media queries
    const hasMediaQueries = htmlLower.includes('@media') && (htmlLower.includes('max-width') || htmlLower.includes('min-width'));
    if (hasMediaQueries) {
      score += 2;
      issues.push({ id: 'media_queries', label: 'Media Queries vorhanden', severity: 'pass', description: 'CSS Media Queries für responsive Design erkannt' });
    } else {
      issues.push({ id: 'no_responsive', label: 'Kein responsives CSS erkannt', severity: 'major', description: 'Weder Framework noch Media Queries gefunden.', recommendation: 'Responsive CSS implementieren für mobile Geräte' });
    }
  }

  // Touch-friendly elements (2 pts)
  const hasLargeTapTargets = htmlLower.includes('cursor: pointer') || htmlLower.includes('cursor:pointer');
  const hasTouchIcons = htmlLower.includes('apple-touch-icon') || htmlLower.includes('icon');
  if (hasTouchIcons) {
    score += 1;
    issues.push({ id: 'touch_icons', label: 'Touch-Icons vorhanden', severity: 'pass', description: 'App-Icons für mobile Geräte' });
  }
  if (hasLargeTapTargets || hasFramework) {
    score += 1;
  }

  return { name: 'Mobile-Optimierung', score: Math.max(0, Math.min(10, score)), maxScore: 10, issues };
}


// ─── Category: Content (5 points) ───────────────────────────────────────────

function checkContent(html: string, htmlLower: string): SeoCategory {
  let score = 0;
  const issues: SeoIssueDetail[] = [];

  // Strip HTML to get text content
  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length;

  // Word count (3 pts)
  if (wordCount >= 300) {
    score += 3;
    issues.push({ id: 'content_ok', label: `${wordCount} Wörter (guter Umfang)`, severity: 'pass', description: 'Ausreichend Text für SEO' });
  } else if (wordCount >= 100) {
    score += 1;
    issues.push({ id: 'content_thin', label: `Nur ${wordCount} Wörter (dünn)`, severity: 'major', description: 'Zu wenig Textinhalt. Google bevorzugt umfangreiche Seiten.', recommendation: 'Mindestens 300+ Wörter relevanten Content hinzufügen (Services, FAQ, Über uns)' });
  } else {
    issues.push({ id: 'content_empty', label: `Nur ${wordCount} Wörter (fast leer)`, severity: 'critical', description: 'Extrem wenig Textinhalt. Google kann die Seite kaum bewerten.', recommendation: 'Dringend Content aufbauen: Service-Beschreibungen, FAQ, Standort-Info' });
  }

  // Text-to-HTML ratio (2 pts)
  const htmlSize = html.length;
  const textSize = textContent.length;
  const ratio = htmlSize > 0 ? Math.round((textSize / htmlSize) * 100) : 0;

  if (ratio >= 15) {
    score += 2;
    issues.push({ id: 'ratio_ok', label: `Text-HTML-Verhältnis: ${ratio}% (gut)`, severity: 'pass', description: 'Gesundes Verhältnis von Text zu Code' });
  } else if (ratio >= 8) {
    score += 1;
    issues.push({ id: 'ratio_low', label: `Text-HTML-Verhältnis: ${ratio}% (niedrig)`, severity: 'minor', description: 'Wenig Text im Verhältnis zum HTML-Code.', recommendation: 'Mehr textlichen Inhalt hinzufügen' });
  } else {
    issues.push({ id: 'ratio_critical', label: `Text-HTML-Verhältnis: ${ratio}% (sehr niedrig)`, severity: 'major', description: 'Die Seite besteht hauptsächlich aus Code, kaum aus Text.', recommendation: 'Deutlich mehr relevanten Textinhalt hinzufügen' });
  }

  return { name: 'Inhalt', score: Math.min(5, score), maxScore: 5, issues };
}


// ─── Local SEO Ranking Check ────────────────────────────────────────────────

export async function checkLocalRanking(keyword: string, city: string, targetWebsite: string): Promise<RankingResult> {
  const query = `${keyword} ${city}`;
  const targetDomain = extractDomain(targetWebsite);

  const googleUrl = `https://www.google.de/search?q=${encodeURIComponent(query)}&hl=de&gl=de&num=20`;

  let html = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(googleUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });
    clearTimeout(timeout);
    html = await response.text();
  } catch {
    return {
      keyword,
      city,
      targetUrl: targetWebsite,
      position: null,
      totalResults: 0,
      competitors: [],
      mapsPackPositions: [],
      checkedAt: new Date().toISOString(),
    };
  }

  // Parse organic results
  const competitors: RankingCompetitor[] = [];
  let targetPosition: number | null = null;

  // Extract organic result blocks — Google uses various div structures
  const resultPattern = /<div class="[^"]*tF2Cxc[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  const resultBlocks = html.match(resultPattern) || [];

  let position = 0;
  for (const block of resultBlocks) {
    position++;

    // Extract URL
    const urlMatch = block.match(/<a[^>]+href="(https?:\/\/[^"]+)"/i);
    const url = urlMatch ? urlMatch[1] : '';

    // Extract title
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Extract description
    const descMatch = block.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    if (url && title) {
      const competitor: RankingCompetitor = { position, title, url, description };
      competitors.push(competitor);

      // Check if this is our target
      const competitorDomain = extractDomain(url);
      if (competitorDomain === targetDomain) {
        targetPosition = position;
      }
    }
  }

  // Parse Maps Pack (local 3-pack)
  const mapsPackPositions: RankingCompetitor[] = [];
  const mapsSection = html.match(/class="[^"]*VkpGBb[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];

  let mapsPos = 0;
  for (const mapBlock of mapsSection) {
    mapsPos++;
    const nameMatch = mapBlock.match(/class="[^"]*dbg0pd[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)/i)
      || mapBlock.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
    const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const ratingMatch = mapBlock.match(/(\d[.,]\d)\s/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;

    const reviewMatch = mapBlock.match(/\((\d+)\)/);
    const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : undefined;

    if (name) {
      mapsPackPositions.push({
        position: mapsPos,
        title: name,
        url: '',
        rating,
        reviewCount,
      });
    }
  }

  // Fallback: simpler parsing if no results found with main pattern
  if (competitors.length === 0) {
    const simpleLinkPattern = /<a[^>]+href="(https?:\/\/(?!www\.google)[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    let simpleMatch;
    let simplePos = 0;
    while ((simpleMatch = simpleLinkPattern.exec(html)) !== null && simplePos < 20) {
      simplePos++;
      const url = simpleMatch[1];
      const title = simpleMatch[2].replace(/<[^>]+>/g, '').trim();

      if (url && title && !url.includes('google.')) {
        competitors.push({ position: simplePos, title, url });

        const competitorDomain = extractDomain(url);
        if (competitorDomain === targetDomain) {
          targetPosition = simplePos;
        }
      }
    }
  }

  return {
    keyword,
    city,
    targetUrl: targetWebsite,
    position: targetPosition,
    totalResults: competitors.length,
    competitors: competitors.slice(0, 10),
    mapsPackPositions,
    checkedAt: new Date().toISOString(),
  };
}


// ─── Helper Functions ───────────────────────────────────────────────────────

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(baseUrl + '/robots.txt', {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timeout);
    if (response.ok) {
      const text = await response.text();
      // Verify it's actually a robots.txt file (not an error page)
      if (text.toLowerCase().includes('user-agent') || text.toLowerCase().includes('sitemap')) {
        return text;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : 'http://' + url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function unreachableResult(url: string, responseTimeMs: number): SeoAuditResult {
  const emptyCategory = (name: string, max: number): SeoCategory => ({
    name,
    score: 0,
    maxScore: max,
    issues: [{ id: 'unreachable', label: 'Website nicht erreichbar', severity: 'critical', description: 'Die Website konnte nicht geladen werden.' }],
  });

  return {
    url,
    finalUrl: url,
    totalScore: 0,
    categories: {
      metaTags: emptyCategory('Meta-Tags', 15),
      headings: emptyCategory('Überschriften', 10),
      links: emptyCategory('Verlinkung', 10),
      performance: emptyCategory('Performance', 15),
      indexability: emptyCategory('Indexierbarkeit', 15),
      schema: emptyCategory('Schema & Structured Data', 10),
      security: emptyCategory('Sicherheit', 10),
      mobile: emptyCategory('Mobile-Optimierung', 10),
      content: emptyCategory('Inhalt', 5),
    },
    summary: { critical: 9, major: 0, minor: 0, passed: 0 },
    analyzedAt: new Date().toISOString(),
    responseTimeMs,
  };
}
