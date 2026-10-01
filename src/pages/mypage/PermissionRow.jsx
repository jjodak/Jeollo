import { useEffect, useRef, useState } from 'react';
import { PERMISSION_LABELS, permissionFailure, queryBrowserPermission, requestBrowserPermission } from '../../services/permissionService.js';
import chevronSmall from '../../assets/figma/account/chevron-small.svg';
import { PermissionRequestDialog } from '../../components/permissions/PermissionRequestDialog.jsx';

export function PermissionRow({ type, label, onNotice, onAlternative, onGranted }) {
  const [status, setStatus] = useState('checking');
  const [requesting, setRequesting] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const refreshPermission = useRef(null);
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    let detach = () => {};
    const refresh = async () => {
      const current = ++generation.current;
      const result = await queryBrowserPermission(type);
      if (!alive || current !== generation.current) return;
      detach();
      setStatus(result.state);
      const changed = () => { if (alive) setStatus(result.permission.state); };
      if (result.permission?.addEventListener) {
        result.permission.addEventListener('change', changed);
        detach = () => result.permission.removeEventListener('change', changed);
      } else detach = () => {};
      return result;
    };
    refreshPermission.current = refresh;
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; mounted.current = false; generation.current++; refreshPermission.current = null; detach(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [type]);

  const request = async () => {
    if (requesting) return;
    setRequesting(true);
    onNotice(null);
    try {
      await requestBrowserPermission(type);
      const latest = await refreshPermission.current?.();
      if (mounted.current && (!latest || latest.state === 'unknown')) setStatus('granted');
      if (mounted.current) { setShowRequest(false); onGranted?.(); }
    } catch (error) {
      const failure = permissionFailure(type, error);
      const latest = await queryBrowserPermission(type);
      if (mounted.current) {
        setShowRequest(false);
        setStatus(['unknown', 'prompt'].includes(latest.state) ? failure.state : latest.state);
        onNotice({ title: label, message: failure.message });
      }
    } finally { if (mounted.current) setRequesting(false); }
  };
  return <><button className="mypage-row" type="button" onClick={() => setShowRequest(true)} disabled={requesting} aria-busy={requesting}>
    <span>{label}</span><span className={`permission-value is-${status}`}>
      {requesting ? '요청 중…' : PERMISSION_LABELS[status]}<img src={chevronSmall} alt="" />
    </span>
  </button>
    {showRequest ? <PermissionRequestDialog type={type} busy={requesting} onAllow={request}
      onClose={() => setShowRequest(false)} onAlternative={() => { setShowRequest(false); onAlternative?.(); }} /> : null}
  </>;
}
