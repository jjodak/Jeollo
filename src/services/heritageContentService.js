import { getHeritageById } from './heritageService.js';
import { getTempleById } from './templeService.js';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { normalizeHeritageContent } from './heritageContent.js';

export async function getHeritageContent(match) {
  const row = await getHeritageById(match.id).catch(() => null) ?? match;
  const templeId = row.temple_id ?? row.templeId;
  const temple = templeId ? await getTempleById(templeId).catch(() => null) : null;
  return normalizeHeritageContent(row, temple);
}

export async function getHeritageCatalog() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('heritages').select('*')
    .eq('is_active', true).order('name', { ascending: true });
  if (error) throw error;
  const templeIds = [...new Set((data ?? []).map((row) => row.temple_id).filter(Boolean))];
  let temples = [];
  if (templeIds.length) {
    const result = await supabase.from('temples').select('*')
      .in('id', templeIds).eq('is_active', true);
    if (result.error) throw result.error;
    temples = result.data ?? [];
  }
  const templesById = new Map(temples.map((temple) => [temple.id, temple]));
  return (data ?? []).map((row) => normalizeHeritageContent(row, templesById.get(row.temple_id)));
}
