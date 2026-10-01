export async function recognizeHeritageImage({ imageDataUrl, latitude, longitude }) {
  const response = await fetch('/api/recognize-heritage', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageDataUrl, latitude, longitude }),
  });

  const payload = await response.json();

  if (!response.ok || (!payload.ok && payload.error)) {
    throw Object.assign(new Error(payload.error || `Recognition request failed: HTTP ${response.status}`), {
      code: payload.code || 'RECOGNITION_ERROR',
    });
  }

  return {
    match: payload.match ?? null,
  };
}
