import { docentTemplate1Sample as sample } from '../src/data/docentTemplate1Sample.js';

process.loadEnvFile('.env.local');
const heritageId = process.argv.find((arg) => arg.startsWith('--heritage-id='))?.slice(14);
if (!heritageId) throw new Error('Pass the existing sample heritage ID using --heritage-id=.');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server configuration is missing.');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
const encoded = encodeURIComponent(heritageId);
async function verifyPublic() {
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const visible = await request(`heritage_docents?heritage_id=eq.${encoded}&select=*,topics:docent_topics(*,scenes:docent_scenes(*))`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
  });
  if (visible.length !== 1 || visible[0].topics.length !== 3 || visible[0].topics.flatMap((topic) => topic.scenes).length !== 10)
    throw new Error('Public content verification failed.');
  for (const topic of sample.topics) for (const scene of topic.scenes) {
    const saved = visible[0].topics.flatMap((t) => t.scenes).find((s) => s.id === `${heritageId}:${topic.id}:${scene.id}`);
    for (const layer of scene.layers) {
      const stored = saved?.layers.find((l) => l.id === layer.id);
      if (!stored || Object.entries(layer).some(([key, value]) => stored[key] !== value)) throw new Error('Scene content verification failed.');
    }
  }
  console.log(JSON.stringify({ template: sample.templateType, topics: 3, scenes: 10, publicReadVerified: true }));
}
if (process.argv.includes('--verify-only')) { await verifyPublic(); process.exit(0); }
const [heritage] = await request(`heritages?id=eq.${encoded}&select=id,name,is_active`);
if (!heritage?.is_active || heritage.name !== '석련대') throw new Error('The Figma sample must be installed on the active 석련대 record.');
const existing = await request(`heritage_docents?heritage_id=eq.${encoded}&select=*`);
if (existing.length && (existing[0].is_active || existing[0].title !== sample.title || existing[0].background_url !== sample.backgroundUrl))
  throw new Error('A docent configuration already exists. Review it rather than overwriting administrator content.');
if (!existing.length) await request('heritage_docents', { method: 'POST', body: JSON.stringify({ heritage_id: heritageId,
  template_id: sample.templateType, title: sample.title, subtitle: sample.subtitle, background_url: sample.backgroundUrl,
  result_layers: sample.resultLayers, selection_layers: sample.selectionLayers, return_transition: sample.returnTransition,
  is_active: false }) });
const topics = sample.topics.map((topic, index) => ({ id: `${heritageId}:${topic.id}`, heritage_id: heritageId,
  label: topic.label, title: topic.title, subtitle: topic.subtitle, script: topic.script, audio_url: topic.audioUrl ?? null,
  position: { x: topic.x, y: topic.y }, return_transition: topic.returnTransition, sort_order: index }));
await request('docent_topics?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(topics) });
const scenes = sample.topics.flatMap((topic) => topic.scenes.map((scene, index) => ({
  id: `${heritageId}:${topic.id}:${scene.id}`, topic_id: `${heritageId}:${topic.id}`, title: scene.title ?? null,
  body: scene.body ?? null, audio_url: scene.audioUrl ?? null, layers: scene.layers, advance: scene.advance,
  wait_ms: scene.waitMs ?? 0, transition: scene.transition, sort_order: index,
})));
await request('docent_scenes?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(scenes) });
const [saved] = await request(`heritage_docents?heritage_id=eq.${encoded}&select=*,topics:docent_topics(*,scenes:docent_scenes(*))`);
if (saved.topics.length !== topics.length || saved.topics.flatMap((topic) => topic.scenes).length !== scenes.length)
  throw new Error('Sample is incomplete; it remains inactive until reviewed.');
await request(`heritage_docents?heritage_id=eq.${encoded}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
// Confirm the exact same public query used by the mobile application succeeds.
await verifyPublic();
