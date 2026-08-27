export async function recognizeHeritageImage({ imageDataUrl }) {
  const response = await fetch('/api/recognize-heritage', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageDataUrl }),
  });

  if (!response.ok) {
    throw new Error(`Recognition request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.ok && payload.error) {
    throw new Error(payload.error);
  }

  return {
    match: payload.match ?? null,
    candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
  };
}
