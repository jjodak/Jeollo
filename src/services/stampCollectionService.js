export const STAMP_STORAGE_KEY = 'jeollo.stamps.v1';

export function readStampCollection(storage = window.localStorage) {
  const raw = storage.getItem(STAMP_STORAGE_KEY);
  if (!raw) return [];
  const payload = JSON.parse(raw);
  if (payload.version !== 1 || !Array.isArray(payload.items)) {
    throw new Error('저장된 스탬프를 읽지 못했어요.');
  }
  return payload.items.filter((item) => typeof item?.id === 'string'
    && typeof item.name === 'string' && item.stamp
    && typeof item.acquiredAt === 'string' && Number.isFinite(Date.parse(item.acquiredAt)));
}

export function acquireStamp(heritage, storage = window.localStorage, now = new Date()) {
  if (!heritage?.id || !heritage.name) throw new Error('문화유산 정보를 확인하지 못했어요.');
  const items = readStampCollection(storage);
  const existing = items.find((item) => item.id === heritage.id);
  const item = { ...heritage, acquiredAt: existing?.acquiredAt ?? now.toISOString() };
  const nextItems = [item, ...items.filter((entry) => entry.id !== item.id)]
    .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
  storage.setItem(STAMP_STORAGE_KEY, JSON.stringify({ version: 1, items: nextItems }));
  return { items: nextItems, item, isNew: !existing };
}

export function mergeStampRecords(...collections) {
  const records = new Map();
  for (const items of collections) for (const item of items) {
    const previous = records.get(item.id);
    records.set(item.id, { ...previous, ...item,
      acquiredAt: previous?.acquiredAt < item.acquiredAt ? previous.acquiredAt : item.acquiredAt });
  }
  return [...records.values()].sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
}

// Only the successfully imported snapshot is removed. New guest stamps survive.
export function removeImportedGuestStamps(imported, storage = window.localStorage) {
  const items = readStampCollection(storage).filter((item) => !imported.some((entry) =>
    entry.id === item.id && entry.acquiredAt === item.acquiredAt));
  storage.setItem(STAMP_STORAGE_KEY, JSON.stringify({ version: 1, items }));
}
