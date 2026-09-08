export function toCoordinate(value, limit) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function hasValidCoordinates(coordinates) {
  return Boolean(coordinates
    && Number.isFinite(coordinates.latitude) && Math.abs(coordinates.latitude) <= 90
    && Number.isFinite(coordinates.longitude) && Math.abs(coordinates.longitude) <= 180);
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function getDistanceKm(from, to) {
  if (!hasValidCoordinates(from) || !hasValidCoordinates(to)) return null;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, a));
  return 6371 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

export function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm)) return null;
  const rounded = distanceKm < 10
    ? Math.max(0.1, Math.round(distanceKm * 10) / 10) : Math.round(distanceKm);
  return `약 ${rounded.toLocaleString('ko-KR')}km 떨어짐`;
}
