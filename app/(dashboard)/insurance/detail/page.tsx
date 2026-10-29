'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n, tpl } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { sanitizeInsuranceHtml } from '@/lib/insurance-html';
import { normalizeInsuranceProduct, humanizeCode, type BenefitRow } from '@/lib/insurance-benefits';

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

const PROVIDER_LOGOS: Record<string, string> = {
  assistcard: '/images/insurance/assistcard.png',
  bcainsurance: '/images/insurance/bcainsurance.png',
  zurich: '/images/insurance/zurich.png',
  great_eastern: '/images/insurance/great_eastern.png',
  oona: '/images/insurance/oona.png',
};

// Kontak layanan tidak tersedia di API Orbisway (lihat BAGIAN C/Catatan) —
// dipakai konten statis per carrier sebagai fallback yang aman.
const PROVIDER_CONTACTS: Record<string, { phone: string; email: string }> = {
  assistcard: { phone: '1500 123', email: 'support@assistcard.com' },
  bcainsurance: { phone: '1500888', email: 'care@bcainsurance.co.id' },
  zurich: { phone: '1500 006', email: 'care@zurich.co.id' },
  great_eastern: { phone: '1500 787', email: 'care@greateastern.co.id' },
  oona: { phone: '1500 245', email: 'care@oona.com' },
};

interface PlanProduct {
  product_code?: string;
  product_name?: string;
  provider?: string;
  carrier_code?: string;
  carrier_name?: string;
  total_price?: number;
  type_trip_name?: string;
  pdf?: string;
  info?: string;
  [key: string]: unknown;
}

type TabKey = 'coverage' | 'terms' | 'claim';

function InsuranceDetailContent() {
  const { language } = useLanguage();
  const t = i18n.insuranceDetail[language];
  const ts = i18n.insuranceSearch[language];
  const sp = useSearchParams();
  const router = useRouter();
  const isEN = language === 'EN';

  const productCode = sp.get('product_code') || '';
  const provider = sp.get('provider') || '';
  const carrierCode = sp.get('carrier_code') || provider;

  const additionalParams = useMemo(() => ({
    date_start: sp.get('date_start') || '',
    date_end: sp.get('date_end') || '',
    pax: sp.get('pax') || '1',
    destination: sp.get('destination') || '',
    destination_area: sp.get('destination_area') || '',
    type: sp.get('type') || 'single_trip',
    is_senior: sp.get('is_senior') || 'false',
    international: sp.get('international') || '',
    nights: sp.get('nights') || '1',
  }), [sp]);

  const providerLabel = PROVIDER_LABELS[provider] || (provider ? provider.toUpperCase() : '');
  const logo = PROVIDER_LOGOS[provider];

  // Cache agar navigasi dari listing terasa instan. Halaman tetap mem-verifikasi
  // ulang lewat get_availability (tidak ada endpoint product detail di Orbisway).
  const cacheKey = `insurance_plan_${provider}_${productCode}`;

  // Baca cache sekali saat mount (bukan di dalam efek) supaya render pertama
  // bisa langsung menampilkan data yang sudah ada tanpa cascading render.
  const [product, setProduct] = useState<PlanProduct | null>(() => {
    if (typeof window === 'undefined' || !productCode) return null;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as PlanProduct) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(() => Boolean(productCode) && !product);
  const [notFound, setNotFound] = useState(() => !productCode);
  const [tab, setTab] = useState<TabKey>('coverage');
  const [selecting, setSelecting] = useState(false);

  usePageTitle(product?.product_name ? String(product.product_name) : (isEN ? 'Insurance Plan Details' : 'Detail Plan Asuransi'));

  const fetchProduct = useCallback(async () => {
    setNotFound(false);
    setLoading(true);
    try {
      const res = await fetch('/api/insurance/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_start: additionalParams.date_start,
          date_end: additionalParams.date_end,
          pax: Number(additionalParams.pax) || 1,
          destination: additionalParams.destination,
          destination_area: additionalParams.destination_area,
          type: additionalParams.type,
          product_type: 'individual',
          international: additionalParams.international === 'true' || additionalParams.international === '',
          is_senior: additionalParams.is_senior === 'true',
          providers: provider ? [provider] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'failed');

      const all: PlanProduct[] = Array.isArray(data.data?.all) ? data.data.all : [];
      const match = all.find((p) =>
        String(p.product_code) === productCode
        && (!provider || String(p.provider || p.carrier_code) === provider),
      );

      if (!match) {
        setNotFound(true);
        setProduct(null);
        return;
      }
      setProduct(match);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(match));
      } catch { /* storage penuh/diblokir — abaikan */ }
    } catch {
      // Jaringan/gagal — coba pakai cache bila ada.
      let cached: PlanProduct | null = null;
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) cached = JSON.parse(raw) as PlanProduct;
      } catch { /* abaikan */ }
      if (cached) setProduct(cached);
      else setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [additionalParams, productCode, provider, cacheKey]);

  useEffect(() => {
    if (!productCode) return;
    // Verifikasi ulang di latar belakang; cache sudah dipakai untuk render awal.
    // Dibungkus microtask agar setState terjadi di luar body efek sinkron.
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchProduct(); });
    return () => { cancelled = true; };
  }, [productCode, fetchProduct]);

  const normalized = useMemo(
    () => (product ? normalizeInsuranceProduct(product, language) : null),
    [product, language],
  );

  const contact = PROVIDER_CONTACTS[provider] || { phone: '1500 000', email: 'care@example.com' };
  const nights = Math.max(1, Number(additionalParams.nights) || 1);
  const pax = Math.max(1, Number(additionalParams.pax) || 1);

  const fmtDate = (d: string) => d
    ? new Date(d).toLocaleDateString(isEN ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const handleSelectPlan = useCallback(async () => {
    if (!product) return;
    setSelecting(true);
    try {
      // Ambil harga terbaru lewat /price dulu, seperti alur listing.
      const q = new URLSearchParams({
        product_code: String(product.product_code || ''),
        package: String(product.package ?? 1),
        product_name: String(product.product_name || ''),
        provider,
        carrier_code: String(product.carrier_code || carrierCode),
        carrier_name: String(product.carrier_name || providerLabel),
        date_start: additionalParams.date_start,
        date_end: additionalParams.date_end,
        pax: String(pax),
        is_senior: additionalParams.is_senior,
        destination: additionalParams.destination,
        destination_area: additionalParams.destination_area,
        international: additionalParams.international,
        adult: String(pax),
        child: '0',
        total_amount: String(Math.round(Number(product.total_price) || 0)),
        sector_type: String(product.sector_type || ''),
        product_type: String(product.product_type_code || 'individual'),
        trip_type: String(product.master_trip_id || additionalParams.type || 'single_trip'),
        nights: String(nights),
      });
      router.push(`/insurance/checkout?${q.toString()}`);
    } catch {
      setSelecting(false);
    }
  }, [product, provider, carrierCode, providerLabel, additionalParams, pax, nights, router]);

  // ─── Render states ────────────────────────────────────────────────────────

  if (loading && !product) {
    return (
      <div className="min-h-screen bg-[#F2F3F3] pt-20">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-64 bg-slate-200 rounded"></div>
            <div className="h-32 w-full bg-white rounded-lg border border-slate-200"></div>
            <div className="h-64 w-full bg-white rounded-lg border border-slate-200"></div>
          </div>
          <p className="mt-4 text-sm text-slate-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#F2F3F3] pt-20">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-16 text-center">
          <div className="w-20 h-20 bg-white rounded-full border border-slate-200 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-shield-halved text-3xl text-slate-300"></i>
          </div>
          <h1 className="text-xl font-black text-brand-ink mb-2">{t.notFoundTitle}</h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-5">{t.notFoundDesc}</p>
          <Link
            href="/insurance/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg text-sm hover:bg-orange-700 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i> {t.backToSearch}
          </Link>
        </div>
      </div>
    );
  }

  const providerDisplay = product.carrier_name ? String(product.carrier_name) : providerLabel;
  // Trip direction dari kode trip provider ("single_trip", "DAILY",
  // "annual_90") — jangan tampilkan nama paket ("Individual") sebagai
  // jenis perjalanan.
  const typeCode = String(product.type || product.master_trip_id || '');
  const rawTripName = String(product.type_trip_name || '');
  const tripName = /annual|anual|yearly|annually/i.test(typeCode)
    ? ts.tripAnnual
    : /single|daily|short|oneway|one_way/i.test(typeCode)
      ? ts.tripSingle
      : rawTripName
        ? (/annual|anual|yearly|tahunan|single|sekali|one\s*way/i.test(rawTripName)
            ? rawTripName
            : humanizeCode(rawTripName))
        : ts.tripSingle;
  const coverageLimit = normalized?.highlights?.find((h) => h.limitText)?.limitText
    || normalized?.benefits?.[0]?.value
    || '—';

  // Label baris rincian plan (fallback terstruktur saat manfaat kosong).
  const planDetailLabel = (key: string) => (
    key === 'package' ? ts.planDetailPackage
    : key === 'coverageArea' ? ts.planDetailArea
    : key === 'ageRange' ? ts.planDetailAgeRange
    : key === 'tripType' ? ts.travelTypeLabel
    : ts.paxLabel
  );

  const renderBenefitRow = (row: BenefitRow, i: number) => (
    <div key={i} className="py-2.5 flex items-start justify-between gap-4 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700 leading-relaxed">{row.label}</p>
        {row.note && <p className="text-[11px] text-slate-400 mt-0.5">{row.note}</p>}
      </div>
      <p className="text-xs font-bold text-slate-900 text-right shrink-0">{row.value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F3F3] pt-20">
      {/* Banner carrier */}
      <section className="bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 text-white">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 flex items-center gap-4">
          {logo && (
            <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center shrink-0">
              <img src={logo} alt={providerDisplay} className="w-11 h-11 object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold">{providerDisplay}</h1>
            <p className="text-xs text-white/85 mt-1">{t.breadcrumbProduct}</p>
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-5">
        {/* Breadcrumb */}
        <nav className="text-xs text-slate-500 mb-4 flex items-center gap-1.5 flex-wrap">
          <Link href="/insurance" className="hover:text-sky-600">{t.breadcrumbHome}</Link>
          <i className="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
          <span>{t.breadcrumbProduct}</span>
          <i className="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
          <span className="font-semibold text-slate-700">{String(product.product_name || '')}</span>
        </nav>

        {/* Kartu ringkasan produk */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-slate-900 leading-snug">{String(product.product_name || '')}</h2>
            {normalized?.description && (
              <p className="text-xs text-slate-500 leading-relaxed mt-1.5 line-clamp-2">{normalized.description}</p>
            )}
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <p>{tripName} / {tpl(t.insuredCount, { count: pax })}</p>
              {coverageLimit !== '—' && <p>{tpl(t.coverageUpTo, { amount: coverageLimit })}</p>}
              <p>{tpl(t.protectionPeriod, { days: nights })} · {fmtDate(additionalParams.date_start)} - {fmtDate(additionalParams.date_end)}</p>
            </div>
          </div>
          <div className="md:text-right shrink-0 md:border-l md:pl-5 border-slate-100">
            <p className="text-[11px] text-slate-400">{t.totalPrice}</p>
            <p className="text-2xl font-black text-orange-600 leading-tight">{fmtIDR(Number(product.total_price) || 0)}</p>
            <button
              onClick={handleSelectPlan}
              disabled={selecting}
              className="mt-2 w-full md:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition-colors text-sm"
            >
              {selecting ? t.selectPlanLoading : t.selectPlan}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 border-b border-slate-200 flex gap-1 overflow-x-auto">
          {([
            { id: 'coverage', label: t.tabs.coverage },
            { id: 'terms', label: t.tabs.terms },
            { id: 'claim', label: t.tabs.claim },
          ] as const).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                tab === item.id
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Konten kiri */}
          <div className="lg:col-span-2 space-y-4">
            {tab === 'coverage' && (
              <>
                {normalized && normalized.benefits.length > 0 ? (
                  normalized.highlights.map((hl) => {
                    const rows = normalized.benefits.filter((b) => {
                      const lower = b.label.toLowerCase();
                      if (hl.key === 'delay') return /delay|keterlambatan|pembatalan|cancel|tunda/.test(lower);
                      if (hl.key === 'accident') return /accident|kecelakaan|medis|medical|pengobatan|evakuasi|repatriasi/.test(lower);
                      if (hl.key === 'baggage') return /bagasi|baggage|luggage|koper/.test(lower);
                      return false;
                    });
                    return (
                      <section key={hl.key} className="bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
                          <span className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                            <i className={`fa-solid ${hl.icon} text-sky-600 text-sm`}></i>
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{hl.label}</h3>
                            {hl.limitText && (
                              <p className="text-[11px] text-slate-500">{tpl(t.coverageUpTo, { amount: hl.limitText })}</p>
                            )}
                          </div>
                        </div>
                        <div className="px-5 py-2">
                          {rows.length > 0
                            ? rows.map(renderBenefitRow)
                            : <p className="py-3 text-xs text-slate-400">{t.noBenefitData}</p>}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">{ts.planDetailTitle}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t.noBenefitData}</p>
                    </div>
                    <div className="px-5 py-2">
                      {normalized && normalized.planDetails.length > 0
                        ? normalized.planDetails.map((row, i) => renderBenefitRow({
                            label: planDetailLabel(row.key),
                            value: row.key === 'ageRange' ? `${row.value} ${ts.yearsShort}` : row.value,
                          }, i))
                        : <p className="py-3 text-xs text-slate-400">{t.noBenefitData}</p>}
                    </div>
                  </section>
                )}

                {/* Kotak "Tidak Termasuk" */}
                {normalized && normalized.exclusions.length > 0 && (
                  <section className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                    <p className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                      <i className="fa-solid fa-circle-exclamation"></i> {t.notIncluded}
                    </p>
                    <ul className="space-y-2">
                      {normalized.exclusions.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-800/90 leading-relaxed">
                          <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0"></i>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Manfaat tambahan — hanya dari data terstruktur; kalau kosong
                    dan rincian terstruktur pun tidak ada, baru jatuh ke HTML
                    mentah sebagai upaya terakhir. */}
                {normalized && normalized.benefits.length > 0 ? (
                  <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">{t.otherBenefits}</h3>
                    </div>
                    <div className="px-5 py-2">
                      {normalized.benefits.map(renderBenefitRow)}
                    </div>
                    {typeof product.pdf === 'string' && product.pdf && (
                      <div className="px-5 pb-4">
                        <a
                          href={product.pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:underline"
                        >
                          <i className="fa-solid fa-file-pdf"></i> {t.readFullPolicy}
                        </a>
                      </div>
                    )}
                  </section>
                ) : (
                  normalized && normalized.planDetails.length === 0
                    && typeof product.info === 'string' && product.info.trim() && (
                    <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
                      <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-900">{t.otherBenefits}</h3>
                      </div>
                      <div className="px-5 py-4">
                        <div
                          className="text-xs text-slate-600 leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:p-2 [&_th]:bg-slate-50 [&_li]:ml-4 [&_li]:list-disc"
                          dangerouslySetInnerHTML={{ __html: sanitizeInsuranceHtml(product.info) }}
                        />
                        {typeof product.pdf === 'string' && product.pdf && (
                          <a
                            href={product.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:underline"
                          >
                            <i className="fa-solid fa-file-pdf"></i> {t.readFullPolicy}
                          </a>
                        )}
                      </div>
                    </section>
                  )
                )}

                {/* Perindungan tambahan opsional (extra premi) — data terstruktur */}
                {normalized && normalized.addons.length > 0 && (
                  <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">{t.addonsTitle}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t.addonsSubtitle}</p>
                    </div>
                    <div className="px-5 py-2">
                      {normalized.addons.map((addon, i) => (
                        <details key={i} className="border-b border-slate-100 last:border-0">
                          <summary className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
                            <span className="text-xs font-semibold text-slate-700">{addon.label}</span>
                            <span className="text-[11px] font-bold text-orange-600 shrink-0">
                              {addon.price > 0 ? `+ ${fmtIDR(addon.price)}` : t.addonIncluded}
                            </span>
                          </summary>
                          <ul className="pb-3 space-y-1.5">
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
                  </section>
                )}

                {/* Fallback bila tidak ada benefit terstruktur, tidak ada
                    rincian plan, dan tidak ada info mentah */}
                {(!normalized || (normalized.benefits.length === 0 && normalized.planDetails.length === 0)) && !product.info && (
                  <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                    <p className="text-xs text-slate-400">{t.noBenefitData}</p>
                  </section>
                )}
              </>
            )}

            {tab === 'terms' && (
              <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">{t.termsIntro}</p>
                {normalized && normalized.ageRange.minAge && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">{ts.minAgeLabel}:</span> {normalized.ageRange.minAge} {ts.yearsShort}
                  </p>
                )}
                {normalized && normalized.ageRange.maxAge && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">{ts.maxAgeLabel}:</span> {normalized.ageRange.maxAge} {ts.yearsShort}
                  </p>
                )}
                {normalized && normalized.ageRange.requirement && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">{ts.requirementLabel}:</span> {normalized.ageRange.requirement}
                  </p>
                )}
                {typeof product.pdf === 'string' && product.pdf && (
                  <a
                    href={product.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:underline"
                  >
                    <i className="fa-solid fa-file-pdf"></i> {t.readFullPolicy}
                  </a>
                )}
              </section>
            )}

            {tab === 'claim' && (
              <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">{t.claimIntro}</p>
                <div>
                  <p className="text-xs font-bold text-slate-800 mb-2">{t.claimSteps}</p>
                  <ul className="space-y-2">
                    {[
                      isEN ? 'Policy document / order number' : 'Dokumen polis / nomor pesanan',
                      isEN ? 'Identity document (KTP/Passport)' : 'Dokumen identitas (KTP/Paspor)',
                      isEN ? 'Supporting evidence (tickets, receipts, reports)' : 'Bukti pendukung (tiket, kuitansi, laporan)',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                        <i className="fa-solid fa-check text-emerald-500 mt-0.5 text-[10px]"></i>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-xs text-slate-600">
                  <p><span className="font-bold">{t.contactPhone}:</span> {contact.phone}</p>
                  <p className="mt-1"><span className="font-bold">{t.contactEmail}:</span> {contact.email}</p>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar kanan — Kontak Informasi */}
          <aside className="lg:col-span-1 lg:sticky lg:top-24">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">{t.contactTitle}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-phone text-sky-600 text-xs"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">{t.contactPhone}</p>
                    <p className="text-xs font-bold text-slate-800">{contact.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-envelope text-sky-600 text-xs"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">{t.contactEmail}</p>
                    <p className="text-xs font-bold text-slate-800 break-all">{contact.email}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[11px] text-slate-400">{t.providerInfo}</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{providerDisplay}</p>
              </div>
            </div>

            <button
              onClick={handleSelectPlan}
              disabled={selecting}
              className="mt-3 w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition-colors text-sm"
            >
              {selecting ? t.selectPlanLoading : t.selectPlan}
            </button>

            <Link
              href="/insurance/search"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2.5 border border-slate-200 bg-white text-slate-600 font-bold rounded-lg text-sm hover:border-sky-300 transition-colors"
            >
              <i className="fa-solid fa-arrow-left"></i> {t.backToList}
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function InsuranceDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F2F3F3] pt-20">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-32 w-full bg-white rounded-lg border border-slate-200"></div>
            <div className="h-64 w-full bg-white rounded-lg border border-slate-200"></div>
          </div>
        </div>
      </div>
    }>
      <InsuranceDetailContent />
    </Suspense>
  );
}
