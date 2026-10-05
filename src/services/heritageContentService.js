import { getHeritageById } from './heritageService.js';
import { getTempleById } from './templeService.js';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { normalizeHeritageContent } from '../utils/heritageContent.js';
import { createRequestCache } from '../utils/requestCache.js';
import { applyDocentContent, getDocentsByHeritageIds } from './docentService.js';

const getCached = createRequestCache(60 * 1000);

async function getAssetsByHeritageIds(ids) {
  const heritageIds = [...new Set(ids.filter(Boolean))];
  if (!heritageIds.length) return new Map();

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('heritage_assets').select('*')
    .in('id', heritageIds);
  if (error) throw error;
  return new Map((data ?? []).map((asset) => [asset.id, asset]));
}

export async function getHeritageContent(match) {
  // Current recognition responses contain the DB content; older responses may only carry an ID.
  const hasContent = Object.hasOwn(match, 'description')
    && (Object.hasOwn(match, 'docentText') || Object.hasOwn(match, 'docent_text'))
    && Object.hasOwn(match, 'content');
  const row = hasContent ? match : await getHeritageById(match.id).catch(() => null) ?? match;
  const assetsByHeritageId = row.asset || row.assets || row.heritage_assets
    ? new Map()
    : await getAssetsByHeritageIds([row.id]).catch(() => new Map());
  const rowWithAsset = assetsByHeritageId.has(row.id)
    ? { ...row, asset: assetsByHeritageId.get(row.id) }
    : row;
  const templeId = row.temple_id ?? row.templeId;
  const temple = templeId ? await getTempleById(templeId).catch(() => null) : null;
  const docents = await getDocentsByHeritageIds([row.id]).catch(() => new Map());
  return applyDocentContent(normalizeHeritageContent(rowWithAsset, temple), docents.get(row.id));
}

export function getHeritageCatalog(options) {
  return getCached('catalog', fetchHeritageCatalog, options);
}

async function fetchHeritageCatalog() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('heritages').select('*')
    .eq('is_active', true).order('name', { ascending: true });
  if (error) throw error;
  const templeIds = [...new Set((data ?? []).map((row) => row.temple_id).filter(Boolean))];
  const heritageIds = (data ?? []).map((row) => row.id).filter(Boolean);
  const [temples, assetsByHeritageId, docents] = await Promise.all([
    fetchTemplesByIds(supabase, templeIds),
    getAssetsByHeritageIds(heritageIds).catch(() => new Map()),
    getDocentsByHeritageIds(heritageIds).catch(() => new Map()),
  ]);
  const templesById = new Map(temples.map((temple) => [temple.id, temple]));
  return (data ?? []).map((row) => applyDocentContent(normalizeHeritageContent({
    ...row,
    asset: assetsByHeritageId.get(row.id),
  }, templesById.get(row.temple_id)), docents.get(row.id)));
}

async function fetchTemplesByIds(supabase, templeIds) {
  if (!templeIds.length) return [];
  const result = await supabase.from('temples').select('*')
    .in('id', templeIds).eq('is_active', true);
  if (result.error) throw result.error;
  return result.data ?? [];
}
