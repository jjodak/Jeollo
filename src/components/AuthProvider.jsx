import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { acceptMemberConsents, CONSENT_VERSION, GUEST_MODE_KEY, hasRequiredConsents, loadAccount, PENDING_CONSENT_KEY } from '../services/accountService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [revision, setRevision] = useState(0);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [guest, setGuest] = useState(() => {
    try { const choice = JSON.parse(localStorage.getItem(GUEST_MODE_KEY)); return choice?.version === CONSENT_VERSION && hasRequiredConsents(choice.choices); }
    catch { return false; }
  });

  useEffect(() => {
    let alive = true;
    let client;
    try { client = getSupabaseClient(); } catch { setAuthReady(true); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      if (alive) { setSession(next); setAuthReady(true); if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true); }
    });
    client.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setAuthReady(true); }
    }).catch(() => { if (alive) setAuthReady(true); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    let alive = true;
    setAccount((previous) => previous?.userId === userId ? previous : null);
    setAccountError('');
    if (!userId) return;
    (async () => {
      let next = await loadAccount(userId);
      if (!alive) return;
      if (!hasRequiredConsents(next.consent)) {
        let pending;
        try { pending = JSON.parse(sessionStorage.getItem(PENDING_CONSENT_KEY)); } catch { /* User can consent again. */ }
        const sameSignup = pending?.method === 'email'
          ? pending.email === session.user.email?.toLowerCase()
          : pending?.method === 'google' && session.user.app_metadata?.providers?.includes('google');
        if (pending?.version === CONSENT_VERSION && sameSignup && Date.now() - pending.createdAt < 3600000 && hasRequiredConsents(pending.choices)) {
          await acceptMemberConsents(pending.choices);
          if (!alive) return;
          next = await loadAccount(userId);
        }
      }
      if (!alive) return;
      sessionStorage.removeItem(PENDING_CONSENT_KEY);
      setAccount({ ...next, userId });
    })().catch((error) => { if (alive) setAccountError(error.message); });
    return () => { alive = false; };
  }, [userId, revision]);

  const refreshAccount = useCallback(() => setRevision((value) => value + 1), []);
  const startGuest = useCallback((choices) => {
    if (!hasRequiredConsents(choices)) throw new Error('필수 항목에 모두 동의해주세요.');
    localStorage.setItem(GUEST_MODE_KEY, JSON.stringify({ version: CONSENT_VERSION, choices }));
    setGuest(true);
  }, []);
  const signOut = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw new Error('로그아웃하지 못했어요. 다시 시도해주세요.');
    localStorage.removeItem(GUEST_MODE_KEY);
    sessionStorage.removeItem(PENDING_CONSENT_KEY);
    setGuest(false);
    setAccount(null);
    setSession(null);
  }, []);

  const currentAccount = account?.userId === userId ? account : null;
  // Login is complete once the authenticated member profile has loaded.
  // Required consent is collected by the signup flow, never invented at login.
  const memberReady = Boolean(userId && currentAccount?.profile);
  const value = useMemo(() => ({ session, user: session?.user ?? null, profile: currentAccount?.profile,
    memberReady, guest, authReady, accountLoading: Boolean(userId && !currentAccount && !accountError),
    accountError, refreshAccount, startGuest, signOut, passwordRecovery, finishPasswordRecovery: () => setPasswordRecovery(false) }),
  [session, currentAccount, memberReady, guest, authReady, userId, accountError, refreshAccount, startGuest, signOut, passwordRecovery]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
