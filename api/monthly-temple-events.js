const TOUR_API_BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';
const TOUR_API_OPERATION = 'searchFestival2';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_ROWS_PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 10;
const MAX_ALLOWED_PAGES = 20;

const buddhistEventKeywords = [
  '사찰',
  '사찰음식',
  '템플',
  '템플스테이',
  '불교',
  '불교문화',
  '산사',
  '부처',
  '부처님',
  '석가',
  '봉축',
  '연등',
  '법회',
  '법요',
  '수륙재',
  '영산재',
  '괘불',
  '불상',
  '불탑',
  '탑돌이',
  '범종',
  '단청',
  '선명상',
  '선문화',
];

const nonTempleSuffixes = [
  '문화행사',
  '기념행사',
  '부대행사',
  '체험행사',
  '공식행사',
  '특별행사',
  '신문사',
  '출판사',
  '여행사',
  '사진사',
  '회사',
  '공사',
  '역사',
  '봉사',
  '감사',
  '인사',
  '조사',
  '심사',
  '기사',
  '의사',
  '교사',
  '군사',
  '마술사',
  '요리사',
  '변호사',
];

const monthlyEventCache = globalThis.__JEOLLO_MONTHLY_TEMPLE_EVENTS_CACHE__ ?? new Map();
globalThis.__JEOLLO_MONTHLY_TEMPLE_EVENTS_CACHE__ = monthlyEventCache;

function getScalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getTourApiServiceKey() {
  const serviceKey = process.env.TOUR_API_SERVICE_KEY;

  if (!serviceKey) {
    throw new Error('TOUR_API_SERVICE_KEY is required.');
  }

  if (!serviceKey.includes('%')) {
    return serviceKey;
  }

  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function getKoreaCurrentYearMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

function parseYearMonth(query) {
  const fallback = getKoreaCurrentYearMonth();
  const year = Number(getScalar(query.year));
  const month = Number(getScalar(query.month));

  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback.month,
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getMonthRange(year, month) {
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    startDate: `${year}${pad2(month)}01`,
    endDate: `${year}${pad2(month)}${pad2(lastDate)}`,
  };
}

function getMaxPages() {
  const envValue = Number(process.env.TOUR_API_EVENT_MAX_PAGES);

  if (!Number.isInteger(envValue) || envValue <= 0) {
    return DEFAULT_MAX_PAGES;
  }

  return Math.min(envValue, MAX_ALLOWED_PAGES);
}

function normalizeItems(items) {
  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : [items];
}

function createTourApiUrl({ pageNo, startDate, endDate }) {
  const url = new URL(`${TOUR_API_BASE_URL}/${TOUR_API_OPERATION}`);

  url.searchParams.set('serviceKey', getTourApiServiceKey());
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'Jeollo');
  url.searchParams.set('_type', 'json');
  url.searchParams.set('numOfRows', String(DEFAULT_ROWS_PER_PAGE));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('eventStartDate', startDate);
  url.searchParams.set('eventEndDate', endDate);

  return url;
}

async function fetchTourApiJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`TourAPI request failed with HTTP ${response.status}.`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error('TourAPI returned a non-JSON response.');
  }
}

async function fetchTourApiPage({ pageNo, startDate, endDate }) {
  const json = await fetchTourApiJson(createTourApiUrl({ pageNo, startDate, endDate }));
  const resultCode = json?.response?.header?.resultCode;
  const resultMessage = json?.response?.header?.resultMsg;

  if (resultCode === '03') {
    return {
      items: [],
      totalCount: 0,
    };
  }

  if (resultCode && resultCode !== '0000') {
    throw new Error(`TourAPI returned ${resultCode}: ${resultMessage ?? 'unknown error'}`);
  }

  const body = json?.response?.body;

  return {
    items: normalizeItems(body?.items?.item),
    totalCount: Number(body?.totalCount ?? 0),
  };
}

function normalizeDate(value) {
  const text = cleanText(value);

  if (!/^\d{8}$/.test(text)) {
    return null;
  }

  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function formatKoreanDate(value) {
  if (!value) {
    return null;
  }

  const [, month, date] = value.split('-');

  return `${Number(month)}월 ${Number(date)}일`;
}

function formatDateRange(startDate, endDate) {
  const startText = formatKoreanDate(startDate);
  const endText = endDate && endDate !== startDate ? formatKoreanDate(endDate) : null;

  if (!startText) {
    return '일정 확인';
  }

  return endText ? `${startText} ~ ${endText}` : startText;
}

function getDurationText(startDate, endDate) {
  if (!startDate || !endDate) {
    return '일정 확인';
  }

  if (startDate === endDate) {
    return '당일 행사';
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return Number.isFinite(days) && days > 1 ? `${days}일간` : '기간 행사';
}

function getTextForFiltering(item) {
  return [
    item.title,
    item.addr1,
    item.addr2,
  ].map(cleanText).filter(Boolean).join(' ');
}

function extractLikelyTempleName(text) {
  const matches = text.match(/[가-힣]{2,}(?:정사|선원|사|암)(?![가-힣])/g) ?? [];

  return matches.find((match) => (
    !nonTempleSuffixes.some((suffix) => match.endsWith(suffix)) &&
    !match.includes('행사')
  )) ?? null;
}

function isTempleRelatedEvent(item) {
  const text = getTextForFiltering(item);
  const compactText = text.replace(/\s+/g, '');

  if (buddhistEventKeywords.some((keyword) => compactText.includes(keyword.replace(/\s+/g, '')))) {
    return true;
  }

  return Boolean(extractLikelyTempleName(text));
}

function getShortLocation(item, address) {
  const templeName = extractLikelyTempleName(getTextForFiltering(item));
  const region = cleanText(item.addr1).split(/\s+/).slice(0, 2).join(' ');

  if (region && templeName) {
    return `${region} ${templeName}`;
  }

  if (region) {
    return region;
  }

  return address || '장소 확인';
}

function toNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function mapTourApiEvent(item) {
  const contentId = cleanText(item.contentid);
  const title = cleanText(item.title);
  const address = [cleanText(item.addr1), cleanText(item.addr2)].filter(Boolean).join(' ');
  const startDate = normalizeDate(item.eventstartdate);
  const endDate = normalizeDate(item.eventenddate) ?? startDate;
  const imageUrl = cleanText(item.firstimage) || cleanText(item.firstimage2) || null;

  return {
    id: contentId ? `tourapi-event-${contentId}` : `tourapi-event-${title}`,
    contentId,
    title,
    location: getShortLocation(item, address),
    address,
    startDate,
    endDate,
    dateText: formatDateRange(startDate, endDate),
    durationText: getDurationText(startDate, endDate),
    imageUrl,
    mapX: toNumber(item.mapx),
    mapY: toNumber(item.mapy),
    tel: cleanText(item.tel) || null,
    source: 'tourapi',
  };
}

async function fetchMonthlyTempleEvents({ year, month }) {
  const { startDate, endDate } = getMonthRange(year, month);
  const firstPage = await fetchTourApiPage({ pageNo: 1, startDate, endDate });
  const totalPages = Math.ceil(firstPage.totalCount / DEFAULT_ROWS_PER_PAGE);
  const maxPages = Math.min(Math.max(totalPages, 1), getMaxPages());
  const items = [...firstPage.items];

  for (let pageNo = 2; pageNo <= maxPages; pageNo += 1) {
    const page = await fetchTourApiPage({ pageNo, startDate, endDate });
    items.push(...page.items);
  }

  const events = items
    .filter(isTempleRelatedEvent)
    .map(mapTourApiEvent)
    .filter((event) => event.title)
    .sort((a, b) => (
      (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
      a.title.localeCompare(b.title, 'ko')
    ));

  return {
    events,
    meta: {
      operation: TOUR_API_OPERATION,
      fetchedCount: items.length,
      totalCount: firstPage.totalCount,
      filteredCount: events.length,
      pagesFetched: maxPages,
      truncated: totalPages > maxPages,
    },
  };
}

function setJsonHeaders(res, { cacheable }) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    cacheable ? 's-maxage=43200, stale-while-revalidate=3600' : 'no-store',
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    setJsonHeaders(res, { cacheable: false });
    res.status(405).json({
      ok: false,
      events: [],
      error: 'Method not allowed.',
    });
    return;
  }

  const { year, month } = parseYearMonth(req.query ?? {});
  const cacheKey = `${year}-${pad2(month)}`;
  const cached = monthlyEventCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    setJsonHeaders(res, { cacheable: true });
    res.status(200).json({
      ...cached.payload,
      cached: true,
    });
    return;
  }

  try {
    const { events, meta } = await fetchMonthlyTempleEvents({ year, month });
    const payload = {
      ok: true,
      year,
      month,
      events,
      error: null,
      cached: false,
      cacheTtlSeconds: CACHE_TTL_MS / 1000,
      meta,
    };

    monthlyEventCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    setJsonHeaders(res, { cacheable: true });
    res.status(200).json(payload);
  } catch (error) {
    setJsonHeaders(res, { cacheable: false });
    res.status(200).json({
      ok: false,
      year,
      month,
      events: [],
      error: error instanceof Error ? error.message : 'TourAPI request failed.',
      cached: false,
    });
  }
}
