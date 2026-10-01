import { getSupabaseClient } from '../lib/supabaseClient.js';
import { normalizeHeritageContent } from '../utils/heritageContent.js';

export async function readMemberCollection(userId) {
  const client = getSupabaseClient();
  // Paginate so the default PostgREST row cap cannot silently truncate a collection.
  const readAll = async (table, columns) => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from(table).select(columns).eq('user_id', userId)
        .order('heritage_id').range(offset, offset + 499);
      if (error) throw new Error('회원 수집 기록을 불러오지 못했어요. 다시 시도해주세요.');
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  };
  const [stamps, scans] = await Promise.all([
    readAll('user_stamps', 'heritage_id,acquired_at,heritage:heritages(*,temple:temples(name,description,latitude,longitude))'),
    readAll('user_scans', 'heritage_id,first_scanned_at'),
  ]);
  return { stamps: stamps.map((row) => ({
    ...normalizeHeritageContent(row.heritage ?? { id: row.heritage_id, name: '문화유산 정보 준비 중' }, row.heritage?.temple),
    acquiredAt: row.acquired_at,
  })), scans };
}

export async function saveMemberStamps(items, { scanned = false, userId } = {}) {
  const { data, error } = await getSupabaseClient().rpc('save_member_stamps', {
    p_items: items.map(({ id, acquiredAt }) => ({ id, acquiredAt })), p_scanned: scanned, p_expected_user: userId,
  });
  if (error) throw new Error('회원 기록을 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.');
  return data;
}

export async function readMemberStamp(userId, heritageId) {
  const { data, error } = await getSupabaseClient().from('user_stamps').select('acquired_at')
    .eq('user_id', userId).eq('heritage_id', heritageId).maybeSingle();
  if (error) throw new Error('회원 기록을 불러오지 못했어요. 다시 시도해주세요.');
  return data;
}
