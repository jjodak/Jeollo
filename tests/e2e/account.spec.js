import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream'] } });

const userId = '11111111-1111-4111-8111-111111111111';
const user = { id: userId, email: 'traveler@example.test', aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
const consent = { version: '2026-10-01', age: true, terms: true, privacy: true, location: false, marketing: false };
const heritage = { id: 'h1', name: '석련대', temple_id: 't1', description: '돌에 담긴 이야기', docent_text: '연꽃 받침 이야기', content: {}, is_active: true };
const guestStamp = { id: 'h1', name: '석련대', templeId: 't1', place: '금산사', stamp: { title: '석련대', imageUrl: '' }, acquiredAt: '2026-09-01T00:00:00.000Z' };
const session = { access_token: `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: 2000000000 })).toString('base64url')}.test-signature`,
  refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: 2000000000, user };

async function mockApp(page, { member = false, agreed = true, guestStamps = [], importFailure = false, profileFailure = false, googleEnabled = false, emptyCatalog = false, showLocationIntro = false } = {}) {
  if (!showLocationIntro) await page.addInitScript(() => sessionStorage.setItem('jeollo.location-intro.v1', 'allowed'));
  const state = { stamps: [], scans: [], consent: agreed ? consent : null, calls: [], profile: { id: userId, display_name: '유진', notifications_enabled: false } };
  if (member || guestStamps.length) await page.addInitScript(({ member, session, guestStamps }) => {
    if (member) localStorage.setItem('sb-jeollo-auth-token', JSON.stringify(session));
    if (guestStamps.length && !localStorage.getItem('jeollo.stamps.v1')) localStorage.setItem('jeollo.stamps.v1', JSON.stringify({ version: 1, items: guestStamps }));
  }, { member, session, guestStamps });
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    state.calls.push({ path: url.pathname, body: route.request().postDataJSON() });
    if (url.pathname.endsWith('/settings')) return route.fulfill({ json: { external: { email: true, google: googleEnabled } } });
    if (url.pathname.endsWith('/signup')) return route.fulfill({ json: { user, session: null } });
    if (url.pathname.endsWith('/token')) return route.fulfill({ json: session });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
    if (url.pathname.endsWith('/authorize')) return route.fulfill({ json: { code: 'provider_disabled', msg: 'Provider disabled' }, status: 400 });
    return route.fulfill({ json: user });
  });
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    let data;
    if (table === 'accept_member_consents') {
      const body = request.postDataJSON(); state.calls.push({ path: table, body });
      state.consent = { ...consent, location: body.p_location, marketing: body.p_marketing };
      return route.fulfill({ status: 204 });
    }
    if (table === 'save_member_stamps') {
      const body = request.postDataJSON(); state.calls.push({ path: table, body });
      if (importFailure) return route.fulfill({ status: 500, json: { code: 'db_error', message: 'unavailable' } });
      expect(body.p_expected_user).toBe(userId);
      for (const item of body.p_items) if (!state.stamps.some((row) => row.heritage_id === item.id)) state.stamps.push({ heritage_id: item.id, acquired_at: item.acquiredAt });
      if (body.p_scanned) for (const item of body.p_items) if (!state.scans.some((row) => row.heritage_id === item.id)) state.scans.push({ heritage_id: item.id, first_scanned_at: item.acquiredAt });
      return route.fulfill({ json: state.stamps });
    }
    if (table === 'profiles') {
      if (profileFailure) return route.fulfill({ status: 500, json: { message: 'unavailable' } });
      if (request.method() === 'PATCH') Object.assign(state.profile, request.postDataJSON());
      data = state.profile;
    } else if (table === 'user_consents') data = state.consent;
    else if (table === 'user_stamps') data = url.searchParams.has('heritage_id')
      ? state.stamps.find((row) => row.heritage_id === url.searchParams.get('heritage_id').replace('eq.', '')) ?? null : state.stamps;
    else if (table === 'user_scans') data = state.scans;
    else if (table === 'heritages') data = request.headers().accept?.includes('object+json') ? heritage : emptyCatalog ? [] : [heritage];
    else if (table === 'temples') data = [{ id: 't1', name: '금산사', latitude: 35, longitude: 127, is_active: true }];
    else data = [];
    return route.fulfill({ json: data });
  });
  await page.route('**/api/monthly-temple-events**', (route) => route.fulfill({ json: { ok: true, events: [] } }));
  await page.route('**/api/recognize-heritage', (route) => route.fulfill({ json: { ok: true, match: { ...heritage, confidence: .99 } } }));
  return state;
}

async function requiredConsents(page) {
  for (const label of ['만 14세 이상입니다', '이용약관 동의', '개인정보 수집·이용 동의']) await page.getByRole('checkbox', { name: `필수 ${label}`, exact: true }).check();
}

test('first launch matches onboarding, required consent gates guest mode and guest mypage uses real counts', async ({ page }, testInfo) => {
  await mockApp(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '이메일로 시작하기' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.screenshot({ path: `/private/tmp/jeollo-onboarding-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
  const start = page.getByRole('button', { name: '동의하고 시작하기' });
  await expect(start).toBeDisabled();
  await requiredConsents(page);
  await expect(start).toBeEnabled();
  await expect(start).toHaveCSS('background-color', 'rgb(33, 122, 68)');
  await expect(page.getByRole('checkbox', { name: /위치기반서비스/ })).not.toBeChecked();
  await page.screenshot({ path: `/private/tmp/jeollo-terms-${testInfo.project.name}.png` });
  await page.getByRole('checkbox', { name: /개인정보 수집/ }).uncheck();
  await expect(start).toBeDisabled();
  await page.getByRole('checkbox', { name: '전체 동의' }).check();
  await expect(page.getByRole('checkbox', { name: /사찰 소식/ })).toBeChecked();
  await start.click();
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.getByRole('heading', { name: '여행자' })).toBeVisible();
  await expect(page.getByRole('button', { name: '백업하기' })).toBeVisible();
  await expect(page.locator('.mypage-stats strong')).toHaveText(['0', '0', '0']);
  await page.screenshot({ path: `/private/tmp/jeollo-guest-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: '이용약관', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('약관 내용을 준비하고 있어요');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '우표 도감 보기' }).click();
  await expect(page.getByRole('tab', { name: '우표 스탬프' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
});

test('email signup submits only after required consent and prompts email confirmation', async ({ page }) => {
  const state = await mockApp(page);
  await page.goto('/');
  await page.getByRole('button', { name: '이메일로 시작하기' }).click();
  await page.getByLabel('이름', { exact: true }).fill('유진');
  await page.getByLabel('이메일', { exact: true }).fill('traveler@example.test');
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  expect(state.calls.filter((call) => call.path.endsWith('/signup'))).toHaveLength(0);
  await requiredConsents(page);
  await page.getByRole('button', { name: '동의하고 시작하기' }).click();
  await expect(page.getByRole('status')).toContainText('인증 링크');
  expect(state.calls.find((call) => call.path.endsWith('/signup')).body).toMatchObject({ email: user.email, data: { display_name: '유진' } });
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('');
});

test('guest records import once, login persists on reload and logout does not expose member stamps', async ({ page }, testInfo) => {
  const state = await mockApp(page, { guestStamps: [guestStamp] });
  await page.goto('/');
  await page.getByRole('button', { name: '이메일로 시작하기' }).click();
  await page.getByRole('button', { name: '이미 계정이 있나요? 로그인' }).click();
  await page.getByLabel('이메일', { exact: true }).fill(user.email);
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.getByRole('heading', { name: '유진' })).toBeVisible();
  await expect(page.locator('.mypage-stats strong')).toHaveText(['1', '1', '1']);
  await expect(page.getByRole('button', { name: '백업하기' })).toHaveCount(0);
  await page.screenshot({ path: `/private/tmp/jeollo-member-${testInfo.project.name}.png` });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jeollo.stamps.v1')).items)).toEqual([]);
  expect(state.calls.filter((call) => call.path === 'save_member_stamps')).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.locator('.mypage-stats strong')).toHaveText(['1', '1', '1']);
  await page.getByRole('switch', { name: '알림' }).click();
  await expect(page.getByRole('switch', { name: '알림' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('button', { name: '이메일로 시작하기' })).toBeVisible();
  await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
  await requiredConsents(page);
  await page.getByRole('button', { name: '동의하고 시작하기' }).click();
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.locator('.mypage-stats strong')).toHaveText(['0', '0', '0']);
});

test('failed account import preserves guest records and shows retry without claiming backup succeeded', async ({ page }) => {
  await mockApp(page, { member: true, guestStamps: [guestStamp], importFailure: true });
  await page.goto('/');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jeollo.stamps.v1')).items)).toEqual([guestStamp]);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('existing members log in without a consent screen or fabricated consent records', async ({ page }) => {
  const state = await mockApp(page, { member: true, agreed: false });
  await page.goto('/');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: '동의하고 시작하기' })).toHaveCount(0);
  expect(state.calls.filter((call) => call.path === 'accept_member_consents')).toEqual([]);
});

test('member scan stores stamps and unique scanned heritage on the account without guest storage', async ({ page }) => {
  const state = await mockApp(page, { member: true });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 35, longitude: 127 });
  await page.goto('/');
  await page.getByRole('button', { name: '스캔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('src/assets/figma/dancheong-tour.png');
  await expect(page.getByText('새로운 스탬프를 획득했어요')).toBeVisible();
  expect(state.calls.find((call) => call.path === 'save_member_stamps').body).toMatchObject({ p_scanned: true, p_expected_user: userId });
  expect(await page.evaluate(() => localStorage.getItem('jeollo.stamps.v1'))).toBeNull();
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.locator('.mypage-stats strong')).toHaveText(['1', '1', '1']);
});

test('profile errors block access rather than entering the app without verified membership', async ({ page }) => {
  await mockApp(page, { member: true, profileFailure: true });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('회원 정보');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('disabled Google provider keeps the user in the app and displays an actionable error', async ({ page }) => {
  await mockApp(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Google로 시작하기' }).click();
  await requiredConsents(page);
  await page.getByRole('button', { name: '동의하고 시작하기' }).click();
  await expect(page.getByRole('alert')).toContainText('이메일로 시작해주세요');
  expect(new URL(page.url()).host).toBe('127.0.0.1:5183');
});

test('enabled Google OAuth uses the configured provider and app redirect after consent', async ({ page }) => {
  const state = await mockApp(page, { googleEnabled: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Google로 시작하기' }).click();
  expect(state.calls.filter((call) => call.path.endsWith('/authorize'))).toHaveLength(0);
  await requiredConsents(page);
  const request = page.waitForRequest('**/auth/v1/authorize?**');
  await page.getByRole('button', { name: '동의하고 시작하기' }).click();
  const url = new URL((await request).url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5183/');
});

test('saved member stamps remain renderable when the active catalog is empty', async ({ page }) => {
  const state = await mockApp(page, { member: true, emptyCatalog: true });
  state.stamps.push({ heritage_id: 'h1', acquired_at: guestStamp.acquiredAt, heritage: { ...heritage, temple: { name: '금산사' } } });
  await page.goto('/');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await expect(page.locator('.mypage-stats strong')).toHaveText(['1', '0', '1']);
  await page.getByRole('button', { name: '우표 도감 보기' }).click();
  await expect(page.getByRole('button', { name: '석련대, 획득한 스탬프' })).toBeVisible();
});

test('email password reset requests an auth recovery link using the app redirect', async ({ page }) => {
  const state = await mockApp(page);
  await page.goto('/');
  await page.getByRole('button', { name: '이메일로 시작하기' }).click();
  await page.getByRole('button', { name: '이미 계정이 있나요? 로그인' }).click();
  await page.getByLabel('이메일', { exact: true }).fill(user.email);
  await page.getByRole('button', { name: '비밀번호를 잊으셨나요?' }).click();
  await expect(page.getByRole('status')).toContainText('재설정 이메일');
  expect(state.calls.find((call) => call.path.endsWith('/recover')).body.email).toBe(user.email);
});

test('recovery callback opens the new password form and exits it after a successful update', async ({ page }) => {
  const state = await mockApp(page);
  const fragment = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token,
    token_type: 'bearer', expires_in: '3600', type: 'recovery' });
  await page.goto(`/#${fragment}`);
  await expect(page.getByRole('heading', { name: '새 비밀번호 설정' })).toBeVisible();
  await page.getByLabel('비밀번호', { exact: true }).fill('updated-test-password');
  await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(state.calls.find((call) => call.path.endsWith('/user') && call.body?.password)?.body.password).toBe('updated-test-password');
});

test('welcome offers immediate email login without any consent step even for legacy members', async ({ page }, testInfo) => {
  const state = await mockApp(page, { agreed: false });
  await page.goto('/');
  await page.getByRole('button', { name: '이미 회원이신가요? 로그인' }).click();
  await expect(page.getByRole('heading', { name: '이메일로 로그인' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toBeVisible();
  await expect(page.getByLabel('이름', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `/private/tmp/jeollo-direct-login-${testInfo.project.name}.png` });
  await page.getByLabel('이메일', { exact: true }).fill(user.email);
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: '동의하고 시작하기' })).toHaveCount(0);
  expect(state.calls.filter((call) => call.path === 'accept_member_consents' || call.path.endsWith('/signup'))).toEqual([]);
});

test('guest mypage login link goes directly to login and Google login starts without consent', async ({ page }) => {
  const state = await mockApp(page, { googleEnabled: true });
  await page.addInitScript(() => localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } })));
  await page.goto('/');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await page.getByRole('button', { name: '로그인 연동' }).click();
  await expect(page.getByRole('heading', { name: '이메일로 로그인' })).toBeVisible();
  const oauth = page.waitForRequest('**/auth/v1/authorize?**');
  await page.getByRole('button', { name: 'Google로 로그인' }).click();
  expect(new URL((await oauth).url()).searchParams.get('provider')).toBe('google');
  expect(state.calls.filter((call) => call.path === 'accept_member_consents')).toEqual([]);
});

test.describe('mypage browser permissions', () => {
  test('location and camera request real browser access and release the camera after checking', async ({ page }, testInfo) => {
    await mockApp(page);
    await page.context().grantPermissions(['geolocation', 'camera']);
    await page.context().setGeolocation({ latitude: 35, longitude: 127 });
    await page.addInitScript(() => {
      localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } }));
      window.__positionOptions = [];
      const locate = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (success, failure, options) => { window.__positionOptions.push(options); locate(success, failure, options); };
      const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.__cameraCalls = [];
      navigator.mediaDevices.getUserMedia = async (options) => { const stream = await open(options); window.__cameraCalls.push({ options, tracks: stream.getTracks() }); return stream; };
    });
    await page.goto('/');
    await page.getByRole('button', { name: '내 정보', exact: true }).click();
    const location = page.getByRole('button', { name: /^위치 권한/ });
    const camera = page.getByRole('button', { name: /^카메라 권한/ });
    await expect(location).toContainText('허용됨');
    await expect(camera).toContainText('허용됨');
    await location.click();
    await expect(page.getByRole('dialog')).toContainText('내 주변 사찰을 찾아드려요');
    await page.screenshot({ path: `/private/tmp/jeollo-location-dialog-${testInfo.project.name}.png` });
    await page.getByRole('button', { name: '위치 권한 허용하기', exact: true }).click();
    await expect(location).toHaveAttribute('aria-busy', 'false');
    expect((await page.evaluate(() => window.__positionOptions)).some((item) => item.maximumAge === 0 && item.enableHighAccuracy === true)).toBe(true);
    await camera.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('문화유산을 스캔하면');
    expect(await page.evaluate(() => window.__cameraCalls.length)).toBe(0);
    const geometry = await dialog.boundingBox();
    expect(geometry.width).toBe(Math.min(345, page.viewportSize().width - 48));
    expect(geometry.height).toBe(426);
    await expect(dialog.locator('img')).toHaveCount(7);
    await expect.poll(() => dialog.locator('img').evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
    const assets = await dialog.locator('img').evaluateAll((images) => images.map((img) => ({ source: img.getAttribute('src'), width: img.getBoundingClientRect().width, loaded: img.complete && img.naturalWidth > 0 })));
    assets.forEach((asset) => expect(/^(data:image\/svg\+xml,|\/.*\/permissions\/)/.test(asset.source)).toBe(true));
    assets.forEach((asset, index) => expect(asset.width).toBeCloseTo([27, 16, 4.33333, 16, 4.33333, 16, 16][index], 1));
    await page.screenshot({ path: `/private/tmp/jeollo-camera-dialog-${testInfo.project.name}.png` });
    await page.getByRole('button', { name: '카메라 켜고 스캔하기', exact: true }).click();
    await expect(page.locator('.scan-page')).toHaveClass(/scan-page--ready/);
    expect(await page.evaluate(() => window.__cameraCalls[0].options)).toEqual({ video: true, audio: false });
    expect(await page.evaluate(() => window.__cameraCalls[0].tracks.map((track) => track.readyState))).toEqual(['ended']);
  });
});

test('camera query fallback still requests access and denial shows settings help in view', async ({ page }) => {
  await mockApp(page);
  await page.addInitScript(() => {
    localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } }));
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => { throw new TypeError('unsupported'); } } });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  const camera = page.getByRole('button', { name: /^카메라 권한/ });
  await expect(camera).toContainText('확인하기');
  await camera.click();
  await page.getByRole('button', { name: '카메라 켜고 스캔하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('사이트 설정');
  await expect(camera).toContainText('거부됨');
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('permission changes refresh immediately and GPS timeout does not turn granted access into denied', async ({ page }) => {
  await mockApp(page);
  await page.addInitScript(() => {
    localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } }));
    const permissions = {};
    window.__setPermission = (name, state) => { permissions[name].state = state; permissions[name].dispatchEvent(new Event('change')); };
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async ({ name }) => {
      if (!permissions[name]) permissions[name] = Object.assign(new EventTarget(), { state: 'granted' });
      return permissions[name];
    } } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_success, failure) => failure({ code: 3 }) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  const location = page.getByRole('button', { name: /^위치 권한/ });
  const camera = page.getByRole('button', { name: /^카메라 권한/ });
  await expect(camera).toContainText('허용됨');
  await page.evaluate(() => window.__setPermission('camera', 'denied'));
  await expect(camera).toContainText('거부됨');
  await page.evaluate(() => window.__setPermission('camera', 'granted'));
  await expect(camera).toContainText('허용됨');
  await location.click();
  await page.getByRole('button', { name: '위치 권한 허용하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('GPS 수신 상태');
  await expect(location).toContainText('허용됨');
});

test('home location introduction waits for approval before requesting GPS', async ({ page }, testInfo) => {
  await mockApp(page, { showLocationIntro: true });
  await page.addInitScript(() => {
    localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } }));
    window.__locationRequests = 0;
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: 'prompt' }) } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success) => {
      window.__locationRequests++;
      success({ coords: { latitude: 35, longitude: 127 } });
    } } });
  });
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('내 주변 사찰을 찾아드려요');
  expect(await page.evaluate(() => window.__locationRequests)).toBe(0);
  expect((await dialog.boundingBox()).height).toBe(358);
  await expect(dialog.locator('img')).toHaveCount(1);
  expect(await dialog.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0 && Math.abs(img.getBoundingClientRect().width - 27.9891) < .01)).toBe(true);
  await page.screenshot({ path: `/private/tmp/jeollo-home-location-dialog-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: '위치 권한 허용하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.figma-place-copy h2')).toHaveText('금산사');
  expect(await page.evaluate(() => window.__locationRequests)).toBe(1);
});

test('manual region selection from home and mypage filters real temples without requesting GPS', async ({ page }) => {
  await mockApp(page, { showLocationIntro: true });
  await page.addInitScript(() => {
    localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } }));
    window.__locationRequests = 0;
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: 'prompt' }) } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: () => { window.__locationRequests++; } } });
  });
  await page.route('**/rest/v1/temples?**', (route) => route.fulfill({ json: [
    { id: 't1', name: '금산사', address: '전북특별자치도 김제시', latitude: 35, longitude: 127 },
    { id: 't2', name: '서울 사찰', address: '서울특별시 종로구', latitude: 37, longitude: 127 },
  ] }));
  await page.goto('/');
  await page.getByRole('button', { name: '직접 지역 선택하기' }).click();
  await page.getByLabel('지역', { exact: true }).selectOption('서울');
  await page.getByRole('button', { name: '이 지역으로 보기' }).click();
  await expect(page.locator('.figma-place-copy h2')).toHaveText('서울 사찰');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await page.getByRole('button', { name: /^위치 권한/ }).click();
  await page.getByRole('button', { name: '직접 지역 선택하기' }).click();
  await page.getByLabel('지역', { exact: true }).selectOption('전북');
  await page.getByRole('button', { name: '이 지역으로 보기' }).click();
  await expect(page.locator('.figma-place-copy h2')).toHaveText('금산사');
  expect(await page.evaluate(() => window.__locationRequests)).toBe(0);
  await page.reload();
  await expect(page.locator('.figma-place-copy h2')).toHaveText('금산사');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mypage photo alternative opens the picker and scans on the member account without camera access', async ({ page }) => {
  const state = await mockApp(page, { member: true });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 35, longitude: 127 });
  await page.addInitScript(() => {
    window.__cameraRequests = 0;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { window.__cameraRequests++; throw new DOMException('denied', 'NotAllowedError'); } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '내 정보', exact: true }).click();
  await page.getByRole('button', { name: /^카메라 권한/ }).click();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '사진으로 대신 스캔하기' }).click();
  await (await picker).setFiles('src/assets/figma/dancheong-tour.png');
  await expect(page.getByText('새로운 스탬프를 획득했어요')).toBeVisible();
  expect(state.calls.find((call) => call.path === 'save_member_stamps').body).toMatchObject({ p_scanned: true, p_expected_user: userId });
  expect(await page.evaluate(() => window.__cameraRequests)).toBe(0);
});
