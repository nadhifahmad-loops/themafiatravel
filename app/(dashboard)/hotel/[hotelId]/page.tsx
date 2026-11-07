'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

// ─── Lightbox Modal ───────────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }: { images: any[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);

  const img = images[current];

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/60 text-sm font-semibold">
          {current + 1} / {images.length} foto
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <i className="fa-solid fa-xmark text-white text-base"></i>
        </button>
      </div>

      {/* Main image */}
      <div
        className="flex-1 flex items-center justify-center relative px-14 min-h-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Prev button */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors z-10"
        >
          <i className="fa-solid fa-chevron-left text-white"></i>
        </button>

        {/* Image */}
        <div className="w-full h-full flex items-center justify-center">
          <img
            key={current}
            src={img?.url}
            alt={img?.description || `Foto ${current + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
            onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x500/1e293b/475569?text=Foto+tidak+tersedia'; }}
          />
        </div>

        {/* Next button */}
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors z-10"
        >
          <i className="fa-solid fa-chevron-right text-white"></i>
        </button>
      </div>

      {/* Thumbnail strip */}
      <div
        className="shrink-0 px-4 py-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 justify-center scrollbar-hide">
          {images.map((img: any, i: number) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === current ? 'border-orange-500 scale-110' : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/50'
              }`}
            >
              <img
                src={img.url}
                alt={`thumb ${i + 1}`}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stars({ rating }: { rating: any }) {
  const n = parseInt(String(rating)) || 0;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={`fa-solid fa-star text-[12px] ${i < n ? 'text-amber-400' : 'text-slate-200'}`} />
      ))}
    </span>
  );
}

function MealBadge({ mealType }: { mealType: string }) {
  const isWithMeal = mealType && mealType !== 'ROOM ONLY' && mealType !== 'RO' && mealType !== 'Room Only';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
      isWithMeal
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-50 text-slate-500 border-slate-200'
    }`}>
      <i className={`fa-solid ${isWithMeal ? 'fa-utensils' : 'fa-bed'} text-[9px]`} />
      {isWithMeal ? (mealType || 'Termasuk Makan') : 'Room Only'}
    </span>
  );
}

function CancellationBadge({ policies }: { policies: any[] }) {
  if (!policies || policies.length === 0) return null;
  const pol = policies[0];
  const nonRefund =
    pol?.can_cancel === false ||
    pol?.cancellation_string?.toLowerCase().includes('non-refund') ||
    pol?.description === null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${nonRefund ? 'text-red-500' : 'text-emerald-600'}`}>
      <i className={`fa-solid ${nonRefund ? 'fa-ban' : 'fa-shield-check'} text-xs`} />
      {nonRefund ? 'Non-refundable' : (pol?.cancellation_string || 'Dapat dibatalkan')}
    </span>
  );
}

function HotelDetailContent() {
  const { language } = useLanguage();
  const t = i18n.hotelDetail[language];
  const tc = i18n.common[language];
  const { hotelId } = useParams();
  const sp = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [selectedPriceIdx, setSelectedPriceIdx] = useState<number | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionMsg, setProvisionMsg] = useState('');
  const [pendingPriceChange, setPendingPriceChange] = useState<{
    checkoutUrl: string;
    oldPrice: number;
    newPrice: number;
  } | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);
  
  // 🌟 STATE BARU UNTUK POPUP MODAL ERROR
  const [showErrorModal, setShowErrorModal] = useState(false);

  usePageTitle(data?.hotel_name || 'Detail Hotel');

  const searchParams = {
    checkin_date: sp.get('checkin_date') || '',
    checkout_date: sp.get('checkout_date') || '',
    destination_id: sp.get('destination_id') || '',
    hotel_id: String(hotelId),
    adult: parseInt(sp.get('adult') || '2'),
    child: parseInt(sp.get('child') || '0'),
    child_ages: (() => {
      try {
        const raw = sp.get('child_ages');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })(),
    room: parseInt(sp.get('room') || '1'),
    nationality: sp.get('nationality') || 'ID',
  };

  const nights = searchParams.checkin_date && searchParams.checkout_date
    ? Math.max(1, Math.round(
        (new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000
      ))
    : 1;

  useEffect(() => {
    // AbortController mencegah request duplikat/stale (mis. React StrictMode
    // yang sengaja meng-invoke effect 2x di dev, atau re-render cepat lainnya)
    // benar-benar mengenai vendor. Setiap kali effect ini dijalankan ulang,
    // fetch sebelumnya (jika masih berjalan) langsung dibatalkan, jadi hanya
    // SATU panggilan get_details yang benar-benar sampai ke Orbis/vendor —
    // ini penting karena tiap get_details membuat sesi cache room baru di
    // vendor (MG Bedbank), dan panggilan ganda bisa bikin cache yang dipakai
    // user untuk booking jadi tidak match lagi saat provision.
    const controller = new AbortController();

    async function fetchDetail() {
      setLoading(true);
      setError('');
      setErrorCode('');
      setProvisionMsg('');
      setSelectedPriceIdx(null);
      try {
        const res = await fetch('/api/hotel/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkin_date: searchParams.checkin_date,
            checkout_date: searchParams.checkout_date,
            destination_id: searchParams.destination_id,
            hotel_id: searchParams.hotel_id,
            adult: searchParams.adult,
            child: searchParams.child,
            child_ages: searchParams.child_ages,
            room: searchParams.room,
            nationality: searchParams.nationality,
          }),
          signal: controller.signal,
        });
        const d = await res.json();
        if (!res.ok || !d.success) {
          if (typeof d.code === 'string') setErrorCode(d.code);
          throw new Error(d.error || 'Gagal memuat detail hotel');
        }
        setData(d.data);
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // request lama dibatalkan, abaikan
        setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchDetail();

    return () => controller.abort();
  }, [hotelId, searchParams.checkin_date, searchParams.checkout_date, searchParams.destination_id, searchParams.adult, searchParams.child, searchParams.room, searchParams.nationality, retryKey]);

  const handleBook = async (price: any) => {
    setProvisioning(true);
    setProvisionMsg('');
    setPendingPriceChange(null);
    setShowErrorModal(false);

    try {
      if (!searchParams.checkin_date || !searchParams.checkout_date) {
        throw new Error('Silakan pilih tanggal stay terlebih dahulu.');
      }

      // Kirim provider DAN vendor_price_code — provision akan gunakan sebagai kandidat utama
      const detailProvider = price.provider || '';
      const detailPriceCode = String(price.price_code || '');
      console.log('[PROVISION] hotel_code:', hotelId, '| provider:', detailProvider, '| price_code:', detailPriceCode);

      const provRes = await fetch('/api/hotel/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_code: String(hotelId),
          vendor_price_code: detailPriceCode,
          provider: detailProvider,
          search_data: {
            checkin_date: searchParams.checkin_date,
            checkout_date: searchParams.checkout_date,
            destination_id: searchParams.destination_id,
            adult: searchParams.adult,
            child: searchParams.child,
            child_ages: searchParams.child_ages,
            room: searchParams.room,
            nationality: searchParams.nationality,
          },
        }),
      });
      const provData = await provRes.json();

      if (!provRes.ok || (!provData.success && !provData.priceChanged)) {
        throw new Error(provData.error || 'Gagal memverifikasi harga kamar');
      }

      if (provData.fallback) {
        setProvisionMsg('⚠️ ' + (provData.fallbackMsg || 'Harga belum diverifikasi ulang. Harga final akan dikonfirmasi saat booking.'));
      } else if (provData.priceChanged) {
        setProvisionMsg(provData.priceChangedMsg || 'Harga kamar telah berubah. Harga terbaru sudah diperbarui.');
      }

      const finalPrice = provData.data || price;
      const totalAmount = Number(finalPrice.price_total);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new Error('Harga terbaru kamar tidak tersedia. Silakan pilih kamar lain atau coba lagi.');
      }
      // Provision mengubah kode hasil get_details menjadi kode vendor yang dipakai
      // action booked. Checkout tidak boleh mengirim ulang kode get_details.
      const checkoutPriceCode = provData.selectedPriceCode || finalPrice.price_code || String(price.price_code || '');
      const q = new URLSearchParams({
        hotel_id: String(hotelId),
        price_code: checkoutPriceCode,
        hotel_name: data?.hotel_code?.name || '',
        total_amount: String(totalAmount),
        meal_type: finalPrice.meal_type || price.meal_type || '',
        room_desc: (finalPrice.rooms?.[0]?.description || price.rooms?.[0]?.description || ''),
        provider: provData.selectedProvider || finalPrice.provider || price.provider || '',
        checkin_date: searchParams.checkin_date,
        checkout_date: searchParams.checkout_date,
        adult: String(searchParams.adult),
        child: String(searchParams.child),
        room: String(searchParams.room),
        nationality: searchParams.nationality,
        child_ages: JSON.stringify(searchParams.child_ages),
        destination_id: searchParams.destination_id,
        nights: String(nights),
      }).toString();

      const checkoutUrl = `/hotel/checkout?${q}`;
      if (provData.priceChanged) {
        setPendingPriceChange({
          checkoutUrl,
          oldPrice: Number(price.price_total),
          newPrice: totalAmount,
        });
        setProvisioning(false);
        return;
      }
      router.push(checkoutUrl);
    } catch (e: any) {
      const message = e?.message || 'Gagal memproses kamar. Silakan coba lagi.';
      setProvisionMsg('❌ ' + message);
      setShowErrorModal(true);
      setProvisioning(false);
    }
  };

  const hotel = data?.hotel_code;
  const prices: any[] = data?.prices || [];
  const selectedPrice = selectedPriceIdx !== null ? prices[selectedPriceIdx] : null;

  const fmt = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  // Loading
  if (loading) return (
    <div className="min-h-screen bg-brand-bgLight pt-20">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8 space-y-5">
        <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-[350px] bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-40 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
        {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  // Error
  if (error) {
    const isOutage = errorCode === 'HOTEL_PROVIDER_UNAVAILABLE';
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bgLight px-4 pt-20">
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${isOutage ? 'bg-amber-50' : 'bg-red-50'}`}>
            <i className={`fa-solid ${isOutage ? 'fa-cloud-arrow-down text-amber-400' : 'fa-circle-exclamation text-red-300'} text-3xl`}></i>
          </div>
          <h2 className="mb-2 text-xl font-black text-slate-900">
            {isOutage
              ? (language === 'EN' ? 'Hotel service is temporarily unavailable' : 'Layanan hotel sedang terganggu')
              : (language === 'EN' ? 'Could not load hotel details' : 'Gagal memuat detail hotel')}
          </h2>
          <p className="mb-6 text-sm leading-6 text-slate-500">{error}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => setRetryKey((value) => value + 1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600"
            >
              <i className="fa-solid fa-rotate-right text-xs"></i>
              {language === 'EN' ? 'Try again' : 'Coba lagi'}
            </button>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              ← {tc.back}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bgLight pb-24 pt-20 relative">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-16 z-30">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-500 hover:text-orange-600 text-sm font-bold transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            {tc.back}
          </button>
          {hotel && (
            <>
              <span className="text-slate-200">·</span>
              <h1 className="text-sm font-black text-slate-900 truncate">{hotel.name}</h1>
              <Stars rating={hotel.rating} />
            </>
          )}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
        {hotel && (
          <>
            {/* ── Image gallery ── */}
            {hotel.images?.length > 0 && (
              <div className="mb-6">
                {/* Grid: main photo + 4 thumbnails */}
                <div className="grid gap-2 rounded-2xl overflow-hidden grid-cols-1 md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2">
                  {hotel.images.slice(0, 5).map((img: any, i: number) => (
                    <div
                      key={i}
                      className={`relative overflow-hidden bg-slate-100 cursor-pointer group h-[220px] md:h-auto ${i === 0 ? 'md:row-span-2' : ''}`}
                      onClick={() => { setLightboxStart(i); setLightboxOpen(true); }}
                    >
                      <img
                        src={img.url}
                        alt={`${hotel.name} ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <i className="fa-solid fa-magnifying-glass-plus text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"></i>
                      </div>
                      {/* "+N more" overlay on last visible tile */}
                      {i === 4 && hotel.images.length > 5 && (
                        <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1 pointer-events-none">
                          <span className="text-white font-black text-2xl">+{hotel.images.length - 5}</span>
                          <span className="text-white/70 text-xs font-semibold">lihat semua foto</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* "Lihat semua foto" button */}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => { setLightboxStart(0); setLightboxOpen(true); }}
                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors bg-white border border-slate-200 hover:border-orange-300 rounded-xl px-4 py-2 shadow-sm"
                  >
                    <i className="fa-solid fa-images text-orange-400"></i>
                    Lihat semua {hotel.images.length} foto
                  </button>
                </div>
              </div>
            )}

            {/* Lightbox */}
            {lightboxOpen && hotel.images?.length > 0 && (
              <Lightbox
                images={hotel.images}
                startIndex={lightboxStart}
                onClose={() => setLightboxOpen(false)}
              />
            )}

            {/* ── Hotel info + search summary ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 mb-6">
              <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-orange-500/10 via-amber-300/10 to-sky-500/10" />
                <div className="relative p-5 sm:p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
                        <i className="fa-solid fa-hotel text-xl" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars rating={hotel.rating} />
                          {Number(hotel.rating) > 0 && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">
                              {Number(hotel.rating).toFixed(1)}
                            </span>
                          )}
                          {hotel.ribbon && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700">
                              <i className="fa-solid fa-star text-[8px]" /> {hotel.ribbon}
                            </span>
                          )}
                        </div>
                        <h2 className="mt-1.5 text-xl font-black leading-tight text-slate-900 sm:text-2xl">{hotel.name}</h2>
                        {hotel.location?.address && (
                          <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                            <i className="fa-solid fa-location-dot mt-0.5 shrink-0 text-orange-400" />
                            {hotel.location.address}
                          </p>
                        )}
                        {hotel.telephone && (
                          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                            <i className="fa-solid fa-phone text-xs text-slate-300" />
                            {hotel.telephone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:shrink-0">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.checkin}</p>
                        <p className="mt-0.5 text-xs font-black text-slate-700">{fmt(searchParams.checkin_date)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.checkout}</p>
                        <p className="mt-0.5 text-xs font-black text-slate-700">{fmt(searchParams.checkout_date)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Hotel facilities — dari doc §3.4.1.3 hotel.facilities */}
                  {hotel.facilities?.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                      {hotel.facilities.slice(0, 8).map((f: any, fi: number) => (
                        <span key={fi} className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                          <i className="fa-solid fa-check text-[8px] text-emerald-500" />
                          {typeof f === 'string' ? f : f.name || f.description || ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Map — dari doc §3.4.1.3 hotel.lat / hotel.long */}
                  {hotel.lat && hotel.long && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                      <a
                        href={`https://www.google.com/maps?q=${hotel.lat},${hotel.long}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block"
                      >
                        <img
                          src={`https://maps.googleapis.com/maps/api/staticmap?center=${hotel.lat},${hotel.long}&zoom=15&size=600x200&maptype=roadmap&markers=color:orange%7C${hotel.lat},${hotel.long}&key=`}
                          alt={`Peta ${hotel.name}`}
                          className="h-[140px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={e => {
                            // Fallback: tampilkan link Google Maps tanpa gambar
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.map-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'map-fallback flex h-[140px] items-center justify-center gap-2 bg-slate-50 text-sm text-slate-400';
                              fallback.innerHTML = '<i class="fa-solid fa-map-location-dot text-orange-300"></i> Lihat di Google Maps';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
                            <i className="fa-solid fa-up-right-from-square text-[10px]"></i>
                            Buka di Maps
                          </span>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Search summary sticky card */}
              <div className="self-start overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm lg:sticky lg:top-32">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white">
                  <h3 className="flex items-center gap-2 text-sm font-black">
                    <i className="fa-solid fa-calendar-check text-orange-400 text-xs"></i>
                    Detail Pencarian
                  </h3>
                  <p className="mt-1 text-[11px] text-white/60">Ringkasan tanggal dan tamu untuk stay ini.</p>
                </div>
                <div className="space-y-3 p-5">
                  {[
                    { label: t.checkin, value: fmt(searchParams.checkin_date), icon: 'fa-calendar-day' },
                    { label: t.checkout, value: fmt(searchParams.checkout_date), icon: 'fa-calendar-day' },
                    { label: 'Durasi', value: `${nights} ${tc.night}`, icon: 'fa-moon' },
                    { label: t.guests, value: `${searchParams.adult} ${tc.adult}${searchParams.child > 0 ? `, ${searchParams.child} ${tc.child}` : ''}`, icon: 'fa-users' },
                    { label: tc.room, value: `${searchParams.room} ${tc.room}`, icon: 'fa-door-open' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        <i className={`fa-solid ${item.icon} w-3.5 text-[11px] text-slate-300`} />
                        {item.label}
                      </span>
                      <span className="text-right text-xs font-bold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-black text-orange-700 transition hover:bg-orange-100"
                  >
                    <i className="fa-solid fa-pen-to-square text-[10px]" />
                    Ubah Pencarian
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Provision message (Inline) ── */}
        {provisionMsg && !showErrorModal && !pendingPriceChange && (
          <div className={`mb-5 p-4 rounded-xl text-sm font-medium flex items-start gap-3 ${
            provisionMsg.startsWith('❌')
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            <i className={`fa-solid ${provisionMsg.startsWith('❌') ? 'fa-circle-xmark' : 'fa-triangle-exclamation'} mt-0.5 shrink-0`} />
            <span>{provisionMsg}</span>
          </div>
        )}
        {pendingPriceChange && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">{provisionMsg || (language === 'EN' ? 'The room price changed after verification.' : 'Harga kamar berubah setelah diverifikasi.')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-slate-600 line-through">Rp{pendingPriceChange.oldPrice.toLocaleString('id-ID')}</span>
              <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
              <strong>Rp{pendingPriceChange.newPrice.toLocaleString('id-ID')}</strong>
              <span className="text-slate-600">
                {language === 'EN' ? 'for the selected rooms and full stay.' : 'untuk seluruh masa inap dan kamar yang dipilih.'}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(pendingPriceChange.checkoutUrl)}
                className="rounded-lg bg-orange-600 px-4 py-2 font-bold text-white transition hover:bg-orange-700"
              >
                {language === 'EN' ? 'Continue with new price' : 'Lanjutkan dengan harga baru'}
              </button>
              <button
                type="button"
                onClick={() => { setPendingPriceChange(null); setProvisionMsg(''); }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {language === 'EN' ? 'Choose another room' : 'Pilih kamar lain'}
              </button>
            </div>
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-700">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-circle-check mt-0.5" />
            <div>
              <p className="font-black">Informasi kamar selalu diperbarui</p>
              <p className="mt-1 text-emerald-700/80">Kami memverifikasi harga dan ketersediaan sebelum Anda melanjutkan ke pembayaran.</p>
            </div>
          </div>
        </div>

        {/* ── Room list ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {t.selectRoom}
                {prices.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-400">({prices.length} pilihan)</span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Semua harga sudah termasuk pajak · {nights} {tc.night} · {searchParams.adult} tamu
              </p>
            </div>
          </div>

          {prices.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                <i className="fa-solid fa-bed text-3xl text-orange-300"></i>
              </div>
              <h3 className="font-black text-slate-800 text-lg mb-2">{t.noRooms}</h3>
              <p className="text-slate-500 text-sm mb-6">Coba pilih tanggal lain, ubah jumlah tamu, atau cari hotel lain untuk melanjutkan.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => router.back()} className="px-6 py-2.5 bg-orange-500 text-white font-bold rounded-xl text-sm hover:bg-orange-600 transition-colors">
                  Ubah Pencarian
                </button>
                <button onClick={() => router.push('/hotel/search')} className="px-6 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  Cari Hotel Lain
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {prices.map((price: any, idx: number) => {
              const isSelected = selectedPriceIdx === idx;
              const pricePerNight = Math.round((price.price_total || 0) / nights);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPriceIdx(isSelected ? null : idx)}
                  className={`bg-white rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-orange-500 shadow-lg shadow-orange-100/60'
                      : 'border-slate-100 hover:border-orange-200 hover:shadow-md'
                  }`}
                >
                  {/* Room header */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">

                    {/* Left: room info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <h3 className="font-black text-slate-900 text-base">
                          {price.rooms?.[0]?.description || 'Kamar Standar'}
                        </h3>
                        {price.availability === 'available' && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fa-solid fa-circle text-[6px]"></i> Tersedia
                          </span>
                        )}
                        {price.availability === 'on_request' && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                            ⏳ On Request
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        <MealBadge mealType={price.meal_type} />
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                          <i className="fa-solid fa-user text-[9px] text-slate-400"></i>
                          {price.rooms?.[0]?.pax?.adult || searchParams.adult} tamu
                        </span>
                        {price.rooms?.[0]?.extra_bed > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                            <i className="fa-solid fa-bed text-[9px] text-slate-400"></i>
                            +{price.rooms[0].extra_bed} extra bed
                          </span>
                        )}
                      </div>

                      <CancellationBadge policies={price.cancellation_policies} />

                      {/* Room facilities — dari doc §3.4.1.4 price.rooms.room_facilities */}
                      {price.rooms?.[0]?.room_facilities?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {price.rooms[0].room_facilities.slice(0, 5).map((f: any, fi: number) => (
                            <span key={fi} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                              <i className="fa-solid fa-check text-[8px] text-emerald-400"></i>
                              {typeof f === 'string' ? f : f.name || f.description || ''}
                            </span>
                          ))}
                          {price.rooms[0].room_facilities.length > 5 && (
                            <span className="text-[10px] text-slate-400">+{price.rooms[0].room_facilities.length - 5} lagi</span>
                          )}
                        </div>
                      )}

                      {/* Room size — dari doc §3.4.1.4 price.rooms.room_size */}
                      {price.rooms?.[0]?.room_size?.size > 0 && (
                        <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                          <i className="fa-solid fa-ruler-combined text-[9px] text-slate-300"></i>
                          {price.rooms[0].room_size.size} {price.rooms[0].room_size.unit || 'm²'}
                        </p>
                      )}

                      {/* Supplement notes */}
                      {price.rooms?.[0]?.supplements?.filter((s: any) => s.name?.trim()).slice(0, 1).map((s: any, si: number) => (
                        <p key={si} className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          <i className="fa-solid fa-circle-info text-slate-300 mr-1"></i>
                          {s.name}
                        </p>
                      ))}
                    </div>

                    {/* Right: price + CTA */}
                    <div className="sm:text-right flex flex-col sm:items-end gap-2 sm:min-w-[190px] shrink-0">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">{tc.total} {nights} {tc.night}</p>
                        <p className="font-black text-orange-600 text-2xl leading-none">
                          IDR {(price.price_total || 0).toLocaleString('id-ID')}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          IDR {pricePerNight.toLocaleString('id-ID')} {t.perNight}
                        </p>
                      </div>

                      <button
                        onClick={e => { e.stopPropagation(); handleBook(price); }}
                        disabled={provisioning}
                        className="mt-1 w-full sm:w-auto px-5 py-3 rounded-xl font-black text-white text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-200 flex items-center justify-center gap-2"
                      >
                        {provisioning ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                            Memproses...
                          </>
                        ) : (
                          <>
                            {t.bookNow}
                            <i className="fa-solid fa-arrow-right text-xs"></i>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail row */}
                  {isSelected && (
                    <div className="border-t border-orange-100 bg-orange-50/40 px-5 py-4 flex flex-wrap gap-4 text-xs text-slate-600">
                      {price.rooms?.[0]?.bed_type && (
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-bed text-orange-400 text-[10px]"></i>
                          <span className="font-medium">Tipe tempat tidur:</span>
                          <span className="font-bold">{price.rooms[0].bed_type}</span>
                        </div>
                      )}
                      {price.currency && (
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-coins text-orange-400 text-[10px]"></i>
                          <span className="font-medium">{tc.currency}:</span>
                          <span className="font-bold">{price.currency}</span>
                        </div>
                      )}
                      {price.cancellation_policies?.[0]?.cancellation_string && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <i className="fa-solid fa-shield text-orange-400 text-[10px]"></i>
                          <span>{price.cancellation_policies[0].cancellation_string}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedPrice && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Kamar terpilih</p>
              <p className="truncate text-sm font-black text-slate-900">
                {selectedPrice.rooms?.[0]?.description || 'Kamar Standar'}
              </p>
              <p className="text-xs text-slate-500">
                {selectedPrice.meal_type ? `${selectedPrice.meal_type} · ` : ''}{nights} {tc.night} · {searchParams.adult} tamu
              </p>
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <div className="text-right">
                <p className="text-[11px] text-slate-400">{tc.total} {nights} {tc.night}</p>
                <p className="text-lg font-black text-orange-600">
                  IDR {(selectedPrice.price_total || 0).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleBook(selectedPrice); }}
                disabled={provisioning}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-orange-200 transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {provisioning ? (
                  <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Memproses...</>
                ) : (
                  <><i className="fa-solid fa-arrow-right text-xs"></i> Lanjut Checkout</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL POP-UP ERROR PROVISIONING */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500"></i>
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-2">
              Kamar Tidak Tersedia
            </h3>
            
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              {provisionMsg.replace('❌ ', '')}
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  router.back(); // Kembali ke halaman pencarian sebelumnya
                }}
                className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black rounded-xl hover:from-orange-700 hover:to-orange-600 transition-all shadow-lg shadow-orange-500/30 active:scale-95"
              >
                <i className="fa-solid fa-magnifying-glass mr-2"></i>
                Cari Tanggal / Hotel Lain
              </button>
              
              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full py-3.5 bg-slate-50 text-slate-500 font-bold rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                Tutup & Pilih Kamar Lain
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function HotelDetailPage() {
  const { language } = useLanguage();
  const t = i18n.hotelDetail[language];
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bgLight flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">{t.loading}</p>
        </div>
      </div>
    }>
      <HotelDetailContent />
    </Suspense>
  );
}