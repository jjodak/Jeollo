import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } })));
  await page.addInitScript(() => sessionStorage.setItem('jeollo.location-intro.v1', 'allowed'));
});

const temples = [
  { id: 'near', name: '가까운 사찰', address: '등록된 주소', description: '등록된 사찰 설명', latitude: 35, longitude: 127, image_url: '/src/assets/figma/home-hero-scroll.png' },
  { id: 'far', name: '다른 사찰', latitude: 36, longitude: 127, image_url: '/src/assets/figma/dancheong-tour.png' },
];

test('home reuses location and reads while keeping carousel, popup and card alignment', async ({ page }) => {
  const errors = [];
  const reads = { temples: 0, events: 0, heritages: 0 };
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__locationRequests = 0;
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success) {
      window.__locationRequests += 1;
      success({ coords: { latitude: 35, longitude: 127 } });
    } } });
  });
  await page.route('**/rest/v1/**', (route) => {
    const type = new URL(route.request().url()).pathname.split('/').pop();
    if (type in reads) reads[type] += 1;
    return route.fulfill({ json: type === 'temples' ? temples : [] });
  });
  await page.route('**/api/monthly-temple-events**', (route) => {
    reads.events += 1;
    return route.fulfill({ json: { ok: true, events: [
      { id: 'valid', title: '좌표 있는 행사', mapY: 35.1, mapX: 127 },
      { id: 'missing', title: '좌표 없는 행사', mapY: null, mapX: null },
    ] } });
  });
  await page.clock.install();
  await page.goto('/');
  const title = page.locator('.figma-place-copy h2');
  await expect(title).toHaveText('가까운 사찰');
  await page.clock.runFor(5900);
  await expect(title).toHaveText('다른 사찰');
  await page.getByRole('button', { name: '1번째 추천 사진 보기' }).click();
  await expect(title).toHaveText('가까운 사찰');
  await page.clock.runFor(7000);
  await expect(title).toHaveText('가까운 사찰');
  await page.clock.runFor(5000);
  await expect(title).toHaveText('다른 사찰');
  await page.locator('.figma-hero-carousel').dispatchEvent('wheel', { deltaX: -100, deltaY: 0 });
  await expect(title).toHaveText('가까운 사찰');
  await page.getByRole('button', { name: '자세히 보기' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('등록된 주소');
  await expect(dialog).toContainText('등록된 사찰 설명');
  await page.clock.runFor(300);
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return Math.abs(box.y + box.height / 2 - page.viewportSize().height / 2);
  }).toBeLessThan(2);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const tops = await page.locator('.figma-popular-card').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  await expect(page.locator('.figma-event-card').filter({ hasText: '좌표 있는 행사' })).toContainText('km 떨어짐');
  await expect(page.locator('.figma-event-card').filter({ hasText: '좌표 없는 행사' })).not.toContainText('km 떨어짐');
  await page.getByRole('button', { name: '탐색', exact: true }).click();
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await expect(title).toHaveText('가까운 사찰');
  expect(reads).toEqual({ temples: 1, events: 1, heritages: 1 });
  expect(await page.evaluate(() => window.__locationRequests)).toBe(1);
  expect(errors).toEqual([]);
});

test('denied location uses database temples and empty data does not invent recommendations', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success, failure) { failure(); } } });
  });
  let rows = temples;
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    json: new URL(route.request().url()).pathname.endsWith('/temples') ? rows : [],
  }));
  await page.route('**/api/monthly-temple-events**', (route) => route.fulfill({ json: { ok: true, events: [] } }));
  await page.goto('/');
  await expect(page.locator('.figma-place-copy h2')).toHaveText('가까운 사찰');
  rows = [];
  await page.reload();
  await expect(page.locator('.figma-greeting')).toBeVisible();
  await expect(page.locator('.figma-place-copy h2')).toHaveCount(0);
});
