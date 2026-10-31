/**
 * Kartu promo di homepage (pesawat / hotel / kereta).
 *
 * Berupa <a> asli (bukan div onClick) supaya bisa dibuka di tab baru, dan halaman
 * punya link internal yang bisa di-crawl. `rel="nofollow"` karena URL membawa
 * tanggal yang berubah tiap hari — hindari pemborosan crawl budget.
 * Prefetch sengaja tidak dipakai: URL membawa `autoSearch=1` yang akan memicu
 * pencarian provider saat di-prefetch.
 */

export type PromoCardVariant = 'flight' | 'hotel' | 'train';

export interface PromoCardProps {
  href: string;
  img: string;
  title: string;
  /** Rp 684.400 — atau Rp 750.000/malam untuk hotel */
  price: string;
  /** "s.d. 30 Nov 2026" — kosong bila promo tanpa batas */
  dateText: string;
  variant: PromoCardVariant;
  badge?: string | null;
  city?: string | null;
  airline?: string | null;
  airlineImg?: string | null;
  /** Gambar cadangan bila gambar utama gagal dimuat (hanya kereta). */
  fallbackImg?: string;
}

export default function PromoCard({
  href, img, title, price, dateText, variant, badge, city, airline, airlineImg, fallbackImg,
}: PromoCardProps) {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (fallbackImg && el.src !== fallbackImg) {
      el.src = fallbackImg;
      return;
    }
    // Gambar rusak → sembunyikan, jangan tampilkan gambar salah kota.
    el.style.display = 'none';
  };

  return (
    <a
      href={href}
      rel="nofollow"
      className="flex-none w-[240px] sm:w-[280px] block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer snap-start transition-colors hover:border-slate-200"
    >
      <div className="relative overflow-hidden h-[150px] bg-slate-100">
        <img src={img} alt={title} onError={handleImageError} className="w-full h-full object-cover" />

        {variant === 'hotel' ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
            <i className="fa-solid fa-location-dot text-[10px]" />
            {city}
          </span>
        ) : (
          badge && (
            <span className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
              {badge}
            </span>
          )
        )}
      </div>

      <div className="px-3 pt-2.5 pb-3">
        <p
          className={`text-sm font-bold text-slate-900 leading-snug ${variant === 'hotel' ? 'line-clamp-2' : 'truncate'}`}
          title={title}
        >
          {title}
        </p>

        <div className="flex items-center gap-1.5 mt-1.5">
          {variant === 'flight' && airlineImg ? (
            <img src={airlineImg} alt={airline || ''} title={airline || undefined} className="w-4 h-4 object-contain shrink-0" />
          ) : (
            <i className={`fa-solid ${variant === 'train' ? 'fa-train' : 'fa-calendar-check'} text-[11px] text-slate-400`} />
          )}
          {dateText && <span className="text-xs text-slate-400 truncate">{dateText}</span>}
        </div>

        <p className="text-brand-orange font-extrabold text-sm mt-1.5">{price}</p>
      </div>
    </a>
  );
}
