import { createRequestCache } from '../utils/requestCache.js';

const getCached = createRequestCache(5 * 60 * 1000);

function getEventApiUrl(date) {
  const url = new URL('/api/monthly-temple-events', window.location.origin);

  url.searchParams.set('year', String(date.getFullYear()));
  url.searchParams.set('month', String(date.getMonth() + 1));

  return url;
}

export function getMonthlyEvents({ date = new Date() } = {}) {
  const url = getEventApiUrl(date);
  return getCached(url.href, () => fetchMonthlyEvents(url));
}

async function fetchMonthlyEvents(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Monthly events request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);

  return {
    events: Array.isArray(payload.events) ? payload.events : [],
    error: payload.error ?? null,
    cached: Boolean(payload.cached),
  };
}
