import { useEffect, useRef } from 'react';

// Replace the notice with approved policy text/URLs when they are supplied.
export function PolicyDialog({ title, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog className="account-dialog" ref={ref} onCancel={onClose}>
    <h2>{title}</h2>
    <p>{title === '만 14세 이상입니다' ? '만 14세 이상인 경우에만 회원가입할 수 있습니다.'
      : '약관 내용을 준비하고 있어요. 정식 서비스 시작 전 이 화면에서 확인하실 수 있습니다.'}</p>
    <button className="account-primary" onClick={onClose}>닫기</button>
  </dialog>;
}
