'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

function getLowestPrice(prices: any): { price: number; provider: string; mealType: string } {
  if (!prices) return { price: 0, provider: '', mealType: '' };
  let lowest = Infinity;
  let lowestProvider = '';
  let lowestMeal = '';
  Object.entries(prices).forEach(([provider, p]: any) => {
    if (p?.price && p.price < lowest) {
      lowest = p.price;
      lowestProvider = provider;
      lowestMeal = p.meal_type || '';
    }
  });
  return { price: lowest === Infinity ? 0 : lowest, provider: lowestProvider, mealType: lowestMeal };
}

function Stars({ n }: { n: number }) {
  if (!n || n < 1) return null;
  return (
    <div className="flex gap-0.5">
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
  if (price <= 0) return <span className="text-sm text-slate-400 italic">Harga tidak tersedia</span>;
  const perNight = Math.round(price / nights);
  return (
    <div className="flex flex-col items-end">
      <span className="font-black text-orange-600 text-2xl leading-none">
        IDR {perNight.toLocaleString('id-ID')}
      </span>
      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{t.perNight} · {nights} {tc.night}</span>
    </div>
  );
}

function HotelMetaChip({ icon, label, accent }: { icon: string; label: string; accent: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${accent}`}>
      <i className={`fa-solid ${icon} text-[9px]`} />
      {label}
    </span>
  );
}

export default function HotelCard({ hotel, searchParams, nights = 1, isCheapest = false }: {
  hotel: any;
  searchParams: any;
  nights?: number;
  isCheapest?: boolean;
}) {
  const { language } = useLanguage();
  const t = i18n.hotelSearch[language];
  const tc = i18n.common[language];
  const router = useRouter();
  const [imgErr, setImgErr] = useState(false);
  const { price, mealType } = getLowestPrice(hotel.prices);
  const image = !imgErr ? hotel.images?.[0]?.url : null;
  const rating = parseInt(hotel.rating) || 0;
  const isWithMeal = mealType && mealType !== 'ROOM ONLY' && mealType !== 'RO' && mealType !== 'Room Only';
  const isConfirmed = hotel.state === 'confirm';

  const handleSelect = () => {
    const q = new URLSearchParams({
      hotel_id: hotel.id,
      checkin_date: searchParams.checkin_date,
      checkout_date: searchParams.checkout_date,
      destination_id: searchParams.destination_id,
      adult: String(searchParams.adult),
      child: String(searchParams.child || 0),
      room: String(searchParams.room),
      nationality: searchParams.nationality || 'ID',
    }).toString();
    router.push(`/hotel/${hotel.id}?${q}`);
  };

  return (
    <article
      onClick={handleSelect}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-all duration-300 group cursor-pointer ${isCheapest ? 'border-orange-400 ring-2 ring-orange-400/30' : 'border-slate-100 hover:border-orange-200/60'}`}
    >
      {/* ── IMAGE ── */}
      <div className="md:w-[260px] lg:w-[280px] relative h-[220px] md:h-auto bg-slate-100 overflow-hidden shrink-0">
        {image ? (
          <img
            src={image}
            alt={hotel.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 bg-gradient-to-br from-slate-100 to-slate-50">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-hotel text-3xl text-slate-300"></i>
            </div>
            <span className="text-xs text-slate-400 font-semibold">Foto tidak tersedia</span>
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

        {/* Meal badge */}
        {isWithMeal && (
          <div className="absolute top-3 left-3">
            <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <i className="fa-solid fa-utensils text-[8px]"></i> Sarapan
            </span>
          </div>
        )}

        {/* Status badge */}
        {!isConfirmed && (
          <div className="absolute top-3 right-3">
            <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">Draft</span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-black text-slate-700 shadow-sm">
            {hotel.location?.city || 'Lokasi populer'}
          </div>
          {isCheapest && (
            <div className="rounded-full bg-orange-500/90 px-3 py-1 text-[10px] font-black text-white shadow-sm">
              Best Price
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 p-5 flex flex-col min-w-0">

        {/* Top: name + location */}
        <div className="mb-3">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="font-black text-slate-900 text-lg leading-tight truncate flex-1">
              {hotel.name}
            </h3>
            {rating > 0 && (
              <span className="shrink-0 bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded-lg">
                {rating}.0
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Stars n={rating} />
            {hotel.location?.city && (
              <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                <i className="fa-solid fa-location-dot text-slate-300 text-[10px]"></i>
                {[hotel.location.city, hotel.location.country_code].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Amenity chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <HotelMetaChip icon="fa-wifi" label="Wi-Fi" accent="text-slate-600 bg-slate-50 border-slate-100" />
          {isWithMeal && (
            <HotelMetaChip icon="fa-mug-hot" label="Sarapan" accent="text-emerald-600 bg-emerald-50 border-emerald-100" />
          )}
          {isConfirmed && (
            <HotelMetaChip icon="fa-shield-check" label="Terverifikasi" accent="text-blue-600 bg-blue-50 border-blue-100" />
          )}
          {Object.keys(hotel.prices || {}).length > 1 && (
            <HotelMetaChip icon="fa-tags" label={`${Object.keys(hotel.prices).length} penawaran`} accent="text-purple-600 bg-purple-50 border-purple-100" />
          )}
        </div>

        {/* Bottom: price + CTA */}
        <div className="mt-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Mulai dari</span>
            <PriceTag price={price} nights={nights} />
            {price > 0 && (
              <span className="text-[10px] text-slate-400 mt-0.5">
                {tc.total} IDR {price.toLocaleString('id-ID')} · {nights} {tc.night}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm shadow-orange-200 group-hover:shadow-md group-hover:shadow-orange-200 shrink-0 flex items-center justify-center gap-2"
          >
            {t.selectHotel}
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </button>
        </div>
      </div>
    </article>
  );
}