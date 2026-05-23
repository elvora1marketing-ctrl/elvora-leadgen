import { NextRequest } from 'next/server';
import { GERMAN_CITIES, ALL_STATES, findCitiesInRadius } from '@/lib/german-cities';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');

  if (mode === 'radius') {
    const cityName = searchParams.get('city') || '';
    const radiusKm = parseInt(searchParams.get('radius') || '50', 10);

    const center = GERMAN_CITIES.find(
      c => c.name.toLowerCase() === cityName.toLowerCase(),
    );

    if (!center) {
      return Response.json({ cities: [{ name: cityName, state: '' }] });
    }

    const cities = findCitiesInRadius(center.lat, center.lng, radiusKm);
    return Response.json({ cities });
  }

  if (mode === 'all') {
    return Response.json({ cities: GERMAN_CITIES });
  }

  return Response.json({
    cities: GERMAN_CITIES,
    states: ALL_STATES,
    total: GERMAN_CITIES.length,
  });
}
