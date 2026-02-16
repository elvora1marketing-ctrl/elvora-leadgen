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
        const redirectRes = await fetch(url, { redirect: 'follow' });
        resolvedUrl = redirectRes.url;
      } catch {
        // Use original URL if redirect fails
      }
    }

    // Fetch the Google Maps page
    const response = await fetch(resolvedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Google Maps Seite konnte nicht geladen werden' }, { status: 502 });
    }

    const html = await response.text();

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

  // Extract business name from title or meta
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    // Google Maps titles: "Business Name - Google Maps"
    data.name = titleMatch[1].replace(/\s*[-–]\s*Google\s*(Maps|Karten).*$/i, '').trim();
  }

  // Try meta og:title
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
    || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    data.name = ogTitleMatch[1].replace(/\s*[-–]\s*Google\s*(Maps|Karten).*$/i, '').trim();
  }

  // Extract from structured data / JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const ld = JSON.parse(match[1]);
      if (ld['@type'] === 'LocalBusiness' || ld['@type']?.includes?.('Business')) {
        if (ld.name) data.name = ld.name;
        if (ld.address?.streetAddress) data.address = `${ld.address.streetAddress}, ${ld.address.postalCode || ''} ${ld.address.addressLocality || ''}`.trim();
        if (ld.telephone) data.phone = ld.telephone;
        if (ld.url) data.website = ld.url;
        if (ld.aggregateRating?.ratingValue) data.rating = parseFloat(ld.aggregateRating.ratingValue);
        if (ld.aggregateRating?.reviewCount) data.reviewCount = parseInt(ld.aggregateRating.reviewCount);
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  // Extract rating from page content patterns
  if (!data.rating) {
    // Pattern: "4,5" or "4.5" near stars/rating context
    const ratingMatch = html.match(/(\d[.,]\d)\s*(?:Sterne|stars|von\s*5)/i)
      || html.match(/"ratingValue"[:\s]*"?(\d[.,]\d)"?/i)
      || html.match(/aria-label="(\d[.,]\d)\s/i);
    if (ratingMatch) {
      data.rating = parseFloat(ratingMatch[1].replace(',', '.'));
    }
  }

  // Extract review count
  if (!data.reviewCount) {
    const reviewMatch = html.match(/(\d+(?:[.,]\d+)?)\s*(?:Rezensionen|Bewertungen|reviews)/i)
      || html.match(/"reviewCount"[:\s]*"?(\d+)"?/i);
    if (reviewMatch) {
      data.reviewCount = parseInt(reviewMatch[1].replace(/[.,]/g, ''));
    }
  }

  // Extract phone
  if (!data.phone) {
    const phoneMatch = html.match(/(\+49[\s\-]?\d{2,5}[\s\-]?\d{4,10})/);
    if (phoneMatch) data.phone = phoneMatch[1];
  }

  // Extract category
  const categoryMatch = html.match(/"category"[:\s]*"([^"]+)"/i)
    || html.match(/aria-label="[^"]*"\s+data-tooltip="([^"]+)"/i);
  if (categoryMatch) data.category = categoryMatch[1];

  // Extract address from meta
  if (!data.address) {
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
      || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i);
    if (ogDescMatch) {
      // OG description often contains the address
      const descParts = ogDescMatch[1].split('·');
      if (descParts.length > 1) {
        data.address = descParts[descParts.length - 1].trim();
        if (!data.category && descParts.length > 0) {
          data.category = descParts[0].replace(/★.*$/, '').trim();
        }
      }
    }
  }

  // Count photos (approximate from page data)
  const photoMatch = html.match(/(\d+)\s*(?:Fotos|photos)/i);
  if (photoMatch) data.photoCount = parseInt(photoMatch[1]);

  return data;
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
