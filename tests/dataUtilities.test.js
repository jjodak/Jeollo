import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestCache } from '../src/utils/requestCache.js';
import { toCoordinate, getDistanceKm, formatDistanceKm } from '../src/utils/coordinates.js';

test('missing or out-of-range coordinates never become a displayed distance', () => {
  for (const value of [null, undefined, '', ' ', 'invalid', 91]) {
    assert.equal(toCoordinate(value, 90), null);
  }
  assert.equal(toCoordinate('0', 90), 0);
  assert.equal(getDistanceKm({ latitude: null, longitude: 127 }, { latitude: 35, longitude: 127 }), null);
  assert.equal(formatDistanceKm(null), null);
  assert.equal(getDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(Math.abs(getDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111.195) < 0.01);
});

test('concurrent reads share one request and cached reads expire or can be refreshed', async (t) => {
  let now = 100;
  t.mock.method(Date, 'now', () => now);
  const cached = createRequestCache(1000);
  let calls = 0;
  const load = async () => ++calls;
  assert.deepEqual(await Promise.all([cached('a', load), cached('a', load, { force: true })]), [1, 1]);
  assert.equal(await cached('a', load), 1);
  assert.equal(await cached('a', load, { force: true }), 2);
  now += 1001;
  assert.equal(await cached('a', load), 3);
  assert.equal(await cached('b', load), 4);
});

test('a failed cached request can be retried without retaining the error', async () => {
  const cached = createRequestCache(1000);
  await assert.rejects(cached('a', () => { throw new Error('offline'); }), /offline/);
  assert.equal(await cached('a', async () => 'recovered'), 'recovered');
});
