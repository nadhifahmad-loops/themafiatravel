import { insuranceAPI } from '@/lib/orbis';

// =============================================================================
// Insurance provider master data (get_config)
// -----------------------------------------------------------------------------
// Kode `master_trip` (dikirim sebagai field `type` ke get_availability) BERBEDA
// per provider: assistcard/bcainsurance memakai "single_trip"/"annual",
// great_eastern memakai "DAILY"/"ANNUALLY", oona memakai "annual_90"/"annual_180",
// dan zurich hanya punya "single_trip". Karena itu kode diambil dinamis dari
// get_config (di-cache) alih-alih di-hardcode.
// =============================================================================

export type TripFamily = 'single' | 'annual';

export interface InsuranceTripType {
  code: string;
  name: string;
  family: TripFamily;
  /** date_setting dari get_config (jumlah hari masa berlaku, khusus tipe tahunan). */
  dateSetting: number | null;
  minDate: number | null;
  maxDate: number | null;
}

export interface InsuranceProductType {
  code: string;
  name: string;
  requirement?: { key: string; value: string };
}

export interface InsuranceProviderConfig {
  provider: string;
  trips: InsuranceTripType[];
  productTypes: InsuranceProductType[];
  supportsSenior: boolean;
}

// Fallback statis: dipakai hanya bila get_config gagal atau provider tidak ada
// di respons. Nilainya mengikuti dokumentasi API saat ini.
const FALLBACK_TRIPS: Record<string, { single: string; annual: string | null }> = {
  assistcard: { single: 'single_trip', annual: 'annual' },
  bcainsurance: { single: 'single_trip', annual: 'annual' },
  zurich: { single: 'single_trip', annual: null },
  great_eastern: { single: 'DAILY', annual: 'ANNUALLY' },
  oona: { single: 'single_trip', annual: 'annual_90' },
};

const FALLBACK_SENIOR: Record<string, boolean> = { zurich: true };

const CONFIG_TTL_MS = 60 * 60 * 1000; // sukses: cache 1 jam
const CONFIG_ERROR_TTL_MS = 60 * 1000; // gagal: hindari retry beruntun 1 menit

let configCache: { data: Record<string, InsuranceProviderConfig>; at: number } | null = null;
let configFailedAt = 0;
let configInflight: Promise<Record<string, InsuranceProviderConfig>> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Klasifikasikan kode/nama master_trip sebagai keluarga "single" atau "annual". */
export function classifyTripFamily(code: string, name = ''): TripFamily | null {
  const haystack = `${code} ${name}`.toLowerCase();
  if (/annual|anual|yearly/.test(haystack)) return 'annual';
  if (/single|short|daily|one.?trip/.test(haystack)) return 'single';
  return null;
}

/** Ubah nilai `type` apa pun (kode provider atau istilah generik) ke keluarga trip. */
export function normalizeTripFamily(type?: string | null): TripFamily {
  return classifyTripFamily(String(type ?? '')) === 'annual' ? 'annual' : 'single';
}

function parseProviderConfig(provider: string, entry: unknown): InsuranceProviderConfig {
  const record = asRecord(entry);

  const rawTrips = Array.isArray(record?.master_trip) ? (record!.master_trip as unknown[]) : [];
  const trips: InsuranceTripType[] = [];
  for (const raw of rawTrips) {
    const trip = asRecord(raw);
    if (!trip) continue;
    const code = String(trip.code ?? '').trim();
    if (!code) continue;
    const name = String(trip.value ?? code);
    const family = classifyTripFamily(code, name);
    if (!family) continue;
    trips.push({
      code,
      name,
      family,
      dateSetting: toPositiveInt(trip.date_setting),
      minDate: toPositiveInt(trip.min_date),
      maxDate: toPositiveInt(trip.max_date),
    });
  }

  const rawProducts = Array.isArray(record?.product_type) ? (record!.product_type as unknown[]) : [];
  const productTypes: InsuranceProductType[] = [];
  for (const raw of rawProducts) {
    const product = asRecord(raw);
    if (!product) continue;
    const code = String(product.code ?? '').trim();
    if (!code) continue;
    const requirement = asRecord(product.is_requirement);
    productTypes.push({
      code,
      name: String(product.value ?? code),
      requirement: requirement
        ? { key: String(requirement.code ?? ''), value: String(requirement.value ?? '') }
        : undefined,
    });
  }

  return {
    provider,
    trips,
    productTypes,
    supportsSenior: record?.is_senior === true || record?.is_senior === 'true',
  };
}

async function loadInsuranceConfig(): Promise<Record<string, InsuranceProviderConfig>> {
  const now = Date.now();
  if (configCache && now - configCache.at < CONFIG_TTL_MS) return configCache.data;
  if (configInflight) return configInflight;
  if (configFailedAt && now - configFailedAt < CONFIG_ERROR_TTL_MS) {
    return configCache?.data ?? {};
  }

  configInflight = (async () => {
    try {
      const raw = await insuranceAPI.getConfig();
      const root = asRecord(raw) ?? {};
      const data: Record<string, InsuranceProviderConfig> = {};
      for (const [provider, entry] of Object.entries(root)) {
        const first = Array.isArray(entry) ? entry[0] : entry;
        const parsed = parseProviderConfig(provider, first);
        if (parsed.trips.length > 0 || provider in FALLBACK_TRIPS) data[provider] = parsed;
      }
      configCache = { data, at: Date.now() };
      configFailedAt = 0;
      return data;
    } catch (error) {
      console.error('[INSURANCE CONFIG] Gagal memuat get_config:', error);
      configFailedAt = Date.now();
      return configCache?.data ?? {};
    } finally {
      configInflight = null;
    }
  })();

  return configInflight;
}

/** Ambil seluruh config provider (dinamis dari get_config, di-cache). */
export async function getInsuranceConfig(): Promise<Record<string, InsuranceProviderConfig>> {
  return loadInsuranceConfig();
}

function fallbackProviderConfig(provider: string): InsuranceProviderConfig | null {
  const fb = FALLBACK_TRIPS[provider];
  if (!fb) return null;
  const trips: InsuranceTripType[] = [
    { code: fb.single, name: fb.single, family: 'single', dateSetting: null, minDate: 1, maxDate: 365 },
  ];
  if (fb.annual) {
    trips.push({ code: fb.annual, name: fb.annual, family: 'annual', dateSetting: 365, minDate: 1, maxDate: 365 });
  }
  return { provider, trips, productTypes: [], supportsSenior: FALLBACK_SENIOR[provider] === true };
}

/** Ambil config satu provider dari map (dengan fallback bila tidak ada). */
export function getProviderEntry(
  config: Record<string, InsuranceProviderConfig>,
  provider: string,
): InsuranceProviderConfig | null {
  return config[provider] ?? fallbackProviderConfig(provider);
}

/** Cari tipe trip (kode master_trip) yang cocok untuk provider + keluarga. */
export function resolveTripFromConfig(
  config: Record<string, InsuranceProviderConfig>,
  provider: string,
  family: TripFamily,
): InsuranceTripType | null {
  const entry = getProviderEntry(config, provider);
  return entry?.trips.find((trip) => trip.family === family) ?? null;
}

/** Apakah provider mendukung penumpang senior (flag is_senior di get_config). */
export function supportsSeniorFromConfig(
  config: Record<string, InsuranceProviderConfig>,
  provider: string,
): boolean {
  return getProviderEntry(config, provider)?.supportsSenior === true;
}

/** Normalisasi product_type ke kode persis milik provider (mis. great_eastern: INDIVIDUAL). */
export function resolveProductTypeFromConfig(
  config: Record<string, InsuranceProviderConfig>,
  provider: string,
  requested: string,
): string {
  const entry = getProviderEntry(config, provider);
  if (!entry || entry.productTypes.length === 0) return requested;
  const wanted = requested.trim().toLowerCase();
  const exact = entry.productTypes.find((pt) => pt.code.toLowerCase() === wanted);
  if (exact) return exact.code;
  const unrestricted = entry.productTypes.find((pt) => !pt.requirement);
  return unrestricted?.code ?? entry.productTypes[0].code;
}

/** Tambah sejumlah hari ke tanggal "YYYY-MM-DD" (UTC). */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return dateStr;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
