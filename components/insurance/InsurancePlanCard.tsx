'use client';

import { memo, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { buildInsuranceSummary, type InsuranceSummaryProduct } from '@/lib/insurance-summary';
import { normalizeInsuranceProduct, type BenefitHighlight } from '@/lib/insurance-benefits';

function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

const PROVIDER_LABELS: Record<string, string> = {
  assistcard: 'Assist Card',
  bcainsurance: 'BCA Insurance',
  zurich: 'Zurich',
  great_eastern: 'Great Eastern',
  oona: 'Oona',
};

// Logo provider — file ada di public/images/insurance/<kode provider>.png
const PROVIDER_LOGOS: Record<string, string> = {
  assistcard: '/images/insurance/assistcard.png',
  bcainsurance: '/images/insurance/bcainsurance.png',
  zurich: '/images/insurance/zurich.png',
  great_eastern: '/images/insurance/great_eastern.png',
  oona: '/images/insurance/oona.png',
};

/** One of the three headline benefit columns (icon → bold label → orange value). */
function HighlightColumn({ highlight, prefix, emptyLabel }: { highlight: BenefitHighlight; prefix: string; emptyLabel: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
      <i className={`fa-solid ${highlight.icon} text-slate-300 text-base`} aria-hidden="true"></i>
      <p className="text-xs font-bold text-slate-800 leading-snug">{highlight.label}</p>
      <p className="text-[11px] font-semibold text-orange-600 leading-snug">
        {highlight.limitText
          ? `${prefix} ${highlight.limitText}`
          : <span className="text-slate-400 font-medium">{emptyLabel}</span>}
      </p>
    </div>
  );
}

export interface InsurancePlanCardProps {
  product: Record<string, unknown> & {
    product_code?: string;
    provider?: string;
    carrier_code?: string;
    carrier_name?: string;
    product_name?: string;
    total_price?: number;
  };
  onSelect: (product: unknown) => void;
  isSelecting?: boolean;
  isCheapest?: boolean;
  /** Passed through to the detail page so it can re-fetch availability. */
  searchParams?: Record<string, string | number | boolean | undefined>;
}

function InsurancePlanCard({
  product,
  onSelect,
  isSelecting = false,
  isCheapest = false,
  searchParams = {},
}: InsurancePlanCardProps) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const router = useRouter();
  const [showDetail, setShowDetail] = useState(false);

  const provider = String(product.provider || product.carrier_code || '');
  const providerLabel = product.carrier_name
    ? String(product.carrier_name)
    : (PROVIDER_LABELS[provider] || provider.toUpperCase());
  const logo = PROVIDER_LOGOS[provider];
  const price = Number(product.total_price) || 0;

  const normalized = useMemo(() => normalizeInsuranceProduct(product, language), [product, language]);
  // Fallback description when the provider carries nothing descriptive.
  const fallbackSummary = useMemo(
    () => buildInsuranceSummary(product as unknown as InsuranceSummaryProduct, language),
    [product, language],
  );
  const description = normalized.description
    || fallbackSummary.map((s) => s.text).join('. ');

  // Fallback baris rincian plan dari field terstruktur — hanya dipakai saat
  // penerbit tidak mengirim tabel manfaat sama sekali (zurich, assistcard).
  const planDetailRows = useMemo(() => {
    const labels: Record<string, string> = {
      package: t.planDetailPackage,
      tripType: t.travelTypeLabel,
      coverageArea: t.planDetailArea,
      ageRange: t.planDetailAgeRange,
      participants: t.paxLabel,
    };
    return normalized.planDetails
      // Usia & tipe perjalanan sudah tampil di kotak kanan — jangan dobel.
      .filter((row) => row.key !== 'ageRange' && row.key !== 'tripType')
      .map((row) => ({ label: labels[row.key] ?? row.key, value: row.value }));
  }, [normalized, t]);

  const openDetail = () => {
    const q = new URLSearchParams({
      product_code: String(product.product_code || ''),
      provider,
      carrier_code: String(product.carrier_code || provider),
      ...Object.fromEntries(
        Object.entries(searchParams)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ),
    });
    router.push(`/insurance/detail?${q.toString()}`);
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isCheapest ? 'border-orange-300' : 'border-slate-200'}`}>
      {/* Provider + plan identity */}
      <div className="px-5 pt-5 flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-white border border-slate-200 overflow-hidden">
          {logo
            ? <img src={logo} alt={providerLabel} className="w-10 h-10 object-contain" />
            : <i className="fa-solid fa-shield-halved text-xl text-slate-400"></i>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm leading-snug">
              {String(product.product_name || '')}
            </h3>
            {isCheapest && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                <i className="fa-solid fa-tags text-[9px]"></i> {t.cheapest}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{providerLabel}</p>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col md:flex-row gap-5">
        {/* Description + 3 benefit highlight columns */}
        <div className="flex-1 min-w-0">
          {description && (
            <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
              {description}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {normalized.highlights.map((h) => (
              <HighlightColumn
                key={h.key}
                highlight={h}
                prefix={t.coverageUpToShort}
                emptyLabel={t.notIncluded}
              />
            ))}
          </div>
        </div>

        {/* Price + CTAs */}
        <div className="md:w-48 shrink-0 flex flex-col items-start md:items-end justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5 pt-3 md:pt-0">
          <div className="md:text-right">
            <p className="text-xl font-black text-orange-600 leading-tight">{fmtIDR(price)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.perPax}</p>
          </div>
          <button
            onClick={() => onSelect(product)}
            disabled={isSelecting}
            className="w-full px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition-colors text-sm shadow-sm"
          >
            {isSelecting === true ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {t.processing}
              </span>
            ) : t.selectPlan}
          </button>
          <button
            onClick={openDetail}
            className="w-full px-5 py-2.5 border border-sky-500 text-sky-600 hover:bg-sky-50 font-bold rounded-lg transition-colors text-sm"
          >
            {t.detailInsurance}
          </button>
        </div>
      </div>

      {/* Expand trigger */}
      <button
        onClick={() => setShowDetail((v) => !v)}
        aria-expanded={showDetail}
        className="w-full flex items-center justify-center gap-2 py-3 border-t border-slate-100 text-sky-600 hover:bg-slate-50 font-bold text-xs transition-colors"
      >
        {showDetail ? t.hideDetailPlan : t.viewDetailPlan}
        <i className={`fa-solid fa-chevron-${showDetail ? 'up' : 'down'} text-[9px]`}></i>
      </button>

      {/* Expanded plan detail panel — 2 columns: benefit table | age & terms */}
      {showDetail && (
        <div className="border-t border-slate-100">
          <div className="bg-sky-50 px-5 py-2.5">
            <p className="text-xs font-bold text-sky-800">{t.detailPlanTitle}</p>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Benefit table */}
            <div className="lg:col-span-3">
              {normalized.benefits.length > 0 ? (
                <dl className="divide-y divide-slate-100">
                  {normalized.benefits.map((row, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 py-2">
                      <dt className="text-xs text-slate-600 leading-relaxed">{row.label}</dt>
                      <dd className="text-xs font-bold text-slate-900 text-right shrink-0 max-w-[45%]">
                        {row.value}
                        {row.note && <span className="block font-medium text-[10px] text-slate-400">{row.note}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : planDetailRows.length > 0 ? (
                <dl className="divide-y divide-slate-100">
                  {planDetailRows.map((row, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 py-2">
                      <dt className="text-xs text-slate-600 leading-relaxed">{row.label}</dt>
                      <dd className="text-xs font-bold text-slate-900 text-right shrink-0 max-w-[45%]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-slate-400">{t.noBenefitData}</p>
              )}

              {/* Add-on packs (extra premium) — shown separately, never base cover */}
              {normalized.addons.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-bold text-slate-800 mb-2">{t.addonsTitle}</p>
                  <div className="space-y-2">
                    {normalized.addons.map((addon, i) => (
                      <details key={i} className="rounded-lg border border-slate-200 overflow-hidden">
                        <summary className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          <span className="min-w-0 truncate">{addon.label}</span>
                          <span className="shrink-0 text-[11px] font-bold text-orange-600">
                            {addon.price > 0 ? `+ ${fmtIDR(addon.price)}` : t.addonIncluded}
                          </span>
                        </summary>
                        <ul className="px-3 py-2 border-t border-slate-100 space-y-1.5">
                          {addon.items.map((item, j) => (
                            <li key={j} className="flex items-start justify-between gap-3 text-[11px]">
                              <span className="text-slate-600 leading-relaxed">{item.label}</span>
                              <span className="font-bold text-slate-900 text-right shrink-0 max-w-[40%]">{item.value}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Age + requirements box */}
            <div className="lg:col-span-2">
              <div className="bg-sky-50 rounded-lg p-4">
                <p className="text-xs font-bold text-sky-800 mb-3">{t.ageTermsTitle}</p>
                <dl className="space-y-2.5">
                  {normalized.travelType && (
                    <div>
                      <dt className="text-[11px] text-slate-500">{t.travelTypeLabel}</dt>
                      <dd className="text-xs font-bold text-slate-800">{normalized.travelType}</dd>
                    </div>
                  )}
                  {normalized.ageRange.minAge && (
                    <div>
                      <dt className="text-[11px] text-slate-500">{t.minAgeLabel}</dt>
                      <dd className="text-xs font-bold text-slate-800">
                        {normalized.ageRange.minAge} {t.yearsShort}
                      </dd>
                    </div>
                  )}
                  {normalized.ageRange.maxAge && (
                    <div>
                      <dt className="text-[11px] text-slate-500">{t.maxAgeLabel}</dt>
                      <dd className="text-xs font-bold text-slate-800">
                        {normalized.ageRange.maxAge} {t.yearsShort}
                      </dd>
                    </div>
                  )}
                  {normalized.ageRange.requirement && (
                    <div>
                      <dt className="text-[11px] text-slate-500">{t.requirementLabel}</dt>
                      <dd className="text-xs font-semibold text-slate-800 leading-relaxed">
                        {normalized.ageRange.requirement}
                      </dd>
                    </div>
                  )}
                  {!normalized.ageRange.minAge && !normalized.ageRange.maxAge && !normalized.ageRange.requirement && (
                    <p className="text-[11px] text-slate-400">{t.noAgeData}</p>
                  )}
                </dl>
              </div>

              {typeof product.pdf === 'string' && product.pdf && (
                <a
                  href={product.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 transition-colors"
                >
                  <i className="fa-solid fa-file-pdf text-[10px]"></i> {t.termsPdf}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(InsurancePlanCard);
