import { getSupabaseClient } from '../lib/supabaseClient.js';
import { createRequestCache } from '../utils/requestCache.js';
import { docentRowToContent } from '../utils/docentRecords.js';
export { applyDocentContent } from '../utils/docentRecords.js';

const cached = createRequestCache(60 * 1000);

export function getDocentsByHeritageIds(ids, options) {
  const unique = [...new Set(ids.filter(Boolean))].sort();
  if (!unique.length) return Promise.resolve(new Map());
  return cached(unique.join(','), async () => {
    const { data, error } = await getSupabaseClient().from('heritage_docents')
      .select('*, topics:docent_topics(*, scenes:docent_scenes(*))').in('heritage_id', unique).eq('is_active', true);
    if (error) throw error;
    return new Map((data ?? []).map((row) => [row.heritage_id, docentRowToContent(row)]));
  }, options);
}
