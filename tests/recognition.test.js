import test from 'node:test';
import assert from 'node:assert/strict';
import recognize, { selectReferenceImages } from '../api/recognize-heritage.js';
import { getCurrentLocation } from '../src/services/locationService.js';
import { recognizeHeritageImage } from '../src/services/recognitionService.js';

const body = { imageDataUrl: 'data:image/jpeg;base64,AAAA', latitude: 35, longitude: 127 };
const heritage = { id: 'h', name: '문화재', temple_id: 't', description: 'PRIVATE DESCRIPTION', docent_text: 'PRIVATE DOCENT', content: { audio: 'keep' } };
const reference = { heritage_id: 'h', image_url: 'https://example.invalid/front.jpg', is_primary: true, angle_type: 'front' };
function response() {
  return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
}
function setup(t, options = {}) {
  const previous = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only', OPENAI_API_KEY: 'test-only' });
  process.env.NODE_ENV = 'test';
  delete process.env.RECOGNITION_DIAGNOSTICS;
  delete process.env.RECOGNITION_MIN_CONFIDENCE;
  delete process.env.OPENAI_RECOGNITION_MODEL;
  delete process.env.RECOGNITION_MAX_TEMPLE_DISTANCE_METERS;
  t.after(() => { process.env = previous; });
  const calls = [];
  const logs = [];
  const requests = [];
  const diagnostics = [];
  const captureLog = (name, entry) => (name === 'recognition:openai' ? diagnostics : logs).push(JSON.parse(entry));
  t.mock.method(console, 'info', captureLog);
  t.mock.method(console, 'warn', captureLog);
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
    calls.push(url);
    if (options.dbError && url.pathname.startsWith('/rest/')) return Response.json({ message: 'private database failure', code: 'XX000' }, { status: 500 });
    if (url.pathname.endsWith('/temples')) {
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      const temples = options.temples ?? [{ id: 't', latitude: 35, longitude: 127 }];
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return Response.json(temples.slice(offset, offset + 500));
    }
    if (url.pathname.endsWith('/heritages')) {
      assert.equal(url.searchParams.get('temple_id'), 'eq.t');
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      if (url.searchParams.has('id')) return Response.json((options.heritages ?? [heritage]).find((row) => `eq.${row.id}` === url.searchParams.get('id')) ?? null);
      assert.equal(url.searchParams.get('select'), 'id,name,temple_id,heritage_images(image_url,angle_type,is_primary)');
      assert.equal(url.searchParams.get('heritage_images.limit'), '1');
      assert.equal(url.searchParams.get('heritage_images.order'), 'is_primary.desc.nullslast,angle_type.asc.nullslast,image_url.asc');
      const images = options.images ?? [reference];
      return Response.json((options.heritages ?? [heritage]).map((row) => ({
        ...row, heritage_images: images.filter((image) => image.heritage_id === row.id)
          .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
            || (a.angle_type ?? 'zz').localeCompare(b.angle_type ?? 'zz') || a.image_url.localeCompare(b.image_url)).slice(0, 1),
      })));
    }
    if (url.pathname.endsWith('/heritage_images')) {
      if (options.verificationDbError) return Response.json({ code: 'XX000' }, { status: 500 });
      const ids = url.searchParams.get('heritage_id').slice(4, -1).split(',');
      return Response.json((options.images ?? [reference]).filter((image) => ids.includes(image.heritage_id)));
    }
    if (url.pathname.endsWith('/heritage_assets')) {
      if (options.noAssets) return Response.json({ code: '42P01' }, { status: 404 });
      return Response.json({ id: url.searchParams.get('id').slice(3), stamp_image_url: 'https://example.invalid/stamp.png' });
    }
    const request = JSON.parse(init.body);
    requests.push(request);
    assert.equal(request.model, options.model ?? 'gpt-5');
    assert.equal(request.text.format.type, 'json_object');
    assert.deepEqual(request.reasoning, { effort: 'minimal' });
    assert.equal(request.text.verbosity, 'low');
    assert.ok(request.input[1].content.filter((item) => item.type === 'input_image')
      .every((image) => image.detail === 'low'));
    assert.equal(JSON.stringify(request).includes('PRIVATE'), false);
    if (options.openaiResponse) return options.openaiResponse(request, requests.length);
    const isStage2 = JSON.stringify(request).includes('2차 최종 검증:');
    if (options.openaiError || (options.stage2Error && isStage2)) return Response.json({ error: { message: 'private upstream failure' } }, { status: 429 });
    if ((options.incomplete || (options.stage2Incomplete && isStage2)) && (request.max_output_tokens === 250 || options.alwaysIncomplete)) {
      return Response.json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{' });
    }
    assert.equal(request.max_output_tokens, (options.incomplete || (options.stage2Incomplete && isStage2)) ? 1200 : 250);
    const result = options.results?.[requests.length - 1] ?? options.result ?? { matchedHeritageId: 'h', confidence: 0.9 };
    return Response.json({ output_text: JSON.stringify({ secondCandidateId: null, needsVerification: false, ...result }) });
  });
  return { calls, logs, requests, diagnostics };
}

for (const coordinates of [{}, { latitude: null, longitude: 127 }, { latitude: '35', longitude: 127 }, { latitude: 91, longitude: 127 }, { latitude: 35, longitude: Infinity }]) {
  test(`invalid GPS rejected before database: ${JSON.stringify(coordinates)}`, async (t) => {
    const { calls } = setup(t);
    const res = response();
    await recognize({ method: 'POST', body: { imageDataUrl: body.imageDataUrl, ...coordinates } }, res);
    assert.equal(res.body.code, 'INVALID_COORDINATES');
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
}
for (const [name, options, code] of [
  ['far away', { temples: [{ id: 't', latitude: 36, longitude: 127 }] }, 'NO_NEARBY_TEMPLE'],
  ['no temples', { temples: [] }, 'NO_NEARBY_TEMPLE'],
  ['missing temple coordinates', { temples: [{ id: 't', latitude: null, longitude: '' }] }, 'NO_NEARBY_TEMPLE'],
  ['empty temple', { heritages: [] }, 'NO_HERITAGES'],
  ['missing images', { images: [] }, 'NO_REFERENCE_IMAGES'],
  ['partially missing images', { heritages: [heritage, { ...heritage, id: 'other' }] }, 'NO_REFERENCE_IMAGES'],
  ['too many candidates', { heritages: Array.from({ length: 201 }, (_, i) => ({ ...heritage, id: `h${i}` })) }, 'TOO_MANY_CANDIDATES'],
  ['database error', { dbError: true }, 'SUPABASE_ERROR'],
  ['OpenAI error', { openaiError: true }, 'OPENAI_ERROR'],
  ['no match', { result: { matchedHeritageId: null, confidence: 0.1 } }, 'NO_MATCH'],
  ['unknown ID', { result: { matchedHeritageId: 'outside-temple', confidence: 1 } }, 'NO_MATCH'],
  ['low confidence', { result: { matchedHeritageId: 'h', confidence: 0.34 } }, 'NO_MATCH'],
  ['invalid confidence', { result: { matchedHeritageId: 'h', confidence: 'bad' } }, 'OPENAI_INVALID_OUTPUT'],
  ['repeated truncation', { incomplete: true, alwaysIncomplete: true }, 'OPENAI_INCOMPLETE'],
]) {
  test(name, async (t) => {
    const { calls, logs } = setup(t, options);
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, code);
    assert.equal(res.body.match, null);
    assert.equal(calls.some((url) => url.pathname.endsWith('/heritage_assets')), false);
    if (['NO_NEARBY_TEMPLE', 'NO_HERITAGES', 'NO_REFERENCE_IMAGES', 'TOO_MANY_CANDIDATES', 'SUPABASE_ERROR'].includes(code)) {
      assert.equal(calls.some((url) => url.pathname === '/v1/responses'), false);
    }
    assert.equal(logs.length, 1);
    assert.ok(logs[0].totalMs >= 0);
    assert.equal(JSON.stringify(logs).includes('base64'), false);
  });
}

test('nearest temple pagination, optional assets and one bounded output retry', async (t) => {
  const temples = Array.from({ length: 500 }, (_, i) => ({ id: `far-${i}`, latitude: 36, longitude: 127 }));
  temples.push({ id: 't', latitude: 35, longitude: 127 });
  const { calls, logs } = setup(t, { temples, noAssets: true, incomplete: true });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(res.body.match.docentText, heritage.docent_text);
  assert.deepEqual(res.body.match.content, heritage.content);
  assert.deepEqual(res.body.match.asset, {});
  assert.equal(calls.filter((url) => url.pathname.endsWith('/temples')).length, 2);
  assert.equal(logs[0].openaiAttempts, 2);
  assert.equal(logs[0].candidateCount, 1);
  assert.equal(logs[0].referenceImageCount, 1);
  assert.equal(logs[0].timingsMs.stage2, null);
  assert.equal(logs[0].stage2, 'skipped');
  assert.ok(logs[0].timingsMs.stage1 >= 0);
});

test('more than twelve candidates remain eligible and model override is preserved', async (t) => {
  const heritages = Array.from({ length: 13 }, (_, i) => ({ ...heritage, id: i === 12 ? 'h' : `h${i}` }));
  const images = heritages.map((row) => ({ ...reference, heritage_id: row.id }));
  const { logs } = setup(t, { heritages, images, model: 'custom-model' });
  process.env.OPENAI_RECOGNITION_MODEL = 'custom-model';
  process.env.RECOGNITION_CANDIDATE_LIMIT = '1';
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.match.id, 'h');
  assert.equal(logs[0].candidateCount, 13);
});

test('distance limit is configurable and enforced on server', async (t) => {
  setup(t, { temples: [{ id: 't', latitude: 35.0046, longitude: 127 }] });
  const outside = response();
  await recognize({ method: 'POST', body }, outside);
  assert.equal(outside.body.code, 'NO_NEARBY_TEMPLE');
  process.env.RECOGNITION_MAX_TEMPLE_DISTANCE_METERS = '600';
  const inside = response();
  await recognize({ method: 'POST', body }, inside);
  assert.equal(inside.body.code, 'MATCHED');
});

test('primary reference first, unique URL and different existing angle preferred', () => {
  const side = { ...reference, image_url: 'https://example.invalid/side.jpg', angle_type: 'left', is_primary: false };
  const duplicateAngle = { ...reference, image_url: 'https://example.invalid/front2.jpg', is_primary: false };
  const result = selectReferenceImages([duplicateAngle, side, reference, reference]);
  assert.deepEqual(result.map((image) => image.imageUrl), [reference.image_url, side.image_url, duplicateAngle.image_url]);
  assert.equal(selectReferenceImages([reference, reference]).length, 1);
});

for (const [errorCode, code] of [[1, 'GPS_PERMISSION_DENIED'], [2, 'GPS_LOOKUP_FAILED'], [3, 'GPS_LOOKUP_FAILED']]) {
  test(`GPS error ${errorCode} remains actionable`, async (t) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
      getCurrentPosition(_resolve, reject, options) {
        assert.equal(options.maximumAge, 0);
        assert.equal(options.enableHighAccuracy, true);
        reject({ code: errorCode });
      },
    } } });
    t.after(() => descriptor ? Object.defineProperty(globalThis, 'navigator', descriptor) : delete globalThis.navigator);
    await assert.rejects(getCurrentLocation({ fresh: true }), { code });
  });
}

test('client preserves actionable errors on non-2xx responses', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body), body);
    return Response.json({ ok: false, code: 'INVALID_COORDINATES', error: '위치 오류' }, { status: 400 });
  });
  await assert.rejects(recognizeHeritageImage(body), { code: 'INVALID_COORDINATES', message: '위치 오류' });
});

const inputImages = (request) => request.input[1].content.filter((item) => item.type === 'input_image');
const sideReference = { ...reference, image_url: 'https://example.invalid/side.jpg', is_primary: false, angle_type: 'side' };
const detailReference = { ...reference, image_url: 'https://example.invalid/detail.jpg', is_primary: false, angle_type: 'detail' };

for (const confidence of [0.85, 1]) {
  test(`stage one accepts ${confidence} with one primary and no additional image query`, async (t) => {
    const { calls, requests, logs } = setup(t, {
      images: [detailReference, sideReference, reference], result: { matchedHeritageId: 'h', confidence },
    });
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, 'MATCHED');
    assert.equal(requests.length, 1);
    assert.deepEqual(inputImages(requests[0]).map((item) => item.image_url), [body.imageDataUrl, reference.image_url]);
    assert.equal(calls.some((url) => url.pathname.endsWith('/heritage_images')), false);
    assert.equal(logs[0].transmittedImageCount, 2);
  });
}

for (const first of [
  { confidence: 0.849, needsVerification: false },
  { confidence: 0.99, needsVerification: true },
]) {
  test(`ambiguous first stage verifies only two candidates: ${JSON.stringify(first)}`, async (t) => {
    const other = { ...heritage, id: 'other' };
    const excluded = { ...heritage, id: 'excluded' };
    const images = [heritage, other, excluded].flatMap((row) => [reference, sideReference, detailReference,
      { ...sideReference, image_url: 'https://example.invalid/side2.jpg' }].map((image) => ({ ...image, heritage_id: row.id })));
    const { calls, requests, logs } = setup(t, {
      heritages: [heritage, other, excluded], images,
      results: [{ matchedHeritageId: 'h', secondCandidateId: 'other', ...first },
        { matchedHeritageId: 'h', confidence: 0.9 }],
    });
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, 'MATCHED');
    assert.equal(requests.length, 2);
    assert.equal(inputImages(requests[0]).length, 4);
    assert.equal(inputImages(requests[1]).length, 7);
    assert.equal(JSON.stringify(requests[1]).includes('excluded'), false);
    const query = calls.filter((url) => url.pathname.endsWith('/heritage_images'));
    assert.equal(query.length, 1);
    assert.equal(query[0].searchParams.get('heritage_id'), 'in.(h,other)');
    assert.equal(logs[0].stage2ReferenceImageCount, 6);
    assert.equal(logs[0].transmittedImageCount, 11);
    assert.equal(logs[0].stage1Attempts, 1);
    assert.equal(logs[0].stage2Attempts, 1);
    assert.ok(logs[0].timingsMs.stage2 >= 0);
  });
}

for (const second of [
  { matchedHeritageId: null, confidence: 0.1 },
  { matchedHeritageId: 'h', confidence: 0.849 },
  { matchedHeritageId: 'h', confidence: 0.99, needsVerification: true },
  { matchedHeritageId: 'outside-shortlist', confidence: 1 },
]) {
  test(`uncertain or invalid final choice returns no match: ${JSON.stringify(second)}`, async (t) => {
    const { requests } = setup(t, { results: [{ matchedHeritageId: 'h', confidence: 0.8 }, second] });
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, 'NO_MATCH');
    assert.equal(res.body.ok, true);
    assert.equal(requests.length, 2);
    // One available image is reused; no synthetic images or third classification pass.
    assert.equal(inputImages(requests[1]).length, 2);
  });
}

test('duplicate shortlist IDs do not duplicate candidates', async (t) => {
  const { calls, requests } = setup(t, { results: [
    { matchedHeritageId: 'h', secondCandidateId: 'h', confidence: 0.8 },
    { matchedHeritageId: 'h', confidence: 0.85 },
  ] });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(inputImages(requests[1]).length, 2);
  assert.equal(calls.find((url) => url.pathname.endsWith('/heritage_images')).searchParams.get('heritage_id'), 'in.(h)');
});

test('threshold override is shared by the fast and final decisions', async (t) => {
  const { requests } = setup(t, { result: { matchedHeritageId: 'h', confidence: 0.8 } });
  process.env.RECOGNITION_MIN_CONFIDENCE = '0.8';
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(requests.length, 1);
});

for (const setting of ['invalid', '0', '1.1', '-1']) {
  test(`invalid threshold ${setting} uses the safe default`, async (t) => {
    const { requests, logs } = setup(t, { result: { matchedHeritageId: 'h', confidence: 0.8 } });
    process.env.RECOGNITION_MIN_CONFIDENCE = setting;
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, 'NO_MATCH');
    assert.equal(requests.length, 2);
    assert.equal(logs[0].minConfidence, 0.85);
  });
}

test('missing primary uses stable existing angle then URL ordering', async (t) => {
  const front = { ...reference, is_primary: false };
  const { requests } = setup(t, { images: [sideReference, front] });
  await recognize({ method: 'POST', body }, response());
  assert.equal(inputImages(requests[0])[1].image_url, front.image_url);
});

test('production omits performance logs', async (t) => {
  const { logs } = setup(t);
  process.env.NODE_ENV = 'production';
  await recognize({ method: 'POST', body }, response());
  assert.equal(logs.length, 0);
});

for (const result of [
  { matchedHeritageId: 'h', confidence: 0.99, needsVerification: 'false' },
  { matchedHeritageId: 'h', confidence: 0.99, secondCandidateId: 42 },
]) {
  test(`malformed decision fields cannot bypass verification: ${JSON.stringify(result)}`, async (t) => {
    const { requests } = setup(t, { result });
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, 'OPENAI_INVALID_OUTPUT');
    assert.equal(requests.length, 1);
  });
}

test('stage two may select the runner-up and preserves its detail contract', async (t) => {
  const other = { ...heritage, id: 'other', name: '다른 문화유산', docent_text: '다른 원고' };
  setup(t, { heritages: [heritage, other], images: [reference, { ...reference, heritage_id: other.id }],
    results: [{ matchedHeritageId: 'h', secondCandidateId: other.id, confidence: 0.8 },
      { matchedHeritageId: other.id, confidence: 0.95 }] });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.match.id, other.id);
  assert.equal(res.body.match.docentText, other.docent_text);
});

for (const [options, code] of [
  [{ stage2Error: true }, 'OPENAI_ERROR'],
  [{ verificationDbError: true }, 'SUPABASE_ERROR'],
  [{ stage2Incomplete: true, alwaysIncomplete: true }, 'OPENAI_INCOMPLETE'],
]) {
  test(`second stage failure preserves error code ${code}`, async (t) => {
    setup(t, { ...options, result: { matchedHeritageId: 'h', confidence: 0.8 } });
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, code);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.match, null);
  });
}

test('second stage token retry is bounded and counted separately', async (t) => {
  const { logs, requests } = setup(t, { stage2Incomplete: true, results: [
    { matchedHeritageId: 'h', confidence: 0.8 }, null,
    { matchedHeritageId: 'h', confidence: 0.9 },
  ] });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(requests.length, 3);
  assert.equal(logs[0].stage1Attempts, 1);
  assert.equal(logs[0].stage2Attempts, 2);
  assert.equal(logs[0].transmittedImageCount, 6);
});

const completedDecision = {
  status: 'completed',
  output_text: JSON.stringify({ matchedHeritageId: 'h', secondCandidateId: null, confidence: 0.9, needsVerification: false }),
};

test('diagnostics explain the exact 3 images times 2 attempts and reasoning exhaustion', async (t) => {
  const { logs, diagnostics, requests } = setup(t, {
    heritages: [heritage, { ...heritage, id: 'other' }],
    images: [reference, { ...reference, heritage_id: 'other' }],
    openaiResponse: (_request, attempt) => Response.json(attempt === 1 ? {
      status: 'incomplete', incomplete_details: { reason: 'max_output_tokens', private: 'SECRET' },
      usage: { input_tokens: 700, output_tokens: 250, output_tokens_details: { reasoning_tokens: 250 } },
      reasoning: { effort: 'medium' }, output: [{ type: 'reasoning', summary: ['SECRET'] }],
    } : completedDecision, { headers: { 'x-request-id': `req_test${attempt}` } }),
  });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(logs[0].transmittedImageCount, 6);
  assert.equal(diagnostics.length, 2);
  assert.deepEqual(diagnostics.map((d) => [d.attempt, d.imageCount, d.parameters.maxOutputTokens, d.retry]),
    [[1, 3, 250, true], [2, 3, 1200, false]]);
  assert.equal(diagnostics[0].retryReason, 'max_output_tokens');
  assert.equal(diagnostics[0].usage.reasoningTokens, 250);
  assert.equal(diagnostics[0].resolvedReasoningEffort, 'medium');
  assert.equal(diagnostics[0].upstreamRequestId, 'req_test1');
  assert.equal(diagnostics[1].outcome, 'completed');
  assert.equal(diagnostics[0].requestId, logs[0].requestId);
  assert.ok(diagnostics.every((d) => d.durationMs >= 0));
  assert.equal(JSON.stringify(diagnostics).includes('SECRET'), false);
  assert.deepEqual(requests[0].reasoning, { effort: 'minimal' });
  assert.equal(diagnostics[0].parameters.reasoningEffort, 'minimal');
  assert.equal(requests[0].text.verbosity, 'low');
  assert.equal(diagnostics[0].parameters.verbosity, 'low');
});

test('completed valid output is never retried, even with stale incomplete_details', async (t) => {
  const { requests, diagnostics } = setup(t, { openaiResponse: () => Response.json({
    ...completedDecision, incomplete_details: { reason: 'max_output_tokens' },
  }) });
  await recognize({ method: 'POST', body }, response());
  assert.equal(requests.length, 1);
  assert.equal(diagnostics[0].retry, false);
});

test('content filter incomplete is diagnosed without a token retry', async (t) => {
  const { requests, diagnostics } = setup(t, { openaiResponse: () => Response.json({
    status: 'incomplete', incomplete_details: { reason: 'content_filter' },
  }) });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'OPENAI_INCOMPLETE');
  assert.equal(requests.length, 1);
  assert.equal(diagnostics[0].incompleteDetails.reason, 'content_filter');
});

test('HTTP errors expose allowlisted metadata but no echoed credentials or customer data', async (t) => {
  const secret = 'sk-secret https://private.example/image?token=secret user@example.com 35.123456 홍길동';
  const { diagnostics } = setup(t, { openaiResponse: () => Response.json({ error: {
    code: 'unsupported_parameter', type: 'invalid_request_error', param: 'reasoning.effort',
    message: `Unsupported parameter: ${secret}`,
  } }, { status: 400, headers: { 'x-request-id': 'req_safe123' } }) });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'OPENAI_ERROR');
  assert.equal(diagnostics[0].httpStatus, 400);
  assert.equal(diagnostics[0].error.code, 'unsupported_parameter');
  assert.equal(diagnostics[0].error.type, 'invalid_request_error');
  assert.equal(diagnostics[0].error.param, 'reasoning.effort');
  assert.equal(diagnostics[0].error.messageSanitized, true);
  for (const value of ['sk-secret', 'private.example', 'user@example.com', '35.123456', '홍길동']) {
    assert.equal(JSON.stringify(diagnostics).includes(value), false);
    assert.equal(JSON.stringify(res.body).includes(value), false);
  }
});

for (const [payload, outcome] of [
  [{ status: 'failed', error: { code: 'server_error', type: 'server_error', message: 'Internal error' } }, 'response_failed'],
  [{ status: 'completed', output: [] }, 'no_output_text'],
  [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'PRIVATE' }] }] }, 'refusal'],
  [{ status: 'completed', output_text: '{' }, 'invalid_output_json'],
]) {
  test(`OPENAI_ERROR distinguishes ${outcome} and never retries it`, async (t) => {
    const { diagnostics, requests } = setup(t, { openaiResponse: () => Response.json(payload) });
    const res = response();
    await recognize({ method: 'POST', body }, res);
    assert.equal(res.body.code, 'OPENAI_ERROR');
    assert.equal(diagnostics[0].outcome, outcome);
    assert.equal(requests.length, 1);
    assert.equal(JSON.stringify(diagnostics).includes('PRIVATE'), false);
  });
}

test('transport and non-JSON HTTP failures retain diagnostic classification', async (t) => {
  const { diagnostics } = setup(t, { openaiResponse: (_request, attempt) => {
    if (attempt === 1) throw Object.assign(new Error('PRIVATE'), { cause: { code: 'ENOTFOUND' } });
    return new Response('<html>PRIVATE</html>', { status: 502 });
  } });
  await recognize({ method: 'POST', body }, response());
  await recognize({ method: 'POST', body }, response());
  assert.equal(diagnostics[0].outcome, 'transport_error');
  assert.equal(diagnostics[0].transportCode, 'ENOTFOUND');
  assert.equal(diagnostics[1].outcome, 'http_error');
  assert.equal(diagnostics[1].httpStatus, 502);
  assert.equal(JSON.stringify(diagnostics).includes('PRIVATE'), false);
});

test('production opt-in records successful attempts and normal production retains failures', async (t) => {
  const { diagnostics, logs } = setup(t, { openaiResponse: (_request, attempt) => Response.json(
    attempt === 3 ? { status: 'incomplete', incomplete_details: { reason: 'content_filter' } } : completedDecision,
  ) });
  process.env.NODE_ENV = 'production';
  await recognize({ method: 'POST', body }, response());
  assert.equal(diagnostics.length, 0);
  process.env.RECOGNITION_DIAGNOSTICS = '1';
  await recognize({ method: 'POST', body }, response());
  assert.equal(diagnostics.length, 1);
  assert.equal(logs.length, 1);
  delete process.env.RECOGNITION_DIAGNOSTICS;
  await recognize({ method: 'POST', body }, response());
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[1].outcome, 'incomplete');
  assert.equal(logs.length, 1);
});


test('minimal reasoning first-attempt success retains usage and timing diagnostics', async (t) => {
  const { requests, diagnostics, logs } = setup(t, { openaiResponse: () => Response.json({
    ...completedDecision, reasoning: { effort: 'minimal' }, text: { verbosity: 'low' },
    usage: { output_tokens: 100, output_tokens_details: { reasoning_tokens: 16 } },
  }) });
  const res = response();
  await recognize({ method: 'POST', body }, res);
  assert.equal(res.body.code, 'MATCHED');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].max_output_tokens, 250);
  assert.equal(diagnostics[0].resolvedReasoningEffort, 'minimal');
  assert.equal(diagnostics[0].resolvedVerbosity, 'low');
  assert.equal(diagnostics[0].usage.reasoningTokens, 16);
  assert.equal(diagnostics[0].usage.outputTokens, 100);
  assert.ok(diagnostics[0].outputTextLength > 0);
  assert.ok(diagnostics[0].durationMs >= 0);
  assert.equal(diagnostics[0].retry, false);
  assert.equal(logs[0].stage1Attempts, 1);
  assert.ok(logs[0].totalMs >= 0);
});
