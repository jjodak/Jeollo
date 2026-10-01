import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../api/delete-account.js';
import { acquireStamp, mergeStampRecords, readStampCollection, removeImportedGuestStamps } from '../src/services/stampCollectionService.js';

test('removing an imported guest snapshot preserves newer records and merging preserves the first date', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const original = acquireStamp({ id: 'one', name: '첫 우표', stamp: {} }, storage, new Date('2026-09-01')).item;
  acquireStamp({ id: 'two', name: '새 우표', stamp: {} }, storage, new Date('2026-09-02'));
  removeImportedGuestStamps([original], storage);
  assert.deepEqual(readStampCollection(storage).map((item) => item.id), ['two']);
  const merged = mergeStampRecords([original], [{ ...original, acquiredAt: '2026-10-01T00:00:00Z' }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].acquiredAt, original.acquiredAt);
});

test('account deletion verifies bearer token and derives the deleted ID exclusively from Supabase', async () => {
  const deleted = [];
  const handler = createDeleteAccountHandler({ createAdmin: () => ({ auth: {
    getUser: async (token) => token === 'valid-token' ? { data: { user: { id: 'verified-user' } } } : { data: {}, error: {} },
    admin: { deleteUser: async (id) => { deleted.push(id); return {}; } },
  } }) });
  const invoke = async (method, authorization, body = {}) => {
    const result = {};
    await handler({ method, headers: { authorization }, body }, {
      setHeader() {}, status(code) { result.code = code; return this; }, json(payload) { result.payload = payload; },
    });
    return result;
  };
  assert.equal((await invoke('GET', 'Bearer valid-token')).code, 405);
  assert.equal((await invoke('POST', '')).code, 401);
  assert.equal((await invoke('POST', 'Bearer invalid-token')).code, 401);
  assert.deepEqual(deleted, []);
  assert.equal((await invoke('POST', 'Bearer valid-token', { userId: 'victim-user' })).code, 200);
  assert.deepEqual(deleted, ['verified-user']);
});
