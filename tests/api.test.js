import test from 'node:test';
import assert from 'node:assert/strict';
import recognize from '../api/recognize-heritage.js';
import monthlyEvents from '../api/monthly-temple-events.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

function environment(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('recognition keeps the database content contract through the shared admin client', async (t) => {
  environment(t, { SUPABASE_URL: 'https://jeollo.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only-placeholder', OPENAI_API_KEY: 'test-only-placeholder' });
  const heritage = { id: 'heritage', temple_id: 'temple', name: '문화유산', heritage_images: [{ image_url: 'https://images.example.invalid/reference.jpg', is_primary: true }], description: 'DB 설명',
    docent_text: 'DB 원고', content: { docent: { title: 'DB 제목' } } };
  const asset = {
    id: 'heritage',
    thumbnail_image_url: 'https://images.example.invalid/thumbnail.jpg',
    stamp_image_url: 'https://images.example.invalid/stamp.png',
  };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
    calls.push(url.pathname);
    if (url.pathname.endsWith('/temples')) return Response.json([{ id: 'temple', latitude: 35, longitude: 127 }]);
    if (url.pathname.endsWith('/heritages')) return Response.json(url.searchParams.has('id') ? heritage : [heritage]);
    if (url.pathname.endsWith('/heritage_images')) return Response.json([
      { heritage_id: 'heritage', image_url: 'https://images.example.invalid/reference.jpg', is_primary: true },
    ]);
    if (url.pathname.endsWith('/heritage_assets')) return Response.json(asset);
    assert.equal(url.pathname, '/v1/responses');
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.input[1].content[1].image_url, 'data:image/jpeg;base64,AAAA');
    return Response.json({ output_text: JSON.stringify({ matchedHeritageId: 'heritage', secondCandidateId: null, needsVerification: false, confidence: 0.9 }) });
  });
  const res = response();
  await recognize({ method: 'POST', body: { imageDataUrl: 'data:image/jpeg;base64,AAAA', latitude: 35, longitude: 127 } }, res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.match.docentText, heritage.docent_text);
  assert.deepEqual(res.body.match.content, heritage.content);
  assert.deepEqual(res.body.match.asset, asset);
  assert.equal(res.body.match.thumbnailUrl, asset.thumbnail_image_url);
  assert.equal(res.body.match.templeId, heritage.temple_id);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls.sort(), ['/rest/v1/temples', '/rest/v1/heritage_assets', '/rest/v1/heritages', '/rest/v1/heritages', '/v1/responses'].sort());
});

test('monthly API keeps absent coordinates null and reuses its server cache', async (t) => {
  environment(t, { TOUR_API_SERVICE_KEY: 'test-only-placeholder' });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    return Response.json({ response: { header: { resultCode: '0000' }, body: {
      totalCount: 1, items: { item: [{ contentid: 'event', title: '사찰 문화 행사', mapx: '', mapy: null }] },
    } } });
  });
  const req = { method: 'GET', query: { year: 2099, month: 12 } };
  const first = response();
  await monthlyEvents(req, first);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.events[0].mapX, null);
  assert.equal(first.body.events[0].mapY, null);
  const second = response();
  await monthlyEvents(req, second);
  assert.equal(second.body.cached, true);
  assert.equal(requests, 1);
});
