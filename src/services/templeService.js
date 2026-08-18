import { getSupabaseClient } from '../lib/supabaseClient.js';

export async function getActiveTemples() {
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

export async function getTempleById(id) {
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

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function getDistanceKm(from, to) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getNearbyActiveTemples({
  latitude,
  longitude,
  limit = 10,
  maxDistanceKm = null,
}) {
  const temples = await getActiveTemples();
  const origin = { latitude, longitude };

  return temples
    .filter((temple) => temple.latitude != null && temple.longitude != null)
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
