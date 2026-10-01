import test from 'node:test';
import assert from 'node:assert/strict';
import recognize, { selectReferenceImages } from '../api/recognize-heritage.js';
import { getCurrentLocation } from '../src/services/locationService.js';
import { recognizeHeritageImage } from '../src/services/recognitionService.js';

const body = { imageDataUrl: 'data:image/jpeg;base64,AAAA', latitude: 35, longitude: 127 };
const heritage = { id: 'h', name: '문화재', temple_id: 't', description: 'PRIVATE DESCRIPTION', docent_text: 'PRIVATE DOCENT', content: { audio: 'keep' } };
const reference = { heritage_id: 'h', image_url: 'https://example.invalid/front.jpg', is_primary: true, angle_type: 'front' };
function response() {
  return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
}
function setup(t, options = {}) {
  const previous = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only', OPENAI_API_KEY: 'test-only' });
  delete process.env.OPENAI_RECOGNITION_MODEL;
  delete process.env.RECOGNITION_MAX_TEMPLE_DISTANCE_METERS;
  t.after(() => { process.env = previous; });
  const calls = [];
  const logs = [];
  t.mock.method(console, 'info', (_, entry) => logs.push(JSON.parse(entry)));
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
    calls.push(url);
    if (options.dbError && url.pathname.startsWith('/rest/')) return Response.json({ message: 'private database failure', code: 'XX000' }, { status: 500 });
    if (url.pathname.endsWith('/temples')) {
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      const temples = options.temples ?? [{ id: 't', latitude: 35, longitude: 127 }];
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return Response.json(temples.slice(offset, offset + 500));
    }
    if (url.pathname.endsWith('/heritages')) {
      assert.equal(url.searchParams.get('temple_id'), 'eq.t');
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      if (url.searchParams.has('id')) return Response.json(heritage);
      assert.equal(url.searchParams.get('select'), 'id,name,temple_id');
      return Response.json(options.heritages ?? [heritage]);
    }
    if (url.pathname.endsWith('/heritage_images')) return Response.json(options.images ?? [reference]);
    if (url.pathname.endsWith('/heritage_assets')) {
      if (options.noAssets) return Response.json({ code: '42P01' }, { status: 404 });
      assert.equal(url.searchParams.get('id'), 'eq.h');
      return Response.json({ id: 'h', stamp_image_url: 'https://example.invalid/stamp.png' });
    }
    const request = JSON.parse(init.body);
    assert.equal(request.model, options.model ?? 'gpt-5');
    assert.equal(request.text.format.type, 'json_object');
    assert.equal(JSON.stringify(request).includes('PRIVATE'), false);
    if (options.openaiError) return Response.json({ error: { message: 'private upstream failure' } }, { status: 429 });
    if (options.incomplete && (request.max_output_tokens === 250 || options.alwaysIncomplete)) {
      return Response.json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{' });
    }
    assert.equal(request.max_output_tokens, options.incomplete ? 1200 : 250);
    return Response.json({ output_text: JSON.stringify(options.result ?? { matchedHeritageId: 'h', confidence: 0.9, reason: '일치' }) });
  });
  return { calls, logs };
}

for (const coordinates of [{}, { latitude: null, longitude: 127 }, { latitude: '35', longitude: 127 }, { latitude: 91, longitude: 127 }, { latitude: 35, longitude: Infinity }]) {
  test(`invalid GPS rejected before database: ${JSON.stringify(coordinates)}`, async (t) => {
    const { calls } = setup(t);
    const res = response();
    await recognize({ method: 'POST', body: { imageDataUrl: body.imageDataUrl, ...coordinates } }, res);
    assert.equal(res.body.code, 'INVALID_COORDINATES');
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
}
for (const [name, options, code] of [
  ['far away', { temples: [{ id: 't', latitude: 36, longitude: 127 }] }, 'NO_NEARBY_TEMPLE'],
  ['no temples', { temples: [] }, 'NO_NEARBY_TEMPLE'],
  ['missing temple coordinates', { temples: [{ id: 't', latitude: null, longitude: '' }] }, 'NO_NEARBY_TEMPLE'],
  ['empty temple', { heritages: [] }, 'NO_HERITAGES'],
  ['missing images', { images: [] }, 'NO_REFERENCE_IMAGES'],
  ['partially missing images', { heritages: [heritage, { ...heritage, id: 'other' }] }, 'NO_REFERENCE_IMAGES'],
  ['too many candidates', { heritages: Array.from({ length: 201 }, (_, i) => ({ ...heritage, id: `h${i}` })) }, 'TOO_MANY_CANDIDATES'],
  ['database error', { dbError: true }, 'SUPABASE_ERROR'],
  ['OpenAI error', { openaiError: true }, 'OPENAI_ERROR'],
  ['no match', { result: { matchedHeritageId: null, confidence: 0.1 } }, 'NO_MATCH'],
  ['unknown ID', { result: { matchedHeritageId: 'outside-temple', confidence: 1 } }, 'NO_MATCH'],
  ['low confidence', { result: { matchedHeritageId: 'h', confidence: 0.34 } }, 'NO_MATCH'],
  ['invalid confidence', { result: { matchedHeritageId: 'h', confidence: 'bad' } }, 'OPENAI_INVALID_OUTPUT'],
  ['repeated truncation', { incomplete: true, alwaysIncomplete: true }, 'OPENAI_INCOMPLETE'],
]) {
  test(name, async (t) => {
    const { calls, logs } = setup(t, options);
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, code);
    assert.equal(res.body.match, null);
    assert.equal(calls.some((url) => url.pathname.endsWith('/heritage_assets')), false);
    if (['NO_NEARBY_TEMPLE', 'NO_HERITAGES', 'NO_REFERENCE_IMAGES', 'TOO_MANY_CANDIDATES', 'SUPABASE_ERROR'].includes(code)) {
      assert.equal(calls.some((url) => url.pathname === '/v1/responses'), false);
    }
    assert.equal(logs.length, 1);
    assert.ok(logs[0].totalMs >= 0);
    assert.equal(JSON.stringify(logs).includes('base64'), false);
  });
}

test('nearest temple pagination, optional assets and one bounded output retry', async (t) => {
  const temples = Array.from({ length: 500 }, (_, i) => ({ id: `far-${i}`, latitude: 36, longitude: 127 }));
  temples.push({ id: 't', latitude: 35, longitude: 127 });
  const { calls, logs } = setup(t, { temples, noAssets: true, incomplete: true });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(res.body.match.docentText, heritage.docent_text);
  assert.deepEqual(res.body.match.content, heritage.content);
  assert.deepEqual(res.body.match.asset, {});
  assert.equal(calls.filter((url) => url.pathname.endsWith('/temples')).length, 2);
  assert.equal(logs[0].openaiAttempts, 2);
  assert.equal(logs[0].candidateCount, 1);
  assert.equal(logs[0].referenceImageCount, 1);
  assert.ok(Object.values(logs[0].timingsMs).every((value) => typeof value === 'number'));
});

test('more than twelve candidates remain eligible and model override is preserved', async (t) => {
  const heritages = Array.from({ length: 13 }, (_, i) => ({ ...heritage, id: i === 12 ? 'h' : `h${i}` }));
  const images = heritages.map((row) => ({ ...reference, heritage_id: row.id }));
  const { logs } = setup(t, { heritages, images, model: 'custom-model' });
  process.env.OPENAI_RECOGNITION_MODEL = 'custom-model';
  process.env.RECOGNITION_CANDIDATE_LIMIT = '1';
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.match.id, 'h');
  assert.equal(logs[0].candidateCount, 13);
});

test('distance limit is configurable and enforced on server', async (t) => {
  setup(t, { temples: [{ id: 't', latitude: 35.0046, longitude: 127 }] });
  const outside = response();
  await recognize({ method: 'POST', body }, outside);
  assert.equal(outside.body.code, 'NO_NEARBY_TEMPLE');
  process.env.RECOGNITION_MAX_TEMPLE_DISTANCE_METERS = '600';
  const inside = response();
  await recognize({ method: 'POST', body }, inside);
  assert.equal(inside.body.code, 'MATCHED');
});

test('primary reference first, unique URL and different existing angle preferred', () => {
  const side = { ...reference, image_url: 'https://example.invalid/side.jpg', angle_type: 'left', is_primary: false };
  const duplicateAngle = { ...reference, image_url: 'https://example.invalid/front2.jpg', is_primary: false };
  const result = selectReferenceImages([duplicateAngle, side, reference, reference]);
  assert.deepEqual(result.map((image) => image.imageUrl), [reference.image_url, side.image_url]);
  assert.equal(selectReferenceImages([reference, reference]).length, 1);
});

for (const [errorCode, code] of [[1, 'GPS_PERMISSION_DENIED'], [2, 'GPS_LOOKUP_FAILED'], [3, 'GPS_LOOKUP_FAILED']]) {
  test(`GPS error ${errorCode} remains actionable`, async (t) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
      getCurrentPosition(_resolve, reject, options) {
        assert.equal(options.maximumAge, 0);
        assert.equal(options.enableHighAccuracy, true);
        reject({ code: errorCode });
      },
    } } });
    t.after(() => descriptor ? Object.defineProperty(globalThis, 'navigator', descriptor) : delete globalThis.navigator);
    await assert.rejects(getCurrentLocation({ fresh: true }), { code });
  });
}

test('client preserves actionable errors on non-2xx responses', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body), body);
    return Response.json({ ok: false, code: 'INVALID_COORDINATES', error: '위치 오류' }, { status: 400 });
  });
  await assert.rejects(recognizeHeritageImage(body), { code: 'INVALID_COORDINATES', message: '위치 오류' });
});
