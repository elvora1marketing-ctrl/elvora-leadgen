import { NextRequest, NextResponse } from 'next/server';

interface GmbData {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  category: string;
  hours: string[];
  photoCount: number;
  url: string;
  issues: GmbIssue[];
  score: number;
}

interface GmbIssue {
  label: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  recommendation: string;
}

const GOOGLE_DOMAINS = /^(?:www\.)?(?:google\.|maps\.google\.|play\.google\.|schemas\.google\.|accounts\.google\.|lh\d\.google\.|streetviewpixels|googleusercontent\.com)/i;

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json() as { url: string };

    if (!url) {
      return NextResponse.json({ error: 'URL fehlt' }, { status: 400 });
    }

    // Resolve share.google redirect to actual Maps URL
    let resolvedUrl = url;
    if (url.includes('share.google') || url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      try {
        const redirectRes = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        resolvedUrl = redirectRes.url;
      } catch {
        // Use original URL if redirect fails
      }
    }

    // Fetch the Google Maps page with consent cookie to bypass EU cookie wall
    const response = await fetch(resolvedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': 'CONSENT=PENDING+987; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJkZSACGgYIgJnPpwY',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Google Maps Seite konnte nicht geladen werden' }, { status: 502 });
    }

    const html = await response.text();

    // Check if we got a consent page instead of actual content
    if (html.includes('consent.google') && !html.includes('APP_INITIALIZATION_STATE')) {
      return NextResponse.json({
        error: 'Google Consent-Seite blockiert den Zugriff. Bitte versuche es erneut.',
      }, { status: 502 });
    }

    // Extract data from Google Maps HTML
    const data = extractGmbData(html, resolvedUrl);

    if (!data.name) {
      return NextResponse.json({
        error: 'Kein Google Business Profil gefunden. Bitte prüfe den Link.',
      }, { status: 404 });
    }

    // Run audit analysis
    const audit = analyzeGmbProfile(data);

    return NextResponse.json(audit);
  } catch (error: unknown) {
    console.error('GMB audit error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden des Profils' }, { status: 500 });
  }
}

function extractGmbData(html: string, url: string): GmbData {
  const data: GmbData = {
    name: '',
    address: '',
    phone: '',
    website: '',
    rating: 0,
    reviewCount: 0,
    category: '',
    hours: [],
    photoCount: 0,
    url,
    issues: [],
    score: 0,
  };

  // === 1. Extract from meta tags (most reliable in server-side fetch) ===

  // Name from title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    data.name = titleMatch[1].replace(/\s*[-–]\s*Google\s*(Maps|Karten).*$/i, '').trim();
  }

  // Name from og:title (overrides title if available)
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
    || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
  if (ogTitleMatch) {
    const name = ogTitleMatch[1].replace(/\s*[-–]\s*Google\s*(Maps|Karten).*$/i, '').trim();
    if (name) data.name = name;
  }

  // Parse og:description — typically contains: "★★★★★ · Category · Address"
  // This is the MOST reliable data source in server-side Google Maps HTML
  const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
    || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i);
  if (ogDescMatch) {
    const desc = ogDescMatch[1];

    // Extract rating from star characters (★ = filled, ☆ = empty)
    const starBlock = desc.match(/[★☆]+/);
    if (starBlock) {
      const filled = (starBlock[0].match(/★/g) || []).length;
      if (filled > 0 && filled <= 5) {
        data.rating = filled;
      }
    }

    // Check for numeric rating like "4,5" in description
    const numRating = desc.match(/(\d[.,]\d)/);
    if (numRating) {
      const val = parseFloat(numRating[1].replace(',', '.'));
      if (val >= 1.0 && val <= 5.0) {
        data.rating = val; // Prefer numeric over star count
      }
    }

    // Split by · separator to extract category and address
    const parts = desc
      .split('·')
      .map(p => p.replace(/[★☆]/g, '').trim())
      .filter(p => p.length > 1);

    if (parts.length >= 2) {
      // First part is usually the category, last part is the address
      data.category = parts[0];
      data.address = parts[parts.length - 1];
    } else if (parts.length === 1) {
      if (/\d/.test(parts[0])) {
        data.address = parts[0];
      } else {
        data.category = parts[0];
      }
    }
  }

  // === 2. Extract from JSON-LD structured data (if present) ===
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    const match = jsonLdMatch;
    try {
      const ld = JSON.parse(match[1]);
      if (ld['@type'] === 'LocalBusiness' || ld['@type']?.includes?.('Business')) {
        if (ld.name) data.name = ld.name;
        if (ld.address?.streetAddress) {
          data.address = `${ld.address.streetAddress}, ${ld.address.postalCode || ''} ${ld.address.addressLocality || ''}`.trim();
        }
        if (ld.telephone) data.phone = ld.telephone;
        if (ld.url) data.website = ld.url;
        if (ld.aggregateRating?.ratingValue) data.rating = parseFloat(ld.aggregateRating.ratingValue);
        if (ld.aggregateRating?.reviewCount) data.reviewCount = parseInt(ld.aggregateRating.reviewCount);
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  // === 3. Extract from embedded Google Maps JavaScript data ===
  // Google Maps is a SPA — the real data is in script tags as nested JS arrays

  // Collect all script content for pattern matching
  const scriptParts: string[] = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRegex.exec(html)) !== null) {
    if (sm[1].length > 100) scriptParts.push(sm[1]);
  }
  const allScripts = scriptParts.join('\n');

  // Try to parse APP_INITIALIZATION_STATE for rich data
  tryParseAppState(html, data);

  // === 4. Rating fallbacks from embedded data ===
  if (!data.rating) {
    const ratingPatterns = [
      /\\"ratingValue\\":\s*\\"?(\d[.,]\d)\d*/,
      /\\"average_rating\\":\s*(\d[.,]\d)/,
      /\[(\d\.\d)\d*,\s*\d+,\s*null/,
      /aria-label=\\"(\d[.,]\d)/,
      /(\d[.,]\d)\s*(?:Sterne|stars|von\s*5)/i,
      /"ratingValue"[:\s]*"?(\d[.,]\d)"?/i,
    ];
    for (const p of ratingPatterns) {
      const m = allScripts.match(p) || html.match(p);
      if (m) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (val >= 1.0 && val <= 5.0) {
          data.rating = val;
          break;
        }
      }
    }
  }

  // === 5. Review count fallbacks ===
  if (!data.reviewCount) {
    const reviewPatterns = [
      /(\d[\d.,]*)\s*(?:Rezensionen|Bewertungen|reviews|Google[- ]?Rezensionen)/i,
      /\\"reviewCount\\":\s*\\"?(\d+)/,
      /\\"user_ratings_total\\":\s*(\d+)/,
      /"reviewCount"[:\s]*"?(\d+)"?/i,
      /(\d+)\s*(?:Rezension(?:en)?|review(?:s)?)/i,
    ];
    for (const p of reviewPatterns) {
      const m = html.match(p) || allScripts.match(p);
      if (m) {
        const count = parseInt(m[1].replace(/[.,]/g, ''));
        if (count > 0 && count < 1000000) {
          data.reviewCount = count;
          break;
        }
      }
    }
  }

  // === 6. Phone fallbacks ===
  if (!data.phone) {
    const phonePatterns = [
      /\\"formatted_phone_number\\":\s*\\"([^"\\]+)\\"/,
      /\\"telephone\\":\s*\\"([^"\\]+)\\"/,
      /(\+49[\s\-]?\(?\d{2,5}\)?[\s\-]?\d{3,10})/,
      /(0\d{2,4}[\s\-\/]\d{3,10})/,
      /tel:(\+?\d[\d\s\-]{8,})/i,
    ];
    for (const p of phonePatterns) {
      const m = html.match(p) || allScripts.match(p);
      if (m) {
        data.phone = m[1].replace(/\\/g, '').trim();
        break;
      }
    }
  }

  // === 7. Website fallbacks ===
  if (!data.website) {
    const websitePatterns = [
      /\\"website\\":\s*\\"(https?:\/\/[^"\\]+)\\"/,
      /\\"url\\":\s*\\"(https?:\/\/[^"\\]+)\\"/,
    ];
    for (const p of websitePatterns) {
      const m = allScripts.match(p);
      if (m) {
        const websiteUrl = m[1].replace(/\\/g, '');
        try {
          const hostname = new URL(websiteUrl).hostname;
          if (!GOOGLE_DOMAINS.test(hostname)) {
            data.website = websiteUrl;
            break;
          }
        } catch { /* skip invalid URLs */ }
      }
    }

    // Broader search: look for non-Google URLs in the embedded data
    if (!data.website) {
      const urlRegex = /"(https?:\/\/[a-zA-Z0-9][\w.-]+\.[a-z]{2,}[^"\\]*)"/g;
      let urlMatch;
      while ((urlMatch = urlRegex.exec(allScripts)) !== null) {
        const m = urlMatch;
        try {
          const hostname = new URL(m[1]).hostname;
          if (!GOOGLE_DOMAINS.test(hostname) && !hostname.includes('gstatic') && !hostname.includes('googleapis')) {
            data.website = m[1];
            break;
          }
        } catch { /* skip */ }
      }
    }
  }

  // === 8. Category fallbacks ===
  if (!data.category) {
    const catPatterns = [
      /\\"category\\":\s*\\"([^"\\]+)\\"/i,
      /\\"primaryCategory\\":\s*\\"([^"\\]+)\\"/i,
      /"category":\s*"([^"]+)"/i,
    ];
    for (const p of catPatterns) {
      const m = allScripts.match(p);
      if (m) {
        data.category = m[1].replace(/\\/g, '');
        break;
      }
    }
  }

  // === 9. Photo count fallbacks ===
  if (!data.photoCount) {
    const photoPatterns = [
      /(\d+)\s*(?:Fotos|Foto|photos?)/i,
      /\\"photo_count\\":\s*(\d+)/,
    ];
    for (const p of photoPatterns) {
      const m = html.match(p) || allScripts.match(p);
      if (m) {
        const count = parseInt(m[1]);
        if (count > 0 && count < 100000) {
          data.photoCount = count;
          break;
        }
      }
    }
  }

  return data;
}

/**
 * Parse Google Maps APP_INITIALIZATION_STATE for rich business data.
 * This variable contains the initial state of the Maps SPA as nested arrays.
 */
function tryParseAppState(html: string, data: GmbData): void {
  try {
    // The APP_INITIALIZATION_STATE contains data at index [3][2] as a string
    // that starts with )]}'\n followed by a JSON array with all business data
    const stateMatch = html.match(/window\.APP_INITIALIZATION_STATE\s*=\s*(\[[\s\S]*?\]);\s*(?:window\.|var\s|<\/script>)/);
    if (!stateMatch) return;

    // The state is a JS array — try to parse the data payload at [3][2]
    // We can't reliably JSON.parse the whole thing since it may contain JS expressions,
    // so extract the inner data string directly
    const stateStr = stateMatch[1];

    // Find the data payload — it's a long string embedded in the state
    // Pattern: ;data:["...long data string..."]
    // The payload starts with )]}' followed by a newline and JSON
    const payloadMatch = stateStr.match(/\)]\}'\n([\s\S]+)/);
    if (!payloadMatch) return;

    // Try to find the place data array in the payload
    // The place data is typically in a deeply nested array
    const payload = payloadMatch[1];

    // Extract specific fields from the nested data using patterns
    // Rating: typically at a known position as a float
    if (!data.rating) {
      // Look for rating pattern: ,X.Y, where X is 1-5
      const ratingMatch = payload.match(/,(\d\.\d)\d*,\d+,null,null,null,null,null,null/);
      if (ratingMatch) {
        const val = parseFloat(ratingMatch[1]);
        if (val >= 1.0 && val <= 5.0) data.rating = val;
      }
    }
  } catch {
    // APP_INITIALIZATION_STATE parsing is best-effort
  }
}

function analyzeGmbProfile(data: GmbData): GmbData {
  const issues: GmbIssue[] = [];
  let score = 100;

  // 1. Rating Analysis
  if (data.rating === 0) {
    issues.push({
      label: 'Keine Bewertungen',
      severity: 'critical',
      description: 'Das Profil hat noch keine Google-Bewertungen.',
      recommendation: 'Bitten Sie zufriedene Kunden aktiv um eine Bewertung. Senden Sie nach Abschluss eines Auftrags einen direkten Link zum Bewertungsformular.',
    });
    score -= 25;
  } else if (data.rating < 4.0) {
    issues.push({
      label: `Bewertung unter 4.0 (${data.rating})`,
      severity: 'critical',
      description: `Mit ${data.rating} Sternen liegt die Bewertung unter dem Branchendurchschnitt. Kunden wählen bevorzugt Betriebe mit 4.5+ Sternen.`,
      recommendation: 'Reagieren Sie professionell auf negative Bewertungen und bitten Sie zufriedene Kunden um Bewertungen. Ein Anstieg auf 4.5+ erhöht die Klickrate um bis zu 35%.',
    });
    score -= 20;
  } else if (data.rating < 4.5) {
    issues.push({
      label: `Bewertung verbesserungswürdig (${data.rating})`,
      severity: 'minor',
      description: `${data.rating} Sterne sind solide, aber Top-Betriebe in der Region haben 4.7+.`,
      recommendation: 'Kontinuierlich Bewertungen sammeln. Jede 5-Sterne-Bewertung hebt den Schnitt.',
    });
    score -= 5;
  }

  // 2. Review Count
  if (data.reviewCount === 0) {
    // Already covered above
  } else if (data.reviewCount < 10) {
    issues.push({
      label: `Zu wenige Bewertungen (${data.reviewCount})`,
      severity: 'major',
      description: `${data.reviewCount} Bewertungen sind nicht genug, um Vertrauen aufzubauen. Mindestens 20-30 Bewertungen sollten es sein.`,
      recommendation: 'Starten Sie eine systematische Bewertungskampagne. Nach jedem Auftrag eine freundliche SMS/WhatsApp mit dem direkten Bewertungslink senden.',
    });
    score -= 15;
  } else if (data.reviewCount < 30) {
    issues.push({
      label: `Bewertungsanzahl ausbaubar (${data.reviewCount})`,
      severity: 'minor',
      description: `${data.reviewCount} Bewertungen sind ein guter Anfang. Die Top-Konkurrenz hat oft 50+.`,
      recommendation: 'Regelmäßig neue Bewertungen sammeln. Google bevorzugt Profile mit stetigem Bewertungsfluss.',
    });
    score -= 5;
  }

  // 3. Photos
  if (data.photoCount === 0) {
    issues.push({
      label: 'Keine Fotos vorhanden',
      severity: 'major',
      description: 'Profile ohne Fotos werden 42% weniger geklickt als Profile mit Fotos.',
      recommendation: 'Laden Sie mindestens 10 Fotos hoch: Logo, Team, Fahrzeuge, abgeschlossene Projekte (vorher/nachher), Werkstatt/Büro.',
    });
    score -= 15;
  } else if (data.photoCount < 10) {
    issues.push({
      label: `Wenige Fotos (${data.photoCount})`,
      severity: 'minor',
      description: 'Mehr Fotos = mehr Vertrauen. Google bevorzugt Profile mit regelmäßig neuen Fotos.',
      recommendation: 'Laden Sie regelmäßig neue Projektfotos hoch. Ideal: 1-2 neue Fotos pro Woche.',
    });
    score -= 5;
  }

  // 4. Website
  if (!data.website) {
    issues.push({
      label: 'Keine Website verlinkt',
      severity: 'critical',
      description: 'Ohne verlinkte Website verlieren Sie potenzielle Kunden, die mehr erfahren möchten.',
      recommendation: 'Eine moderne, mobiloptimierte Website erstellen und im Google Business Profil verlinken.',
    });
    score -= 20;
  }

  // 5. Phone
  if (!data.phone) {
    issues.push({
      label: 'Keine Telefonnummer',
      severity: 'major',
      description: 'Kunden in Notfällen (Rohrbruch, Heizungsausfall) rufen direkt an. Ohne Nummer verlieren Sie diese Aufträge.',
      recommendation: 'Hinterlegen Sie eine gut erreichbare Telefonnummer. Ideal: Mobilnummer für Notfälle.',
    });
    score -= 10;
  }

  // 6. Category
  if (!data.category) {
    issues.push({
      label: 'Kategorie nicht erkennbar',
      severity: 'minor',
      description: 'Die Geschäftskategorie konnte nicht ermittelt werden. Eine klare Kategorie verbessert die lokale Auffindbarkeit.',
      recommendation: 'Wählen Sie die passendste Hauptkategorie (z.B. "Klempner", "Heizungsbauer") und ergänzen Sie sekundäre Kategorien.',
    });
    score -= 5;
  }

  // 7. Address
  if (!data.address) {
    issues.push({
      label: 'Adresse nicht erkennbar',
      severity: 'minor',
      description: 'Die Geschäftsadresse konnte nicht aus dem Profil ermittelt werden.',
      recommendation: 'Stellen Sie sicher, dass Ihre vollständige Adresse im GMB-Profil hinterlegt ist.',
    });
    score -= 5;
  }

  // General recommendations (always add)
  if (issues.length === 0) {
    issues.push({
      label: 'Profil sieht solide aus',
      severity: 'info',
      description: 'Grundlegende Daten sind vorhanden. Es gibt aber immer Optimierungspotenzial.',
      recommendation: 'Regelmäßig Google Posts veröffentlichen, auf Bewertungen antworten und Fotos hochladen.',
    });
  }

  // Always add these best-practice recommendations
  issues.push({
    label: 'Google Beiträge (Posts)',
    severity: 'info',
    description: 'Regelmäßige Google Posts erhöhen die Sichtbarkeit um bis zu 30%. Die meisten Handwerksbetriebe nutzen diese Funktion nicht.',
    recommendation: 'Veröffentlichen Sie wöchentlich einen Post: Projekte, Angebote, Tipps (z.B. "5 Zeichen dass Ihre Heizung gewartet werden muss").',
  });

  issues.push({
    label: 'Auf Bewertungen antworten',
    severity: 'info',
    description: 'Google bevorzugt Profile, die auf Bewertungen antworten. Antwortrate sollte bei 100% liegen.',
    recommendation: 'Antworten Sie auf JEDE Bewertung – positiv und negativ. Bei negativen: sachlich, lösungsorientiert, nie persönlich.',
  });

  score = Math.max(0, Math.min(100, score));

  return {
    ...data,
    issues,
    score,
  };
}
