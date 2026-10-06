import { test, expect } from '@playwright/test';
import { docentTemplate1Sample as sample } from '../../src/data/docentTemplate1Sample.js';

function relational(data, heritageId) {
  return { heritage_id: heritageId, template_id: data.templateType, title: data.title, subtitle: data.subtitle,
    background_url: data.backgroundUrl, result_layers: data.resultLayers, selection_layers: data.selectionLayers,
    return_transition: data.returnTransition, is_active: true,
    topics: data.topics.map((t, i) => ({ id: t.id, label: t.label, title: t.title, subtitle: t.subtitle, script: t.script,
      audio_url: t.audioUrl, position: { x: t.x, y: t.y }, return_transition: t.returnTransition, sort_order: i, is_active: true,
      scenes: t.scenes.map((s, j) => ({ id: s.id, title: s.title, body: s.body, audio_url: s.audioUrl,
        layers: s.layers, advance: s.advance, wait_ms: s.waitMs, transition: s.transition, sort_order: j, is_active: true })) })) };
}

async function setup(page, data = sample) {
  const heritage = { id: 'another-heritage', name: '다른 문화재', description: 'DB의 문화재 설명',
    docent_text: '기존 원고', content: {}, temple_id: 'temple-one', is_active: true };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('jeollo.guest.v1', JSON.stringify({ version: '2026-10-01', choices: { age: true, terms: true, privacy: true } }));
    window.__spoken = []; window.__cancelled = 0;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak: (utterance) => window.__spoken.push(utterance.text), cancel: () => window.__cancelled++,
      pause: () => {}, resume: () => {}, paused: false,
    } });
  });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 35.7229, longitude: 127.0534 });
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const single = route.request().headers().accept?.includes('object+json');
    let rows = [];
    if (url.pathname.endsWith('/heritages')) rows = [heritage];
    if (url.pathname.endsWith('/temples')) rows = [{ id: 'temple-one', name: '금산사', is_active: true }];
    if (url.pathname.endsWith('/heritage_docents')) rows = data ? [relational(data, heritage.id)] : [];
    await route.fulfill({ json: single ? rows[0] ?? null : rows });
  });
  await page.route('**/api/monthly-temple-events**', (route) => route.fulfill({ json: { ok: true, events: [] } }));
  await page.route('**/api/recognize-heritage', (route) => route.fulfill({ json: { ok: true,
    match: { ...heritage, docentText: heritage.docent_text, confidence: .98 } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '스캔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('src/assets/figma/dancheong-tour.png');
  await page.getByRole('button', { name: '도슨트 듣기', exact: true }).click();
  return errors;
}

test('all Figma branches finish at selection and can replay without duplicating stamps', async ({ page }, info) => {
  const errors = await setup(page);
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await expect(player).toBeVisible();
  await expect(player.locator('.docent-topics button')).toHaveCount(3);
  if (info.project.name === 'mobile') await player.screenshot({ path: '/tmp/jeollo-docent-selection.png' });
  for (const topic of sample.topics) {
    await player.getByRole('button', { name: topic.label, exact: true }).click();
    for (let i = 0; i < topic.scenes.length; i++) {
      await expect(player).toHaveAttribute('data-scene-id', topic.scenes[i].id);
      await expect(player.locator('.docent-header h2')).toHaveText(topic.title);
      await expect.poll(() => player.locator('img').evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
      await page.waitForTimeout(350);
      if (info.project.name === 'mobile') await player.screenshot({ path: `/tmp/jeollo-docent-${topic.scenes[i].id}.png` });
      await player.getByRole('button', { name: '다음 장면', exact: true }).click();
    }
    await expect(player).toHaveAttribute('data-scene-id', topic.scenes.at(-1).id);
    await player.getByRole('button', { name: '건너뛰기', exact: true }).click();
    await expect(player).toHaveAttribute('data-topic-id', '');
  }
  await player.getByRole('button', { name: sample.topics[0].label, exact: true }).click();
  await expect(player).toHaveAttribute('data-scene-id', 'seated');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jeollo.stamps.v1')));
  expect(stored.items ?? stored).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('two custom questions use database text and skip/detail transitions clean up speech', async ({ page }) => {
  const content = { ...sample, topics: sample.topics.slice(0, 2).map((t, i) => ({ ...t, id: `custom-${i}`,
    label: `문화재 질문 ${i + 1}`, title: `새 도슨트 제목 ${i + 1}`, script: `새 원고 ${i + 1}` })) };
  await setup(page, content);
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await expect(player.locator('.docent-topics button')).toHaveCount(2);
  await player.getByRole('button', { name: '문화재 질문 1', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken.at(-1))).toBe('새 원고 1');
  await player.getByRole('button', { name: '텍스트 자세히보기' }).click();
  await expect(player.getByRole('region', { name: '도슨트 스크립트' })).toHaveText('새 원고 1');
  const cancelled = await page.evaluate(() => window.__cancelled);
  await player.getByRole('button', { name: '건너뛰기' }).click();
  await expect(player).toHaveAttribute('data-topic-id', '');
  await expect.poll(() => page.evaluate(() => window.__cancelled)).toBeGreaterThan(cancelled);
  await player.getByRole('button', { name: '상세 정보' }).click();
  await expect(player).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '다른 문화재', exact: true })).toBeVisible();
});

test('automatic dissolve waits and pauses, then returns without leaving timers behind', async ({ page }) => {
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], label: '자동 질문', script: '', scenes: [
    { id: 'fade-in', advance: 'auto', waitMs: 1200, transition: { type: 'dissolve', durationMs: 400, easing: 'ease-in-out' }, layers: sample.selectionLayers },
    { id: 'finished', advance: 'click', transition: { type: 'dissolve', durationMs: 300 }, layers: [] },
  ] }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: '자동 질문' }).click();
  await expect(player).toHaveAttribute('data-scene-id', 'fade-in');
  await player.getByRole('button', { name: '도슨트 일시정지' }).click();
  await page.waitForTimeout(1750);
  await expect(player).toHaveAttribute('data-scene-id', 'fade-in');
  await player.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  await expect(player).toHaveAttribute('data-scene-id', 'finished');
  await player.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await page.waitForTimeout(1700);
  await expect(player).toHaveAttribute('data-topic-id', '');
});

test('reduced motion renders correct final geometry with no active animations or overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: sample.topics[0].label, exact: true }).click();
  await expect.poll(() => player.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await expect.poll(() => player.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const visible = await player.locator('[data-layer-id=pedestal]').evaluate((el) => ({ top: el.style.top, width: el.style.width }));
  expect(visible).toEqual({ top: '542.42px', width: '190.99px' });
});

test('dissolve crossfades both images even when a scene reuses the same layer ID', async ({ page }) => {
  const first = { id: 'shared', imageUrl: '/docent/template1/sample/marble.png', x: 40, y: 280, width: 160, height: 130 };
  const second = { ...first, imageUrl: '/docent/template1/sample/granite.png', x: 180 };
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], scenes: [
    { id: 'before', layers: [first], advance: 'click' },
    { id: 'after', layers: [second], advance: 'click', transition: { type: 'dissolve', durationMs: 5000, easing: 'linear' } },
  ] }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: sample.topics[0].label, exact: true }).click();
  await player.getByRole('button', { name: '다음 장면', exact: true }).click();
  await expect(player).toHaveAttribute('data-scene-id', 'after');
  await player.evaluate((el) => el.getAnimations({ subtree: true }).forEach((animation) => {
    animation.pause(); animation.currentTime = 2500;
  }));
  const outgoing = player.locator('.docent-dissolve-outgoing');
  const incoming = player.locator('[data-layer-id=shared]');
  await expect(outgoing.locator('img[src$="marble.png"]')).toHaveCount(1);
  await expect(incoming.locator('img')).toHaveAttribute('src', second.imageUrl);
  await expect(outgoing).toHaveCSS('opacity', '0.5');
  await expect(incoming).toHaveCSS('opacity', '0.5');
  await expect(incoming).toHaveCSS('left', '180px');
  await player.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await expect(outgoing).toHaveCount(0);
});

test('unregistered templates preserve the existing default docent', async ({ page }) => {
  await setup(page, { ...sample, templateType: 'template_future' });
  await expect(page.getByRole('region', { name: '도슨트 Template 1' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '도슨트 재생', exact: true })).toBeVisible();
});

test('question audio keeps its position through five slides and stops only on Skip', async ({ page }) => {
  const rate = 8000; const seconds = 6;
  const wav = Buffer.alloc(44 + rate * seconds * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  await page.route('**/docent-test.wav', (route) => route.fulfill({ body: wav, contentType: 'audio/wav' }));
  await page.addInitScript(() => {
    const NativeAudio = window.Audio; window.__docentAudios = [];
    window.Audio = function (...args) { const audio = new NativeAudio(...args); window.__docentAudios.push(audio); return audio; };
  });
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], script: '', audioUrl: '/docent-test.wav',
    scenes: sample.topics[0].scenes.map((scene, index) => ({ ...scene, body: `장면 본문 ${index + 1}`,
      audioUrl: index === 4 ? '/old-scene-audio.wav' : '' })),
  }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: sample.topics[0].label, exact: true }).click();
  const seek = player.getByRole('slider', { name: '도슨트 진행률' });
  await expect(seek).toBeEnabled();
  await expect(seek).toHaveAttribute('max', '6');
  await expect.poll(() => page.evaluate(() => window.__docentAudios.at(-1).currentTime)).toBeGreaterThan(0.5);
  await player.getByRole('button', { name: '도슨트 일시정지', exact: true }).click();
  const pausedAt = await page.evaluate(() => window.__docentAudios.at(-1).currentTime);
  await page.evaluate(() => { window.__questionAudio = window.__docentAudios.at(-1); });
  for (let i = 1; i < 5; i++) await player.getByRole('button', { name: '다음 장면', exact: true }).click();
  await expect(player).toHaveAttribute('data-scene-id', sample.topics[0].scenes[4].id);
  expect(await page.evaluate(() => window.__questionAudio === window.__docentAudios.at(-1))).toBe(true);
  expect(await page.evaluate(() => window.__docentAudios.at(-1).currentTime)).toBe(pausedAt);
  await expect(player.getByRole('button', { name: '도슨트 재생', exact: true })).toBeVisible();
  await player.getByRole('button', { name: '건너뛰기' }).click();
  await expect.poll(() => page.evaluate(() => window.__docentAudios.every((audio) => audio.paused))).toBe(true);
});

test('failed topic audio shows a safe error without synthesizing its script', async ({ page }) => {
  await page.route('**/unavailable-docent.mp3', (route) => route.fulfill({ status: 404 }));
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], audioUrl: '/unavailable-docent.mp3' }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: sample.topics[0].label, exact: true }).click();
  await expect(player.getByRole('alert')).toContainText('음성 파일을 재생하지 못했어요');
  expect(await page.evaluate(() => window.__spoken)).toEqual([]);
});

test('long database headings and questions remain within their mobile layout areas', async ({ page }) => {
  const title = '문화재의 아주 긴 제목과 이야기 '.repeat(10);
  const label = '이 문화재에 대해 자세히 알려주세요 '.repeat(8);
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], label, title }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: label.trim(), exact: true }).click();
  const bounds = await player.evaluate((el) => ({
    headerBottom: el.querySelector('.docent-header').getBoundingClientRect().bottom,
    mediaTop: el.querySelector('.docent-media').getBoundingClientRect().top,
    overflow: el.scrollWidth > el.clientWidth,
  }));
  expect(bounds.headerBottom).toBeLessThanOrEqual(bounds.mediaTop);
  expect(bounds.overflow).toBe(false);
});

test('admin studio styles, entrance pause, duration and stacking survive the public DB read', async ({ page }, info) => {
  const text = { id: 'studio-text', text: '관리자 편집\n둘째 줄', x: 20, y: 280, width: 350, height: 230,
    color: '#aabbcc', fontSize: 64, fontWeight: 600, textAlign: 'left', animation: { type: 'up', durationMs: 800, delayMs: 0 } };
  const shape = { id: 'studio-shape', shape: 'rounded', fill: '#234567', x: 20, y: 280, width: 350, height: 230 };
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], label: '편집한 질문', script: '질문 전체 음성', scenes: [
    { id: 'studio-first', body: '첫 장면 본문', advance: 'auto', waitMs: 600000,
      transition: { durationMs: 0, studio: { durationMs: 1600 } }, layers: [shape, text] },
    { id: 'studio-next', body: '다음 장면 본문', advance: 'click', layers: [text, shape] },
  ] }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await expect(player.locator('.docent-background')).toHaveAttribute('src', /^blob:/);
  await player.getByRole('button', { name: '편집한 질문', exact: true }).click();
  const label = player.locator('[data-layer-id=studio-text] span');
  await expect(label).toHaveCSS('font-size', '64px');
  await expect(label).toHaveCSS('color', 'rgb(170, 187, 204)');
  await expect(label).toHaveCSS('text-align', 'left');
  await player.getByRole('button', { name: '도슨트 일시정지', exact: true }).click();
  await expect.poll(() => player.locator('[data-layer-id=studio-text] .docent-layer-content').evaluate(el => el.getAnimations().map(a => a.playState))).toEqual(['paused']);
  await page.waitForTimeout(1700);
  await expect(player).toHaveAttribute('data-scene-id', 'studio-first');
  await player.getByRole('button', { name: '도슨트 재생', exact: true }).click();
  if (info.project.name === 'mobile') {
    await page.waitForTimeout(850);
    await player.screenshot({ path: '/tmp/jeollo-docent-studio.png' });
  }
  await expect(player).toHaveAttribute('data-scene-id', 'studio-next', { timeout: 3000 });
  await expect.poll(() => player.locator('[data-layer-id]').evaluateAll(els => els.filter(el => Number(el.style.opacity) > 0).map(el => el.dataset.layerId))).toEqual(['studio-text', 'studio-shape']);
  expect(await page.evaluate(() => window.__spoken.filter(s => s === '질문 전체 음성').length)).toBe(1);
});

test('left and right taps stay within the question until Skip, including the final auto scene', async ({ page }) => {
  await setup(page, { ...sample, topics: [{ ...sample.topics[0], scenes: [
    { id: 'first', advance: 'click', layers: [] },
    { id: 'last', advance: 'auto', waitMs: 150, layers: [] },
  ] }] });
  const player = page.getByRole('region', { name: '도슨트 Template 1' });
  await player.getByRole('button', { name: sample.topics[0].label, exact: true }).click();
  const board = await player.locator('.docent-artboard').boundingBox();
  const tap = fraction => page.mouse.click(board.x + board.width * fraction, board.y + board.height * .65);
  await tap(.2);
  await expect(player).toHaveAttribute('data-scene-id', 'first');
  await tap(.8);
  await expect(player).toHaveAttribute('data-scene-id', 'last');
  await page.waitForTimeout(400);
  await player.getByRole('button', { name: '다음 장면', exact: true }).evaluate(button => { button.click(); button.click(); });
  await expect(player).toHaveAttribute('data-scene-id', 'last');
  await expect(player.getByRole('button', { name: '다음 장면', exact: true })).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
  await expect(player.getByRole('button', { name: '상세 정보' })).toHaveCount(0);
  await tap(.2);
  await expect(player).toHaveAttribute('data-scene-id', 'first');
  await player.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await expect(player).toHaveAttribute('data-topic-id', '');
  await expect(player.getByRole('button', { name: '상세 정보' })).toBeVisible();
});
