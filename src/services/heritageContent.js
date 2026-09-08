function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function contentImageUrl(value) {
  const url = text(value);
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function coordinate(value, limit) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

// Both database rows and recognition responses use this view model.
export function normalizeHeritageContent(row, temple = null) {
  const content = row.content ?? {};
  const stamp = content.stamp ?? {};
  const docent = content.docent ?? {};
  const detail = content.detail ?? {};
  const description = text(row.description);
  return {
    id: String(row.id),
    name: text(row.name),
    description,
    templeId: row.temple_id ?? row.templeId ?? null,
    place: text(temple?.name) || text(row.place),
    placeDescription: text(temple?.description),
    latitude: coordinate(temple?.latitude ?? row.latitude, 90),
    longitude: coordinate(temple?.longitude ?? row.longitude, 180),
    thumbnailUrl: contentImageUrl(row.thumbnail_url ?? row.thumbnailUrl),
    docentTitle: text(docent.title) || text(row.name),
    docentSubtitle: text(docent.subtitle),
    docentText: text(row.docent_text ?? row.docentText) || description,
    detailText: text(detail.text),
    facts: Array.isArray(detail.facts) ? detail.facts
      .filter((fact) => text(fact?.label) && text(fact?.value))
      .map((fact) => ({ label: text(fact.label), value: text(fact.value) })) : [],
    stamp: {
      title: text(stamp.title) || text(row.name),
      description: text(stamp.description) || description,
      imageUrl: contentImageUrl(stamp.imageUrl),
      paperUrl: contentImageUrl(stamp.paperUrl),
      color: /^#[0-9a-f]{6}$/i.test(stamp.color ?? '') ? stamp.color : '#497945',
    },
  };
}

export function mergeCollectionCatalog(catalog, collected) {
  const entries = new Map(collected.map((item) => [item.id, item]));
  for (const item of catalog) {
    entries.set(item.id, { ...item, acquiredAt: entries.get(item.id)?.acquiredAt ?? null });
  }
  return [...entries.values()];
}
