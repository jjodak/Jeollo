import { test, expect } from '@playwright/test';

const first = {
  id: 'heritage-one', temple_id: 'temple-one', name: '석련대', is_active: true,
  description: '등록된 문화유산 설명입니다.', docent_text: '연꽃 받침의 이야기를 함께 만나보세요.',
  thumbnail_url: '/src/assets/figma/dancheong-tour.png',
  content: {
    docent: { title: '연꽃 받침의 이야기', subtitle: '돌에 담긴 시간' },
    stamp: { title: '석련대', imageUrl: '/src/assets/figma/map-stamp-art-seokryeondae.svg' },
    detail: { text: '더 자세한 문화유산 이야기입니다.', facts: [{ label: '재질', value: '화강암' }] },
  },
};
const second = { id: 'heritage-two', name: '아직 만나지 않은 문화유산', is_active: true, description: '', docent_text: '', content: {} };

async function setup(page, { match = first, failStorage = false } = {}) {
  const catalog = [match || first, second];
  const errors = [];
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

test('recognition, docent, detail and exploration share one persistent stamp', async ({ page }, testInfo) => {
  const errors = await setup(page);
  await scan(page);
  await expect(page.getByText('새로운 스탬프를 획득했어요')).toBeVisible();
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  await page.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__spokenScripts)).toEqual([first.docent_text]);
  await page.getByRole('button', { name: '스크립트 보기' }).click();
  await expect(page.locator('.scan-docent-script')).toHaveText(first.docent_text);
  expect(await page.locator('.app-viewport').evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(testInfo.project.use.viewport.width);
  await page.screenshot({ path: `/private/tmp/jeollo-docent-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '석련대', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: `${second.name}, 미획득` }).click();
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
