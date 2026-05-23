'use client';
import { useRouter } from 'next/navigation';

function getLowestPrice(prices: any): { price: number; provider: string } {
  if (!prices) return { price: 0, provider: '' };
  let lowest = Infinity;
  let lowestProvider = '';
  Object.entries(prices).forEach(([provider, p]: any) => {
    if (p?.price && p.price < lowest) { lowest = p.price; lowestProvider = provider; }
  });
  return { price: lowest === Infinity ? 0 : lowest, provider: lowestProvider };
}

function Stars({ n }: { n: number }) {
  if (!n || n < 1) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={`fa-solid fa-star text-[14px] ${i < n ? 'text-orange-500' : 'text-slate-300'}`}></i>
      ))}
    </div>
  );
}

export default function HotelCard({ hotel, searchParams, nights = 1 }: { hotel: any; searchParams: any; nights?: number }) {
  const router = useRouter();
  const { price, provider } = getLowestPrice(hotel.prices);
  const image = hotel.images?.[0]?.url;
  const rating = parseInt(hotel.rating) || 0;
  const isWithMeal = Object.values(hotel.prices || {}).some((p: any) => p?.is_with_meal);

  // LOGIKA ASLI MILIKMU (TIDAK DIUBAH)
  const handleSelect = () => {
    const q = new URLSearchParams({
      hotel_id: hotel.id,
      checkin_date: searchParams.checkin_date,
      checkout_date: searchParams.checkout_date,
      destination_id: searchParams.destination_id,
      adult: String(searchParams.adult),
      child: String(searchParams.child),
      room: String(searchParams.room),
      nationality: searchParams.nationality,
    }).toString();
    router.push(`/hotel/${hotel.id}?${q}`);
  };

  return (
    <article 
      onClick={handleSelect}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-all duration-300 group cursor-pointer"
    >
      {/* KIRI: Gambar (Width 1/3 di Desktop) */}
      <div className="md:w-1/3 relative min-h-[220px] bg-slate-100 overflow-hidden shrink-0">
        {image ? (
          <img
            src={image}
            alt={hotel.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl text-slate-300 bg-slate-50">🏨</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-50" />
        
        {/* Badge Kiri Atas */}
        <div className="absolute top-4 left-4">
          <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
            <i className="fa-solid fa-hotel text-[10px]"></i> Hotel
          </span>
        </div>

        {/* Favorite Icon Kanan Atas */}
        <button className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shadow-sm">
          <i className="fa-solid fa-heart"></i>
        </button>
      </div>

      {/* KANAN: Konten Detail (Width 2/3 di Desktop) */}
      <div className="md:w-2/3 p-6 flex flex-col flex-grow">
        
        {/* Header Title & Rating */}
        <div className="flex justify-between items-start mb-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xl md:text-2xl text-slate-900 font-display leading-tight">{hotel.name}</h3>
              <Stars n={rating} />
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <i className="fa-solid fa-location-dot text-slate-400 text-lg"></i>
              <span className="truncate max-w-[280px]">
                {[hotel.location?.city, hotel.location?.state, hotel.location?.country_code].filter(Boolean).join(', ')}
              </span>
            </p>
          </div>

          {/* Rating Bubble Kanan Atas */}
          {rating > 0 && (
            <div className="flex flex-col items-end shrink-0 hidden sm:flex">
              <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm border border-blue-100">
                <i className="fa-solid fa-thumbs-up text-sm"></i> 8.{rating}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-wider">Top Pick</span>
            </div>
          )}
        </div>

        {/* Fasilitas & Harga Bawah */}
        <div className="flex-1 flex items-end justify-between mt-6 pt-6 border-t border-slate-100 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                <i className="fa-solid fa-wifi text-slate-400 text-sm"></i> Free Wi-Fi
              </div>
              {isWithMeal && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                  <i className="fa-solid fa-utensils text-slate-400 text-sm"></i> Breakfast incl.
                </div>
              )}
            </div>
            <span className="text-emerald-600 text-xs font-bold flex items-center gap-1.5 mt-1">
              <i className="fa-solid fa-shield-check text-sm"></i> {hotel.state === 'confirm' ? 'Certified Clean' : 'Info Awal'}
            </span>
          </div>

          <div className="flex flex-col items-end shrink-0">
            {price > 0 ? (
              <>
                <span className="font-black text-orange-600 text-2xl font-display leading-none mb-1">
                  IDR {price.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-slate-400 mb-3 uppercase tracking-widest font-bold">per malam · {provider}</span>
                <button className="bg-orange-600 text-white font-bold px-6 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-orange-600/20 hover:bg-orange-700">
                  Lihat Penawaran
                </button>
              </>
            ) : (
              <span className="text-sm font-bold text-slate-400 italic">Harga tidak tersedia</span>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}