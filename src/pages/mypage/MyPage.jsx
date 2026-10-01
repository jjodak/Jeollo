import { useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider.jsx';
import { useCollection } from '../../components/CollectionProvider.jsx';
import { getSupabaseClient } from '../../lib/supabaseClient.js';
import { deleteMember } from '../../services/accountService.js';
import { PolicyDialog } from '../auth/PolicyDialog.jsx';
import chevron from '../../assets/figma/account/chevron.svg';
import chevronGreen from '../../assets/figma/account/chevron-green.svg';
import { PermissionRow } from './PermissionRow.jsx';
import { PermissionNotice } from './PermissionNotice.jsx';

export function MyPage({ onOpenAuth, onOpenCollection, onChooseRegion, onUseDeviceLocation, onStartScan, onScanFile }) {
  const auth = useAuth();
  const collection = useCollection();
  const photoInput = useRef(null);
  const [policy, setPolicy] = useState(null);
  const [permissionNotice, setPermissionNotice] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [guestNotifications, setGuestNotifications] = useState(() => {
    try { return localStorage.getItem('jeollo.notifications.v1') === 'true'; } catch { return false; }
  });
  const member = auth.memberReady;
  const notifications = member ? auth.profile?.notifications_enabled : guestNotifications;
  const templeCount = new Set(collection.stamps.map((stamp) => stamp.templeId).filter(Boolean)).size;
  const act = async (operation) => { setBusy(true); setError(''); try { await operation(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const toggleNotifications = () => act(async () => {
    if (member) {
      const { error: failure } = await getSupabaseClient().from('profiles').update({ notifications_enabled: !notifications }).eq('id', auth.user.id);
      if (failure) throw new Error('알림 설정을 저장하지 못했어요.');
      auth.refreshAccount();
    } else { localStorage.setItem('jeollo.notifications.v1', String(!notifications)); setGuestNotifications(!notifications); }
  });
  return <section className="mypage">
    <header className="mypage-header"><h1>마이페이지</h1><div className="mypage-mode" aria-label={member ? '회원으로 로그인됨' : '비회원'}>
      <span className={!member ? 'selected' : ''}>게스트</span><span className={member ? 'selected' : ''}>회원</span></div></header>
    <section className="mypage-profile"><div className="mypage-avatar" aria-hidden="true" />
      <div><h2>{member ? auth.profile?.display_name || '여행자' : '여행자'}</h2>
        <span className={member ? 'mypage-badge is-member' : 'mypage-badge'}>{member ? auth.user.app_metadata?.providers?.includes('google') ? '구글 연동' : '이메일 연동' : '게스트'}</span></div></section>
    {!member ? <section className="mypage-backup"><div><div><strong>내 우표를 백업하세요</strong><p>기기를 바꿔도 우표가 유지돼요</p></div>
      <button onClick={() => onOpenAuth('signup')}>백업하기</button></div></section> : null}
    <section className="mypage-collection"><h2>나의 수집 현황</h2>
      <div className="mypage-stats">{[[templeCount, '방문 사찰'], [collection.scannedCount, '스캔 유물'], [collection.stamps.length, '수집 우표']].map(([count, label]) =>
        <div key={label}><strong>{count}</strong><span>{label}</span>{label === '스캔 유물' && count > 0 ? <small>NEW</small> : null}</div>)}</div>
      <button className="mypage-catalog-link" onClick={() => onOpenCollection()}><span>우표 도감 보기</span><img src={chevronGreen} alt="" /></button>
      {collection.syncStatus === 'loading' ? <p className="account-message" role="status">기록을 동기화하고 있어요.</p> : null}
      {collection.syncError ? <p className="account-error" role="alert">{collection.syncError} <button className="account-text" onClick={collection.refreshCollection}>다시 시도</button></p> : null}
    </section>
    <section className="mypage-section"><h2>설정</h2>
      <PermissionRow type="geolocation" label="위치 권한" onNotice={setPermissionNotice} onAlternative={onChooseRegion} onGranted={onUseDeviceLocation} />
      <PermissionRow type="camera" label="카메라 권한" onNotice={setPermissionNotice} onAlternative={() => photoInput.current?.click()} onGranted={onStartScan} />
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={(event) => {
        const [file] = event.target.files || [];
        event.target.value = '';
        if (file) onScanFile(file);
      }} />
      <div className="mypage-row"><span>알림</span><button className={`mypage-switch ${notifications ? 'is-on' : ''}`} role="switch" aria-label="알림" aria-checked={Boolean(notifications)} disabled={busy} onClick={toggleNotifications}><span /></button></div>
    </section>
    <section className="mypage-section"><h2>계정 및 정보</h2>
      <button className="mypage-row" disabled={busy} onClick={member ? () => act(auth.signOut) : () => onOpenAuth('login')}><span>{member ? '로그아웃' : '로그인 연동'}</span><img src={chevron} alt="" /></button>
      {['이용약관', '개인정보처리방침', '위치기반서비스 이용약관'].map((title) => <button className="mypage-row" key={title} onClick={() => setPolicy(title)}><span>{title}</span><img src={chevron} alt="" /></button>)}
    </section>
    <footer className="mypage-footer">
      <button disabled={busy} onClick={() => setConfirmation(member ? 'delete' : 'reset')}>{member ? '회원 탈퇴' : '데이터 초기화'}</button>
    </footer>
    {error ? <p className="account-error" role="alert">{error}</p> : null}
    {policy ? <PolicyDialog title={policy} onClose={() => setPolicy(null)} /> : null}
    {permissionNotice ? <PermissionNotice notice={permissionNotice} onClose={() => setPermissionNotice(null)} /> : null}
    {confirmation ? <div className="account-modal-backdrop"><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{confirmation === 'delete' ? '회원 탈퇴' : '데이터 초기화'}</h2>
      <p>{confirmation === 'delete' ? '계정과 수집 기록이 영구 삭제돼요. 탈퇴하시겠어요?' : '이 기기의 비회원 스탬프가 삭제돼요. 초기화하시겠어요?'}</p>
      <button className="account-primary" disabled={busy} onClick={() => act(async () => {
        if (confirmation === 'delete') { await deleteMember(); localStorage.removeItem('jeollo.guest.v1'); window.location.reload(); }
        else collection.resetGuestCollection();
        setConfirmation(null);
      })}>{confirmation === 'delete' ? '탈퇴하기' : '초기화하기'}</button>
      <button className="account-text" disabled={busy} onClick={() => setConfirmation(null)}>취소</button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </section></div> : null}
  </section>;
}
