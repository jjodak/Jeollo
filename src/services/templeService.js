import { getSupabaseClient } from '../lib/supabaseClient.js';
import { getDistanceKm, hasValidCoordinates, toCoordinate } from '../utils/coordinates.js';
import { createRequestCache } from '../utils/requestCache.js';

const getCached = createRequestCache(60 * 1000);

export function getActiveTemples(options) {
  return getCached('active', fetchActiveTemples, options);
}

async function fetchActiveTemples() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('temples')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function getTempleById(id) {
  return getCached(`temple:${id}`, () => fetchTempleById(id));
}

async function fetchTempleById(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('temples')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getNearbyActiveTemples({
  latitude,
  longitude,
  limit = 10,
  maxDistanceKm = null,
}) {
  const origin = { latitude, longitude };
  if (!hasValidCoordinates(origin)) return [];
  const temples = await getActiveTemples();

  return temples
    .map((temple) => ({
      ...temple,
      latitude: toCoordinate(temple.latitude, 90),
      longitude: toCoordinate(temple.longitude, 180),
    }))
    .filter(hasValidCoordinates)
    .map((temple) => ({
      ...temple,
      distance_km: getDistanceKm(origin, {
        latitude: temple.latitude,
        longitude: temple.longitude,
      }),
    }))
    .filter((temple) => maxDistanceKm == null || temple.distance_km <= maxDistanceKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}
