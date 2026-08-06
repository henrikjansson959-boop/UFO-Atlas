const UAPDROP_DATASET_URL = 'https://www.uapdrop.com/rest/v1/public/sightings.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_DATASET_BYTES = 50 * 1024 * 1024;

interface UapDropRecord {
  sourceKey?: unknown;
  externalId?: unknown;
  title?: unknown;
  summary?: unknown;
  locationName?: unknown;
  countryCode?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  observedAt?: unknown;
  sourceUrl?: unknown;
  coordinatePrecision?: unknown;
}

export interface PublicSighting {
  id: string;
  sourceKey: string;
  externalId: string;
  title: string;
  summary: string;
  location: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  observedAt: string | null;
  sourceUrl: string | null;
  sourceReference: string | null;
  coordinatePrecision: string | null;
}

interface CachedDataset {
  expiresAt: number;
  records: PublicSighting[];
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isHttpUrl(value: string | null): value is string {
  return value !== null && /^https?:\/\//i.test(value);
}

function normalizeRecord(record: UapDropRecord): PublicSighting | null {
  const sourceKey = optionalText(record.sourceKey);
  const externalId = optionalText(record.externalId);
  const latitude = typeof record.latitude === 'number' ? record.latitude : Number.NaN;
  const longitude = typeof record.longitude === 'number' ? record.longitude : Number.NaN;

  if (
    !sourceKey
    || !externalId
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }

  const rawSource = optionalText(record.sourceUrl);
  const sourceUrl = isHttpUrl(rawSource) ? rawSource : null;

  return {
    id: `uapdrop:${sourceKey}:${externalId}`,
    sourceKey,
    externalId,
    title: optionalText(record.title) ?? 'Untitled sighting',
    summary: optionalText(record.summary) ?? '',
    location: optionalText(record.locationName) ?? 'Location not specified',
    countryCode: optionalText(record.countryCode),
    latitude,
    longitude,
    observedAt: optionalText(record.observedAt),
    sourceUrl,
    sourceReference: sourceUrl ? null : rawSource,
    coordinatePrecision: optionalText(record.coordinatePrecision),
  };
}

export class UapDropService {
  private cache: CachedDataset | null = null;
  private loading: Promise<PublicSighting[]> | null = null;

  async getSightings(): Promise<PublicSighting[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.records;
    }

    if (!this.loading) {
      this.loading = this.loadDataset().finally(() => {
        this.loading = null;
      });
    }

    return this.loading;
  }

  async getSighting(sourceKey: string, externalId: string): Promise<PublicSighting | null> {
    const records = await this.getSightings();
    return records.find(
      (record) => record.sourceKey === sourceKey && record.externalId === externalId,
    ) ?? null;
  }

  private async loadDataset(): Promise<PublicSighting[]> {
    const response = await fetch(UAPDROP_DATASET_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'UFO-Atlas/1.0 (+https://www.uapdrop.com/data.html)',
      },
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new Error(`UAPDrop returned HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_DATASET_BYTES) {
      throw new Error('UAPDrop dataset exceeds the configured size limit');
    }

    const rawText = await response.text();
    if (Buffer.byteLength(rawText, 'utf8') > MAX_DATASET_BYTES) {
      throw new Error('UAPDrop dataset exceeds the configured size limit');
    }

    const rawRecords = JSON.parse(rawText) as unknown;
    if (!Array.isArray(rawRecords)) {
      throw new Error('UAPDrop returned an unexpected data format');
    }

    const records: PublicSighting[] = [];
    const seen = new Set<string>();

    for (const rawRecord of rawRecords as UapDropRecord[]) {
      const record = normalizeRecord(rawRecord);
      if (!record || seen.has(record.id)) continue;
      seen.add(record.id);
      records.push(record);
    }

    this.cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      records,
    };
    return records;
  }
}

