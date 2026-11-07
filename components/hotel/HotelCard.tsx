'use client';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n, tpl } from '@/lib/i18n';
import FavoriteButton from '@/components/favorite/FavoriteButton';

type HotelPriceOffer = {
  price?: number | string;
  prices?: { price_total?: number | string };
  meal_type?: string;
};

type HotelSearchContext = {
  checkin_date?: string;
  checkout_date?: string;
  destination_id?: string;
  adult?: number;
  child?: number;
  child_ages?: number[];
  room?: number;
  nationality?: string;
  q?: string;
};

function getLowestPrice(prices: unknown): { price: number; mealType: string; offers: number } {
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
    return { price: 0, mealType: '', offers: 0 };
  }

  let lowest = Infinity;
  let lowestMeal = '';
  let offers = 0;

  Object.values(prices as Record<string, HotelPriceOffer>).forEach((offer) => {
    const price = Number(offer?.price ?? offer?.prices?.price_total);
    if (Number.isFinite(price) && price > 0) {
      offers += 1;
      if (price < lowest) {
        lowest = price;
        lowestMeal = offer.meal_type || '';
      }
    }
  });

  return { price: lowest === Infinity ? 0 : lowest, mealType: lowestMeal, offers };
}

function Stars({ n }: { n: number }) {
  if (!n || n < 1) return null;
  return (
    <div className="flex gap-0.5" aria-label={`${n} bintang`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={`fa-solid fa-star text-[11px] ${i < n ? 'text-amber-400' : 'text-slate-200'}`}></i>
      ))}
    </div>
  );
}

function PriceTag({ price, nights }: { price: number; nights: number }) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  if (price <= 0) return <span className="text-sm italic text-slate-400">{t.priceUnavailable}</span>;
  const perNight = Math.round(price / nights);
  return (
    <div className="flex flex-col sm:items-end">
      <span className="font-black text-orange-600 text-2xl leading-none">
        IDR {perNight.toLocaleString('id-ID')}
      </span>
      <span className="text-[10px] text-slate-400 font-semibold mt-1">{t.perNight} · {nights} {tc.night}</span>
    </div>
  );
}

function MetaChip({ icon, label, accent }: { icon: string; label: string; accent: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${accent}`}>
      <i className={`fa-solid ${icon} text-[9px]`} />
      {label}
    </span>
  );
}

export default function HotelCard({ hotel, searchParams, nights = 1, isCheapest = false }: {
  hotel: Record<string, unknown>;
  searchParams?: HotelSearchContext | null;
  nights?: number;
  isCheapest?: boolean;
}) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const router = useRouter();
  const { price, mealType, offers } = getLowestPrice(hotel.prices);
  const rating = Number(hotel.rating) || 0;
  const stars = rating > 0 && rating <= 5 ? Math.round(rating) : 0;
  const isWithMeal = Boolean(mealType) && !/^(RO|ROOM ONLY)$/i.test(mealType.trim());
  const location = hotel.location as { city?: unknown; country_code?: unknown } | undefined;
  const city = typeof hotel.city === 'string' ? hotel.city : typeof location?.city === 'string' ? location.city : '';
  const countryCode = typeof location?.country_code === 'string' ? location.country_code : '';
  const destination = [city, countryCode].filter(Boolean).join(', ') || searchParams?.q || '';
  const rawName = hotel.name ?? hotel.hotel_name;
  const hotelName = typeof rawName === 'string' && rawName.trim() ? rawName : 'Hotel';

  const handleSelect = () => {
    const q = new URLSearchParams({
      hotel_id: String(hotel.id ?? ''),
      checkin_date: searchParams?.checkin_date || '',
      checkout_date: searchParams?.checkout_date || '',
      destination_id: searchParams?.destination_id || '',
      adult: String(searchParams?.adult ?? 2),
      child: String(searchParams?.child ?? 0),
      child_ages: JSON.stringify(searchParams?.child_ages || []),
      room: String(searchParams?.room ?? 1),
      nationality: searchParams?.nationality || 'ID',
    }).toString();
    router.push(`/hotel/${hotel.id}?${q}`);
  };

  return (
    <article
      onClick={handleSelect}
      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        isCheapest ? 'border-orange-300' : 'border-slate-100 hover:border-slate-200'
      }`}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:gap-5">
        {/* Identitas hotel */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 ring-1 ring-orange-100">
            <i className="fa-solid fa-hotel text-base" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-black leading-tight text-brand-ink sm:text-lg">
                    {hotelName}
                  </h3>
                  {isCheapest && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      <i className="fa-solid fa-tags text-[9px]" aria-hidden="true" />
                      {t.cheapest}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars n={stars} />
                  {rating > 0 && (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      {rating.toFixed(1)}
                    </span>
                  )}
                  {destination && (
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-slate-400">
                      <i className="fa-solid fa-location-dot text-[9px] text-slate-300" aria-hidden="true" />
                      <span className="truncate">{destination}</span>
                    </span>
                  )}
                </div>
              </div>

              <FavoriteButton
                entityType="hotel"
                dedupeKey={`hotel:${hotel.id}:${searchParams?.checkin_date || ''}`}
                title={hotelName}
                subtitle={destination}
                price={price || null}
                searchParams={{
                  ...(searchParams || {}),
                  _stars: stars,
                  _score: rating > 5 ? rating : 0,
                }}
                className="shrink-0"
                iconSize="sm"
              />
            </div>

            {(isWithMeal || offers > 1) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {isWithMeal && (
                  <MetaChip icon="fa-utensils" label={t.includesMeal} accent="text-emerald-700 bg-emerald-50 border-emerald-100" />
                )}
                {offers > 1 && (
                  <MetaChip icon="fa-tags" label={tpl(t.offersCount, { count: offers })} accent="text-violet-700 bg-violet-50 border-violet-100" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Harga + CTA */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between md:w-56 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="min-w-0 md:text-right">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t.landing.startingFrom}
            </p>
            <PriceTag price={price} nights={nights} />
            {price > 0 && (
              <p className="mt-1 text-[10px] text-slate-400">
                {tc.total} IDR {price.toLocaleString('id-ID')} · {nights} {tc.night}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleSelect();
            }}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 active:scale-95 sm:w-auto"
          >
            {t.selectHotel}
            <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
