/**
 * Stadtteile (districts) for major cities in NRW / Ruhrgebiet.
 *
 * Used by the "Tiefenscan" feature to split a city search into
 * many district-level searches, bypassing the Google Places API
 * 60-result-per-query limit.
 */

export const STADTTEILE: Record<string, string[]> = {
  Essen: [
    'Essen-Altendorf', 'Essen-Altenessen', 'Essen-Bergerhausen', 'Essen-Borbeck',
    'Essen-Bredeney', 'Essen-Burgaltendorf', 'Essen-Dellwig', 'Essen-Fischlaken',
    'Essen-Freisenbruch', 'Essen-Frillendorf', 'Essen-Frintrop', 'Essen-Haarzopf',
    'Essen-Heisingen', 'Essen-Holsterhausen', 'Essen-Horst', 'Essen-Huttrop',
    'Essen-Katernberg', 'Essen-Kettwig', 'Essen-Kray', 'Essen-Kupferdreh',
    'Essen-Leithe', 'Essen-Margarethenhöhe', 'Essen-Rellinghausen', 'Essen-Rüttenscheid',
    'Essen-Schonnebeck', 'Essen-Stadtwald', 'Essen-Steele', 'Essen-Stoppenberg',
    'Essen-Überruhr', 'Essen-Werden',
  ],

  Dortmund: [
    'Dortmund-Aplerbeck', 'Dortmund-Brackel', 'Dortmund-Brünninghausen', 'Dortmund-Dorstfeld',
    'Dortmund-Eving', 'Dortmund-Hörde', 'Dortmund-Hombruch', 'Dortmund-Huckarde',
    'Dortmund-Innenstadt', 'Dortmund-Kirchhörde', 'Dortmund-Körne', 'Dortmund-Lütgendortmund',
    'Dortmund-Mengede', 'Dortmund-Mitte', 'Dortmund-Scharnhorst', 'Dortmund-Schüren',
    'Dortmund-Wickede', 'Dortmund-Barop', 'Dortmund-Berghofen', 'Dortmund-Brechten',
    'Dortmund-Asseln', 'Dortmund-Husen', 'Dortmund-Lücklemberg', 'Dortmund-Wellinghofen',
  ],

  Bochum: [
    'Bochum-Altenbochum', 'Bochum-Dahlhausen', 'Bochum-Ehrenfeld', 'Bochum-Gerthe',
    'Bochum-Grumme', 'Bochum-Hamme', 'Bochum-Harpen', 'Bochum-Hiltrop',
    'Bochum-Hofstede', 'Bochum-Langendreer', 'Bochum-Laer', 'Bochum-Linden',
    'Bochum-Querenburg', 'Bochum-Riemke', 'Bochum-Stiepel', 'Bochum-Wattenscheid',
    'Bochum-Weitmar', 'Bochum-Werne', 'Bochum-Wiemelhausen',
  ],

  Duisburg: [
    'Duisburg-Alt-Hamborn', 'Duisburg-Baerl', 'Duisburg-Beeck', 'Duisburg-Buchholz',
    'Duisburg-Dellviertel', 'Duisburg-Großenbaum', 'Duisburg-Hamborn', 'Duisburg-Hochemmerich',
    'Duisburg-Hochfeld', 'Duisburg-Homberg', 'Duisburg-Huckingen', 'Duisburg-Laar',
    'Duisburg-Marxloh', 'Duisburg-Meiderich', 'Duisburg-Mitte', 'Duisburg-Mündelheim',
    'Duisburg-Neudorf', 'Duisburg-Neumühl', 'Duisburg-Rheinhausen', 'Duisburg-Ruhrort',
    'Duisburg-Walsum', 'Duisburg-Wanheimerort', 'Duisburg-Wedau',
  ],

  Düsseldorf: [
    'Düsseldorf-Altstadt', 'Düsseldorf-Benrath', 'Düsseldorf-Bilk', 'Düsseldorf-Derendorf',
    'Düsseldorf-Düsseltal', 'Düsseldorf-Eller', 'Düsseldorf-Flingern', 'Düsseldorf-Friedrichstadt',
    'Düsseldorf-Garath', 'Düsseldorf-Gerresheim', 'Düsseldorf-Golzheim', 'Düsseldorf-Grafenberg',
    'Düsseldorf-Hassels', 'Düsseldorf-Heerdt', 'Düsseldorf-Holthausen', 'Düsseldorf-Kaiserswerth',
    'Düsseldorf-Lierenfeld', 'Düsseldorf-Lörick', 'Düsseldorf-Mörsenbroich', 'Düsseldorf-Oberbilk',
    'Düsseldorf-Oberkassel', 'Düsseldorf-Pempelfort', 'Düsseldorf-Rath', 'Düsseldorf-Reisholz',
    'Düsseldorf-Stockum', 'Düsseldorf-Unterbach', 'Düsseldorf-Unterbilk', 'Düsseldorf-Urdenbach',
    'Düsseldorf-Vennhausen', 'Düsseldorf-Wersten',
  ],

  Köln: [
    'Köln-Altstadt', 'Köln-Bayenthal', 'Köln-Bickendorf', 'Köln-Braunsfeld',
    'Köln-Chorweiler', 'Köln-Deutz', 'Köln-Ehrenfeld', 'Köln-Höhenberg',
    'Köln-Junkersdorf', 'Köln-Kalk', 'Köln-Klettenberg', 'Köln-Lindenthal',
    'Köln-Longerich', 'Köln-Merheim', 'Köln-Mülheim', 'Köln-Neuehrenfeld',
    'Köln-Nippes', 'Köln-Ossendorf', 'Köln-Pesch', 'Köln-Poll',
    'Köln-Porz', 'Köln-Raderthal', 'Köln-Rodenkirchen', 'Köln-Sülz',
    'Köln-Vingst', 'Köln-Weidenpesch', 'Köln-Weiden', 'Köln-Zollstock',
  ],

  Gelsenkirchen: [
    'Gelsenkirchen-Altstadt', 'Gelsenkirchen-Bismarck', 'Gelsenkirchen-Buer',
    'Gelsenkirchen-Erle', 'Gelsenkirchen-Feldmark', 'Gelsenkirchen-Hassel',
    'Gelsenkirchen-Heßler', 'Gelsenkirchen-Horst', 'Gelsenkirchen-Neustadt',
    'Gelsenkirchen-Resse', 'Gelsenkirchen-Rotthausen', 'Gelsenkirchen-Schalke',
    'Gelsenkirchen-Scholven', 'Gelsenkirchen-Ückendorf',
  ],

  Oberhausen: [
    'Oberhausen-Alstaden', 'Oberhausen-Borbeck', 'Oberhausen-Dümpten',
    'Oberhausen-Holten', 'Oberhausen-Lirich', 'Oberhausen-Neue Mitte',
    'Oberhausen-Osterfeld', 'Oberhausen-Schmachtendorf', 'Oberhausen-Sterkrade',
    'Oberhausen-Styrum', 'Oberhausen-Tackenberg',
  ],

  Mülheim: [
    'Mülheim-Altstadt', 'Mülheim-Broich', 'Mülheim-Dümpten', 'Mülheim-Heißen',
    'Mülheim-Holthausen', 'Mülheim-Menden', 'Mülheim-Mintard', 'Mülheim-Saarn',
    'Mülheim-Speldorf', 'Mülheim-Stadtmitte', 'Mülheim-Styrum',
  ],

  Herne: [
    'Herne-Baukau', 'Herne-Börnig', 'Herne-Constantin', 'Herne-Crange',
    'Herne-Eickel', 'Herne-Holsterhausen', 'Herne-Horsthausen', 'Herne-Mitte',
    'Herne-Röhlinghausen', 'Herne-Sodingen', 'Herne-Wanne',
  ],
};

/**
 * Expand a city name into its Stadtteile.
 * Returns the Stadtteile array if found, otherwise returns the city as-is.
 */
export function expandCityToStadtteile(city: string): string[] {
  return STADTTEILE[city] || [city];
}

/**
 * Get the total number of Stadtteile for given cities.
 */
export function countStadtteile(cities: string[]): number {
  return cities.reduce((sum, city) => sum + (STADTTEILE[city]?.length || 1), 0);
}
