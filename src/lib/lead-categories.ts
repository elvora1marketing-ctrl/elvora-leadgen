export interface CategoryMapping {
  id: string;
  name: string;
  keywords: string[];
}

export const CATEGORIES: CategoryMapping[] = [
  {
    id: 'handwerk',
    name: 'Handwerk',
    keywords: [
      'elektriker', 'elektro', 'elektrik', 'elektroinstallation', 'elektrotechnik',
      'klempner', 'sanitär', 'heizung', 'shk', 'installateur',
      'maler', 'malerbetrieb', 'lackierer', 'anstreicher',
      'dachdecker', 'dach', 'bedachung',
      'schreiner', 'tischler', 'möbel', 'holz',
      'schlosser', 'metallbau', 'schweißer',
      'fliesenleger', 'fliesen', 'bodenleger',
      'maurer', 'maurerarbeiten', 'trockenbau',
      'zimmerer', 'zimmermann', 'holzbau',
      'glaser', 'glaserei',
      'stuckateur', 'putz', 'verputzer',
      'kfz', 'autowerkstatt', 'auto', 'mechaniker', 'karosserie',
      'gärtner', 'garten', 'landschaftsbau', 'gartenbau', 'galabau',
      'gebäudereinigung', 'reinigung', 'reinigungsfirma',
      'umzug', 'umzugsunternehmen', 'transport',
      'hausmeister', 'facility', 'gebäudemanagement',
      'rollladen', 'jalousie', 'sonnenschutz', 'markise',
      'aufzug', 'fahrstuhl', 'lift',
      'klimaanlage', 'klima', 'kältetechnik', 'lüftung',
      'photovoltaik', 'solar', 'solaranlage', 'pv',
      'brandschutz', 'feuerlöscher',
      'schlüsseldienst', 'sicherheitstechnik',
    ],
  },
  {
    id: 'gesundheit',
    name: 'Gesundheit & Medizin',
    keywords: [
      'zahnarzt', 'zahnklinik', 'dental', 'kieferorthopäde', 'zahnmedizin',
      'arzt', 'praxis', 'hausarzt', 'allgemeinarzt', 'facharzt',
      'physiotherapie', 'physiotherapeut', 'krankengymnastik',
      'orthopäde', 'orthopädie',
      'augenarzt', 'optiker', 'optik',
      'hno', 'hals-nasen-ohren',
      'dermatologie', 'hautarzt',
      'psychotherapie', 'psychologe', 'therapeut',
      'heilpraktiker', 'naturheilkunde', 'alternativmedizin',
      'osteopathie', 'osteopath', 'chiropraktik',
      'logopädie', 'logopäde', 'sprachtherapie',
      'ergotherapie', 'ergotherapeut',
      'apotheke', 'pharma',
      'pflegedienst', 'pflege', 'altenpflege', 'ambulant',
      'tierarzt', 'tierarztpraxis', 'tierklinik', 'veterinär',
      'labor', 'labormedizin',
      'radiologie', 'röntgen', 'mrt',
      'kardiologe', 'kardiologie', 'herz',
      'urologie', 'urologe',
      'gynäkologie', 'frauenarzt', 'gynäkologe',
    ],
  },
  {
    id: 'recht',
    name: 'Recht & Finanzen',
    keywords: [
      'rechtsanwalt', 'anwalt', 'kanzlei', 'anwaltskanzlei', 'rechtsanwälte',
      'notar', 'notariat',
      'steuerberater', 'steuerbüro', 'steuerberatung', 'buchhalter',
      'wirtschaftsprüfer', 'wirtschaftsprüfung',
      'unternehmensberater', 'unternehmensberatung', 'consulting',
      'finanzberater', 'finanzberatung', 'vermögensberatung',
      'versicherung', 'versicherungsmakler', 'makler',
      'immobilien', 'immobilienmakler', 'hausverwaltung',
      'inkasso', 'schuldnerberatung',
      'patentanwalt', 'patent',
    ],
  },
  {
    id: 'gastronomie',
    name: 'Gastronomie & Hotellerie',
    keywords: [
      'restaurant', 'gaststätte', 'gasthaus', 'gasthof',
      'café', 'cafe', 'bäckerei', 'konditorei',
      'hotel', 'pension', 'ferienwohnung', 'unterkunft',
      'catering', 'partyservice', 'eventcatering',
      'imbiss', 'döner', 'pizza', 'lieferservice',
      'bar', 'kneipe', 'biergarten', 'lounge',
      'metzger', 'metzgerei', 'fleischerei', 'fleischer',
    ],
  },
  {
    id: 'it',
    name: 'IT & Digital',
    keywords: [
      'webdesign', 'webentwicklung', 'webdesigner', 'webagentur',
      'seo', 'online-marketing', 'onlinemarketing', 'digitalmarketing',
      'it-service', 'it-dienstleister', 'systemhaus', 'edv',
      'softwareentwicklung', 'software', 'app', 'programmierung',
      'werbeagentur', 'agentur', 'kreativagentur', 'marketingagentur',
      'grafikdesign', 'grafik', 'designer', 'design',
      'fotograf', 'fotografie', 'fotostudio',
      'videoproduktion', 'film', 'video', 'kameramann',
      'druck', 'druckerei', 'printmedien', 'werbetechnik',
      'social media', 'socialmedia',
    ],
  },
  {
    id: 'bildung',
    name: 'Bildung & Coaching',
    keywords: [
      'fahrschule', 'fahrlehrer',
      'nachhilfe', 'lernhilfe', 'tutor',
      'musikschule', 'musik', 'musiklehrer',
      'tanzschule', 'tanz',
      'coaching', 'coach', 'trainer', 'personaltrainer',
      'fitness', 'fitnessstudio', 'gym', 'sport',
      'yoga', 'pilates', 'meditation',
      'sprachschule', 'sprachkurs', 'dolmetscher', 'übersetzer',
      'kindergarten', 'kita', 'kinderbetreuung',
      'hundeschule', 'hundetrainer',
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Wellness',
    keywords: [
      'friseur', 'frisör', 'haare', 'friseursalon', 'barbershop', 'barber',
      'kosmetik', 'kosmetikstudio', 'beauty', 'schönheitspflege',
      'nagelstudio', 'nägel', 'maniküre', 'nail',
      'tattoo', 'tattoostudio', 'piercing',
      'massage', 'massagepraxis', 'spa', 'wellness', 'sauna',
      'sonnenstudio', 'solarium',
    ],
  },
  {
    id: 'bau',
    name: 'Bau & Architektur',
    keywords: [
      'architekt', 'architektur', 'architekturbüro',
      'bauunternehmen', 'baufirma', 'bauunternehmung', 'hochbau', 'tiefbau',
      'statiker', 'statik', 'ingenieur', 'ingenieurbüro',
      'vermessung', 'vermessungsbüro', 'geodäsie',
      'abbruch', 'abriss', 'entsorgung', 'container',
      'gerüstbau', 'gerüst',
      'pflasterarbeiten', 'pflasterer', 'straßenbau',
      'betonbau', 'beton', 'fertigbau',
      'innenarchitekt', 'innenausbau', 'raumausstatter',
      'küchenstudio', 'küche', 'einbauküche',
    ],
  },
  {
    id: 'handel',
    name: 'Handel & Einzelhandel',
    keywords: [
      'blumen', 'blumenladen', 'florist', 'gärtnerei',
      'möbelhaus', 'einrichtung', 'einrichtungshaus',
      'elektromarkt', 'elektronik', 'computer', 'pc',
      'buchhandlung', 'bücher',
      'spielwaren', 'spielzeug',
      'baustoffhandel', 'baustoffe', 'baumarkt',
      'getränkemarkt', 'getränke', 'getränkehandel',
      'autozubehör', 'autoteile', 'reifen', 'reifenhändler',
      'schmuck', 'juwelier', 'goldschmied',
      'textil', 'mode', 'bekleidung', 'boutique',
    ],
  },
];

export function detectCategory(keyword: string): string | null {
  const kw = keyword.toLowerCase().trim();

  for (const cat of CATEGORIES) {
    for (const term of cat.keywords) {
      if (kw.includes(term) || term.includes(kw)) {
        return cat.id;
      }
    }
  }

  return null;
}

export function getCategoryName(categoryId: string): string {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat?.name || categoryId;
}
