import { useState } from 'react';
import { useAuth } from '../../components/AuthProvider.jsx';
import { getSupabaseClient } from '../../lib/supabaseClient.js';
import { acceptMemberConsents, accountError, authRedirectUrl, CONSENT_VERSION, PENDING_CONSENT_KEY, signInWithGoogle } from '../../services/accountService.js';
import { TermsPage } from './TermsPage.jsx';
import logo from '../../assets/figma/account/logo.svg';

export function AuthPage({ onClose, forceRecovery = false, initialMode }) {
  const auth = useAuth();
  const [step, setStep] = useState(forceRecovery || initialMode === 'login' ? 'email' : 'welcome');
  const [method, setMethod] = useState('guest');
  const [mode, setMode] = useState(initialMode ?? 'signup');
  const [draft, setDraft] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(forceRecovery);
  const act = async (operation) => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (e) { setError(e instanceof Error && !e.code ? e.message : accountError(e)); }
    finally { setBusy(false); }
  };
  const startTerms = (nextMethod) => { setMethod(nextMethod); setStep('terms'); setError(''); };
  const accept = (choices) => act(async () => {
    if (auth.user) { await acceptMemberConsents(choices); auth.refreshAccount(); onClose?.(); return; }
    if (method === 'guest') { auth.startGuest(choices); onClose?.(); return; }
    sessionStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, choices,
      method, email: method === 'email' ? draft.email.trim().toLowerCase() : undefined, createdAt: Date.now() }));
    const client = getSupabaseClient();
    if (method === 'google') {
      await signInWithGoogle();
    } else {
      const { data, error: failure } = await client.auth.signUp({ email: draft.email.trim(), password: draft.password,
        options: { emailRedirectTo: authRedirectUrl(), data: { display_name: draft.name.trim() || '여행자' } } });
      if (failure) throw failure;
      setDraft((prev) => ({ ...prev, password: '' }));
      if (!data.session) {
        setStep('email'); setMode('login');
        setMessage('이메일로 보낸 인증 링크를 확인해주세요. 인증 후 로그인하면 기록이 연동됩니다.');
      } else onClose?.();
    }
  });
  if (step === 'terms') return <TermsPage busy={busy} error={error} onAccept={accept}
    onBack={() => { setStep(method === 'email' ? 'email' : 'welcome'); setError(''); }} />;

  const submitEmail = (event) => {
    event.preventDefault();
    if (mode === 'signup') { startTerms('email'); return; }
    act(async () => {
      const { error: failure } = await getSupabaseClient().auth.signInWithPassword({ email: draft.email.trim(), password: draft.password });
      if (failure) throw failure;
      setDraft((prev) => ({ ...prev, password: '' })); onClose?.();
    });
  };

  return <section className={`account-page ${step === 'welcome' ? 'onboarding-page' : 'email-page'}`}>
    {step === 'welcome' ? <>
      {onClose ? <button className="account-back" aria-label="로그인 화면 닫기" onClick={onClose}>‹</button> : null}
      <div className="onboarding-brand"><div className="onboarding-logo"><img src={logo} alt="절로" /></div>
        <p>걸음마다 전시가 되는<br />지붕 없는 박물관, 절로</p></div>
      <div className="onboarding-actions">
        <p className="onboarding-sync">로그인하면 기기를 바꿔도 내가 방문한 기록이 연동됩니다.</p>
        <button className="account-secondary" onClick={() => { setMode('signup'); setStep('email'); setError(''); }}>이메일로 시작하기</button>
        <button className="account-secondary" onClick={() => startTerms('google')}>Google로 시작하기</button>
        <button className="onboarding-login" onClick={() => { setMode('login'); setStep('email'); setError(''); }}>이미 회원이신가요? 로그인</button>
        <div className="onboarding-divider"><span />또는<span /></div>
        <button className="onboarding-guest" onClick={() => auth.guest ? onClose?.() : startTerms('guest')}>비회원으로 시작하기</button>
        <p className="onboarding-warning">앱을 지우거나 기기를 바꾸면 나의 기록이 사라집니다<br />나중에 계정연동을 하면 기록을 이어갈 수 있습니다.</p>
      </div>
    </> : <>
      <button className="account-back" aria-label={recovery ? '비밀번호 변경 취소' : '가입 화면으로 돌아가기'} onClick={() => {
        if (recovery) { auth.finishPasswordRecovery(); return; }
        setStep('welcome'); setDraft((prev) => ({ ...prev, password: '' })); setError('');
      }}>‹</button>
      <h1>{recovery ? '새 비밀번호 설정' : mode === 'signup' ? '이메일로 회원가입' : '이메일로 로그인'}</h1>
      <p className="email-description">절로와 함께 나의 발견을 이어가세요.</p>
      <form onSubmit={recovery ? (event) => { event.preventDefault(); act(async () => {
        const { error: failure } = await getSupabaseClient().auth.updateUser({ password: draft.password });
        if (failure) throw failure; setRecovery(false); setDraft((prev) => ({ ...prev, password: '' })); auth.finishPasswordRecovery(); onClose?.();
      }); } : submitEmail}>
        {!recovery && mode === 'signup' ? <label>이름<input value={draft.name} maxLength={80} required autoComplete="nickname" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label> : null}
        {!recovery ? <label>이메일<input type="email" value={draft.email} required autoComplete="email" onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label> : null}
        <label>비밀번호<input type="password" value={draft.password} minLength={mode === 'signup' || recovery ? 8 : undefined} required maxLength={128}
          autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'} placeholder="8자 이상 입력해주세요" onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></label>
        <button className="account-primary" disabled={busy}>{busy ? '처리 중…' : recovery ? '비밀번호 변경' : mode === 'signup' ? '다음' : '로그인'}</button>
      </form>
      {!recovery && mode === 'login' ? <button className="account-secondary email-google-login" disabled={busy} onClick={() => act(async () => {
        sessionStorage.removeItem(PENDING_CONSENT_KEY);
        await signInWithGoogle();
      })}>Google로 로그인</button> : null}
      {!recovery ? <button className="account-text" disabled={busy} onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setMessage(''); }}>
        {mode === 'signup' ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 회원가입'}</button> : null}
      {!recovery && mode === 'login' ? <button className="account-text" disabled={busy} onClick={() => act(async () => {
        if (!draft.email.trim()) throw new Error('이메일을 입력해주세요.');
        const { error: failure } = await getSupabaseClient().auth.resetPasswordForEmail(draft.email.trim(), { redirectTo: authRedirectUrl() });
        if (failure) throw failure; setMessage('비밀번호 재설정 이메일을 보냈어요.');
      })}>비밀번호를 잊으셨나요?</button> : null}
    </>}
    {error ? <p className="account-error" role="alert">{error}</p> : null}
    {message ? <p className="account-message" role="status">{message}</p> : null}
  </section>;
}
