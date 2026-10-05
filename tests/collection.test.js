import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeritageContent, mergeCollectionCatalog } from '../src/utils/heritageContent.js';
import { acquireStamp, readStampCollection, STAMP_STORAGE_KEY } from '../src/services/stampCollectionService.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

const heritage = normalizeHeritageContent({ id: 'heritage-1', name: '석련대', description: '문화유산 설명' });

test('the same heritage keeps its first acquisition date and one stamp after reload', () => {
  const storage = memoryStorage();
  const first = acquireStamp(heritage, storage, new Date('2026-09-08T01:00:00Z'));
  const second = acquireStamp({ ...heritage, name: '새 이름' }, storage, new Date('2026-09-09T01:00:00Z'));
  assert.equal(first.isNew, true);
  assert.equal(second.isNew, false);
  assert.equal(readStampCollection(storage).length, 1);
  assert.equal(second.item.acquiredAt, first.item.acquiredAt);
  assert.equal(second.item.name, '새 이름');
});

test('catalog content updates without losing collected stamps or inventing acquisitions', () => {
  const stored = { ...heritage, acquiredAt: '2026-09-08T01:00:00Z' };
  const updated = { ...heritage, description: '수정된 설명' };
  const other = { ...heritage, id: 'heritage-2' };
  const result = mergeCollectionCatalog([updated, other], [stored]);
  assert.equal(result[0].description, '수정된 설명');
  assert.equal(result[0].acquiredAt, stored.acquiredAt);
  assert.equal(result[1].acquiredAt, null);
  assert.deepEqual(mergeCollectionCatalog([], [stored]), [stored]);
});

test('missing data stays empty and database content supplies the entire experience', () => {
  assert.equal(heritage.docentText, heritage.description);
  assert.equal(heritage.stamp.imageUrl, '');
  assert.equal(heritage.latitude, null);
  const data = normalizeHeritageContent({ id: 3, name: '범종', docent_text: '도슨트 원고', content: {
    docent: { title: '종의 이야기', subtitle: '소리를 만나다' },
    stamp: { imageUrl: '/stamps/bell.png', color: 'red; display:none' },
    detail: { text: '상세 설명', facts: [{ label: '재질', value: '청동' }, null] },
  }, asset: {
    thumbnail_image_url: '/thumbnails/bell.jpg',
    stamp_image_url: '/stamps/bell-from-db.png',
  } }, { name: '금산사', latitude: '', longitude: 999 });
  assert.equal(data.id, '3');
  assert.equal(data.docentText, '도슨트 원고');
  assert.equal(data.docentTitle, '종의 이야기');
  assert.equal(data.place, '금산사');
  assert.equal(data.thumbnailUrl, '/thumbnails/bell.jpg');
  assert.equal(data.catalogImageUrl, '/thumbnails/bell.jpg');
  assert.equal(data.detailImageAlt, '');
  assert.equal(data.stamp.imageUrl, '/stamps/bell-from-db.png');
  assert.equal(data.stamp.color, '#497945');
  assert.equal(data.longitude, null);
  assert.deepEqual(data.facts, [{ label: '재질', value: '청동' }]);
});

test('storage failures do not report successful acquisition or overwrite corrupt records', () => {
  const storage = memoryStorage();
  storage.setItem(STAMP_STORAGE_KEY, 'invalid-json');
  assert.throws(() => acquireStamp(heritage, storage));
  assert.equal(storage.getItem(STAMP_STORAGE_KEY), 'invalid-json');
  assert.throws(() => acquireStamp(heritage, {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  }));
});


test('generated audio URL reaches the view model from DB and recognition responses', () => {
  for (const fields of [{ audio_url: 'https://example.invalid/voice.mp3' }, { audioUrl: 'https://example.invalid/voice.mp3' }]) {
    assert.equal(normalizeHeritageContent({ id: 'h', ...fields }).audioUrl, 'https://example.invalid/voice.mp3');
  }
  assert.equal(normalizeHeritageContent({ id: 'h', audio_url: 'javascript:alert(1)' }).audioUrl, '');
  assert.equal(normalizeHeritageContent({ id: 'h' }).audioUrl, '');
});
