// Reconstruct a localized insurance summary from structured product fields.
//
// The provider `info` field is English freeform text, and the API has no
// language parameter, so the collapsed card preview must NOT show it raw.
// Instead we build a clean ID/EN summary from the structured fields that are
// already available on each product. The raw `info` is still rendered in the
// expanded "benefit details" panel (that is the provider's source of truth).

export type Lang = 'ID' | 'EN';

export interface SummaryItem {
  icon: string;
  text: string;
}

/** Subset of the insurance product fields used to build the summary. */
export interface InsuranceSummaryProduct {
  info?: string | null;
  product_type_code?: string | null;
  type_trip_code?: string | null;
  type_trip_name?: string | null;
  master_trip_id?: string | number | null;
  type?: string | number | null;
  sector_type?: string | null;
  data_name?: string | null;
  minAdultOld?: number | null;
  maxAdultOld?: number | null;
  minChildOld?: number | null;
  maxChildOld?: number | null;
  minPax?: number | null;
  maxPax?: number | null;
}

type Bi = { ID: string; EN: string };

const PLAN_TYPES: Record<string, Bi> = {
  individual: { ID: 'Individu', EN: 'Individual' },
  family: { ID: 'Keluarga', EN: 'Family' },
  duo_plus: { ID: 'Duo Plus', EN: 'Duo Plus' },
  duoplus: { ID: 'Duo Plus', EN: 'Duo Plus' },
  dual: { ID: 'Duo Plus', EN: 'Duo Plus' },
  group: { ID: 'Grup', EN: 'Group' },
  mild2plus: { ID: 'Mild 2 Plus', EN: 'Mild 2 Plus' },
  large_group: { ID: 'Grup Besar', EN: 'Large Group' },
  lite_group: { ID: 'Grup Lite', EN: 'Lite Group' },
};

const SECTORS: Record<string, Bi> = {
  international: { ID: 'Internasional', EN: 'International' },
  domestic: { ID: 'Domestik', EN: 'Domestic' },
};

const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/** Localize a provider sector value (e.g. International -> Internasional). */
export function localizeSector(sector: unknown, lang: Lang): string | null {
  if (!sector) return null;
  const key = norm(sector);
  return SECTORS[key]?.[lang] ?? String(sector);
}

/** Extract the coverage limit amount (e.g. "200.000") from the English info text. */
export function extractCoverageLimit(info?: string | null): string | null {
  if (!info) return null;
  const m = info.match(/USD\s*([\d][\d.,]*)/i);
  return m ? m[1].replace(/[.,]+$/, '') : null;
}

function planType(product: InsuranceSummaryProduct, lang: Lang): string | null {
  const candidates = [product?.product_type_code, product?.type_trip_code, product?.type_trip_name];
  for (const c of candidates) {
    const key = norm(c);
    if (key && PLAN_TYPES[key]) return PLAN_TYPES[key][lang];
  }
  return product?.type_trip_name ? String(product.type_trip_name) : null;
}

function tripDuration(product: InsuranceSummaryProduct, lang: Lang): string | null {
  const src = `${product?.type ?? ''} ${product?.master_trip_id ?? ''} ${product?.type_trip_name ?? ''}`;
  if (/annual|anual|yearly/i.test(src)) return lang === 'ID' ? 'Tahunan' : 'Annual';
  if (/single|short|daily/i.test(src)) return lang === 'ID' ? 'Sekali Jalan' : 'Single Trip';
  return null;
}

function range(min: unknown, max: unknown): string | null {
  const a = Number(min);
  const b = Number(max);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `${a}\u2013${b}`;
}

/**
 * Build a localized, structured summary for the insurance card preview.
 * Returns an empty array when there is nothing useful to show.
 */
export function buildInsuranceSummary(product: InsuranceSummaryProduct, lang: Lang): SummaryItem[] {
  const items: SummaryItem[] = [];
  const isID = lang === 'ID';

  const limit = extractCoverageLimit(product?.info);
  if (limit) {
    items.push({
      icon: 'fa-shield-halved',
      text: isID ? `Limit perlindungan hingga USD ${limit}` : `Coverage up to USD ${limit}`,
    });
  }

  const plan = planType(product, lang);
  if (plan) {
    items.push({ icon: 'fa-user-group', text: isID ? `Paket ${plan}` : `${plan} plan` });
  }

  const duration = tripDuration(product, lang);
  if (duration) items.push({ icon: 'fa-calendar-day', text: duration });

  const sector = localizeSector(product?.sector_type, lang);
  const area = sector && product?.data_name ? `${sector} \u00b7 ${product.data_name}` : sector;
  if (area) items.push({ icon: 'fa-earth-asia', text: isID ? `Cakupan ${area}` : `${area} coverage` });

  const adult = range(product?.minAdultOld, product?.maxAdultOld);
  const child = range(product?.minChildOld, product?.maxChildOld);
  const noLimit = /no age limit/i.test(product?.info ?? '');
  if (noLimit) {
    items.push({ icon: 'fa-user-clock', text: isID ? 'Tanpa batasan usia' : 'No age limit' });
  } else if (adult || child) {
    const parts: string[] = [];
    if (adult) parts.push(`${isID ? 'Dewasa' : 'Adult'} ${adult} ${isID ? 'thn' : 'yr'}`);
    if (child) parts.push(`${isID ? 'Anak' : 'Child'} ${child} ${isID ? 'thn' : 'yr'}`);
    items.push({ icon: 'fa-user-clock', text: (isID ? 'Usia: ' : 'Age: ') + parts.join(', ') });
  }

  const pax = range(product?.minPax, product?.maxPax);
  if (pax) items.push({ icon: 'fa-users', text: isID ? `${pax} peserta` : `${pax} pax` });

  return items;
}
