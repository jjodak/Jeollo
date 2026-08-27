import { createClient } from '@supabase/supabase-js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_CANDIDATE_LIMIT = 12;
const MAX_REQUEST_BODY_BYTES = 9 * 1024 * 1024;
const MAX_REFERENCE_IMAGES_PER_HERITAGE = 3;
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

function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getCandidateLimit() {
  const value = Number(process.env.RECOGNITION_CANDIDATE_LIMIT);

  return Number.isInteger(value) && value > 0 ? value : DEFAULT_CANDIDATE_LIMIT;
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

function normalizeHeritage(row, imagesByHeritageId) {
  const images = (imagesByHeritageId.get(row.id) ?? [])
    .map((image) => ({
      imageUrl: sanitizeImageUrl(image.image_url),
      angleType: image.angle_type,
      isPrimary: Boolean(image.is_primary),
    }))
    .filter((image) => image.imageUrl)
    .slice(0, MAX_REFERENCE_IMAGES_PER_HERITAGE);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    docentText: row.docent_text ?? '',
    thumbnailUrl: sanitizeImageUrl(row.thumbnail_url),
    templeId: row.temple_id,
    images,
  };
}

async function getRecognitionCandidates() {
  const supabase = createSupabaseAdminClient();
  const { data: heritages, error: heritageError } = await supabase
    .from('heritages')
    .select('id,temple_id,name,description,docent_text,thumbnail_url')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(getCandidateLimit());

  if (heritageError) {
    throw heritageError;
  }

  const heritageIds = (heritages ?? []).map((heritage) => heritage.id);

  if (heritageIds.length === 0) {
    return [];
  }

  const { data: images, error: imageError } = await supabase
    .from('heritage_images')
    .select('heritage_id,image_url,angle_type,is_primary')
    .in('heritage_id', heritageIds)
    .order('is_primary', { ascending: false })
    .order('angle_type', { ascending: true });

  if (imageError) {
    throw imageError;
  }

  const imagesByHeritageId = new Map();

  for (const image of images ?? []) {
    const heritageImages = imagesByHeritageId.get(image.heritage_id) ?? [];
    heritageImages.push(image);
    imagesByHeritageId.set(image.heritage_id, heritageImages);
  }

  return (heritages ?? [])
    .map((heritage) => normalizeHeritage(heritage, imagesByHeritageId))
    .filter((heritage) => heritage.images.length > 0);
}

function createOpenAiContent(imageDataUrl, candidates) {
  const content = [
    {
      type: 'input_text',
      text: [
        '첫 번째 이미지는 사용자가 방금 촬영한 이미지입니다.',
        '아래 후보 문화유산의 참조 이미지들과 비교해서 가장 같은 물체를 고르세요.',
        '같은 물체라고 보기 어렵거나 애매하면 matchedHeritageId를 null로 반환하세요.',
        '반드시 JSON 객체 하나만 반환하세요: {"matchedHeritageId": string|null, "confidence": number, "reason": string}',
        '테스트 후보 목록:',
        ...candidates.map((candidate) => (
          `- ${candidate.id}: ${candidate.name} / ${candidate.description || '설명 없음'}`
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

async function callOpenAiRecognition({ imageDataUrl, candidates }) {
  const apiKey = getRequiredEnv('OPENAI_API_KEY');
  const model = process.env.OPENAI_RECOGNITION_MODEL || DEFAULT_MODEL;
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
      max_output_tokens: 1200,
    }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseBody?.error?.message || `OpenAI request failed with HTTP ${response.status}.`);
  }

  const outputText = getOutputText(responseBody);

  if (!outputText) {
    throw new Error('OpenAI response did not include recognition output.');
  }

  return JSON.parse(outputText);
}

function createMatchPayload(recognition, candidates) {
  const matchedHeritageId =
    recognition.matchedHeritageId ?? recognition.heritageId ?? recognition.id ?? null;
  const candidate = candidates.find((item) => item.id === matchedHeritageId);
  const parsedConfidence = Number(recognition.confidence);
  const confidence = Number.isFinite(parsedConfidence) ? parsedConfidence : 0.7;

  if (!candidate || confidence < MIN_CONFIDENCE) {
    return null;
  }

  return {
    ...candidate,
    confidence,
    reason: recognition.reason || `${candidate.name} 참조 이미지와 가장 유사합니다.`,
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

  try {
    const body = await parseJsonBody(req);
    const imageDataUrl = body?.imageDataUrl;

    if (!isSupportedImageDataUrl(imageDataUrl)) {
      setJsonHeaders(res);
      res.status(400).json({
        ok: false,
        match: null,
        error: '지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP, GIF 이미지가 필요합니다.',
      });
      return;
    }

    const candidates = await getRecognitionCandidates();

    if (candidates.length === 0) {
      setJsonHeaders(res);
      res.status(200).json({
        ok: false,
        match: null,
        candidates: [],
        error: '인식 후보 데이터가 없습니다.',
      });
      return;
    }

    const recognition = await callOpenAiRecognition({ imageDataUrl, candidates });
    const match = createMatchPayload(recognition, candidates);

    setJsonHeaders(res);
    res.status(200).json({
      ok: true,
      match,
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
      })),
      error: null,
    });
  } catch (error) {
    setJsonHeaders(res);
    res.status(200).json({
      ok: false,
      match: null,
      error: error instanceof Error ? error.message : 'Recognition API failed.',
    });
  }
}
