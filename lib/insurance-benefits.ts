// Normalize raw Orbisway insurance products into a consistent, UI-ready shape.
//
// WHAT THE PROVIDERS ACTUALLY SEND (verified against live get_availability
// responses from assistcard, zurich and oona):
//
//   • `MasterBenefitName` / `MasterBenefitNameIdn` are ALWAYS empty strings —
//     ignore them entirely.
//
//   • `info` is the authoritative BASE benefit source, in one of two shapes:
//       (A) an HTML table — usually with a leading `<style>` block — whose rows
//           are `Benefits | Coverage`, e.g. zurich/oona. Group headers are rows
//           with a bold label and an EMPTY coverage cell.
//       (B) plain `Label: value` lines separated by `<br>`, e.g. assistcard:
//           `Description: …<br>Travel type: Daily<br>Minimum age: 0<br>…`
//
//   • `additional_benefit` is NOT the base cover — it is a list of OPTIONAL
//     add-on packs (winter sports, cruise, visa, covid…), each with its own
//     extra `price`. Shape: `{ id, price, text: [id, en], child: [{ text, detail }] }`
//     where `detail[0]` holds the coverage value. These are surfaced separately
//     via `addons`, never folded into the base benefit table.
//
//   • NOT every provider sends benefits at all (verified live): zurich sends
//     `info: ""` + `additional_benefit: []`, assistcard sends only metadata
//     label-lines. For those cases `benefits` stays empty and the UI falls
//     back to `planDetails` — rows built ONLY from structured fields the
//     provider actually sent (`type_trip_name`, `sector_type`, `data_name`,
//     `minAdultOld`/`maxAdultOld`, `minPax`/`maxPax`, `Travel type:` line).
//     Nothing is ever invented: a missing field simply omits its row.
//     great_eastern tables use a `Benefits | Amount` header — also skipped.
//
// Every access goes through a type guard: a field may be a string, an array, an
// object, null, or entirely absent, and none of those cases may throw. The UI
// must NEVER render raw CSS/HTML, and `total_commission` is never read.

import { localizeSector } from './insurance-summary';

export type Lang = 'ID' | 'EN';

export interface BenefitHighlight {
  key: 'delay' | 'accident' | 'baggage' | 'other';
  label: string;
  /** e.g. "Rp 20.000.000", "Actual cost", or null when no data at all. */
  limitText: string | null;
  icon: string;
}

export interface BenefitRow {
  label: string;
  value: string;
  note?: string;
}

/**
 * A fallback "plan detail" row built from structured product fields, used when
 * the provider sends no benefit table at all (zurich, assistcard). Labels are
 * resolved by the UI from i18n via `key`; `value` is provider data only.
 */
export type PlanDetailKey = 'package' | 'tripType' | 'coverageArea' | 'ageRange' | 'participants';

export interface PlanDetail {
  key: PlanDetailKey;
  value: string;
}

/** An optional add-on pack with its own extra premium. */
export interface AddonRow {
  label: string;
  price: number;
  items: Array<{ label: string; value: string }>;
}

export interface AgeRange {
  minAge?: string;
  maxAge?: string;
  requirement?: string;
}

export interface NormalizedInsuranceProduct {
  highlights: BenefitHighlight[];
  benefits: BenefitRow[];
  /**
   * Structured-field fallback rows (package / trip type / coverage area /
   * age range / pax). Always computed; the UI shows them only when the
   * provider sent no benefit table.
   */
  planDetails: PlanDetail[];
  /** Optional add-on packs (extra premium) — never base cover. */
  addons: AddonRow[];
  exclusions: string[];
  ageRange: AgeRange;
  /** Clean, 1–2 sentence description with no HTML/CSS. Never a table dump. */
  description: string;
  /** Package/trip metadata pulled out of the `info` label lines. */
  travelType?: string;
}

const EMPTY: NormalizedInsuranceProduct = {
  highlights: [],
  benefits: [],
  planDetails: [],
  addons: [],
  exclusions: [],
  ageRange: {},
  description: '',
};

// ─── Small safe helpers ──────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

/** Coerce any scalar-ish value to a trimmed string ('' when unusable). */
function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    });
}

/** Bullet / decorative glyphs the providers sprinkle into benefit labels. */
const BULLET_RE = /[▸►▶●○◦•·→»\u25a0\u25aa\u2023]/g;

/**
 * Remove `<style>`/`<script>` blocks *including their contents*, then strip
 * every remaining tag. Fixes CSS text leaking into the UI, e.g.
 * `th,td{border:1px solid black...}`.
 */
function stripHtml(value: string): string {
  if (!value) return '';
  return decodeEntities(
    value
      .replace(/<(style|script|head|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\s*br\s*\/?\s*>/gi, ' ')
      .replace(/<\/\s*(p|div|li|tr|td|th|h[1-6])\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[a-z-]+\s*:\s*[^;{}]+;/gi, ' ')
      .replace(/[{}]/g, ' '),
  )
    .replace(BULLET_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Same as `stripHtml` but keeps `<br>` as a newline so label lines survive. */
function htmlToLines(value: string): string[] {
  if (!value) return [];
  const withBreaks = decodeEntities(value)
    .replace(/<(style|script|head|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Drop table content completely: it is parsed separately as benefits and
    // must never leak into prose lines (description / metadata).
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[a-z-]+\s*:\s*[^;{}]+;/gi, ' ')
    .replace(/[{}]/g, ' ');
  return withBreaks
    .split('\n')
    .map((line) => line.replace(BULLET_RE, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Parse HTML `<table>` markup into `[leftCell, rightCell]` pairs. Declarative
 * markup parsing — only ever applied to actual `<table>` markup.
 */
function parseHtmlTables(html: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  if (!html || !/<table\b/i.test(html)) return pairs;

  const cleaned = html.replace(/<(style|script|head|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(cleaned)) !== null) {
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(tableMatch[1])) !== null) {
      const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
        cells.push(stripHtml(cellMatch[1]));
      }
      if (cells.length < 2) continue;
      const left = cells[0];
      const right = cells[1];
      // Skip the header row ("Benefits" | "Coverage" / great_eastern: "Amount").
      if (/^benefits?$/i.test(left) && /^(coverage|amount|sum|limit|nilai|manfaat|value|jumlah|harga)/i.test(right)) continue;
      if (!left) continue;
      pairs.push([left, right]);
    }
  }
  return pairs;
}

function idr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/**
 * Pull a currency amount out of a cell. Handles `Rp 20.000.000`, `IDR 20,000`,
 * a bare `750,000,000`, and `2,250,000 (750.000 per 4 jam)` (keeps the first
 * number). Returns null for text-only values like `Actual cost` / `Ya/Yes`.
 */
function extractAmount(text: string): number | null {
  if (!text) return null;
  // Reject pure prose/yes-no cells outright.
  if (/^(ya|yes|no|tidak|actual cost|dijamin|covered)\b/i.test(text.trim())) return null;
  const explicit = text.match(/(?:Rp|IDR|USD)\s*([\d][\d.,]*)/i);
  const bare = explicit ?? text.match(/\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/);
  if (!bare) return null;
  let digits = bare[1];
  // Indonesian formatting: `.` = thousands, `,` = decimal.
  if (/\./.test(digits) && /,\d{1,2}$/.test(digits)) {
    digits = digits.replace(/\./g, '').replace(/,/, '.');
  } else {
    digits = digits.replace(/[.,]/g, '');
  }
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return '';
}

// ─── Code → human label ──────────────────────────────────────────────────────

const AREA_LABELS: Record<string, { id: string; en: string }> = {
  worldwide: { id: 'Seluruh dunia', en: 'Worldwide' },
  worldwide_excluding_usa_ca: { id: 'Seluruh dunia (kecuali USA & Kanada)', en: 'Worldwide (excluding USA & Canada)' },
  worldwide_excluding_us_ca: { id: 'Seluruh dunia (kecuali USA & Kanada)', en: 'Worldwide (excluding USA & Canada)' },
  asia: { id: 'Asia', en: 'Asia' },
  asia_only: { id: 'Asia', en: 'Asia' },
  asean: { id: 'ASEAN', en: 'ASEAN' },
  domestic: { id: 'Domestik', en: 'Domestic' },
  domestik: { id: 'Domestik', en: 'Domestic' },
  worldwide_including_usa_ca: { id: 'Seluruh dunia (termasuk USA & Kanada)', en: 'Worldwide (including USA & Canada)' },
  europe: { id: 'Eropa', en: 'Europe' },
  schengen: { id: 'Schengen', en: 'Schengen' },
};

/** Convert unknown snake_case/kebab codes to Title Case words — never show raw. */
export function humanizeCode(value: string): string {
  if (!value) return '';
  if (/\s/.test(value)) return value; // already prose
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

/** Map an area code (or passthrough prose) to a human label in the given lang. */
export function humanizeArea(value: string, lang: Lang): string {
  const key = value.trim().toLowerCase();
  const known = AREA_LABELS[key];
  if (known) return lang === 'ID' ? known.id : known.en;
  return humanizeCode(value);
}

// ─── Benefit classification ──────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<'delay' | 'accident' | 'baggage', RegExp> = {
  delay: /keterlambatan|delay|pembatalan|cancel|curtail|tunda|perubahan jadwal|penundaan|missed (flight|connection)|itinerary|interuption|interruption/i,
  accident: /kecelakaan|accident|medis|medical|pengobatan|perawatan|hospital|rumah sakit|evakuasi|repatriasi|sakit|illness|meninggal|death|disability|cacat|kesehatan|health/i,
  baggage: /bagasi|baggage|luggage|koper|kehilangan barang|kehilangan bagasi|personal belonging|dokumen perjalanan|travel document/i,
};

const HIGHLIGHT_META: Record<BenefitHighlight['key'], { id: string; en: string; icon: string }> = {
  delay: { id: 'Keterlambatan & Pembatalan', en: 'Delay & Cancellation', icon: 'fa-clock' },
  accident: { id: 'Kecelakaan & Biaya Pengobatan', en: 'Accident & Medical', icon: 'fa-kit-medical' },
  baggage: { id: 'Perlindungan Bagasi', en: 'Baggage Protection', icon: 'fa-suitcase' },
  other: { id: 'Manfaat Lainnya', en: 'Other Benefits', icon: 'fa-shield-halved' },
};

const HIGHLIGHT_ORDER: Array<'delay' | 'accident' | 'baggage'> = ['delay', 'accident', 'baggage'];

type CategoryKey = 'delay' | 'accident' | 'baggage';

function matchCategories(name: string): CategoryKey[] {
  const haystack = name.toLowerCase();
  const hits: CategoryKey[] = [];
  (Object.keys(CATEGORY_PATTERNS) as CategoryKey[]).forEach((key) => {
    if (CATEGORY_PATTERNS[key].test(haystack)) hits.push(key);
  });
  return hits;
}

// ─── Base benefits from `info` ───────────────────────────────────────────────

interface RawBenefit {
  name: string;
  nameIdn: string;
  /** Numeric coverage when it parses; null when text-only ("Actual cost"). */
  value: number | null;
  /** Clean text value used when `value` is null. */
  textValue: string;
  note: string;
}

/**
 * Prefer the Indonesian side of a bilingual label `"ID / EN"` for language ID,
 * the English side for EN; single-language labels pass through unchanged.
 *
 * Only a *spaced* slash (` / `) is treated as the bilingual separator, and only
 * when it occurs once — labels like `…/set, 7.500.000 untuk laptop` contain
 * unspaced slashes that must not be split.
 */
function pickBilingual(label: string, lang: Lang): string {
  const parts = label.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) return lang === 'ID' ? parts[0] : parts[1];
  return label;
}

/** Build a `RawBenefit` from a label + coverage cell. */
function toRawBenefit(label: string, coverage: string, lang: Lang): RawBenefit | null {
  const clean = pickBilingual(stripHtml(label), lang);
  if (!clean) return null;
  const value = extractAmount(coverage);
  return {
    name: clean,
    nameIdn: clean,
    value,
    textValue: value === null ? stripHtml(coverage) : '',
    note: '',
  };
}

/** Base benefits from the `info` label lines (`Description:` etc.). */
function parseInfoLabelLines(lines: string[], lang: Lang): RawBenefit[] {
  const rows: RawBenefit[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z /&().-]{2,40}):\s*(.*)$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (!value) continue;
    // Metadata lines are handled elsewhere, not as benefits.
    if (/^(description|travel type|minimum age|maximum age|age limits?|tipe perjalanan|usia minimum|usia maksimum)$/i.test(label)) {
      continue;
    }
    const row = toRawBenefit(label, value, lang);
    if (row) rows.push(row);
  }
  return rows;
}

/** Optional add-on packs from `additional_benefit`. */
function parseAddons(raw: unknown, lang: Lang): AddonRow[] {
  const addons: AddonRow[] = [];
  for (const entry of asArray(raw)) {
    if (!isRecord(entry)) continue;
    const names = Array.isArray(entry.text) ? entry.text : [entry.text];
    const label = pickBilingual(stripHtml(firstString(...names)), lang);
    if (!label) continue;
    const price = Number(entry.price) || 0;

    const items: Array<{ label: string; value: string }> = [];
    for (const child of asArray(entry.child)) {
      if (!isRecord(child)) continue;
      const childNames = Array.isArray(child.text) ? child.text : [child.text];
      const childLabel = pickBilingual(stripHtml(firstString(...childNames)), lang);
      if (!childLabel) continue;
      const details = asArray(child.detail);
      const rawDetail = stripHtml(firstString(...details));
      const amount = rawDetail ? extractAmount(rawDetail) : null;
      items.push({
        label: childLabel,
        value: amount !== null ? idr(amount) : (rawDetail || '—'),
      });
    }
    addons.push({ label, price, items });
  }
  return addons;
}

// ─── Description builder ─────────────────────────────────────────────────────

/** Pick a clean 1–2 sentence description; never a table/content dump. */
function buildDescription(
  product: Record<string, unknown>,
  infoLines: string[],
  lang: Lang,
): string {
  // 1) Explicit short description field.
  const explicit = stripHtml(firstString(
    product.description,
    product.short_description,
    product.product_description,
    product.desc,
  ));
  if (explicit && explicit.length >= 12) return truncate(explicit, 170);

  // 2) The `Description:` label line inside `info` (assistcard sends this).
  for (const line of infoLines) {
    const match = line.match(/^Description:\s*(.+)$/i);
    if (match && match[1].trim().length >= 12) return truncate(match[1].trim(), 170);
  }

  // 3) Any leading prose line that isn't a `Label:` metadata line.
  for (const line of infoLines) {
    if (/^[A-Za-z][A-Za-z /&().-]{2,40}:/.test(line)) continue;
    if (line.length >= 25 && /[a-zA-Z]/.test(line)) return truncate(line, 170);
  }

  // 4) Synthesize from structured fields — never a table dump.
  const tripName = stripHtml(firstString(product.type_trip_name, product.trip_type_name));
  const isAnnual = /annual|anual|yearly|tahunan/i.test(tripName);
  const isIntl = (() => {
    const sector = firstString(product.sector_type);
    if (sector) return !/domestic|domestik/i.test(sector);
    const area = firstString(product.destination_area, product.area);
    if (area) return !/domestic|domestik/i.test(area);
    const flag = product.international;
    return flag === true || flag === 'true' || flag === 1 || flag === '1';
  })();
  const destination = stripHtml(firstString(
    product.destination,
    product.carrier_destination,
    product.data_name,
  ));
  const destinationLabel = destination ? humanizeArea(destination, lang) : '';

  if (lang === 'ID') {
    const trip = isAnnual ? 'tahunan' : 'sekali jalan';
    const scope = isIntl ? 'internasional' : 'domestik';
    const target = destinationLabel ? ` untuk ${destinationLabel}` : '';
    return truncate(`Perlindungan perjalanan ${trip} ${scope}${target}.`, 170);
  }
  const trip = isAnnual ? 'annual' : 'single-trip';
  const scope = isIntl ? 'international' : 'domestic';
  const target = destinationLabel ? ` for ${destinationLabel}` : '';
  return truncate(`${trip[0].toUpperCase()}${trip.slice(1)} ${scope} travel protection${target}.`, 170);
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s{2,}/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// ─── Age / requirement box ───────────────────────────────────────────────────

/** Read a `Minimum age: 0` style value out of the `info` lines. */
function lineValue(lines: string[], re: RegExp): string {
  for (const line of lines) {
    const match = line.match(re);
    if (match && match[1].trim()) return match[1].trim();
  }
  return '';
}

function extractAgeRange(
  product: Record<string, unknown>,
  infoLines: string[],
): { ageRange: AgeRange; travelType?: string } {
  const ageRange: AgeRange = {};

  const min = firstString(
    product.minAdultOld,
    lineValue(infoLines, /^Minimum age:\s*(.+)$/i),
    product.min_age,
    product.minAge,
  );
  const max = firstString(
    product.maxAdultOld,
    lineValue(infoLines, /^Maximum age:\s*(.+)$/i),
    product.max_age,
    product.maxAge,
  );
  if (min) ageRange.minAge = min;
  if (max) ageRange.maxAge = max;

  // `Age limits:` may be empty with the real content on the following
  // continuation lines (assistcard: "- Age 70, price increase by 50.0%").
  let requirement = lineValue(infoLines, /^Age limits?:\s*(.+)$/i);
  if (!requirement) {
    const idx = infoLines.findIndex((line) => /^Age limits?:\s*$/i.test(line));
    if (idx >= 0) {
      const extras: string[] = [];
      for (let i = idx + 1; i < infoLines.length; i++) {
        const line = infoLines[i];
        // Stop at the next `Label:` metadata line.
        if (/^[A-Za-z][A-Za-z /&().-]{2,40}:/.test(line)) break;
        extras.push(line.replace(/^[-•\s]+/, ''));
        if (extras.length >= 4) break;
      }
      requirement = extras.join('; ');
    }
  }
  if (requirement && requirement.length <= 200) ageRange.requirement = requirement;

  const travelType = lineValue(infoLines, /^Travel type:\s*(.+)$/i);
  return { ageRange, travelType: travelType || undefined };
}

// ─── Exclusions ──────────────────────────────────────────────────────────────

function extractExclusions(product: Record<string, unknown>, infoLines: string[]): string[] {
  const out: string[] = [];

  for (const entry of asArray(product.exclusions ?? product.exclusion)) {
    const text = stripHtml(asString(entry));
    if (text) out.push(text);
  }

  if (out.length === 0) {
    let collecting = false;
    for (const line of infoLines) {
      if (/tidak termasuk|not covered|pengecualian|exclusion/i.test(line)) { collecting = true; continue; }
      if (collecting && line.length >= 4) {
        out.push(line);
        if (out.length >= 6) break;
      }
    }
  }

  return out;
}

// ─── Structured plan details (fallback when there are no benefits) ──────────
//
// zurich ships `info: ""` (+ empty `additional_benefit`) and assistcard ships
// only metadata label-lines, so `benefits` ends up empty. Instead of an empty
// panel we surface the structured fields the provider DID send. Every row is
// provider data — a missing field simply omits its row, nothing is invented.

function buildPlanDetails(
  product: Record<string, unknown>,
  infoLines: string[],
  lang: Lang,
): PlanDetail[] {
  const rows: PlanDetail[] = [];

  const pkg = humanizeCode(firstString(product.type_trip_name, product.product_type_code));
  if (pkg) rows.push({ key: 'package', value: pkg });

  // Only the literal provider line ("Travel type: Daily", assistcard). Trip
  // direction (single/annual) is already known from the search form.
  const travelType = lineValue(infoLines, /^Travel type:\s*(.+)$/i);
  if (travelType) rows.push({ key: 'tripType', value: travelType });

  const sector = localizeSector(product.sector_type, lang);
  const areaRaw = firstString(product.data_name);
  const area = areaRaw ? humanizeArea(areaRaw, lang) : '';
  const coverage = [sector, area].filter(Boolean).join(' \u00b7 ');
  if (coverage) rows.push({ key: 'coverageArea', value: coverage });

  const minAge = firstString(product.minAdultOld, lineValue(infoLines, /^Minimum age:\s*(.+)$/i));
  const maxAge = firstString(product.maxAdultOld, lineValue(infoLines, /^Maximum age:\s*(.+)$/i));
  const age = [minAge, maxAge].filter(Boolean).join('\u2013');
  if (age) rows.push({ key: 'ageRange', value: age });

  const minPax = Number(product.minPax);
  const maxPax = Number(product.maxPax);
  const minTxt = Number.isFinite(minPax) && minPax > 0 ? String(minPax) : '';
  const maxTxt = Number.isFinite(maxPax) && maxPax > 0 ? String(maxPax) : '';
  const pax = minTxt === maxTxt ? minTxt || maxTxt : [minTxt, maxTxt].filter(Boolean).join('\u2013');
  if (pax) rows.push({ key: 'participants', value: pax });

  return rows;
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Defensive normalizer. Never throws; returns an empty shape when the product
 * carries no parseable benefit data, so callers can fall back to their own
 * summary rendering.
 */
export function normalizeInsuranceProduct(raw: unknown, lang: Lang): NormalizedInsuranceProduct {
  try {
    if (!isRecord(raw)) return { ...EMPTY };

    const rawInfo = firstString(raw.info, raw.product_info, raw.benefit_info);
    const infoLines = htmlToLines(rawInfo);

    // Base benefits: HTML table (zurich/oona/bca) → label lines (assistcard).
    const tablePairs = parseHtmlTables(rawInfo);
    let rawBenefits: RawBenefit[] = [];
    for (const [label, coverage] of tablePairs) {
      // Bold, empty-coverage rows are group headers, not benefits.
      if (!coverage) continue;
      const row = toRawBenefit(label, coverage, lang);
      if (row) rawBenefits.push(row);
    }
    if (rawBenefits.length === 0) rawBenefits = parseInfoLabelLines(infoLines, lang);

    const benefits: BenefitRow[] = [];
    const numericMax: Partial<Record<CategoryKey, number>> = {};
    const textFallback: Partial<Record<CategoryKey, string>> = {};

    for (const item of rawBenefits) {
      const label = pickBilingual(firstString(item.nameIdn, item.name), lang);
      if (!label) continue;

      const displayValue = item.value !== null
        ? idr(item.value)
        : (item.textValue || '—');

      benefits.push({ label, value: displayValue });

      for (const key of matchCategories(label)) {
        if (item.value !== null) {
          if (item.value > (numericMax[key] ?? 0)) numericMax[key] = item.value;
        } else if (item.textValue && !textFallback[key]) {
          textFallback[key] = item.textValue;
        }
      }
    }

    const highlights: BenefitHighlight[] = HIGHLIGHT_ORDER.map((key) => {
      const meta = HIGHLIGHT_META[key];
      let limitText: string | null = null;
      if (numericMax[key] !== undefined) limitText = idr(numericMax[key] as number);
      else if (textFallback[key]) limitText = textFallback[key] as string;
      return { key, label: lang === 'ID' ? meta.id : meta.en, limitText, icon: meta.icon };
    });

    const { ageRange, travelType } = extractAgeRange(raw, infoLines);

    return {
      highlights,
      benefits,
      planDetails: buildPlanDetails(raw, infoLines, lang),
      addons: parseAddons(raw.additional_benefit, lang),
      exclusions: extractExclusions(raw, infoLines),
      ageRange,
      description: buildDescription(raw, infoLines, lang),
      travelType,
    };
  } catch (error) {
    console.warn('[INSURANCE BENEFITS] Normalizer gagal memproses produk, memakai fallback:', error);
    return { ...EMPTY };
  }
}
