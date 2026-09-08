import { useEffect, useState } from 'react';
import { createRequestCache } from '../utils/requestCache.js';

const getCachedLocation = createRequestCache(5 * 60 * 1000);

function getCurrentLocation() {
  return getCachedLocation('current', () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }));
}

export function useCurrentLocation() {
  const [locationState, setLocationState] = useState({ status: 'pending', coordinates: null });
  useEffect(() => {
    let active = true;
    if (!navigator.geolocation) {
      setLocationState({ status: 'unavailable', coordinates: null });
      return undefined;
    }
    getCurrentLocation().then((coordinates) => {
      if (active) setLocationState({ status: 'ready', coordinates });
    }).catch(() => {
      if (active) setLocationState({ status: 'unavailable', coordinates: null });
    });
    return () => { active = false; };
  }, []);
  return locationState;
}
