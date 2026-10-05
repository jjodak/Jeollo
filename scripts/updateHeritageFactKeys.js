import { getHeritageFactKey } from '../src/utils/heritageFacts.js';

process.loadEnvFile('.env.local');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server configuration is missing.');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

// Add only known icon keys. Preserve the original text, order and other content.
// Filter on the original JSON to avoid overwriting a concurrent admin edit.
const rows = await request('heritages?select=id,content');
let updated = 0;
for (const row of rows) {
  const facts = row.content?.detail?.facts;
  if (!Array.isArray(facts)) continue;
  const next = facts.map((fact) => {
    if (!fact || typeof fact !== 'object' || fact.key) return fact;
    const factKey = getHeritageFactKey(fact);
    return factKey ? { ...fact, key: factKey } : fact;
  });
  if (JSON.stringify(next) === JSON.stringify(facts)) continue;
  const content = { ...row.content, detail: { ...row.content.detail, facts: next } };
  const filter = new URLSearchParams({ id: `eq.${row.id}`, content: `eq.${JSON.stringify(row.content)}`, select: 'id,content' });
  const changed = await request(`heritages?${filter}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ content }),
  });
  if (changed.length !== 1) throw new Error('Concurrent content edit detected; rerun after reviewing the record.');
  const [verified] = await request(`heritages?id=eq.${encodeURIComponent(row.id)}&select=content`);
  if (JSON.stringify(verified.content) !== JSON.stringify(changed[0].content)) throw new Error('Database verification failed.');
  updated++;
}
console.log(JSON.stringify({ checked: rows.length, updated, verified: true }));
