import { toCoordinate } from './coordinates.js';

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

function firstObject(value) {
  if (Array.isArray(value)) return value[0] ?? {};
  return value && typeof value === 'object' ? value : {};
}

// Both database rows and recognition responses use this view model.
export function normalizeHeritageContent(row, temple = null) {
  const content = row.content ?? {};
  const asset = firstObject(row.asset ?? row.assets ?? row.heritage_assets);
  const stamp = content.stamp ?? {};
  const docent = content.docent ?? {};
  const detail = content.detail ?? {};
  const description = text(row.description);
  const stampColor = row.stamp_color ?? stamp.color;
  const thumbnailUrl = contentImageUrl(
    asset.thumbnail_image_url
      ?? row.thumbnail_image_url
      ?? row.thumbnail_url
      ?? row.thumbnailUrl
      ?? detail.imageUrl
      ?? docent.imageUrl,
  );
  return {
    id: String(row.id),
    name: text(row.name),
    description,
    templeId: row.temple_id ?? row.templeId ?? null,
    place: text(temple?.name) || text(row.place),
    placeDescription: text(temple?.description),
    latitude: toCoordinate(temple?.latitude ?? row.latitude, 90),
    longitude: toCoordinate(temple?.longitude ?? row.longitude, 180),
    thumbnailUrl,
    detailImageUrl: thumbnailUrl,
    catalogImageUrl: thumbnailUrl,
    detailImageAlt: text(row.detail_image_alt),
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
      imageUrl: contentImageUrl(asset.stamp_image_url ?? row.stamp_image_url ?? stamp.imageUrl),
      paperUrl: contentImageUrl(row.stamp_paper_url ?? stamp.paperUrl),
      color: /^#[0-9a-f]{6}$/i.test(stampColor ?? '') ? stampColor : '#497945',
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
