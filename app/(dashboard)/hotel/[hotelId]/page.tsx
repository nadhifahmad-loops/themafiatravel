'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

function Stars({ rating }: { rating: any }) {
  const n = parseInt(String(rating)) || 0;
  return (
    <span>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#F97316' : '#D1D5DB', fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

export default function HotelDetailPage() {
  const { hotelId } = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPrice, setSelectedPrice] = useState<any>(null);
  const [provisioning, setProvisioning] = useState(false);

  const searchParams = {
    checkin_date: sp.get('checkin_date') || '',
    checkout_date: sp.get('checkout_date') || '',
    destination_id: sp.get('destination_id') || '',
    hotel_id: String(hotelId),
    adult: parseInt(sp.get('adult') || '2'),
    child: parseInt(sp.get('child') || '0'),
    child_ages: [],
    room: parseInt(sp.get('room') || '1'),
    nationality: sp.get('nationality') || 'ID',
  };

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch('/api/hotel/detail', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchParams),
        });
        const d = await res.json();
        if (d.success) setData(d.data);
      } catch (e) {}
      setLoading(false);
    }
    fetchDetail();
  }, [hotelId]);

  const handleBook = async (price: any) => {
    setProvisioning(true);
    try {
      const provRes = await fetch('/api/hotel/provision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotel_code: String(hotelId), price_code: String(price.price_code) }),
      });
      const provData = await provRes.json();
      const finalPrice = provData.data || price;
      const q = new URLSearchParams({
        hotel_id: String(hotelId),
        price_code: String(price.price_code),
        hotel_name: data?.hotel_code?.name || '',
        total_amount: String(finalPrice.price_total || price.price_total),
        meal_type: price.meal_type || '',
        room_desc: price.rooms?.[0]?.description || '',
        checkin_date: searchParams.checkin_date,
        checkout_date: searchParams.checkout_date,
        adult: String(searchParams.adult),
        child: String(searchParams.child),
        room: String(searchParams.room),
        nationality: searchParams.nationality,
        destination_id: searchParams.destination_id,
      }).toString();
      router.push(`/hotel/checkout?${q}`);
    } catch (e: any) {
      alert('Gagal melakukan provision: ' + e.message);
    }
    setProvisioning(false);
  };

  const hotel = data?.hotel_code;
  const prices: any[] = data?.prices || [];
  const nights = searchParams.checkin_date && searchParams.checkout_date
    ? Math.max(1, Math.round((new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000))
    : 1;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div style={{ width: 40, height: 40, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p className="text-gray-400 text-sm">Memuat detail hotel...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-dark to-orange py-8 px-6">
        <div className="container mx-auto max-w-[1200px]">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-3 transition-colors"
          >
            ← Kembali ke Hasil Pencarian
          </button>
          {hotel && <h1 className="text-xl font-black text-white">{hotel.name}</h1>}
        </div>
      </div>

      <div className="container mx-auto max-w-[1200px] px-6 py-8">
        {hotel && (
          <div className="mb-8">
            {/* Images */}
            {hotel.images?.length > 0 && (
              <div className="grid gap-2 rounded-2xl overflow-hidden mb-6" style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '200px 200px' }}>
                {hotel.images.slice(0, 5).map((img: any, i: number) => (
                  <div key={i} style={{ gridColumn: i === 0 ? '1' : 'auto', gridRow: i === 0 ? 'span 2' : 'auto', background: '#f3f4f6', overflow: 'hidden' }}>
                    <img src={img.url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).parentElement!.style.background = '#e5e7eb'; }} />
                  </div>
                ))}
              </div>
            )}

            {/* Hotel Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="mb-2"><Stars rating={hotel.rating} /></div>
                <h2 className="text-2xl font-black text-dark mb-3">{hotel.name}</h2>
                <p className="text-gray-400 text-sm flex items-start gap-2 mb-3">
                  <span>📍</span><span>{hotel.location?.address}</span>
                </p>
                {hotel.telephone && <p className="text-gray-400 text-sm">📞 {hotel.telephone}</p>}
              </div>

              <div className="bg-white rounded-2xl p-5 border-2 border-orange/20 shadow-sm">
                <h3 className="font-bold text-dark mb-4 text-sm uppercase tracking-wider">📋 Detail Pencarian</h3>
                <div className="flex flex-col gap-3 text-sm">
                  {[
                    { label: 'Check-in', value: searchParams.checkin_date },
                    { label: 'Check-out', value: searchParams.checkout_date },
                    { label: 'Durasi', value: `${nights} malam` },
                    { label: 'Tamu', value: `${searchParams.adult} dewasa` },
                    { label: 'Kamar', value: `${searchParams.room} kamar` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="font-semibold text-dark">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prices */}
        <div>
          <h2 className="text-xl font-black text-dark mb-5">
            Pilih Kamar <span className="text-gray-400 font-normal text-base">({prices.length} pilihan)</span>
          </h2>
          <div className="flex flex-col gap-4">
            {prices.map((price: any, idx: number) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                  selectedPrice === idx ? 'border-orange shadow-md shadow-orange/10' : 'border-gray-100 hover:border-orange/30'
                }`}
                onClick={() => setSelectedPrice(idx)}
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <h3 className="font-bold text-dark text-base">{price.rooms?.[0]?.description || 'Kamar Standar'}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-light text-blue-dark border border-blue/20">
                        {price.provider}
                      </span>
                      {price.availability === 'available' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-600">✓ Tersedia</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-500">
                      <span>🍽️ {price.meal_type || 'Room Only'}</span>
                      <span>👥 {price.rooms?.[0]?.pax?.adult || searchParams.adult} tamu</span>
                    </div>
                    {price.cancellation_policies?.length > 0 && (
                      <p className="text-xs">
                        {price.cancellation_policies[0]?.can_cancel === false || price.cancellation_policies[0]?.cancellation_string?.includes('non-refund')
                          ? <span className="text-red-500">🚫 Non-refundable</span>
                          : <span className="text-green-600">✓ {price.cancellation_policies[0]?.cancellation_string || 'Dapat dibatalkan'}</span>
                        }
                      </p>
                    )}
                  </div>

                  <div className="text-right min-w-[180px]">
                    <p className="text-xs text-gray-400 mb-1">Total {nights} malam</p>
                    <p className="font-black text-orange text-2xl">IDR {price.price_total?.toLocaleString('id-ID')}</p>
                    {price.commission !== 0 && price.commission && (
                      <p className="text-xs text-green-600 mb-2">Komisi: IDR {Math.abs(price.commission).toLocaleString('id-ID')}</p>
                    )}
                    <button
                      onClick={() => handleBook(price)}
                      disabled={provisioning}
                      className="mt-3 w-full py-3 rounded-full font-bold text-white text-sm transition-all"
                      style={{
                        background: provisioning ? '#fdba74' : 'linear-gradient(135deg, #F97316, #EA6B0A)',
                        boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
                        cursor: provisioning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {provisioning ? '⏳ Memproses...' : 'Pesan Sekarang →'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {prices.length === 0 && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                <div className="text-4xl mb-3">😔</div>
                <h3 className="font-bold text-dark text-lg mb-1">Tidak ada kamar tersedia</h3>
                <p className="text-gray-400 text-sm">Coba cari di tanggal atau destinasi lain.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
