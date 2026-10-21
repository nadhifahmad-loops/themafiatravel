'use client';

// components/favorite/FavoriteRow.tsx
// Kartu favorit bergaya "Daftar Simpan":
// - HOTEL: foto, label, nama, bintang + skor/ulasan, lokasi, harga + konteks.
// - PESAWAT: logo, label, rute kota, tanggal, chevron ekspansi berisi
//   "Maskapai (Kelas) / CGK - SIN (Direct) / 19:45 ~ (1h 40m) - 22:25".
// - Harga + tag koleksi di baris bawah; bila KEDALUWARSA (tanggal ≤ hari ini)
//   harga DIGANTI badge "Kedaluwarsa".
// - Item AKTIF diklik      → buka hasil pencarian tersimpan.
// - Item KEDALUWARSA diklik → popup konfirmasi "hapus item ini?" (tanpa reset tanggal).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { useFavorites, type FavoriteItem } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import { airportCity } from '@/lib/geo';

// ─── Util tanggal & URL ─────────────────────────────────────────────────────

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export function parseDateOnly(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function isExpiredDate(s?: string | null): boolean {
  const d = parseDateOnly(s);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Hari yang sama (berangkat/check-in hari ini) sudah dianggap kedaluwarsa.
  return d.getTime() <= today.getTime();
}

export function fmtDateOnly(s?: string | null): string {
  const d = parseDateOnly(s);
  if (!d) return '-';
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function tripNights(from?: string | null, to?: string | null): number {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) return 0;
  const n = Math.round((b.getTime() - a.getTime()) / 86400000);
  return n > 0 ? n : 0;
}

export function fmtIDR(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function savedDate(item: FavoriteItem): string | null {
  const sp = (item.searchParams || {}) as Record<string, string | undefined>;
  if (item.entityType === 'flight') return sp.departure_date || null;
  if (item.entityType === 'train') return sp.depart || sp.departure_date || null;
  return sp.checkin_date || null;
}

// Konteks pax/kamar/malam — "(1 tamu, 1 kamar, 1 malam)" / "(1 org)".
export function paxContext(item: FavoriteItem, language: 'ID' | 'EN'): string | null {
  const sp = (item.searchParams || {}) as Record<string, unknown>;
  const isEN = language === 'EN';
  const num = (v: unknown, def: number) => {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : def;
  };

  if (item.entityType === 'hotel') {
    const adult = num(sp.adult, 1);
    const room = num(sp.room, 1);
    const nights = tripNights(sp.checkin_date as string, sp.checkout_date as string) || 1;
    const parts = [
      `${adult} ${isEN ? (adult === 1 ? 'guest' : 'guests') : 'tamu'}`,
      `${room} ${isEN ? (room === 1 ? 'room' : 'rooms') : 'kamar'}`,
      `${nights} ${isEN ? (nights === 1 ? 'night' : 'nights') : 'malam'}`,
    ];
    return `(${parts.join(', ')})`;
  }

  const total =
    num(sp.adult, 1) + (Number(sp.child) || 0) + (Number(sp.infant) || 0);
  return `(${total} ${isEN ? 'pax' : 'org'})`;
}

export function buildSearchUrl(item: FavoriteItem): string {
  const sp = (item.searchParams || {}) as Record<string, string | undefined>;

  if (item.entityType === 'flight') {
    const q = new URLSearchParams({
      origin: sp.origin || 'CGK',
      destination: sp.destination || 'DPS',
      departure_date: sp.departure_date || addDays(7),
      return_date: sp.return_date || '',
      adult: String(sp.adult ?? '1'),
      child: String(sp.child ?? '0'),
      infant: String(sp.infant ?? '0'),
      cabin_class: sp.cabin_class || 'Y',
      direction: sp.direction || 'OW',
    });
    return `/flight/search?${q.toString()}`;
  }

  if (item.entityType === 'train') {
    const q = new URLSearchParams({
      origin: sp.origin || 'GMR',
      destination: sp.destination || 'BD',
      depart: sp.depart || sp.departure_date || addDays(7),
      adult: String(sp.adult ?? '1'),
      infant: String(sp.infant ?? '0'),
      direction: sp.direction || 'OW',
      provider: sp.provider || 'kai',
    });
    return `/train/search?${q.toString()}`;
  }

  const nights = tripNights(sp.checkin_date, sp.checkout_date) || 1;
  const q = new URLSearchParams({
    destination_id: sp.destination_id || '',
    q: sp.q || '',
    checkin_date: sp.checkin_date || addDays(1),
    checkout_date: sp.checkout_date || addDaysFrom(sp.checkin_date || addDays(1), nights),
    adult: String(sp.adult ?? 2),
    child: String(sp.child ?? 0),
    child_ages: JSON.stringify(Array.isArray(sp.child_ages) ? sp.child_ages : []),
    room: String(sp.room ?? 1),
    nationality: sp.nationality || 'ID',
  });
  return `/hotel/search?${q.toString()}`;
}

function addDaysFrom(base: string, days: number): string {
  const d = parseDateOnly(base) || new Date();
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export const TYPE_META: Record<
  string,
  { icon: string; color: string; labelKey: 'tabFlight' | 'tabHotel' | 'tabTrain' }
> = {
  flight: { icon: 'fa-plane', color: 'text-orange-500', labelKey: 'tabFlight' },
  hotel: { icon: 'fa-hotel', color: 'text-violet-500', labelKey: 'tabHotel' },
  train: { icon: 'fa-train', color: 'text-emerald-500', labelKey: 'tabTrain' },
};

// Gradasi cover untuk koleksi yang belum punya gambar — dipilih deterministik
// dari seed (id koleksi) supaya tiap koleksi punya warna khas yang konsisten.
export const COLLECTION_GRADIENTS = [
  'from-orange-400 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-fuchsia-400 to-pink-500',
  'from-violet-400 to-purple-600',
] as const;

export function collectionGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLLECTION_GRADIENTS[h % COLLECTION_GRADIENTS.length];
}

// Label kelas penerbangan dari kode kabin ("Y" → Ekonomi, dst.).
function cabinText(code: unknown, language: 'ID' | 'EN'): string {
  const c = String(code || 'Y').toUpperCase();
  if (c === 'C' || c === 'J') return language === 'ID' ? 'Bisnis' : 'Business';
  if (c === 'F' || c === 'A') return 'First';
  if (c === 'W' || c === 'P') return language === 'ID' ? 'Premium Ekonomi' : 'Premium Economy';
  return language === 'ID' ? 'Ekonomi' : 'Economy';
}

// Durasi "1h 40m" dari string elapsed provider ("HH:MM:SS" / "0:01:40:00").
function fmtElapsed(elapsed?: unknown): string {
  const s = String(elapsed || '');
  if (!s) return '';
  const parts = s.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return '';
  let h = 0;
  let m = 0;
  if (parts.length === 4) {
    h = (parts[0] || 0) * 24 + (parts[1] || 0);
    m = parts[2] || 0;
  } else if (parts.length >= 2) {
    h = parts[0] || 0;
    m = parts[1] || 0;
  } else {
    return s;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Baris favorit ──────────────────────────────────────────────────────────

export default function FavoriteRow({ item }: { item: FavoriteItem }) {
  const { language } = useLanguage();
  const t = i18n.favorites[language];
  const tc = i18n.confirm[language];
  const router = useRouter();
  const { removeById } = useFavorites();
  const { toast } = useToast();
  const [expiredConfirmOpen, setExpiredConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const meta = TYPE_META[item.entityType] || TYPE_META.flight;
  const typeLabel = t[meta.labelKey];
  const dateStr = savedDate(item);
  const expired = isExpiredDate(dateStr);
  const context = paxContext(item, language);

  const isFlight = item.entityType === 'flight';
  const isHotel = item.entityType === 'hotel';
  const favoriteEntityType =
    item.entityType === 'hotel' ? 'hotel' : item.entityType === 'train' ? 'train' : 'flight';
  const sp = (item.searchParams || {}) as Record<string, unknown>;

  // ── Data kartu penerbangan (rute, maskapai, jam, durasi, transit) ──
  const originCode = String(sp.origin || '');
  const destCode = String(sp.destination || '');
  const routeLabel =
    originCode && destCode
      ? `${airportCity(originCode)} → ${airportCity(destCode)}`
      : item.subtitle || item.title;
  const airlineLine = sp._airline
    ? String(sp._airline)
    : item.subtitle && !item.subtitle.includes('→')
      ? item.subtitle
      : item.title;
  const stops = Number(sp._stops) || 0;
  const cabinLabel = cabinText(sp.cabin_class, language);
  const depTime = sp._dep_time ? String(sp._dep_time) : '';
  const arrTime = sp._arr_time ? String(sp._arr_time) : '';
  const durLabel = fmtElapsed(sp._elapsed);
  const hasDetail = Boolean(sp._airline || depTime || arrTime);

  // ── Data kartu hotel (bintang, skor, jumlah ulasan) ──
  const stars = Number(sp._stars) || 0;
  const score = Number(sp._score) || 0;
  const reviews = Number(sp._reviews) || 0;

  // Item aktif → buka pencarian. Item kedaluwarsa → popup konfirmasi hapus
  // (tidak membuka pencarian, tidak menyesuaikan tanggal).
  const handleClick = () => {
    if (expired) {
      setExpiredConfirmOpen(true);
      return;
    }
    router.push(buildSearchUrl(item));
  };

  const doRemoveExpired = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await removeById(item.id);
      toast(t.toastRemoved, { variant: 'info' });
      setExpiredConfirmOpen(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <article
        role="link"
        tabIndex={0}
        aria-label={`${t.ariaCard}: ${item.title}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`relative rounded-2xl border bg-white cursor-pointer p-4 focus:outline-none focus:ring-2 focus:ring-slate-300 ${
          expired ? 'border-slate-200' : 'border-slate-100'
        }`}
      >
        <div className="flex gap-4">
          {/* Thumbnail / logo maskapai */}
          {isFlight ? (
            <div
              className={`w-12 h-12 shrink-0 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden ${
                expired ? 'grayscale opacity-70' : ''
              }`}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <i className={`fa-solid ${meta.icon} text-lg ${meta.color}`}></i>
              )}
            </div>
          ) : (
            <div
              className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50 flex items-center justify-center ${
                expired ? 'grayscale opacity-70' : ''
              }`}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <i className={`fa-solid ${meta.icon} text-2xl ${meta.color}`}></i>
              )}
            </div>
          )}

          {/* Konten atas */}
          <div className="flex-1 min-w-0 pr-16">
            {isFlight ? (
              <>
                <p className="text-[11px] font-semibold text-slate-400">{t.typeFlight}</p>
                <p className="text-sm font-black text-slate-800 truncate mt-0.5">{routeLabel}</p>
                {dateStr && (
                  <p
                    className={`text-[11px] font-semibold mt-1 ${
                      expired ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {fmtDateOnly(dateStr)}
                  </p>
                )}
              </>
            ) : isHotel ? (
              <>
                <p className="text-[11px] font-semibold text-slate-400">{t.typeHotel}</p>
                <p className="text-sm font-black text-slate-800 truncate mt-0.5">{item.title}</p>

                {(stars > 0 || score > 0 || reviews > 0) && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {stars > 0 && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <i
                            key={i}
                            className={`fa-solid fa-star text-[10px] ${
                              i < stars ? 'text-amber-400' : 'text-slate-200'
                            }`}
                          ></i>
                        ))}
                      </span>
                    )}
                    {stars > 0 && (score > 0 || reviews > 0) && (
                      <span className="w-px h-3 bg-slate-200"></span>
                    )}
                    {(score > 0 || reviews > 0) && (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
                        <i className="fa-solid fa-thumbs-up text-sky-500 text-[10px]"></i>
                        {score > 0 && (
                          <span>
                            {Number.isInteger(score) ? score : score.toFixed(1)} / 10
                          </span>
                        )}
                        {reviews > 0 && (
                          <span className="text-slate-400 font-semibold">({reviews})</span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {item.subtitle && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1 min-w-0">
                    <i className="fa-solid fa-location-dot text-slate-300 text-[11px] shrink-0"></i>
                    <span className="truncate">{item.subtitle}</span>
                  </p>
                )}
              </>
            ) : (
              /* Kereta (item lama) — layout generik */
              <>
                <p className="text-[11px] font-semibold text-slate-400">{typeLabel}</p>
                <p className="text-sm font-black text-slate-800 truncate mt-0.5">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    {item.subtitle}
                  </p>
                )}
                {dateStr && (
                  <p
                    className={`text-[11px] font-semibold mt-1.5 ${
                      expired ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {fmtDateOnly(dateStr)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail penerbangan (dibuka lewat chevron) */}
        {isFlight && expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            <p className="text-[13px] font-black text-slate-800">
              {airlineLine} ({cabinLabel})
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {originCode || '?'} - {destCode || '?'} (
              {stops === 0 ? t.direct : `${stops} ${t.transit}`})
            </p>
            {(depTime || arrTime) && (
              <p className="text-xs font-semibold text-slate-500">
                {depTime || '--:--'}
                {durLabel ? ` ~ (${durLabel})` : ' ~'} - {arrTime || '--:--'}
              </p>
            )}
          </div>
        )}

        {/* Harga atau status kedaluwarsa — rata kiri, tanpa badge koleksi. */}
        <div className="mt-3 pt-3 border-t border-slate-100 text-left">
          {expired ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
              {t.expired}
            </span>
          ) : (
            <>
              {typeof item.price === 'number' && item.price > 0 && (
                <span className="font-black text-sm text-orange-600">{fmtIDR(item.price)}</span>
              )}
              {context && (
                <span className="text-[10px] text-slate-400 font-medium"> {context}</span>
              )}
            </>
          )}
        </div>

        <FavoriteButton
          entityType={favoriteEntityType}
          dedupeKey={item.dedupeKey}
          title={item.title}
          subtitle={item.subtitle}
          price={item.price}
          image={item.image}
          searchParams={item.searchParams}
          className="absolute top-3.5 right-3.5 z-10"
          iconSize="sm"
          savedFavoriteId={item.id}
          currentCollectionId={item.collectionId}
        />

        {/* Chevron ekspansi detail — hanya kartu penerbangan aktif */}
        {isFlight && !expired && hasDetail && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-label={expanded ? t.collapseDetail : t.expandDetail}
            className="absolute right-4 top-14 z-10 p-1 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-xs`}></i>
          </button>
        )}
      </article>

      {/* Konfirmasi hapus item kedaluwarsa (klik kartu) */}
      <ConfirmDialog
        open={expiredConfirmOpen}
        title={t.expiredConfirmTitle}
        message={t.expiredConfirmMessage}
        confirmLabel={tc.confirmBtn}
        cancelLabel={tc.cancelBtn}
        loading={removing}
        onConfirm={doRemoveExpired}
        onCancel={() => setExpiredConfirmOpen(false)}
      />
    </>
  );
}
