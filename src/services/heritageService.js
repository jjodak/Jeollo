import { getSupabaseClient } from '../lib/supabaseClient.js';

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
