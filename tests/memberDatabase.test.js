import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Execute the real migration in PostgreSQL with the same auth.uid()/role contract.
const db = new PGlite();
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table public.heritages (id text primary key);
  insert into public.heritages values ('h1'), ('h2');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261001_member_system.sql', import.meta.url), 'utf8'));
// Applying the same migration twice must preserve existing records and permissions.
await db.exec(await readFile(new URL('../supabase/migrations/20261001_member_system.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261001_member_login.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261001_member_login.sql', import.meta.url), 'utf8'));
await db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)',
  [first, JSON.stringify({ display_name: '유진' }), second, '{}']);
after(() => db.close());

async function asUser(id, operation, role = 'authenticated') {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  try { return await operation(); } finally { await db.exec('reset role'); }
}
const accept = (age = true, terms = true, privacy = true) => db.query(
  "select public.accept_member_consents('2026-10-01',$1,$2,$3,false,false)", [age, terms, privacy]);
const save = (id, items, scanned = false) => db.query('select * from public.save_member_stamps($1::jsonb, $2::uuid, $3)', [JSON.stringify(items), id, scanned]);

test('signup creates an own profile; anonymous and other members cannot read private records', async () => {
  const own = await asUser(first, () => db.query('select * from public.profiles'));
  assert.equal(own.rows.length, 1);
  assert.equal(own.rows[0].display_name, '유진');
  await assert.rejects(asUser(null, () => db.query('select * from public.profiles'), 'anon'), /permission denied/);
  const other = await asUser(second, () => db.query('select * from public.profiles where id = $1', [first]));
  assert.deepEqual(other.rows, []);
});

test('signup consent validation remains strict while login does not create or require new consent', async () => {
  await assert.rejects(asUser(null, () => save(first, [{ id: 'h1' }])), /Authentication required/);
  await assert.rejects(asUser(null, () => save(first, [{ id: 'h1' }]), 'anon'), /permission denied/);
  await asUser(first, () => save(first, [{ id: 'h1', acquiredAt: '2026-09-01T00:00:00Z' }]));
  const before = await asUser(first, () => db.query('select * from public.user_consents'));
  assert.deepEqual(before.rows, []);
  for (const args of [[false,true,true], [true,false,true], [true,true,false], [null,true,true]]) {
    await assert.rejects(asUser(first, () => accept(...args)), /Required consents missing/);
  }
  await assert.rejects(asUser(first, () => db.query("select public.accept_member_consents('old',true,true,true,false,false)")), /Required consents missing/);
  await asUser(first, () => accept());
  const record = await asUser(first, () => db.query('select * from public.user_consents'));
  assert.equal(record.rows.length, 1);
  assert.equal(record.rows[0].marketing, false);
  assert.ok(record.rows[0].accepted_at);
});

test('stamp imports preserve earliest acquisition, are idempotent, skip unknown IDs and distinguish scans', async () => {
  const items = [{ id: 'h1', acquiredAt: '2026-09-01T00:00:00Z' }, { id: 'unknown', acquiredAt: '2026-09-01T00:00:00Z' }];
  await asUser(first, () => save(first, items));
  await asUser(first, () => save(first, [{ id: 'h1', acquiredAt: '2026-09-09T00:00:00Z' }], true));
  await asUser(first, () => save(first, [{ id: 'h1', acquiredAt: '2026-08-01T00:00:00Z' }], true));
  const stamps = await asUser(first, () => db.query('select * from public.user_stamps'));
  assert.equal(stamps.rows.length, 1);
  assert.equal(stamps.rows[0].acquired_at.toISOString(), '2026-08-01T00:00:00.000Z');
  const scans = await asUser(first, () => db.query('select * from public.user_scans'));
  assert.equal(scans.rows.length, 1);
});

test('accounts cannot forge the stamp owner, directly mutate records, overwrite consents or read another collection', async () => {
  await asUser(second, () => accept());
  await assert.rejects(asUser(second, () => save(first, [{ id: 'h2' }])), /Authentication required/);
  await assert.rejects(asUser(second, () => db.query('insert into public.user_stamps (user_id,heritage_id) values ($1,$2)', [first,'h2'])), /permission denied/);
  await assert.rejects(asUser(first, () => db.query('update public.user_consents set terms = false')), /permission denied/);
  const stamps = await asUser(second, () => db.query('select * from public.user_stamps'));
  assert.deepEqual(stamps.rows, []);
  const update = await asUser(second, () => db.query('update public.profiles set display_name = $1 where id = $2 returning *', ['변경', first]));
  assert.deepEqual(update.rows, []);
});

test('malformed import is atomic; deleting the auth account cascades only that account data', async () => {
  await assert.rejects(asUser(first, () => save(first, [{ id: 'h2', acquiredAt: 'invalid-time' }])), /invalid input syntax/);
  await asUser(second, () => save(second, [{ id: 'h2', acquiredAt: '2026-09-01T00:00:00Z' }], true));
  await db.query('delete from auth.users where id = $1', [first]);
  for (const table of ['profiles', 'user_consents', 'user_stamps', 'user_scans']) {
    const { rows } = await db.query(`select * from public.${table}`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][table === 'profiles' ? 'id' : 'user_id'], second);
  }
});
