function getEventApiUrl(date) {
  const url = new URL('/api/monthly-temple-events', window.location.origin);

  url.searchParams.set('year', String(date.getFullYear()));
  url.searchParams.set('month', String(date.getMonth() + 1));

  return url;
}

export async function getMonthlyEvents({ date = new Date() } = {}) {
  const response = await fetch(getEventApiUrl(date), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Monthly events request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();

  return {
    events: Array.isArray(payload.events) ? payload.events : [],
    error: payload.error ?? null,
    cached: Boolean(payload.cached),
  };
}
