import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createSupabaseAdminClient } from '../server/supabaseAdmin.js';

const TOUR_API_BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';
const TOUR_API_OPERATION = 'areaBasedList2';
const DEFAULT_LIMIT = 10;
const DEFAULT_PAGE_SIZE = 100;
const UPSERT_BATCH_SIZE = 100;
const MAX_RETRIES = 2;

const TEMPLE_CLASSIFICATION = {
  contentTypeId: '12',
  lclsSystm1: 'HS',
  lclsSystm2: 'HS03',
  lclsSystm3: 'HS030100',
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const envText = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function parseBoolean(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

function toPositiveInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const numberValue = Number(value);

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function parseArgs(argv) {
  const options = {
    dryRun: parseBoolean(process.env.IMPORT_DRY_RUN),
    limit: toPositiveInteger(process.env.IMPORT_LIMIT, DEFAULT_LIMIT),
    pageSize: toPositiveInteger(process.env.IMPORT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    areaCode: process.env.TOUR_API_AREA_CODE || null,
    sigunguCode: process.env.TOUR_API_SIGUNGU_CODE || null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--all') {
      options.limit = null;
      continue;
    }

    const [key, value] = arg.split('=');

    if (!value) {
      continue;
    }

    if (key === '--limit' || key === '--max-rows') {
      options.limit = toPositiveInteger(value, options.limit);
    } else if (key === '--page-size') {
      options.pageSize = toPositiveInteger(value, options.pageSize);
    } else if (key === '--area-code') {
      options.areaCode = value;
    } else if (key === '--sigungu-code') {
      options.sigunguCode = value;
    }
  }

  if (options.pageSize > 500) {
    throw new Error('--page-size must be 500 or less.');
  }

  return options;
}

function getRequiredEnv(name, fallbackNames = []) {
  const names = [name, ...fallbackNames];
  const matchedName = names.find((envName) => process.env[envName]);

  if (!matchedName) {
    throw new Error(`${name} is required.`);
  }

  return process.env[matchedName];
}

function getTourApiServiceKey() {
  const serviceKey = getRequiredEnv('TOUR_API_SERVICE_KEY', [
    'TOURAPI_SERVICE_KEY',
    'KTO_TOUR_API_KEY',
  ]);

  if (!serviceKey.includes('%')) {
    return serviceKey;
  }

  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function normalizeItems(items) {
  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : [items];
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createTourApiUrl(pageNo, options) {
  const url = new URL(`${TOUR_API_BASE_URL}/${TOUR_API_OPERATION}`);

  url.searchParams.set('serviceKey', getTourApiServiceKey());
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'Jeollo');
  url.searchParams.set('_type', 'json');
  url.searchParams.set('numOfRows', String(options.pageSize));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('contentTypeId', TEMPLE_CLASSIFICATION.contentTypeId);
  url.searchParams.set('lclsSystm1', TEMPLE_CLASSIFICATION.lclsSystm1);
  url.searchParams.set('lclsSystm2', TEMPLE_CLASSIFICATION.lclsSystm2);
  url.searchParams.set('lclsSystm3', TEMPLE_CLASSIFICATION.lclsSystm3);

  if (options.areaCode) {
    url.searchParams.set('areaCode', options.areaCode);
  }

  if (options.sigunguCode) {
    url.searchParams.set('sigunguCode', options.sigunguCode);
  }

  return url;
}

async function fetchJsonWithRetry(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url);
      const responseText = await response.text();

      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          await sleep(500 * (attempt + 1));
          continue;
        }

        throw new Error(`TourAPI request failed: HTTP ${response.status}`);
      }

      try {
        return JSON.parse(responseText);
      } catch {
        throw new Error('TourAPI returned a non-JSON response.');
      }
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

async function fetchTourApiPage(pageNo, options) {
  const json = await fetchJsonWithRetry(createTourApiUrl(pageNo, options));
  const resultCode = json?.response?.header?.resultCode;
  const resultMessage = json?.response?.header?.resultMsg;

  if (resultCode && resultCode !== '0000') {
    throw new Error(`TourAPI returned ${resultCode}: ${resultMessage ?? 'unknown error'}`);
  }

  const body = json?.response?.body;

  return {
    items: normalizeItems(body?.items?.item),
    totalCount: Number(body?.totalCount ?? 0),
  };
}

function toNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function hasValidCoordinates(latitude, longitude) {
  return (
    latitude != null &&
    longitude != null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isTempleItem(item) {
  return (
    String(item.contenttypeid) === TEMPLE_CLASSIFICATION.contentTypeId &&
    item.lclsSystm1 === TEMPLE_CLASSIFICATION.lclsSystm1 &&
    item.lclsSystm2 === TEMPLE_CLASSIFICATION.lclsSystm2 &&
    item.lclsSystm3 === TEMPLE_CLASSIFICATION.lclsSystm3
  );
}

function mapTempleItem(item) {
  const longitude = toNumber(item.mapx);
  const latitude = toNumber(item.mapy);
  const address = [item.addr1, item.addr2].filter(Boolean).join(' ').trim();
  const imageUrl = item.firstimage || null;

  return {
    id: `T_${item.contentid}`,
    tour_content_id: String(item.contentid),
    name: normalizeTempleName(item.title),
    address: address || null,
    longitude,
    latitude,
    image_url: imageUrl,
    image_source: imageUrl ? 'tourapi' : null,
    is_active: true,
  };
}

function normalizeTempleName(name) {
  return name.replace(/\s*[\(（][^\)）]+[\)）]\s*$/u, '').trim();
}

function createEmptyStats(options) {
  return {
    dryRun: options.dryRun,
    limit: options.limit,
    pagesFetched: 0,
    tourApiTotalCount: 0,
    tourApiFetched: 0,
    templeCandidates: 0,
    preparedForSave: 0,
    saved: 0,
    skippedMissingRequired: 0,
    skippedInvalidCategory: 0,
    skippedNoCoordinates: 0,
    skippedDuplicateInResponse: 0,
    saveErrors: 0,
    errors: [],
  };
}

async function collectTemples(options) {
  const stats = createEmptyStats(options);
  const temples = [];
  const seenContentIds = new Set();
  let pageNo = 1;

  while (options.limit == null || temples.length < options.limit) {
    const page = await fetchTourApiPage(pageNo, options);
    stats.pagesFetched += 1;
    stats.tourApiTotalCount = page.totalCount;
    stats.tourApiFetched += page.items.length;

    if (page.items.length === 0) {
      break;
    }

    for (const item of page.items) {
      if (!isTempleItem(item)) {
        stats.skippedInvalidCategory += 1;
        continue;
      }

      stats.templeCandidates += 1;

      if (!item.contentid || !item.title) {
        stats.skippedMissingRequired += 1;
        continue;
      }

      const temple = mapTempleItem(item);

      if (!hasValidCoordinates(temple.latitude, temple.longitude)) {
        stats.skippedNoCoordinates += 1;
        continue;
      }

      if (seenContentIds.has(temple.tour_content_id)) {
        stats.skippedDuplicateInResponse += 1;
        continue;
      }

      seenContentIds.add(temple.tour_content_id);
      temples.push(temple);
      stats.preparedForSave += 1;

      if (options.limit != null && temples.length >= options.limit) {
        break;
      }
    }

    if (pageNo * options.pageSize >= page.totalCount) {
      break;
    }

    pageNo += 1;
  }

  return { temples, stats };
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function getExistingTempleIdsByTourContentId(supabase, tourContentIds) {
  const existingByTourContentId = new Map();

  for (const batch of chunkArray(tourContentIds, UPSERT_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('temples')
      .select('id,tour_content_id')
      .in('tour_content_id', batch);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (!existingByTourContentId.has(row.tour_content_id)) {
        existingByTourContentId.set(row.tour_content_id, row.id);
      }
    }
  }

  return existingByTourContentId;
}

function withExistingIds(temples, existingByTourContentId) {
  return temples.map((temple) => ({
    ...temple,
    id: existingByTourContentId.get(temple.tour_content_id) ?? temple.id,
  }));
}

function isMissingTourContentUniqueConstraint(error) {
  return (
    error?.code === '42P10' ||
    /unique|exclusion|constraint|on conflict/i.test(error?.message ?? '')
  );
}

async function upsertBatch(supabase, batch, stats) {
  const byTourContent = await supabase
    .from('temples')
    .upsert(batch, { onConflict: 'tour_content_id' });

  if (!byTourContent.error) {
    stats.saved += batch.length;
    return;
  }

  if (!isMissingTourContentUniqueConstraint(byTourContent.error)) {
    throw byTourContent.error;
  }

  const byId = await supabase.from('temples').upsert(batch, { onConflict: 'id' });

  if (byId.error) {
    throw byId.error;
  }

  stats.saved += batch.length;
}

async function saveTemples(temples, stats) {
  if (temples.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const existingByTourContentId = await getExistingTempleIdsByTourContentId(
    supabase,
    temples.map((temple) => temple.tour_content_id),
  );
  const preparedTemples = withExistingIds(temples, existingByTourContentId);

  for (const batch of chunkArray(preparedTemples, UPSERT_BATCH_SIZE)) {
    try {
      await upsertBatch(supabase, batch, stats);
    } catch (batchError) {
      for (const temple of batch) {
        try {
          await upsertBatch(supabase, [temple], stats);
        } catch (itemError) {
          stats.saveErrors += 1;
          stats.errors.push({
            tour_content_id: temple.tour_content_id,
            message: itemError.message,
          });
        }
      }

      if (stats.errors.length === 0) {
        stats.errors.push({ message: batchError.message });
      }
    }
  }
}

function createDryRunSample(temples) {
  return temples.slice(0, 3).map((temple) => ({
    id: temple.id,
    tour_content_id: temple.tour_content_id,
    name: temple.name,
    address: temple.address,
    latitude: temple.latitude,
    longitude: temple.longitude,
    image_source: temple.image_source,
    has_image_url: Boolean(temple.image_url),
  }));
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));

  const options = parseArgs(process.argv.slice(2));
  const { temples, stats } = await collectTemples(options);

  if (!options.dryRun) {
    await saveTemples(temples, stats);
  }

  console.log(
    JSON.stringify(
      {
        ...stats,
        sample: options.dryRun ? createDryRunSample(temples) : undefined,
      },
      null,
      2,
    ),
  );

  if (stats.saveErrors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
