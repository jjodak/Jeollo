import { useState } from 'react';
import { CONSENT_ITEMS, hasRequiredConsents } from '../../services/accountService.js';
import { PolicyDialog } from './PolicyDialog.jsx';
import checkAll from '../../assets/figma/account/check-all.svg';
import checkOn from '../../assets/figma/account/check-on.svg';
import checkTerms from '../../assets/figma/account/check-terms.svg';
import checkOff from '../../assets/figma/account/check-off.svg';

export function TermsPage({ onAccept, onBack, busy, error }) {
  const [choices, setChoices] = useState({});
  const [policy, setPolicy] = useState(null);
  const all = CONSENT_ITEMS.every((item) => choices[item.id]);
  return <section className="terms-page account-page">
    <header className="terms-header"><h1>서비스 이용을 위해 동의해주세요</h1>
      {onBack ? <button className="account-back" onClick={onBack} aria-label="가입 화면으로 돌아가기">‹</button> : null}</header>
    <div className="terms-scroll">
      <div className="terms-list">
        <label className="terms-all"><input type="checkbox" checked={all} disabled={busy}
          onChange={() => setChoices(Object.fromEntries(CONSENT_ITEMS.map((item) => [item.id, !all])))} />
          <img src={all ? checkOn : checkAll} alt="" /><strong>전체 동의</strong></label>
        {CONSENT_ITEMS.map((item) => <div className="terms-row" key={item.id}>
          <label><input type="checkbox" checked={Boolean(choices[item.id])} disabled={busy}
            onChange={(event) => setChoices((prev) => ({ ...prev, [item.id]: event.target.checked }))} />
            <img src={choices[item.id] ? item.id === 'terms' ? checkTerms : checkOn : checkOff} alt="" />
            <span className={item.required ? 'consent-badge is-required' : 'consent-badge'}>{item.required ? '필수' : '선택'}</span>
            <span>{item.label}</span></label>
          <button type="button" aria-label={`${item.label} 보기`} onClick={() => setPolicy(item.label)}>보기 &gt;</button>
        </div>)}
      </div>
      <p className="terms-help">선택 항목에 동의하지 않아도 서비스를 이용하실 수 있어요.</p>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </div>
    <footer className="terms-footer"><button className="account-primary" disabled={!hasRequiredConsents(choices) || busy}
      onClick={() => onAccept(choices)}>{busy ? '저장 중…' : '동의하고 시작하기'}</button></footer>
    {policy ? <PolicyDialog title={policy} onClose={() => setPolicy(null)} /> : null}
  </section>;
}
