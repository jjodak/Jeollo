import { useEffect, useRef, useState } from 'react';

import { getCurrentLocation } from '../services/locationService.js';
import { permissionFailure, queryBrowserPermission } from '../services/permissionService.js';

export function useCurrentLocation({ manual = false } = {}) {
  const [locationState, setLocationState] = useState({ status: 'pending', coordinates: null });
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState(null);
  const mounted = useRef(false);
  const remember = (choice) => { try { sessionStorage.setItem('jeollo.location-intro.v1', choice); } catch { /* permission checks still work without storage */ } };
  useEffect(() => {
    let active = true;
    mounted.current = true;
    setShowPermissionRequest(false);
    const load = async () => {
      if (manual) { if (active) setLocationState({ status: 'unavailable', coordinates: null }); return; }
      const { state } = await queryBrowserPermission('geolocation');
      if (!active) return;
      let choice;
      try { choice = sessionStorage.getItem('jeollo.location-intro.v1'); } catch { /* optional preference */ }
      if (state === 'granted' || choice === 'allowed') {
        try {
          const coordinates = await getCurrentLocation();
          if (active) setLocationState({ status: 'ready', coordinates });
        } catch { if (active) setLocationState({ status: 'unavailable', coordinates: null }); }
      } else {
        setLocationState({ status: 'unavailable', coordinates: null });
        if (choice !== 'skipped' && ['prompt', 'unknown'].includes(state)) setShowPermissionRequest(true);
      }
    };
    load();
    return () => { active = false; mounted.current = false; };
  }, [manual]);
  const requestPermission = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const coordinates = await getCurrentLocation();
      if (mounted.current) {
        remember('allowed');
        setLocationState({ status: 'ready', coordinates });
        setShowPermissionRequest(false);
      }
    } catch (error) {
      if (mounted.current) {
        remember('skipped');
        setShowPermissionRequest(false);
        setLocationState({ status: 'unavailable', coordinates: null });
        setNotice({ title: '위치 권한', message: permissionFailure('geolocation', error).message });
      }
    } finally { if (mounted.current) setRequesting(false); }
  };
  const skipPermission = () => { remember('skipped'); setShowPermissionRequest(false); };
  return { ...locationState, showPermissionRequest, requesting, requestPermission, skipPermission, notice, closeNotice: () => setNotice(null) };
}
