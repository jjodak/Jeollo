import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } })));
});

const first = {
  id: 'heritage-one', temple_id: 'temple-one', name: '석련대', is_active: true,
  description: '등록된 문화유산 설명입니다.', docent_text: '연꽃 받침의 이야기를 함께 만나보세요.',
  thumbnail_url: '',
  content: {
    docent: { title: '연꽃 받침의 이야기', subtitle: '돌에 담긴 시간' },
    stamp: { title: '석련대' },
    detail: { text: '더 자세한 문화유산 이야기입니다.', facts: [{ label: '재질', value: '화강암' }] },
  },
};
const firstAsset = {
  id: first.id,
  thumbnail_image_url: '/src/assets/figma/dancheong-tour.png',
  stamp_image_url: '/test-fixtures/seokryeondae.svg',
};
const second = { id: 'heritage-two', name: '아직 만나지 않은 문화유산', is_active: true, description: '', docent_text: '', content: {} };

async function setup(page, { match = first, failStorage = false } = {}) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 35.7229, longitude: 127.0534 });
  const catalog = [match || first, second];
  const errors = [];
  await page.route('**/test-fixtures/seokryeondae.svg', (route) => route.fulfill({
    path: 'tests/fixtures/stamps/seokryeondae.svg', contentType: 'image/svg+xml',
  }));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ failStorage }) => {
    window.__failStorage = failStorage;
    if (failStorage) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.__failStorage && key === 'jeollo.stamps.v1') throw new DOMException('Storage full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    }
    const spoken = [];
    window.__spokenScripts = spoken;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak: (utterance) => spoken.push(utterance.text), cancel: () => {},
      pause: () => {}, resume: () => {}, paused: false,
    } });
  }, { failStorage });
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const isSingle = route.request().headers().accept?.includes('object+json');
    let data;
    if (url.pathname.endsWith('/heritages')) {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      data = id ? catalog.filter((entry) => entry.id === id) : catalog;
    } else if (url.pathname.endsWith('/heritage_assets')) {
      const idFilter = url.searchParams.get('id');
      data = idFilter?.startsWith('in.')
        ? [firstAsset].filter((asset) => idFilter.includes(asset.id))
        : [firstAsset];
    } else if (url.pathname.endsWith('/temples')) {
      data = [{ id: 'temple-one', name: '금산사', latitude: 35.7229, longitude: 127.0534, is_active: true }];
    } else data = [];
    await route.fulfill({ json: isSingle ? data[0] ?? null : data });
  });
  await page.route('**/api/monthly-temple-events**', (route) => route.fulfill({ json: { ok: true, events: [] } }));
  await page.route('**/api/recognize-heritage', (route) => route.fulfill({ json: {
    ok: true, match: match ? { ...match, docentText: match.docent_text, thumbnailUrl: match.thumbnail_url, confidence: 0.98 } : null,
  } }));
  await page.route('**/maps.js?**', (route) => route.abort());
  await page.goto('/');
  return errors;
}

async function scan(page) {
  await page.getByRole('button', { name: '스캔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('src/assets/figma/dancheong-tour.png');
}

test('detail displays only populated facts and hides empty sections', async ({ page }) => {
  await setup(page, { match: { ...first, description: '', content: { detail: {
    facts: [{ label: '재질', value: ' 화강암 ' }, { label: '시대', value: '  ' }, { label: '', value: '빈 항목명' }],
  } } } });
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(page.getByRole('region', { name: '상세 설명' })).toHaveCount(0);
  const facts = page.getByRole('region', { name: '세부 사항' });
  await expect(facts.locator('dt')).toHaveText(['재질']);
  await expect(facts.locator('dd')).toHaveText(['화강암']);
});

test('detail hides the facts heading when all database values are empty', async ({ page }) => {
  await setup(page, { match: { ...first, content: { detail: { text: '', facts: [{ label: '재질', value: '' }] } } } });
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(page.getByRole('region', { name: '세부 사항' })).toHaveCount(0);
  await expect(page.getByText('세부 정보를 준비하고 있어요.')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '상세 설명' })).toContainText(first.description);
});

test('detail uses all five original Figma icons and wraps long database values', async ({ page }, testInfo) => {
  const rows = [
    { key: 'era', label: '제작 시기', value: '통일신라 말 ~ 고려 초 (9~10세기)' },
    { key: 'material', label: '재질', value: '화강암' },
    { key: 'dimensions', label: '크기', value: '높이 약 40cm · 지름 약 95cm' },
    { key: 'designation', label: '지정 정보', value: '보물 제23호 · 1963년 1월 21일 지정' },
    { key: 'collection', label: '소장 정보', value: '국가유산청 · 금산사 소장' },
  ];
  await setup(page, { match: { ...first, content: { detail: { facts: rows } } } });
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  const facts = page.getByRole('region', { name: '세부 사항' });
  await expect(facts.locator('dt')).toHaveText(rows.map((row) => row.label));
  await expect(facts.locator('dd')).toHaveText(rows.map((row) => row.value));
  await expect(facts.locator('img')).toHaveCount(5);
  await expect.poll(() => facts.locator('dt span').evaluateAll((labels) => labels.every((label) =>
    getComputedStyle(label).position === 'absolute' && label.getBoundingClientRect().width === 1,
  ))).toBe(true);
  const columns = await facts.locator('.scan-detail-fact-row').first().evaluate((el) => {
    const icon = el.querySelector('img').getBoundingClientRect();
    return el.querySelector('dd').getBoundingClientRect().left - icon.left;
  });
  expect(columns).toBeCloseTo(44, 0);
  await expect.poll(() => facts.locator('img').evaluateAll((images) => images.every((img) => {
    const rect = img.getBoundingClientRect();
    return img.complete && img.naturalWidth > 0 && Math.abs(rect.width - 19.9917) < 0.1
      && Math.abs(rect.height - 19.9917) < 0.1;
  }))).toBe(true);
  await facts.scrollIntoViewIfNeeded();
  await expect.poll(() => facts.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  if (testInfo.project.name === 'mobile') {
    await facts.screenshot({ path: '/tmp/jeollo-scan-detail-facts.png' });
  }
});

test('camera capture sends a compressed image through the recognition route', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      async getUserMedia() {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1000;
        const context = canvas.getContext('2d');
        context.fillStyle = '#497945';
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas.captureStream(1);
      },
    } });
  });
  await setup(page);
  await page.getByRole('button', { name: '스캔', exact: true }).click();
  await page.getByRole('button', { name: '카메라 켜고 스캔하기', exact: true }).click();
  await expect.poll(() => page.locator('video').evaluate((video) => video.videoWidth)).toBe(1600);
  const request = page.waitForRequest('**/api/recognize-heritage');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  const payload = (await request).postDataJSON();
  expect(Object.keys(payload)).toEqual(['imageDataUrl', 'latitude', 'longitude']);
  expect(payload.latitude).toBe(35.7229);
  expect(payload.longitude).toBe(127.0534);
  expect(payload.imageDataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  const dimensions = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, payload.imageDataUrl);
  expect(dimensions).toEqual([960, 600]);
  await expect(page.getByText('새로운 스탬프를 획득했어요')).toBeVisible();
});

test('recognition, docent, detail and exploration share one persistent stamp', async ({ page }, testInfo) => {
  const repeatedHeritageReads = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/heritages') && url.searchParams.has('id')) repeatedHeritageReads.push(url.pathname);
  });
  const errors = await setup(page);
  await scan(page);
  await expect(page.getByText('새로운 스탬프를 획득했어요')).toBeVisible();
  expect(repeatedHeritageReads).toEqual([]);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await expect.poll(() => page.locator('.scan-docent-stage .scan-analysis-image').getAttribute('src')).toContain(firstAsset.thumbnail_image_url);
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__spokenScripts)).toEqual([first.docent_text]);
  await page.getByRole('button', { name: '스크립트 보기' }).click();
  await expect(page.locator('.scan-docent-script')).toHaveText(first.docent_text);
  await page.locator('.scan-docent-range-label input').fill('3');
  await expect.poll(() => page.evaluate(() => window.__spokenScripts.length)).toBe(2);
  expect((await page.evaluate(() => window.__spokenScripts))[1].length).toBeLessThan(first.docent_text.length);
  expect(await page.locator('.app-viewport').evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(testInfo.project.use.viewport.width);
  await page.screenshot({ path: `/private/tmp/jeollo-docent-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '석련대', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.scan-detail-photo img').getAttribute('src')).toContain(firstAsset.thumbnail_image_url);
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(page.getByText('더 자세한 문화유산 이야기입니다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '내 스탬프 모두 보기' }).click();
  await expect(page.getByRole('tab', { name: '우표 스탬프' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('1 / 2 발견')).toBeVisible();
  await expect(page.getByRole('button', { name: '석련대, 획득한 스탬프' })).toBeVisible();
  await page.getByRole('button', { name: '석련대, 획득한 스탬프' }).scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.collection-stamp-card .stamp-image img').evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: `/private/tmp/jeollo-collection-${testInfo.project.name}.png` });
  const firstDate = await page.evaluate(() => JSON.parse(localStorage.getItem('jeollo.stamps.v1')).items[0].acquiredAt);
  await page.reload();
  await scan(page);
  await expect(page.getByText('이미 획득한 스탬프예요')).toBeVisible();
  const items = await page.evaluate(() => JSON.parse(localStorage.getItem('jeollo.stamps.v1')).items);
  expect(items).toHaveLength(1);
  expect(items[0].acquiredAt).toBe(firstDate);
  await page.getByRole('button', { name: '탐색', exact: true }).click();
  await expect(page.getByText('1개 획득')).toBeVisible();
  await page.getByRole('button', { name: '내 스탬프 보기', exact: true }).click();
  await page.getByRole('button', { name: '더보기 · 도슨트' }).click();
  await expect(page.getByRole('heading', { name: '석련대', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '스탬프 모음으로 돌아가기' }).click();
  await expect(page.getByText('1 / 2 발견')).toBeVisible();
  expect(errors).toEqual([]);
});

test('empty collections and browsing locked heritage never award a stamp', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '탐색', exact: true }).click();
  await page.getByRole('button', { name: '내 스탬프 보기', exact: true }).click();
  await expect(page.getByText('아직 획득한 스탬프가 없어요')).toBeVisible();
  await page.getByRole('tab', { name: '문화유산 도감' }).click();
  await page.getByRole('button', { name: `${second.name}, 문화유산 도감` }).click();
  await page.getByRole('button', { name: '더보기 · 도슨트' }).click();
  await expect(page.getByRole('button', { name: '도슨트 재생', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '도슨트로 돌아가기', exact: true }).click();
  await expect(page.getByText('도슨트가 아직 준비되지 않았어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '스탬프 저장 다시 시도' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('jeollo.stamps.v1'))).toBeNull();
});

test('failed recognition does not award a stamp', async ({ page }) => {
  await setup(page, { match: null });
  await scan(page);
  await expect(page.getByRole('heading', { name: '인식하지 못했어요' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('jeollo.stamps.v1'))).toBeNull();
});

test('failed persistence offers retry while docent remains available', async ({ page }) => {
  await setup(page, { failStorage: true });
  await scan(page);
  await expect(page.getByRole('button', { name: '스탬프 저장 다시 시도' })).toBeVisible();
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await expect(page.getByText('스탬프 저장 대기')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('jeollo.stamps.v1'))).toBeNull();
  await page.evaluate(() => { window.__failStorage = false; });
  await page.getByRole('button', { name: '스탬프 저장 다시 시도' }).click();
  await expect(page.getByText('새로운 스탬프를 획득했어요')).toBeVisible();
});

test('leaving an in-flight recognition does not award a late stamp', async ({ page }) => {
  await setup(page);
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  await page.route('**/api/recognize-heritage', async (route) => {
    await pending;
    await route.fulfill({ json: { ok: true, match: first } });
  });
  const requested = page.waitForRequest('**/api/recognize-heritage');
  await scan(page);
  await requested;
  await page.getByRole('button', { name: '탐색', exact: true }).click();
  const response = page.waitForResponse('**/api/recognize-heritage');
  finish();
  await response;
  await page.getByRole('button', { name: '내 스탬프 보기', exact: true }).click();
  await expect(page.getByText('아직 획득한 스탬프가 없어요')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('jeollo.stamps.v1'))).toBeNull();
});

test('long scripts and missing images remain usable without speech support', async ({ page }, testInfo) => {
  const longHeritage = { ...first, docent_text: '등록된 긴 도슨트 원고입니다. '.repeat(100), thumbnail_url: '/missing-photo.png',
    content: { ...first.content, stamp: { title: '스탬프이미지없이긴이름을가진문화유산', imageUrl: '/missing-stamp.png' } } };
  await setup(page, { match: longHeritage });
  await page.route('**/missing-*.png', (route) => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect(page.getByText('이 브라우저에서는 음성 재생을 지원하지 않아요. 스크립트로 감상해주세요.')).toBeVisible();
  await expect(page.locator('.scan-docent-script')).toHaveText(longHeritage.docent_text.trim());
  await page.getByRole('button', { name: '내 스탬프 보기', exact: true }).click();
  await expect(page.getByText('1 / 2 발견')).toBeVisible();
  const panel = page.getByRole('tabpanel');
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `/private/tmp/jeollo-missing-content-${testInfo.project.name}.png` });
});

test('location permission denial uses the existing error screen without sending a photo', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: 1 });
  });
  let recognitionRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/recognize-heritage')) recognitionRequests += 1;
  });
  await scan(page);
  await expect(page.getByText('문화재를 인식하려면 위치 권한이 필요해요. 브라우저 설정에서 위치 권한을 허용해 주세요.')).toBeVisible();
  expect(recognitionRequests).toBe(0);
});

test('nearby temple error retains the existing analysis UI and does not award stamps', async ({ page }) => {
  await setup(page);
  await page.route('**/api/recognize-heritage', (route) => route.fulfill({ json: {
    ok: false, match: null, code: 'NO_NEARBY_TEMPLE', error: '주변 500m 이내에 등록된 사찰이 없어요.',
  } }));
  await scan(page);
  await expect(page.getByText('주변 500m 이내에 등록된 사찰이 없어요.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('jeollo.stamps.v1'))).toBeNull();
});

function docentAudioFixture(seconds = 8) {
  const sampleRate = 8000;
  const pcmBytes = seconds * sampleRate * 2;
  const wav = Buffer.alloc(44 + pcmBytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcmBytes, 40);
  return wav;
}

async function fulfillDocentAudio(route) {
  const body = docentAudioFixture();
  const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
  await route.fulfill({
    status: range ? 206 : 200, contentType: 'audio/wav', body: body.subarray(start, end + 1),
    headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${body.length}` } : {}) },
  });
}

test('registered audio plays the file, seeks and shares playback with the detail mini player', async ({ page }) => {
  await setup(page, { match: { ...first, audio_url: '/test-fixtures/docent.wav' } });
  await page.route('**/test-fixtures/docent.wav', fulfillDocentAudio);
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  const audio = page.locator('audio');
  await expect(audio).toHaveAttribute('src', '/test-fixtures/docent.wav');
  await expect.poll(() => audio.evaluate((el) => el.duration)).toBe(8);
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect.poll(() => audio.evaluate((el) => el.paused)).toBe(false);
  await expect.poll(() => audio.evaluate((el) => el.currentTime)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__spokenScripts)).toEqual([]);
  await page.getByRole('button', { name: '도슨트 일시정지', exact: true }).click();
  await expect.poll(() => audio.evaluate((el) => el.paused)).toBe(true);
  await page.getByRole('slider', { name: '도슨트 진행률' }).press('Home');
  for (let i = 0; i < 4; i += 1) await page.getByRole('slider', { name: '도슨트 진행률' }).press('ArrowRight');
  await expect.poll(() => audio.evaluate((el) => el.currentTime)).toBe(4);
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(page.getByRole('region', { name: '세부 사항' })).toContainText('화강암');
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect.poll(() => audio.evaluate((el) => el.paused)).toBe(false);
  await page.getByRole('slider', { name: '도슨트 진행률' }).press('End');
  await expect.poll(() => audio.evaluate((el) => el.paused)).toBe(true);
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect.poll(() => audio.evaluate((el) => el.currentTime)).toBeLessThan(2);
  await page.getByRole('button', { name: '내 스탬프 보기', exact: true }).click();
  await expect.poll(() => audio.count()).toBe(0);
});

test('broken registered audio reports an error without speaking the script', async ({ page }) => {
  await setup(page, { match: { ...first, audio_url: '/test-fixtures/broken.mp3' } });
  await page.route('**/test-fixtures/broken.mp3', (route) => route.fulfill({ status: 404, body: '' }));
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('등록된 음성 파일');
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('등록된 음성 파일');
  expect(await page.evaluate(() => window.__spokenScripts)).toEqual([]);
});

test('audio-only records play without browser speech support and stop on retake', async ({ page }) => {
  await setup(page, { match: { ...first, description: '', docent_text: '', audio_url: '/test-fixtures/docent.wav' } });
  await page.route('**/test-fixtures/docent.wav', fulfillDocentAudio);
  await page.evaluate(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  await scan(page);
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((el) => el.paused)).toBe(false);
  await page.evaluate(() => { window.__docentAudio = document.querySelector('audio'); });
  await page.getByRole('button', { name: '다시 찍기', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__docentAudio.paused)).toBe(true);
});

async function installTrackedCamera(page, delayFirst = false) {
  await page.addInitScript(({ delayFirst }) => {
    window.__cameraSessions = [];
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      async getUserMedia() {
        const session = {};
        window.__cameraSessions.push(session);
        if (delayFirst && window.__cameraSessions.length === 1) {
          await new Promise((resolve) => { window.__releaseFirstCamera = resolve; });
        }
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        canvas.getContext('2d').fillRect(0, 0, 640, 480);
        const stream = canvas.captureStream(1);
        stream.addTrack(stream.getVideoTracks()[0].clone());
        session.stream = stream;
        return stream;
      },
    } });
  }, { delayFirst });
}

test('leaving scan for any tab stops every camera track and returning opens a fresh stream', async ({ page }) => {
  await installTrackedCamera(page);
  await setup(page);
  for (const [index, destination] of ['홈', '탐색', '내 정보'].entries()) {
    await page.getByRole('button', { name: '스캔', exact: true }).click();
    await page.getByRole('button', { name: '카메라 켜고 스캔하기', exact: true }).click();
    await expect(page.locator('.scan-page')).toHaveClass(/scan-page--ready/);
    await expect.poll(() => page.evaluate((i) => window.__cameraSessions[i].stream.getTracks().map((track) => track.readyState), index)).toEqual(['live', 'live']);
    await page.getByRole('button', { name: destination, exact: true }).click();
    await expect.poll(() => page.evaluate((i) => window.__cameraSessions[i].stream.getTracks().map((track) => track.readyState), index)).toEqual(['ended', 'ended']);
    await expect(page.locator('video')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.__cameraSessions.length)).toBe(3);
});

test('a camera request resolving after tab exit is stopped without affecting the new scan session', async ({ page }) => {
  await installTrackedCamera(page, true);
  await setup(page);
  await page.getByRole('button', { name: '스캔', exact: true }).click();
  await page.getByRole('button', { name: '카메라 켜고 스캔하기', exact: true }).click();
  await expect(page.locator('.scan-page')).toHaveClass(/scan-page--loading/);
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await page.getByRole('button', { name: '스캔', exact: true }).click();
  await page.getByRole('button', { name: '카메라 켜고 스캔하기', exact: true }).click();
  await expect(page.locator('.scan-page')).toHaveClass(/scan-page--ready/);
  await page.evaluate(() => window.__releaseFirstCamera());
  await expect.poll(() => page.evaluate(() => window.__cameraSessions[0].stream?.getTracks().map((track) => track.readyState))).toEqual(['ended', 'ended']);
  expect(await page.evaluate(() => window.__cameraSessions[1].stream.getTracks().map((track) => track.readyState))).toEqual(['live', 'live']);
  await expect.poll(() => page.locator('video').evaluate((video) => video.srcObject === window.__cameraSessions[1].stream)).toBe(true);
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__cameraSessions[1].stream.getTracks().map((track) => track.readyState))).toEqual(['ended', 'ended']);
});
