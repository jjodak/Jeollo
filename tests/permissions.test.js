import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionFailure, queryBrowserPermission, requestBrowserPermission } from '../src/services/permissionService.js';

const browser = (permissions) => ({ isSecureContext: true, navigator: { permissions,
  geolocation: {}, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } } });

test('permission queries return actual state and unsupported queries remain unknown', async () => {
  const permission = { state: 'denied' };
  assert.deepEqual(await queryBrowserPermission('camera', browser({ query: async () => permission })), { state: 'denied', permission });
  assert.equal((await queryBrowserPermission('camera', browser())).state, 'unknown');
  assert.equal((await queryBrowserPermission('camera', browser({ query: async () => { throw new TypeError(); } }))).state, 'unknown');
  const insecure = { ...browser(), isSecureContext: false };
  assert.equal((await queryBrowserPermission('camera', insecure)).state, 'insecure');
  assert.equal((await queryBrowserPermission('camera', { isSecureContext: true, navigator: {} })).state, 'unsupported');
});

test('camera permission requests real video access without audio and stops all returned tracks', async () => {
  let options;
  const stopped = [];
  const context = browser();
  context.navigator.mediaDevices.getUserMedia = async (constraints) => { options = constraints; return { getTracks: () => [0,1].map((id) => ({ stop: () => stopped.push(id) })) }; };
  await requestBrowserPermission('camera', context);
  assert.deepEqual(options, { video: true, audio: false });
  assert.deepEqual(stopped, [0,1]);
});

test('location permission makes a fresh lookup; failure is never reported as granted', async () => {
  let options;
  await requestBrowserPermission('geolocation', browser(), async (value) => { options = value; });
  assert.deepEqual(options, { fresh: true });
  await assert.rejects(requestBrowserPermission('geolocation', browser(), async () => { throw { code: 'GPS_LOOKUP_FAILED' }; }));
  assert.equal(permissionFailure('geolocation', { code: 'GPS_LOOKUP_FAILED' }, browser()).state, 'unknown');
  assert.equal(permissionFailure('geolocation', { code: 'GPS_PERMISSION_DENIED' }, browser()).state, 'denied');
  assert.match(permissionFailure('camera', { name: 'NotReadableError' }, browser()).message, /다른 앱/);
  assert.match(permissionFailure('camera', { name: 'NotAllowedError' }, browser()).message, /사이트 설정/);
});
