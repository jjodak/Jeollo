import { randomUUID } from 'node:crypto';
import { getDistanceKm, hasValidCoordinates, toCoordinate } from '../src/utils/coordinates.js';
import { createSupabaseAdminClient } from '../server/supabaseAdmin.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5';
const MAX_TEMPLE_DISTANCE_METERS = 500;
const PAGE_SIZE = 500;
// Reject an oversized temple explicitly; never silently drop candidates.
const MAX_CANDIDATES_PER_REQUEST = 200;
const MAX_REQUEST_BODY_BYTES = 9 * 1024 * 1024;
const MAX_REFERENCE_IMAGES_PER_HERITAGE = 2;
const MIN_CONFIDENCE = 0.35;

function getEnv(name, fallbackNames = []) {
  const names = [name, ...fallbackNames];
  const matchedName = names.find((envName) => process.env[envName]);

  return matchedName ? process.env[matchedName] : null;
}

function getRequiredEnv(name, fallbackNames = []) {
  const value = getEnv(name, fallbackNames);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function recognitionError(code, message, status = 200) {
  return Object.assign(new Error(message), { code, status });
}

async function readAll(query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function getNearestTemple(supabase, origin) {
  const temples = await readAll(() => supabase.from('temples')
    .select('id,latitude,longitude').eq('is_active', true).order('id'));
  let nearest = null;
  for (const temple of temples) {
    const coordinates = {
      latitude: toCoordinate(temple.latitude, 90),
      longitude: toCoordinate(temple.longitude, 180),
    };
    const distanceKm = getDistanceKm(origin, coordinates);
    if (distanceKm !== null && (!nearest || distanceKm * 1000 < nearest.distanceMeters)) {
      nearest = { id: temple.id, distanceMeters: distanceKm * 1000 };
    }
  }
  return nearest;
}

function getMaxTempleDistance() {
  const value = Number(process.env.RECOGNITION_MAX_TEMPLE_DISTANCE_METERS);
  return Number.isFinite(value) && value > 0 ? value : MAX_TEMPLE_DISTANCE_METERS;
}

export function selectReferenceImages(rows) {
  const unique = new Map();
  for (const row of [...rows].sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))) {
    const imageUrl = sanitizeImageUrl(row.image_url);
    if (imageUrl && !unique.has(imageUrl)) unique.set(imageUrl, {
      imageUrl, angleType: row.angle_type, isPrimary: Boolean(row.is_primary),
    });
  }
  const images = [...unique.values()];
  if (images.length < 2) return images;
  const first = images[0];
  const second = images.slice(1).find((image) => image.angleType
    && first.angleType && image.angleType !== first.angleType) ?? images[1];
  return [first, second].slice(0, MAX_REFERENCE_IMAGES_PER_HERITAGE);
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_REQUEST_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }

    return req.body ? JSON.parse(req.body) : {};
  }

  let rawBody = '';

  for await (const chunk of req) {
    rawBody += chunk;

    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
  }

  return rawBody ? JSON.parse(rawBody) : {};
}

function isSupportedImageDataUrl(value) {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value ?? '');
}

function sanitizeImageUrl(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeHeritage(row, imagesByHeritageId, assetsByHeritageId) {
  const asset = assetsByHeritageId.get(row.id) ?? {};
  const images = selectReferenceImages(imagesByHeritageId.get(row.id) ?? []);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    docentText: row.docent_text ?? '',
    thumbnailUrl: sanitizeImageUrl(asset.thumbnail_image_url)
      ?? sanitizeImageUrl(row.thumbnail_image_url)
      ?? sanitizeImageUrl(row.thumbnail_url),
    stampImageUrl: sanitizeImageUrl(asset.stamp_image_url),
    templeId: row.temple_id,
    asset,
    content: row.content ?? {},
    images,
  };
}

function isOptionalAssetReadError(error) {
  return ['42P01', 'PGRST106', 'PGRST205'].includes(error?.code);
}

async function getRecognitionCandidates(supabase, templeId, metrics) {
  const heritages = await readAll(() => supabase.from('heritages')
    .select('id,name,temple_id').eq('is_active', true).eq('temple_id', templeId).order('id'));
  metrics.candidateCount = heritages.length;
  if (!heritages.length) throw recognitionError('NO_HERITAGES', '이 사찰에 등록된 활성 문화재가 없어요.');
  if (heritages.length > MAX_CANDIDATES_PER_REQUEST) {
    throw recognitionError('TOO_MANY_CANDIDATES', '이 사찰의 문화재가 요청 한도를 초과했어요. 관리자에게 문의해 주세요.');
  }
  const imagesByHeritageId = new Map();
  // Small ID chunks avoid oversized PostgREST URLs. Pagination prevents row-cap truncation.
  for (let offset = 0; offset < heritages.length; offset += 100) {
    const ids = heritages.slice(offset, offset + 100).map((row) => row.id);
    const images = await readAll(() => supabase.from('heritage_images')
      .select('heritage_id,image_url,angle_type,is_primary').in('heritage_id', ids)
      .order('heritage_id').order('is_primary', { ascending: false })
      .order('angle_type').order('image_url'));
    for (const image of images) {
      const rows = imagesByHeritageId.get(image.heritage_id) ?? [];
      rows.push(image);
      imagesByHeritageId.set(image.heritage_id, rows);
    }
  }
  const candidates = heritages.map((row) => ({
    id: row.id, name: row.name, templeId: row.temple_id,
    images: selectReferenceImages(imagesByHeritageId.get(row.id) ?? []),
  }));
  metrics.referenceImageCount = candidates.reduce((sum, candidate) => sum + candidate.images.length, 0);
  // Missing references must not make a registered candidate disappear silently.
  if (candidates.some((candidate) => !candidate.images.length)) {
    throw recognitionError('NO_REFERENCE_IMAGES', '이 사찰에 참조 사진이 없는 문화재가 있어요. 관리자에게 사진 등록을 요청해 주세요.');
  }
  return candidates;
}

async function getMatchDetail(supabase, match, templeId) {
  const [heritageResult, assetResult] = await Promise.all([
    supabase.from('heritages').select('*').eq('id', match.id)
      .eq('temple_id', templeId).eq('is_active', true).maybeSingle(),
    supabase.from('heritage_assets').select('*').eq('id', match.id).maybeSingle(),
  ]);
  if (heritageResult.error) throw heritageResult.error;
  if (assetResult.error && !isOptionalAssetReadError(assetResult.error)) throw assetResult.error;
  if (!heritageResult.data) throw recognitionError('MATCH_UNAVAILABLE', '문화재 정보가 변경되었어요. 다시 촬영해 주세요.');
  const normalized = normalizeHeritage(heritageResult.data, new Map(),
    new Map(assetResult.data ? [[match.id, assetResult.data]] : []));
  return { ...normalized, images: match.images, confidence: match.confidence, reason: match.reason };
}

function createOpenAiContent(imageDataUrl, candidates) {
  const content = [
    {
      type: 'input_text',
      text: [
        '첫 번째 이미지는 사용자가 방금 촬영한 이미지입니다.',
        '현재 사찰에 등록된 아래 후보의 참조 사진과 비교하여 정확히 같은 문화재만 고르세요. 비슷한 종류만으로 선택하지 마세요.',
        '같은 물체라고 보기 어렵거나 애매하면 matchedHeritageId를 null로 반환하세요.',
        '반드시 JSON 객체 하나만 반환하세요: {"matchedHeritageId": string|null, "confidence": number, "reason": string}',
        'reason은 짧은 한 문장으로 작성하세요.',
        '문화유산 후보 목록:',
        ...candidates.map((candidate) => (
          `- ${candidate.id}: ${candidate.name}`
        )),
      ].join('\n'),
    },
    {
      type: 'input_image',
      image_url: imageDataUrl,
      detail: 'low',
    },
  ];

  for (const candidate of candidates) {
    content.push({
      type: 'input_text',
      text: `후보 ${candidate.id} (${candidate.name}) 참조 이미지`,
    });

    for (const image of candidate.images) {
      content.push({
        type: 'input_image',
        image_url: image.imageUrl,
        detail: 'low',
      });
    }
  }

  return content;
}

function getOutputText(response) {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return '';
}

async function callOpenAiRecognition({ imageDataUrl, candidates, metrics, maxOutputTokens = 250 }) {
  const apiKey = getRequiredEnv('OPENAI_API_KEY');
  const model = process.env.OPENAI_RECOGNITION_MODEL || DEFAULT_MODEL;
  metrics.model = model;
  metrics.openaiAttempts += 1;
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: 'You are a strict visual classifier. Return only one JSON object.',
            },
          ],
        },
        {
          role: 'user',
          content: createOpenAiContent(imageDataUrl, candidates),
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
      max_output_tokens: maxOutputTokens,
    }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseBody?.error?.message || `OpenAI request failed with HTTP ${response.status}.`);
  }

  if (responseBody?.status === 'incomplete') {
    if (responseBody.incomplete_details?.reason === 'max_output_tokens' && maxOutputTokens === 250) {
      return callOpenAiRecognition({ imageDataUrl, candidates, metrics, maxOutputTokens: 1200 });
    }
    throw recognitionError('OPENAI_INCOMPLETE', '사진 분석 응답이 완료되지 않았어요. 다시 시도해 주세요.');
  }
  const outputText = getOutputText(responseBody ?? {});

  if (!outputText) {
    throw new Error('OpenAI response did not include recognition output.');
  }

  const result = JSON.parse(outputText);
  if (!result || typeof result !== 'object' || Array.isArray(result)
    || !(result.matchedHeritageId === null || typeof result.matchedHeritageId === 'string')
    || typeof result.confidence !== 'number' || !Number.isFinite(result.confidence)
    || result.confidence < 0 || result.confidence > 1) {
    throw recognitionError('OPENAI_INVALID_OUTPUT', '사진 분석 응답 형식이 올바르지 않아요. 다시 시도해 주세요.');
  }
  return result;
}

function createMatchPayload(recognition, candidates) {
  const matchedHeritageId = recognition.matchedHeritageId;
  const candidate = candidates.find((item) => item.id === matchedHeritageId);
  const parsedConfidence = Number(recognition.confidence);
  const confidence = Number.isFinite(parsedConfidence) ? parsedConfidence : 0.7;

  if (!candidate || confidence < MIN_CONFIDENCE) {
    return null;
  }

  return {
    ...candidate,
    confidence,
    reason: typeof recognition.reason === 'string' && recognition.reason
      ? recognition.reason : `${candidate.name} 참조 이미지와 가장 유사합니다.`,
  };
}

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    setJsonHeaders(res);
    res.status(405).json({
      ok: false,
      match: null,
      error: 'Method not allowed.',
    });
    return;
  }

  const started = performance.now();
  const metrics = { requestId: randomUUID(), templeId: null, distanceMeters: null,
    candidateCount: 0, referenceImageCount: 0, openaiAttempts: 0,
    timingsMs: { bodyParsing: null, nearestTemple: null, candidates: null, openai: null, detail: null } };
  let stage = 'bodyParsing';
  const measure = async (name, run) => {
    stage = name;
    const start = performance.now();
    try { return await run(); }
    finally { metrics.timingsMs[name] = Math.round(performance.now() - start); }
  };
  setJsonHeaders(res);
  try {
    const body = await measure('bodyParsing', () => parseJsonBody(req));
    const imageDataUrl = body?.imageDataUrl;
    if (!isSupportedImageDataUrl(imageDataUrl)) {
      throw recognitionError('INVALID_IMAGE', '지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP, GIF 이미지가 필요합니다.', 400);
    }
    if (Buffer.byteLength(imageDataUrl, 'utf8') > MAX_REQUEST_BODY_BYTES) {
      throw recognitionError('IMAGE_TOO_LARGE', '이미지 크기가 너무 커요.', 413);
    }
    const coordinates = { latitude: body.latitude, longitude: body.longitude };
    if (!hasValidCoordinates(coordinates)) {
      throw recognitionError('INVALID_COORDINATES', '현재 위치를 확인할 수 없어요. 위치 권한을 허용하고 다시 시도해 주세요.', 400);
    }
    const temple = await measure('nearestTemple', async () => {
      const db = createSupabaseAdminClient();
      return { db, nearest: await getNearestTemple(db, coordinates) };
    });
    const { db: supabase, nearest } = temple;
    metrics.templeId = nearest?.id ?? null;
    metrics.distanceMeters = nearest ? Math.round(nearest.distanceMeters) : null;
    if (!nearest || nearest.distanceMeters > getMaxTempleDistance()) {
      throw recognitionError('NO_NEARBY_TEMPLE', `주변 ${getMaxTempleDistance()}m 이내에 등록된 사찰이 없어요. 사찰 가까이에서 다시 시도해 주세요.`);
    }
    const candidates = await measure('candidates', () => getRecognitionCandidates(supabase, nearest.id, metrics));
    const recognition = await measure('openai', () => callOpenAiRecognition({ imageDataUrl, candidates, metrics }));
    const selected = createMatchPayload(recognition, candidates);
    const match = selected ? await measure('detail', () => getMatchDetail(supabase, selected, nearest.id)) : null;
    metrics.code = match ? 'MATCHED' : 'NO_MATCH';
    res.status(200).json({ ok: true, match, code: metrics.code,
      candidates: candidates.map(({ id, name }) => ({ id, name })), error: null });
  } catch (error) {
    const code = error.status && error instanceof Error ? error.code
      : stage === 'openai' ? 'OPENAI_ERROR'
        : stage === 'bodyParsing' ? 'INVALID_REQUEST' : 'SUPABASE_ERROR';
    metrics.code = code;
    const message = error.status ? error.message : code === 'OPENAI_ERROR'
      ? '사진 분석 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
      : code === 'INVALID_REQUEST' ? '인식 요청을 읽지 못했어요.' : '문화재 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
    res.status(error.status ?? 200).json({ ok: false, match: null, code, error: message });
  } finally {
    metrics.totalMs = Math.round(performance.now() - started);
    console.info('recognition:request', JSON.stringify(metrics));
  }
}
