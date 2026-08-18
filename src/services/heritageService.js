import { getSupabaseClient } from '../lib/supabaseClient.js';

export async function getHeritagesByTempleId(templeId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('heritages')
    .select('*')
    .eq('temple_id', templeId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getHeritageById(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('heritages')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getHeritageImages(heritageId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('heritage_images')
    .select('*')
    .eq('heritage_id', heritageId)
    .order('is_primary', { ascending: false })
    .order('angle_type', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
