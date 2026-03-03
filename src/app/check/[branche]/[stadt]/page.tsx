import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import CheckPageClient from './CheckPageClient';

// Slug → Display name mapping for known German terms
const KNOWN_NAMES: Record<string, string> = {
  'sanitaer': 'Sanitär', 'heizung': 'Heizung', 'klempner': 'Klempner',
  'shk': 'SHK', 'elektriker': 'Elektriker', 'elektro': 'Elektro',
  'maler': 'Maler', 'dachdecker': 'Dachdecker', 'tischler': 'Tischler',
  'schreiner': 'Schreiner', 'zimmerer': 'Zimmerer', 'fliesenleger': 'Fliesenleger',
  'gartenbau': 'Gartenbau', 'landschaftsbau': 'Landschaftsbau',
  'schluesselservice': 'Schlüsselservice', 'schluesseldienst': 'Schlüsseldienst',
  'installateur': 'Installateur', 'klimatechnik': 'Klimatechnik',
  'kaelteanlagenbau': 'Kälteanlagenbau', 'lueftung': 'Lüftung',
  'baecker': 'Bäcker', 'metzger': 'Metzger', 'friseur': 'Friseur',
  'kfz': 'KFZ', 'autowerkstatt': 'Autowerkstatt',
};

function slugToDisplay(slug: string): string {
  // Check known names first
  if (KNOWN_NAMES[slug]) return KNOWN_NAMES[slug];
  // Capitalize first letter as fallback
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

function getBrancheLabel(branche: string): string {
  const display = slugToDisplay(branche);
  // Add "betriebe" suffix for common trade terms
  const suffix = ['Sanitär', 'Heizung', 'Elektro', 'SHK', 'KFZ'].includes(display)
    ? 'betriebe'
    : '';
  return display + suffix;
}

interface PageProps {
  params: Promise<{ branche: string; stadt: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { branche, stadt } = await params;
  const brancheLabel = getBrancheLabel(branche);
  const stadtLabel = slugToDisplay(stadt);

  const title = `Kostenloser Website-Check für ${brancheLabel} in ${stadtLabel} | Elvora`;
  const description = `Testen Sie Ihre Website kostenlos. Wir analysieren Ladezeit, SEO, Mobilfreundlichkeit, Sicherheit und mehr für ${brancheLabel} in ${stadtLabel}. Ergebnis in 30 Sekunden.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'de_DE',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CheckPage({ params }: PageProps) {
  const { branche, stadt } = await params;
  const brancheDisplay = slugToDisplay(branche);
  const stadtDisplay = slugToDisplay(stadt);
  const brancheLabel = getBrancheLabel(branche);

  // Get calendly URL from settings
  let calendlyUrl = 'https://calendly.com/elvora-meeting/30min';
  try {
    const db = getDb();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'calendly_url'").get() as { value: string } | undefined;
    if (setting?.value) calendlyUrl = setting.value;

    // Track page view
    db.prepare(`
      INSERT INTO check_page_stats (branche, stadt, branche_slug, stadt_slug, views)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(branche_slug, stadt_slug)
      DO UPDATE SET views = views + 1
    `).run(brancheDisplay, stadtDisplay, branche, stadt);
  } catch (e) {
    console.error('[Check Page] Settings/tracking error:', e);
  }

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Website-Check für ${brancheLabel} in ${stadtDisplay}`,
    description: `Kostenloser Website-Check für ${brancheLabel} in ${stadtDisplay}`,
    provider: {
      '@type': 'Organization',
      name: 'Elvora',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CheckPageClient
        branche={branche}
        stadt={stadt}
        brancheDisplay={brancheDisplay}
        stadtDisplay={stadtDisplay}
        brancheLabel={brancheLabel}
        calendlyUrl={calendlyUrl}
      />
    </>
  );
}
