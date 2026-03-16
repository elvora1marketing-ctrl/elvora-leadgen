/**
 * Umkreissuche (radius search) for NRW cities.
 *
 * Contains coordinates for cities in NRW and a function to find
 * nearby cities within a given radius using the Haversine formula.
 */

interface CityCoord {
  name: string;
  lat: number;
  lng: number;
}

/** Coordinates for cities in NRW (Nordrhein-Westfalen) */
export const NRW_CITIES: CityCoord[] = [
  // Main cities (already in the app)
  { name: 'Essen', lat: 51.4556, lng: 7.0116 },
  { name: 'Dortmund', lat: 51.5136, lng: 7.4653 },
  { name: 'Bochum', lat: 51.4818, lng: 7.2162 },
  { name: 'Duisburg', lat: 51.4344, lng: 6.7624 },
  { name: 'Düsseldorf', lat: 51.2277, lng: 6.7735 },
  { name: 'Köln', lat: 50.9375, lng: 6.9603 },
  { name: 'Gelsenkirchen', lat: 51.5178, lng: 7.0857 },
  { name: 'Oberhausen', lat: 51.4696, lng: 6.8516 },
  { name: 'Mülheim', lat: 51.4272, lng: 6.8825 },
  { name: 'Herne', lat: 51.5369, lng: 7.2211 },

  // Additional NRW cities
  { name: 'Wuppertal', lat: 51.2562, lng: 7.1508 },
  { name: 'Bonn', lat: 50.7374, lng: 7.0982 },
  { name: 'Münster', lat: 51.9607, lng: 7.6261 },
  { name: 'Bielefeld', lat: 52.0302, lng: 8.5325 },
  { name: 'Aachen', lat: 50.7753, lng: 6.0839 },
  { name: 'Krefeld', lat: 51.3388, lng: 6.5853 },
  { name: 'Mönchengladbach', lat: 51.1805, lng: 6.4428 },
  { name: 'Hagen', lat: 51.3671, lng: 7.4633 },
  { name: 'Hamm', lat: 51.6739, lng: 7.8160 },
  { name: 'Solingen', lat: 51.1652, lng: 7.0671 },
  { name: 'Leverkusen', lat: 51.0459, lng: 6.9844 },
  { name: 'Remscheid', lat: 51.1787, lng: 7.1896 },
  { name: 'Moers', lat: 51.4516, lng: 6.6226 },
  { name: 'Neuss', lat: 51.1985, lng: 6.6919 },
  { name: 'Paderborn', lat: 51.7189, lng: 8.7544 },
  { name: 'Recklinghausen', lat: 51.6141, lng: 7.1979 },
  { name: 'Bottrop', lat: 51.5247, lng: 6.9286 },
  { name: 'Bergisch Gladbach', lat: 50.9918, lng: 7.1303 },
  { name: 'Siegen', lat: 50.8748, lng: 8.0243 },
  { name: 'Witten', lat: 51.4439, lng: 7.3350 },
  { name: 'Iserlohn', lat: 51.3758, lng: 7.6925 },
  { name: 'Gütersloh', lat: 51.9032, lng: 8.3786 },
  { name: 'Marl', lat: 51.6558, lng: 7.0852 },
  { name: 'Lünen', lat: 51.6167, lng: 7.5167 },
  { name: 'Ratingen', lat: 51.2970, lng: 6.8493 },
  { name: 'Velbert', lat: 51.3386, lng: 7.0435 },
  { name: 'Minden', lat: 52.2887, lng: 8.9168 },
  { name: 'Herford', lat: 52.1145, lng: 8.6724 },
  { name: 'Dorsten', lat: 51.6603, lng: 6.9659 },
  { name: 'Castrop-Rauxel', lat: 51.5500, lng: 7.3167 },
  { name: 'Lüdenscheid', lat: 51.2197, lng: 7.6297 },
  { name: 'Gladbeck', lat: 51.5706, lng: 6.9856 },
  { name: 'Dinslaken', lat: 51.5667, lng: 6.7333 },
  { name: 'Unna', lat: 51.5347, lng: 7.6889 },
  { name: 'Herten', lat: 51.5958, lng: 7.1367 },
  { name: 'Troisdorf', lat: 50.8159, lng: 7.1553 },
  { name: 'Detmold', lat: 51.9386, lng: 8.8783 },
  { name: 'Bergkamen', lat: 51.6167, lng: 7.6333 },
  { name: 'Wesel', lat: 51.6586, lng: 6.6208 },
  { name: 'Schwerte', lat: 51.4464, lng: 7.5672 },
  { name: 'Kamen', lat: 51.5925, lng: 7.6636 },
  { name: 'Menden', lat: 51.4333, lng: 7.8000 },
  { name: 'Langenfeld', lat: 51.1108, lng: 6.9483 },
  { name: 'Hilden', lat: 51.1684, lng: 6.9313 },
  { name: 'Wetter', lat: 51.3892, lng: 7.3950 },
  { name: 'Herdecke', lat: 51.3994, lng: 7.4344 },
  { name: 'Sprockhövel', lat: 51.3500, lng: 7.2500 },
  { name: 'Hattingen', lat: 51.3996, lng: 7.1867 },
  { name: 'Heiligenhaus', lat: 51.3267, lng: 6.9714 },
  { name: 'Wülfrath', lat: 51.2817, lng: 7.0381 },
  { name: 'Schwelm', lat: 51.2892, lng: 7.2919 },
  { name: 'Gevelsberg', lat: 51.3215, lng: 7.3395 },
  { name: 'Ennepetal', lat: 51.2975, lng: 7.3625 },
  { name: 'Datteln', lat: 51.6547, lng: 7.3414 },
  { name: 'Waltrop', lat: 51.6214, lng: 7.3969 },
  { name: 'Haltern am See', lat: 51.7431, lng: 7.1864 },
  { name: 'Selm', lat: 51.6939, lng: 7.4711 },
  { name: 'Werne', lat: 51.6622, lng: 7.6317 },
  { name: 'Bönen', lat: 51.5958, lng: 7.7667 },
  { name: 'Fröndenberg', lat: 51.4733, lng: 7.7689 },
  { name: 'Holzwickede', lat: 51.5000, lng: 7.6167 },
  { name: 'Voerde', lat: 51.5978, lng: 6.6886 },
  { name: 'Kamp-Lintfort', lat: 51.5031, lng: 6.5419 },
  { name: 'Neukirchen-Vluyn', lat: 51.4411, lng: 6.5481 },
  { name: 'Rheinberg', lat: 51.5467, lng: 6.5950 },
  { name: 'Xanten', lat: 51.6603, lng: 6.4539 },
  { name: 'Erkrath', lat: 51.2239, lng: 6.9086 },
  { name: 'Mettmann', lat: 51.2500, lng: 6.9833 },
  { name: 'Monheim am Rhein', lat: 51.0917, lng: 6.8933 },
  { name: 'Dormagen', lat: 51.0967, lng: 6.8314 },
];

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find all cities within the given radius (km) of the specified cities.
 * Returns the original cities plus any nearby cities found, deduplicated.
 */
export function findCitiesInRadius(selectedCities: string[], radiusKm: number): string[] {
  const result = new Set<string>(selectedCities);

  for (const cityName of selectedCities) {
    const cityCoord = NRW_CITIES.find(c => c.name === cityName);
    if (!cityCoord) continue;

    for (const candidate of NRW_CITIES) {
      if (result.has(candidate.name)) continue;
      const dist = haversineDistance(cityCoord.lat, cityCoord.lng, candidate.lat, candidate.lng);
      if (dist <= radiusKm) {
        result.add(candidate.name);
      }
    }
  }

  return Array.from(result);
}

/**
 * Count how many additional cities would be found within the radius.
 * Used for preview in the UI.
 */
export function countCitiesInRadius(selectedCities: string[], radiusKm: number): number {
  return findCitiesInRadius(selectedCities, radiusKm).length;
}
