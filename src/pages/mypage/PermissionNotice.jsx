import { useEffect, useRef } from 'react';

export function PermissionNotice({ notice, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="account-dialog" onCancel={onClose} aria-labelledby="permission-notice-title">
    <h2 id="permission-notice-title">{notice.title}</h2><p>{notice.message}</p>
    <button type="button" className="account-primary" onClick={onClose}>확인</button>
  </dialog>;
}
