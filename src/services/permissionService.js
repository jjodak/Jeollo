import { getCurrentLocation } from './locationService.js';

export const PERMISSION_LABELS = {
  checking: '확인 중…', granted: '허용됨', denied: '거부됨', prompt: '권한 요청',
  unknown: '확인하기', insecure: 'HTTPS 필요', unsupported: '사용 불가',
};

function unavailableState(type, browser) {
  if (browser.isSecureContext === false) return 'insecure';
  if (type === 'camera' ? !browser.navigator?.mediaDevices?.getUserMedia : !browser.navigator?.geolocation) return 'unsupported';
  return null;
}

export async function queryBrowserPermission(type, browser = window) {
  const unavailable = unavailableState(type, browser);
  if (unavailable) return { state: unavailable, permission: null };
  try {
    if (!browser.navigator.permissions?.query) return { state: 'unknown', permission: null };
    const permission = await browser.navigator.permissions.query({ name: type });
    return { state: permission.state, permission };
  } catch { return { state: 'unknown', permission: null }; }
}

export function permissionFailure(type, error, browser = window) {
  const name = type === 'camera' ? '카메라' : '위치';
  const unavailable = unavailableState(type, browser);
  if (unavailable === 'insecure') return { state: 'insecure', message: `${name} 권한은 HTTPS 주소 또는 이 컴퓨터의 localhost에서 요청할 수 있어요. HTTPS 주소로 접속한 뒤 다시 시도해주세요.` };
  if (unavailable === 'unsupported') return { state: 'unsupported', message: `이 브라우저에서 ${name} 기능을 사용할 수 없어요. 지원하는 브라우저에서 다시 시도해주세요.` };
  if (error?.code === 'GPS_PERMISSION_DENIED' || error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return { state: 'denied', message: `${name} 권한이 차단되어 있어요. 주소창의 사이트 정보 또는 브라우저의 사이트 설정에서 ${name} 권한을 허용한 뒤 다시 시도해주세요. 앱에서는 브라우저의 차단 설정을 직접 바꿀 수 없어요.` };
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return { state: 'unknown', message: '사용할 수 있는 카메라를 찾지 못했어요. 카메라 연결과 기기 설정을 확인해주세요.' };
  if (error?.name === 'NotReadableError' || error?.name === 'AbortError') return { state: 'unknown', message: '카메라를 켜지 못했어요. 카메라를 사용 중인 다른 앱을 종료한 뒤 다시 시도해주세요.' };
  return { state: 'unknown', message: type === 'geolocation'
    ? '현재 위치를 찾지 못했어요. 기기의 위치 서비스와 GPS 수신 상태를 확인한 뒤 다시 시도해주세요.'
    : '카메라를 확인하지 못했어요. 기기의 카메라 설정을 확인한 뒤 다시 시도해주세요.' };
}

export async function requestBrowserPermission(type, browser = window, locate = getCurrentLocation) {
  const unavailable = unavailableState(type, browser);
  if (unavailable) throw Object.assign(new Error('Permission unavailable'), { permissionUnavailable: unavailable });
  if (type === 'geolocation') { await locate({ fresh: true }); return; }
  // Opening the camera requests real access; release every track immediately.
  // No photo, audio, or location is stored by this permission check.
  const stream = await browser.navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  stream.getTracks().forEach((track) => track.stop());
}
