import { useEffect, useRef, useId } from 'react';
import cameraIcon from '../../assets/figma/permissions/camera.svg';
import locationIcon from '../../assets/figma/permissions/location.svg';
import photoIcon from '../../assets/figma/permissions/photo-step.svg';
import docentIcon from '../../assets/figma/permissions/docent-step.svg';
import stampIcon from '../../assets/figma/permissions/stamp-step.svg';
import arrowIcon from '../../assets/figma/permissions/step-arrow.svg';
import galleryIcon from '../../assets/figma/permissions/gallery.svg';

export function PermissionRequestDialog({ type, onAllow, onAlternative, onClose, busy = false }) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const camera = type === 'camera';
  useEffect(() => { dialog.current.showModal(); dialog.current.focus(); }, []);
  return <dialog ref={dialog} className={`permission-request-dialog permission-request-dialog--${type}`}
    tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="permission-request-icon"><span><img src={camera ? cameraIcon : locationIcon} alt="" /></span></div>
    <h2 id={titleId} className="permission-request-title">{camera ? <>문화유산을 스캔하면<br />이야기를 들려드려요</> : '내 주변 사찰을 찾아드려요'}</h2>
    {camera ? <>
      <div className="permission-request-steps" aria-label="사진 찍기, 도슨트, 우표 수집">
        {[[photoIcon, '사진 찍기'], [docentIcon, '도슨트'], [stampIcon, '우표 수집']].map(([icon, label], index) =>
          <div className="permission-request-step-group" key={label}>
            {index > 0 ? <span className="permission-request-arrow"><img src={arrowIcon} alt="" /></span> : null}
            <div className="permission-request-step"><span><img src={icon} alt="" /></span><p>{label}</p></div>
          </div>)}
      </div>
      <p id={descriptionId} className="permission-request-privacy">카메라 권한 외의 개인정보는 수집되지 않습니다.</p>
    </> : <p id={descriptionId} className="permission-request-description">내 위치 정보를 기반으로<br />사찰과 문화유산을 추천합니다.</p>}
    <div className="permission-request-primary"><button type="button" className="account-primary" onClick={onAllow} disabled={busy} aria-busy={busy}>
      {busy ? '요청 중…' : camera ? '카메라 켜고 스캔하기' : '위치 권한 허용하기'}
    </button></div>
    <button type="button" className="permission-request-alternative" onClick={onAlternative} disabled={busy}>
      {camera ? <><img src={galleryIcon} alt="" />사진으로 대신 스캔하기</> : '직접 지역 선택하기'}
    </button>
  </dialog>;
}
