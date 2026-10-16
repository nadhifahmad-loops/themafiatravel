'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

interface DiscountCoupon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  category: string;
  minOrderAmount: number;
  maxDiscount: number | null;
  maxUsage: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  isFeatured: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  flight: 'bg-sky-50 text-sky-600',
  hotel: 'bg-amber-50 text-amber-600',
  train: 'bg-emerald-50 text-emerald-600',
  insurance: 'bg-violet-50 text-violet-600',
  transfer: 'bg-cyan-50 text-cyan-600',
  activity: 'bg-pink-50 text-pink-600',
  all: 'bg-orange-50 text-orange-600',
};

interface Promo {
  module: 'flight' | 'hotel' | 'train' | 'insurance';
  title: string;
  subtitle: string;
  img: string;
  badge: string;
  dest?: string;
  q?: string;
  origin?: string;
  area?: string;
}

const PROMOS_ID: Record<string, Promo[]> = {
  flights: [
    { module: 'flight', title: 'Travel to South Korea', subtitle: 'Mulai Rp 2.499.000', img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=500&q=80', badge: 'Hemat 35%', dest: 'ICN' },
    { module: 'flight', title: 'Travel to Malaysia', subtitle: 'Mulai Rp 899.000', img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=500&q=80', badge: 'Promo Spesial', dest: 'KUL' },
    { module: 'flight', title: 'Travel to Singapore', subtitle: 'Mulai Rp 1.199.000', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=500&q=80', badge: 'Terlaris', dest: 'SIN' },
    { module: 'flight', title: 'Travel to Bali', subtitle: 'Mulai Rp 599.000', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80', badge: 'Domestik', dest: 'DPS' },
    { module: 'flight', title: 'Travel to New Zealand', subtitle: 'Mulai Rp 6.799.000', img: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=500&q=80', badge: 'Impian', dest: 'AKL' },
  ],
  hotels: [
    { module: 'hotel', title: 'Hotel Bali Mewah', subtitle: 'Mulai Rp 750.000/malam', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80', badge: 'Bintang 5', dest: 'ID8731', q: 'Bali' },
    { module: 'hotel', title: 'Resort Lombok', subtitle: 'Mulai Rp 450.000/malam', img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80', badge: 'Best Value', dest: 'ID8731', q: 'Bali' },
    { module: 'hotel', title: 'Hotel Jakarta Pusat', subtitle: 'Mulai Rp 380.000/malam', img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80', badge: 'Flash Sale', dest: 'ID339', q: 'Jakarta' },
    { module: 'hotel', title: 'Villa Ubud', subtitle: 'Mulai Rp 1.200.000/malam', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80', badge: 'Pilihan Editor', dest: 'ID8731', q: 'Bali' },
  ],
  trains: [
    { module: 'train', title: 'Jakarta – Surabaya', subtitle: 'Mulai Rp 180.000', img: '/images/domestik/surabaya.png', badge: 'Eksekutif', origin: 'GMR', dest: 'SGU' },
    { module: 'train', title: 'Bandung – Yogyakarta', subtitle: 'Mulai Rp 120.000', img: '/images/domestik/yogyakarta.png', badge: 'Populer', origin: 'BD', dest: 'YK' },
    { module: 'train', title: 'Jakarta – Bandung', subtitle: 'Mulai Rp 75.000', img: '/images/domestik/bandung.png', badge: 'Harian', origin: 'GMR', dest: 'BD' },
  ],
  insurance: [
    { module: 'insurance', title: 'Asuransi Asia', subtitle: 'Mulai Rp 150.000', img: 'https://images.unsplash.com/photo-1533050487297-09b450131914?w=500&q=80', badge: 'Populer', area: 'Asia' },
    { module: 'insurance', title: 'Asuransi Schengen', subtitle: 'Mulai Rp 250.000', img: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=500&q=80', badge: 'Visa Aman', area: 'Schengen' },
    { module: 'insurance', title: 'Asuransi Seluruh Dunia', subtitle: 'Mulai Rp 350.000', img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&q=80', badge: 'Lengkap', area: 'Worldwide' },
    { module: 'insurance', title: 'Asuransi Domestik', subtitle: 'Mulai Rp 80.000', img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=500&q=80', badge: 'Hemat', area: 'Indonesia' },
  ],
};

const PROMOS_EN: Record<string, Promo[]> = {
  flights: [
    { module: 'flight', title: 'Travel to South Korea', subtitle: 'From Rp 2,499,000', img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=500&q=80', badge: 'Save 35%', dest: 'ICN' },
    { module: 'flight', title: 'Travel to Malaysia', subtitle: 'From Rp 899,000', img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=500&q=80', badge: 'Special Promo', dest: 'KUL' },
    { module: 'flight', title: 'Travel to Singapore', subtitle: 'From Rp 1,199,000', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=500&q=80', badge: 'Best Seller', dest: 'SIN' },
    { module: 'flight', title: 'Travel to Bali', subtitle: 'From Rp 599,000', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80', badge: 'Domestic', dest: 'DPS' },
    { module: 'flight', title: 'Travel to New Zealand', subtitle: 'From Rp 6,799,000', img: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=500&q=80', badge: 'Dream Trip', dest: 'AKL' },
  ],
  hotels: [
    { module: 'hotel', title: 'Luxury Bali Hotel', subtitle: 'From Rp 750,000/night', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80', badge: '5 Stars', dest: 'ID8731', q: 'Bali' },
    { module: 'hotel', title: 'Lombok Resort', subtitle: 'From Rp 450,000/night', img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80', badge: 'Best Value', dest: 'ID8731', q: 'Bali' },
    { module: 'hotel', title: 'Central Jakarta Hotel', subtitle: 'From Rp 380,000/night', img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80', badge: 'Flash Sale', dest: 'ID339', q: 'Jakarta' },
    { module: 'hotel', title: 'Ubud Villa', subtitle: 'From Rp 1,200,000/night', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80', badge: "Editor's Pick", dest: 'ID8731', q: 'Bali' },
  ],
  trains: [
    { module: 'train', title: 'Jakarta – Surabaya', subtitle: 'From Rp 180,000', img: '/images/domestik/surabaya.png', badge: 'Executive', origin: 'GMR', dest: 'SGU' },
    { module: 'train', title: 'Bandung – Yogyakarta', subtitle: 'From Rp 120,000', img: '/images/domestik/yogyakarta.png', badge: 'Popular', origin: 'BD', dest: 'YK' },
    { module: 'train', title: 'Jakarta – Bandung', subtitle: 'From Rp 75,000', img: '/images/domestik/bandung.png', badge: 'Daily', origin: 'GMR', dest: 'BD' },
  ],
  insurance: [
    { module: 'insurance', title: 'Asia Travel Insurance', subtitle: 'From Rp 150,000', img: 'https://images.unsplash.com/photo-1533050487297-09b450131914?w=500&q=80', badge: 'Popular', area: 'Asia' },
    { module: 'insurance', title: 'Schengen Travel Insurance', subtitle: 'From Rp 250,000', img: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=500&q=80', badge: 'Visa Ready', area: 'Schengen' },
    { module: 'insurance', title: 'Worldwide Travel Insurance', subtitle: 'From Rp 350,000', img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&q=80', badge: 'Complete', area: 'Worldwide' },
    { module: 'insurance', title: 'Domestic Travel Insurance', subtitle: 'From Rp 80,000', img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=500&q=80', badge: 'Great Value', area: 'Indonesia' },
  ],
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(from.getDate() + days);
  return toISO(d);
}

export default function DiscountPage() {
  const { language } = useLanguage();
  const t = i18n.discounts[language];
  const isEN = language === 'EN';
  const router = useRouter();

  const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const promoRowRef = useRef<HTMLDivElement>(null);

  const TABS = [
    { id: 'flights', label: t.categories.flight },
    { id: 'hotels', label: t.categories.hotel },
    { id: 'trains', label: t.categories.train },
    { id: 'insurance', label: t.categories.insurance },
  ];
  const PROMOS = isEN ? PROMOS_EN : PROMOS_ID;
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  const loadCoupons = useCallback(() => {
    return fetch('/api/coupons/active?limit=100')
      .then(r => r.json())
      .then(d => setCoupons((d.coupons || []) as DiscountCoupon[]))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  const retry = () => { setLoading(true); setError(false); loadCoupons(); };

  const copyCoupon = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch {}
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const categoryLabel = (c: string) =>
    (t.categories as Record<string, string>)[c] || c;

  const valueLabel = (c: DiscountCoupon) =>
    c.type === 'percentage' ? `${c.value}%` : `Rp${c.value.toLocaleString('id-ID')}`;

  const gotoPromo = (p: Promo, baseDate: Date) => {
    const today = toISO(baseDate);
    const tomorrow = addDaysISO(baseDate, 1);
    const nextWeek = addDaysISO(baseDate, 7);

    if (p.module === 'flight') {
      const params = new URLSearchParams({ origin: 'CGK', destination: p.dest || 'DPS', departure_date: tomorrow, adult: '1', child: '0', infant: '0', cabin_class: 'Y', direction: 'OW', autoSearch: '1' });
      router.push(`/flight/search?${params.toString()}`);
    } else if (p.module === 'hotel') {
      const params = new URLSearchParams({ destination_id: p.dest || 'ID8731', q: p.q || '', checkin_date: today, checkout_date: tomorrow, adult: '2', child: '0', room: '1', nationality: 'ID' });
      router.push(`/hotel/search?${params.toString()}`);
    } else if (p.module === 'train') {
      const params = new URLSearchParams({ origin: p.origin || 'GMR', destination: p.dest || 'SGU', depart: tomorrow, adult: '1', infant: '0', direction: 'OW', provider: 'kai' });
      router.push(`/train/search?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ provider: 'all', destination_area: p.area || 'Asia', date_start: today, date_end: nextWeek, trip_type: 'single_trip', pax: '1', is_senior: 'false', autoSearch: '1' });
      router.push(`/insurance/search?${params.toString()}`);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bgLight">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 space-y-10">

        {/* Header */}
        <header>
          <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
            {isEN ? 'Active Discount Coupons & Deals' : 'Kupon Diskon & Penawaran'}
          </h1>
          <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium max-w-2xl">{t.subtitle}</p>
        </header>

        {/* ═══ Active coupons ═══ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <i className="fa-solid fa-percent text-brand-orange text-sm" />
            <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.activeCoupons}</h2>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-card p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                    <div className="h-4 w-12 bg-slate-200 rounded-full"></div>
                  </div>
                  <div className="h-3 w-3/4 bg-slate-200 rounded mb-2"></div>
                  <div className="h-2.5 w-full bg-slate-200 rounded mb-3"></div>
                  <div className="h-8 w-full bg-slate-200 rounded-lg"></div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-triangle-exclamation text-xl text-slate-300"></i>
              </div>
              <p className="text-slate-500 text-sm">{t.loading}</p>
              <button onClick={retry} className="mt-3 px-5 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm">
                {t.retry}
              </button>
            </div>
          )}

          {!loading && !error && coupons.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-ticket text-2xl text-slate-300"></i>
              </div>
              <h3 className="font-black text-brand-ink text-base mb-1">{t.empty}</h3>
              <p className="text-slate-400 text-sm">{t.emptySub}</p>
            </div>
          )}

          {!loading && !error && coupons.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {coupons.map(c => (
                <button
                  key={c.id}
                  onClick={() => copyCoupon(c.code)}
                  className="text-left bg-white rounded-xl border border-slate-100 shadow-card p-4 relative overflow-hidden cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 bg-orange-50/60 rounded-bl-full group-hover:scale-125 transition-transform" />
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CATEGORY_COLORS[c.category] || CATEGORY_COLORS.all}`}>
                      {categoryLabel(c.category)}
                    </span>
                    <span className="text-[12px] font-black text-brand-ink">{valueLabel(c)}</span>
                  </div>
                  <p className="text-[13px] font-bold text-brand-ink leading-snug">{c.name}</p>
                  {c.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-relaxed">{c.description}</p>
                  )}
                  <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between gap-2">
                    <code className="text-[11px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded">{c.code}</code>
                    <span className={`text-[11px] font-black flex items-center gap-1 transition-colors ${copied === c.code ? 'text-emerald-600' : 'text-orange-500'}`}>
                      <i className={`fa-solid ${copied === c.code ? 'fa-circle-check' : 'fa-copy'} text-[10px]`}></i>
                      {copied === c.code ? t.copied : t.copyCode}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ═══ Promo cards ═══ */}
        <section className="border-t border-slate-200/60 pt-8 pb-4">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.promoTitle}</h2>
          </div>

          <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  activeTab === tab.id
                    ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-blue/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <div ref={promoRowRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory scroll-smooth">
              {(PROMOS[activeTab] || []).map((p, i) => (
                <button
                  key={i}
                  onClick={() => gotoPromo(p, new Date())}
                  className="flex-none w-[210px] sm:w-[240px] bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group snap-start text-left"
                >
                  <div className="relative overflow-hidden h-[118px]">
                    <img src={p.img} alt={p.title} onError={p.module === 'train' ? (e) => { e.currentTarget.src = '/images/train.jpg'; } : undefined} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 bg-brand-orange text-white text-[10px] font-black px-2 py-1 rounded-full shadow">{p.badge}</span>
                  </div>
                  <div className="p-3">
                    <p className="font-black text-brand-ink text-[13px] leading-snug">{p.title}</p>
                    <p className="text-orange-600 font-bold text-[11px] mt-1">{p.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => promoRowRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center text-slate-400 hover:text-brand-orange bg-white/80 rounded-full shadow sm:flex hidden transition-colors"
            >
              <i className="fa-solid fa-chevron-left text-sm"></i>
            </button>
            <button
              onClick={() => promoRowRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center text-slate-400 hover:text-brand-orange bg-white/80 rounded-full shadow sm:flex hidden transition-colors"
            >
              <i className="fa-solid fa-chevron-right text-sm"></i>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}