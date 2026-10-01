import { createRequestCache } from '../utils/requestCache.js';
import { hasValidCoordinates } from '../utils/coordinates.js';

const getCachedLocation = createRequestCache(5 * 60 * 1000);

function locationError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function getCurrentLocation({ fresh = false } = {}) {
  return getCachedLocation(fresh ? 'recognition' : 'current', () => new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(locationError('GPS_UNAVAILABLE', '현재 위치를 조회할 수 없어요. HTTPS 환경과 위치 설정을 확인해 주세요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { latitude: coords.latitude, longitude: coords.longitude };
        if (!hasValidCoordinates(coordinates)) {
          reject(locationError('INVALID_COORDINATES', '현재 위치 좌표가 올바르지 않아요. 다시 시도해 주세요.'));
        } else resolve(coordinates);
      },
      (error) => reject(error?.code === 1
        ? locationError('GPS_PERMISSION_DENIED', '문화재를 인식하려면 위치 권한이 필요해요. 브라우저 설정에서 위치 권한을 허용해 주세요.')
        : locationError('GPS_LOOKUP_FAILED', '현재 위치를 찾지 못했어요. 위치 설정을 확인하고 다시 시도해 주세요.')),
      { enableHighAccuracy: fresh, timeout: 8000, maximumAge: fresh ? 0 : 5 * 60 * 1000 },
    );
  }), { force: fresh });
}
