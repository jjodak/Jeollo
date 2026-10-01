import { getSupabaseClient } from '../lib/supabaseClient.js';

export const CONSENT_VERSION = '2026-10-01';
export const GUEST_MODE_KEY = 'jeollo.guest.v1';
export const PENDING_CONSENT_KEY = 'jeollo.pending-consent.v1';
export const CONSENT_ITEMS = [
  { id: 'age', label: '만 14세 이상입니다', required: true },
  { id: 'terms', label: '이용약관 동의', required: true },
  { id: 'privacy', label: '개인정보 수집·이용 동의', required: true },
  { id: 'location', label: '위치기반서비스 이용약관 동의', required: false },
  { id: 'marketing', label: '사찰 소식·행사 알림 수신 동의', required: false },
];

export function hasRequiredConsents(choices) {
  return CONSENT_ITEMS.filter((item) => item.required).every((item) => choices?.[item.id] === true);
}

export function accountError(error) {
  const code = error?.code;
  if (code === 'invalid_credentials') return '이메일 또는 비밀번호를 확인해주세요.';
  if (code === 'email_not_confirmed') return '이메일 인증을 완료한 뒤 로그인해주세요.';
  if (code === 'user_already_exists') return '이미 가입한 이메일이에요. 로그인해주세요.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return '요청이 많아요. 잠시 후 다시 시도해주세요.';
  if (code === 'weak_password') return '비밀번호는 8자 이상으로 입력해주세요.';
  if (code === 'provider_disabled') return 'Google 로그인을 준비하고 있어요. 이메일로 시작해주세요.';
  return '요청을 완료하지 못했어요. 잠시 후 다시 시도해주세요.';
}

export async function loadAccount(userId) {
  const client = getSupabaseClient();
  const [profile, consent] = await Promise.all([
    client.from('profiles').select('id,display_name,notifications_enabled').eq('id', userId).single(),
    client.from('user_consents').select('version,age,terms,privacy,location,marketing,accepted_at')
      .eq('user_id', userId).eq('version', CONSENT_VERSION).maybeSingle(),
  ]);
  if (profile.error || consent.error) throw new Error('회원 정보를 불러오지 못했어요. 다시 시도해주세요.');
  return { profile: profile.data, consent: consent.data };
}

export async function acceptMemberConsents(choices) {
  if (!hasRequiredConsents(choices)) throw new Error('필수 항목에 모두 동의해주세요.');
  const { error } = await getSupabaseClient().rpc('accept_member_consents', {
    p_version: CONSENT_VERSION, p_age: choices.age, p_terms: choices.terms, p_privacy: choices.privacy,
    p_location: Boolean(choices.location), p_marketing: Boolean(choices.marketing),
  });
  if (error) throw new Error('동의 내용을 저장하지 못했어요. 다시 시도해주세요.');
}

export function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export async function signInWithGoogle() {
  const client = getSupabaseClient();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('로그인 설정을 확인하지 못했어요. 다시 시도해주세요.');
  const settings = await response.json();
  if (!settings.external?.google) throw Object.assign(new Error('Provider disabled'), { code: 'provider_disabled' });
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function deleteMember() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('다시 로그인해주세요.');
  const response = await fetch('/api/delete-account', {
    method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) throw new Error('회원 탈퇴를 완료하지 못했어요. 다시 시도해주세요.');
  await client.auth.signOut({ scope: 'local' });
}
