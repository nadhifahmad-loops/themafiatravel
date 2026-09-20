'use client';
import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import HotelCard from '@/components/hotel/HotelCard';
import HotelSearchForm from '@/components/hotel/HotelSearchForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

const POPULAR_HOTEL_DESTINATIONS = [
  { destination_id: 'ID8731', name: 'Bali',        nameEN: 'Bali',        price: 750000,  img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80' },
  { destination_id: 'ID339',  name: 'Jakarta',     nameEN: 'Jakarta',     price: 380000,  img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80' },
  { destination_id: 'ID8735', name: 'Yogyakarta',  nameEN: 'Yogyakarta',  price: 450000,  img: 'https://images.unsplash.com/photo-1580981568153-81e4a20bf7ec?w=600&q=80' },
  { destination_id: 'ID8734', name: 'Bandung',     nameEN: 'Bandung',     price: 400000,  img: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&q=80' },
  { destination_id: 'ID8732', name: 'Surabaya',    nameEN: 'Surabaya',    price: 350000,  img: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600&q=80' },
  { destination_id: 'SG7355', name: 'Singapura',   nameEN: 'Singapore',   price: 1500000, img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80' },
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row animate-pulse">
      <div className="md:w-[280px] h-[200px] md:h-auto bg-slate-100 shrink-0" />
      <div className="flex-1 p-5 flex flex-col gap-3">
        <div className="h-5 bg-slate-100 rounded-xl w-3/4" />
        <div className="h-3.5 bg-slate-100 rounded-xl w-1/3" />
        <div className="h-3 bg-slate-100 rounded-xl w-1/2" />
        <div className="flex gap-2 mt-1">
          {[1,2,3].map(i => <div key={i} className="h-6 w-16 bg-slate-100 rounded-full" />)}
        </div>
        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-7 w-36 bg-orange-100 rounded-xl" />
          </div>
          <div className="h-10 w-28 bg-orange-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Filter Skeleton ────────────────────────────────────────────────────────
function FilterSkeleton() {
  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden animate-pulse">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded"></div>
          <div className="h-3 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-5 flex flex-col gap-6">
          {/* Search by name */}
          <div>
            <div className="h-2 w-24 bg-slate-200 rounded mb-3"></div>
            <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
          </div>
          {/* Price */}
          <div>
            <div className="h-2 w-20 bg-slate-200 rounded mb-3"></div>
            <div className="flex gap-1.5 mb-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-7 w-14 bg-slate-100 rounded-lg"></div>)}
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full mt-2"></div>
          </div>
          {/* Stars */}
          <div className="border-t border-slate-100 pt-5">
            <div className="h-2 w-16 bg-slate-200 rounded mb-3"></div>
            <div className="space-y-2.5">
              {[1,2,3,4,5].map(i => <div key={i} className="flex items-center gap-3"><div className="w-4 h-4 bg-slate-100 rounded"></div><div className="flex gap-0.5">{[1,2,3,4,5].map(j => <div key={j} className="w-2.5 h-2.5 bg-slate-100 rounded-full"></div>)}</div><div className="h-2.5 w-10 bg-slate-100 rounded"></div></div>)}
            </div>
          </div>
          {/* Facilities */}
          <div className="border-t border-slate-100 pt-5">
            <div className="h-2 w-14 bg-slate-200 rounded mb-3"></div>
            <div className="flex flex-wrap gap-1.5">
              {[1,2,3,4,5].map(i => <div key={i} className="h-7 w-16 bg-slate-100 rounded-lg"></div>)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── No Results with Alternatives ───────────────────────────────────────────
function NoResultsWithAlternatives({ searchParams, onSearch, onRetry }: { searchParams: any; onSearch: (p: any) => void; onRetry?: () => void }) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const isEN = language === 'EN';

  const quickHotel = (destId: string) => {
    const today = formatLocalDate(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = formatLocalDate(tomorrowDate);
    onSearch({
      destination_id: destId,
      q: POPULAR_HOTEL_DESTINATIONS.find(d => d.destination_id === destId)?.nameEN || destId,
      checkin_date: today,
      checkout_date: tomorrow,
      adult: searchParams?.adult || 2,
      room: searchParams?.room || 1,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* No results header */}
      <div className="px-6 py-10 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-bed text-3xl text-orange-300"></i>
        </div>
        <h3 className="font-black text-brand-ink text-lg mb-1.5">{t.noResultTitle}</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{t.noResultDesc}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm hover:bg-orange-700 transition-colors">
            <i className="fa-solid fa-rotate-right"></i> Coba Lagi
          </button>
        )}
      </div>

      {/* Alternative destinations */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-6">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.alternativeTitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_HOTEL_DESTINATIONS.filter(d => d.destination_id !== searchParams?.destination_id).map(d => (
            <button key={d.destination_id} onClick={() => quickHotel(d.destination_id)}
              className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[16/10] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                    Mulai dari IDR {(d.price / 1000).toLocaleString('id-ID')}K
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Compact search bar ───────────────────────────────────────────────────────
function CompactBar({ searchParams, onSearch, loading }: { searchParams: any; onSearch: (p: any) => void; loading: boolean }) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const [open, setOpen] = useState(false);

  const POPULAR: Record<string, string> = {
    'SG7355': 'Singapura, SG', 'ID339': 'Jakarta, ID', 'ID8731': 'Bali, ID',
    'ID8732': 'Surabaya, ID', 'MY5411': 'Kuala Lumpur, MY', 'TH3299': 'Bangkok, TH',
    'ID8735': 'Yogyakarta, ID', 'ID8734': 'Bandung, ID',
  };

  const fmt = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—';
  const destLabel = searchParams?.q || POPULAR[searchParams?.destination_id] || searchParams?.destination_id || '—';

  const nights = searchParams?.checkin_date && searchParams?.checkout_date
    ? Math.max(1, Math.round((new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000))
    : 1;

  if (!open) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpen(true)}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-bed text-orange-600"></i>
          </div>
          <div>
            <p className="font-black text-brand-ink text-sm">{destLabel}</p>
            <p className="text-xs text-slate-500">
              {fmt(searchParams?.checkin_date)} → {fmt(searchParams?.checkout_date)} · {nights} {tc.night} · {searchParams?.adult || 2} tamu · {searchParams?.room || 1} {tc.room}
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-200 transition-colors shrink-0">
          Ubah Pencarian
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 relative z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-brand-ink text-sm">Ubah Pencarian</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-brand-ink transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <HotelSearchForm onSearch={(p) => { onSearch(p); setOpen(false); }} loading={loading} initialData={searchParams} variant="light" />
    </div>
  );
}

// ─── Info Banner (after search) ─────────────────────────────────────────────
function InfoBanner({ searchParams, nights, onSearch }: { searchParams: any; nights: number; onSearch: (p: any) => void }) {
  const fmt = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—';

  return (
    <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-bed text-orange-400 text-sm"></i>
          </div>
          <div>
            <div className="text-sm font-black">
              {searchParams?.q || searchParams?.destination_id || '—'}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60 mt-0.5">
              <span>{fmt(searchParams?.checkin_date)} → {fmt(searchParams?.checkout_date)}</span>
              <span>·</span>
              <span>{nights} malam · {searchParams?.adult || 2} tamu · {searchParams?.room || 1} kamar</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {[-2, -1, 0, 1, 2].map(offset => {
            const d = searchParams?.checkin_date ? parseLocalDate(searchParams.checkin_date) : new Date();
            d.setDate(d.getDate() + offset);
            const dateStr = formatLocalDate(d);
            const checkout = new Date(d);
            checkout.setDate(checkout.getDate() + nights);
            return (
              <button key={offset} onClick={() => onSearch({ ...searchParams, checkin_date: dateStr, checkout_date: formatLocalDate(checkout) })}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${offset === 0 ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar filter ───────────────────────────────────────────────────────────
type SearchParamsState = {
  destination_id?: string;
  q?: string;
  checkin_date?: string;
  checkout_date?: string;
  adult?: number;
  child?: number;
  child_ages?: number[];
  room?: number;
  nationality?: string;
};

function SidebarFilter({ priceRange, setPriceRange, starFilters, onStarChange, onReset, hasActive, searchText, onSearchTextChange, facilityFilters, onFacilityChange }: any) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const PRESETS = [
    { label: '< 500rb', max: 500000 },
    { label: '< 1jt', max: 1000000 },
    { label: '< 2jt', max: 2000000 },
    { label: '< 5jt', max: 5000000 },
    { label: t.allStars, max: 10000000 },
  ];

  const FACILITIES = [
    { key: 'wifi', label: 'Wi-Fi', icon: 'fa-wifi' },
    { key: 'parking', label: 'Parkir', icon: 'fa-square-parking' },
    { key: 'pool', label: 'Kolam Renang', icon: 'fa-person-swimming' },
    { key: 'breakfast', label: 'Sarapan', icon: 'fa-mug-hot' },
    { key: 'ac', label: 'AC', icon: 'fa-snowflake' },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-brand-ink text-sm flex items-center gap-2">
            <i className="fa-solid fa-sliders text-orange-500 text-xs"></i>
            {tc.filter}
          </h3>
          {hasActive && (
            <button onClick={onReset} className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1">
              <i className="fa-solid fa-rotate-right text-[10px]"></i> Reset
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* Search by name */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Cari Nama Hotel</p>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
              <input
                type="text"
                value={searchText}
                onChange={e => onSearchTextChange(e.target.value)}
                placeholder="Ketik nama hotel..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-orange-400 transition-colors"
              />
            </div>
          </div>

          {/* Price range with presets */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Harga / Malam</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESETS.map(p => (
                <button
                  key={p.max}
                  onClick={() => setPriceRange({ min: 0, max: p.max })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                    priceRange.max === p.max
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-orange-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="range" min="0" max="10000000" step="500000"
              value={priceRange.max}
              onChange={e => setPriceRange({ min: 0, max: parseInt(e.target.value) })}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-400 font-semibold">IDR 0</span>
              <span className="text-xs font-bold text-orange-600">
                {priceRange.max >= 10000000 ? 'IDR 10jt+' : `IDR ${(priceRange.max / 1000000).toFixed(1).replace('.0','')}jt`}
              </span>
            </div>
          </div>

          {/* Stars */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">{t.filterStars}</p>
            <div className="flex flex-col gap-2">
              {[5, 4, 3, 2, 1].map(star => (
                <label key={star} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    starFilters.includes(star)
                      ? 'bg-orange-500 border-orange-500'
                      : 'border-slate-300 group-hover:border-orange-400'
                  }`} onClick={() => onStarChange(star)}>
                    {starFilters.includes(star) && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <i key={i} className={`fa-solid fa-star text-[10px] ${i < star ? 'text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">{star} {t.stars}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Facilities */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Fasilitas</p>
            <div className="flex flex-wrap gap-1.5">
              {FACILITIES.map(f => (
                <button
                  key={f.key}
                  onClick={() => onFacilityChange(f.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    facilityFilters.includes(f.key)
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-orange-300'
                  }`}
                >
                  <i className={`fa-solid ${f.icon} text-[9px]`}></i>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Sort & result bar ────────────────────────────────────────────────────────
function ResultBar({ count, loading, filtered, sortBy, onSort }: any) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  return (
    <div className="bg-white border-b border-slate-100">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {loading ? (
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-4 h-4 border-2 border-orange-200 rounded-full"></div>
                <div className="absolute inset-0 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <span className="text-xs font-semibold text-slate-500">Sedang mencari hotel terbaik...</span>
            </div>
          ) : (
            <span className="text-slate-600 text-sm">
              <span className="font-black text-brand-ink">{count}</span> {t.hotelsFound}
              {filtered && <span className="text-orange-500 ml-1 text-xs">(difilter)</span>}
            </span>
          )}
        </div>
        {!loading && count > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 hidden sm:block font-medium">{t.sortBy}</span>
            <select
              value={sortBy}
              onChange={e => onSort(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-400 cursor-pointer"
            >
              <option value="price_asc">💰 {t.sortOptions.priceAsc}</option>
              <option value="price_desc">💎 {t.sortOptions.priceDesc}</option>
              <option value="rating">⭐ {t.sortOptions.rating}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page wrapper ────────────────────────────────────────────────────────
export default function HotelSearchPage() {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bgLight flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">{t.loadingPage}</span>
        </div>
      </div>
    }>
      <HotelSearchContent />
    </Suspense>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function HotelSearchContent() {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const isEN = language === 'EN';
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  usePageTitle(
    searchParamsHook.get('q')
      ? `Pencarian Hotel: ${searchParamsHook.get('q')}`
      : 'Pencarian Hotel'
  );

  const [results, setResults] = useState<{ hotel_ids?: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useState<SearchParamsState | null>(null);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'rating'>('price_asc');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000000 });
  const [starFilters, setStarFilters] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [facilityFilters, setFacilityFilters] = useState<string[]>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Default tanggal dihitung sekali saat mount (stabil & idempotent)
  const [todayISO] = useState(() => formatLocalDate(new Date()));
  const [tomorrowISO] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatLocalDate(date);
  });

  // Guard supaya auto-search dari URL params hanya benar-benar dieksekusi
  // SEKALI, walau effect di-invoke berkali-kali (mis. React StrictMode di dev).
  const autoSearchDone = useRef(false);

  const doSearch = async (params: SearchParamsState) => {
    if (!params.destination_id || !params.checkin_date || !params.checkout_date) {
      setError('Silakan pilih destinasi dan tanggal stay terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    setCurrentPage(1);
    try {
      const res = await fetch('/api/hotel/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mencari hotel');
      setResults(data.data);
    } catch (error) {
      const msg = error instanceof TypeError
        ? 'Koneksi internet terputus. Periksa sinyalmu lalu coba lagi.'
        : error instanceof Error ? error.message : 'Gagal mencari hotel';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-search from URL params on mount ──
  useEffect(() => {
    if (autoSearchDone.current) return;
    autoSearchDone.current = true;

    const destId = searchParamsHook.get('destination_id');
    if (!destId) return;

    const params = {
      destination_id: destId,
      q: searchParamsHook.get('q') || '',
      checkin_date: searchParamsHook.get('checkin_date') || '',
      checkout_date: searchParamsHook.get('checkout_date') || '',
      adult: parseInt(searchParamsHook.get('adult') || '2'),
      child: parseInt(searchParamsHook.get('child') || '0'),
      child_ages: (() => {
        try { return JSON.parse(searchParamsHook.get('child_ages') || '[]'); } catch { return []; }
      })(),
      room: parseInt(searchParamsHook.get('room') || '1'),
      nationality: searchParamsHook.get('nationality') || 'ID',
    };

    setSearchParams(params);
    doSearch(params);
  }, []);

  const handleSearch = (params: SearchParamsState) => {
    setSearchParams(params);
    const urlParams = new URLSearchParams();
    if (params.destination_id) urlParams.set('destination_id', params.destination_id);
    urlParams.set('q', params.q || '');
    if (params.checkin_date) urlParams.set('checkin_date', params.checkin_date);
    if (params.checkout_date) urlParams.set('checkout_date', params.checkout_date);
    urlParams.set('adult', String(params.adult ?? 2));
    urlParams.set('child', String(params.child ?? 0));
    urlParams.set('room', String(params.room ?? 1));
    urlParams.set('nationality', params.nationality || 'ID');
    if (params.child_ages?.length) urlParams.set('child_ages', JSON.stringify(params.child_ages));
    router.replace(`/hotel/search?${urlParams.toString()}`, { scroll: false });
    doSearch(params);
  };

  const quickHotel = (destination_id: string) => {
    handleSearch({ destination_id, q: '', checkin_date: todayISO, checkout_date: tomorrowISO, adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' });
  };

  const getLowestPrice = (prices?: Record<string, { price?: number }>) => {
    if (!prices) return 0;
    const values = Object.values(prices).map((item) => item?.price ?? Number.POSITIVE_INFINITY);
    const valid = values.filter((value) => Number.isFinite(value));
    if (valid.length === 0) return 0;
    return Math.min(...valid);
  };

  const filteredAndSortedHotels = useMemo(() => {
    const hotels = (results?.hotel_ids || []) as Array<Record<string, unknown>>;
    const filtered = hotels.filter((hotel) => {
      const prices = (hotel.prices as Record<string, { price?: number }> | undefined) ?? undefined;
      const p = getLowestPrice(prices);
      const ratingValue = Number((hotel.rating as string | number | undefined) ?? 0);
      const hotelName = String(hotel.name || hotel.hotel_name || '').toLowerCase();
      const priceOk = p >= priceRange.min && (priceRange.max >= 10000000 ? true : p <= priceRange.max);
      const starOk = starFilters.length === 0 || starFilters.includes(Math.round(ratingValue));
      const textOk = !searchText || hotelName.includes(searchText.toLowerCase());
      return priceOk && starOk && textOk;
    });

    return [...filtered].sort((a, b) => {
      const priceA = getLowestPrice((a.prices as Record<string, { price?: number }> | undefined) ?? undefined);
      const priceB = getLowestPrice((b.prices as Record<string, { price?: number }> | undefined) ?? undefined);
      const ratingA = Number((a.rating as string | number | undefined) ?? 0);
      const ratingB = Number((b.rating as string | number | undefined) ?? 0);

      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'rating') return ratingB - ratingA;
      return 0;
    });
  }, [results, priceRange, starFilters, sortBy, searchText]);

  // ── Hotel termurah (badge Best Price) ──
  const cheapestHotelId = useMemo(() => {
    let bestId: string | number | null = null;
    let bestPrice = Infinity;
    filteredAndSortedHotels.forEach(hotel => {
      const p = getLowestPrice(hotel.prices as Record<string, { price?: number }> | undefined);
      if (p > 0 && p < bestPrice) {
        bestPrice = p;
        bestId = hotel.id as string | number;
      }
    });
    return bestId;
  }, [filteredAndSortedHotels]);

  const totalPages = Math.ceil(filteredAndSortedHotels.length / itemsPerPage);
  const currentHotels = filteredAndSortedHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const nights = searchParams?.checkout_date && searchParams?.checkin_date
    ? Math.max(1, Math.round(
        (new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000
      ))
    : 1;

  const hasActiveFilters = starFilters.length > 0 || priceRange.max < 10000000 || searchText.length > 0 || facilityFilters.length > 0;
  const showInitialForm = !searchParams;
  const hasResults = results && results.hotel_ids && results.hotel_ids.length > 0;
  const noResultsAfterSearch = !loading && results && !hasResults;

  return (
    <div className="bg-brand-bgLight min-h-screen pb-24 pt-20">

      {/* ── HERO HEADER (landing) ── */}
      {showInitialForm ? (
      <>
      <section className="relative z-10 overflow-hidden pt-4 md:pt-8 pb-2">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-ink leading-tight tracking-tight">
              {t.landing.title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-brand-neutral font-medium">{t.landing.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl shadow-floating border border-slate-100/80 p-4 sm:p-6 transition-all">
            <HotelSearchForm onSearch={handleSearch} loading={loading} variant="light" />
          </div>
        </div>
      </section>

      {/* Destinasi populer */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <div className="mb-5">
          <h2 className="text-lg sm:text-xl font-black text-brand-ink">{t.landing.popularTitle}</h2>
          <p className="text-brand-neutral text-xs sm:text-sm mt-1">{t.landing.popularSub}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {POPULAR_HOTEL_DESTINATIONS.map(d => (
            <button key={d.destination_id} onClick={() => quickHotel(d.destination_id)}
              className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-left">
              <div className="aspect-[16/10] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                  <p className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</p>
                  <p className="text-orange-300 text-[10px] sm:text-xs font-semibold mt-0.5">
                    {t.landing.startingFrom} IDR {(d.price / 1000).toLocaleString('id-ID')}K
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      </>
      ) : (
      <>
      {/* ─── Info Banner ──────────────────────────────────────────────────────── */}
      <InfoBanner searchParams={searchParams} nights={nights} onSearch={handleSearch} />
      </>
      )}

      {!showInitialForm && (
      <>
      {/* ─── Sticky Compact Search Bar ─────────────────────────────────────── */}
      <div data-compact-search className="sticky top-0 z-[900] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3">
          <CompactBar searchParams={searchParams} onSearch={handleSearch} loading={loading} />
        </div>
      </div>

      {/* ── RESULT BAR ── */}
      {(results || loading) && !noResultsAfterSearch && (
        <ResultBar
          count={filteredAndSortedHotels.length}
          loading={loading}
          filtered={hasActiveFilters}
          sortBy={sortBy}
          onSort={(v: any) => { setSortBy(v); setCurrentPage(1); }}
        />
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-3 pb-6 flex flex-col lg:flex-row gap-6 items-start">

        {/* Mobile filter toggle */}
        {loading && (
          <div className="lg:hidden w-full">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2 animate-pulse">
              <div className="w-4 h-4 bg-slate-200 rounded"></div>
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
        )}
        {!loading && !noResultsAfterSearch && (results || loading) && (
          <div className="lg:hidden w-full">
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-sliders text-orange-500 text-xs"></i>
                {tc.filter}
                {hasActiveFilters && <span className="w-2 h-2 bg-orange-500 rounded-full"></span>}
              </span>
              <i className={`fa-solid fa-chevron-${mobileFilterOpen ? 'up' : 'down'} text-xs text-slate-400`}></i>
            </button>
            {mobileFilterOpen && (
              <div className="mt-3">
                <SidebarFilter
                  priceRange={priceRange}
                  setPriceRange={(v: any) => { setPriceRange(v); setCurrentPage(1); }}
                  starFilters={starFilters}
                  onStarChange={(s: number) => {
                    setCurrentPage(1);
                    setStarFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
                  }}
                  onReset={() => { setPriceRange({ min: 0, max: 10000000 }); setStarFilters([]); setSearchText(''); setFacilityFilters([]); setCurrentPage(1); }}
                  hasActive={hasActiveFilters}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  facilityFilters={facilityFilters}
                  onFacilityChange={(f: string) => {
                    setCurrentPage(1);
                    setFacilityFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Desktop Sidebar */}
        {loading && <FilterSkeleton />}
        {!loading && !noResultsAfterSearch && (results || loading) && (
          <div className="hidden lg:block">
            <SidebarFilter
              priceRange={priceRange}
              setPriceRange={(v: any) => { setPriceRange(v); setCurrentPage(1); }}
              starFilters={starFilters}
              onStarChange={(s: number) => {
                setCurrentPage(1);
                setStarFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
              }}
              onReset={() => { setPriceRange({ min: 0, max: 10000000 }); setStarFilters([]); setSearchText(''); setFacilityFilters([]); setCurrentPage(1); }}
              hasActive={hasActiveFilters}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              facilityFilters={facilityFilters}
              onFacilityChange={(f: string) => {
                setCurrentPage(1);
                setFacilityFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
              }}
            />
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {!loading && results && !noResultsAfterSearch && currentHotels.length > 0 && (
            <div className="lg:hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-black text-slate-700">Hasil pencarian</span>
                <span>{filteredAndSortedHotels.length} {t.hotelsFound}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <NoResultsWithAlternatives searchParams={searchParams} onSearch={handleSearch} onRetry={() => doSearch(searchParams!)} />
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Hotel cards */}
          {!loading && currentHotels.length > 0 && (
            <div className="flex flex-col gap-4">
              {currentHotels.map((hotel: Record<string, unknown>, i: number) => (
                <HotelCard key={String((hotel.id as string | number | undefined) ?? i)} hotel={hotel} nights={nights} searchParams={searchParams} isCheapest={hotel.id === cheapestHotelId} />
              ))}
            </div>
          )}

          {/* No results after search - show alternatives */}
          {noResultsAfterSearch && (
            <NoResultsWithAlternatives searchParams={searchParams} onSearch={handleSearch} />
          )}

          {/* Empty state after filter (but results exist overall) */}
          {!loading && results && !noResultsAfterSearch && currentHotels.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-card">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-filter-circle-xmark text-3xl text-orange-200"></i>
              </div>
              <h3 className="font-black text-brand-ink text-lg mb-1.5">{t.noResult}</h3>
              <p className="text-slate-400 text-sm mb-5">{t.noResultSub}</p>
              {hasActiveFilters && (
                <button
                  onClick={() => { setPriceRange({ min: 0, max: 10000000 }); setStarFilters([]); setSearchText(''); setFacilityFilters([]); }}
                  className="px-5 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm"
                >
                  Hapus Semua Filter
                </button>
              )}
            </div>
          )}

          {/* Initial state — form & popular destinations handled in landing above */}
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <button
                onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 bg-white disabled:opacity-30 transition-colors"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              {Array.from({ length: totalPages }, (_, i) => {
                const p = i + 1;
                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                  return (
                    <button
                      key={p}
                      onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className={`w-9 h-9 rounded-xl border font-bold text-sm transition-all ${
                        currentPage === p
                          ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                }
                if (p === currentPage - 2 || p === currentPage + 2) {
                  return <span key={p} className="text-slate-300 text-sm px-1">···</span>;
                }
                return null;
              })}
              <button
                onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 bg-white disabled:opacity-30 transition-colors"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      <style jsx global>{`
        /* Saat halaman hasil pencarian hotel: navbar ikut terscroll,
           hanya "Ubah Pencarian" yang sticky di atas. */
        body:has([data-compact-search]) header.fixed {
          position: absolute;
        }
      `}</style>
    </div>
  );
}