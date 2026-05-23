'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const TITLES = ['MR', 'MRS', 'MS', 'MSTR', 'MISS'];
const NATIONALITIES = [
  { code: 'ID', name: 'Indonesia' }, { code: 'SG', name: 'Singapura' },
  { code: 'MY', name: 'Malaysia' }, { code: 'US', name: 'Amerika' },
  { code: 'GB', name: 'Inggris' }, { code: 'AU', name: 'Australia' },
];

function CheckoutContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const hotelId = sp.get('hotel_id') || '';
  const priceCode = sp.get('price_code') || '';
  const hotelName = sp.get('hotel_name') || 'Hotel';
  const totalAmount = parseFloat(sp.get('total_amount') || '0');
  const checkinDate = sp.get('checkin_date') || '';
  const checkoutDate = sp.get('checkout_date') || '';
  const adultCount = parseInt(sp.get('adult') || '1');
  const nights = checkinDate && checkoutDate
    ? Math.max(1, Math.round((new Date(checkoutDate).getTime() - new Date(checkinDate).getTime()) / 86400000)) : 1;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [passengers, setPassengers] = useState<any[]>(
    Array.from({ length: adultCount }, () => ({
      pax_type: 'ADT', first_name: '', last_name: '', title: 'MR',
      nationality_code: 'ID', identity_country_of_issued_code: 'ID'
    }))
  );
  const [contact, setContact] = useState({
    title: 'MR', first_name: '', last_name: '',
    email: session?.user?.email || '', calling_code: '62', mobile: '', nationality_code: 'ID',
  });

  const updatePax = (i: number, k: string, v: string) =>
    setPassengers(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await fetch('/api/hotel/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_code: hotelId, price_code: priceCode, passenger: passengers,
          contact: [contact], booker: contact, special_request: specialRequest,
          total_amount: totalAmount, hotel_name: hotelName,
          search_data: {
            checkin_date: checkinDate, checkout_date: checkoutDate,
            destination_id: sp.get('destination_id') || '', adult: adultCount,
            child: parseInt(sp.get('child') || '0'), child_ages: [],
            room: parseInt(sp.get('room') || '1'), nationality: sp.get('nationality') || 'ID',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuat pesanan');
      if (data.snapToken && typeof (window as any).snap !== 'undefined') {
        (window as any).snap.pay(data.snapToken, {
          onSuccess: () => router.push(`/hotel/confirmation?order=${data.orderId}&status=success`),
          onPending: () => router.push(`/hotel/confirmation?order=${data.orderId}&status=pending`),
          onError: () => { setError('Pembayaran gagal. Coba lagi.'); setLoading(false); },
          onClose: () => setLoading(false),
        });
      } else if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        router.push(`/hotel/confirmation?order=${data.orderId}&status=pending`);
      }
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const inputCls = "w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-dark text-sm outline-none focus:border-orange focus:bg-white transition-all form-input";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5";

  return (
    <>
      <script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} async />
      <style>{`.form-input:focus { border-color: #F97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.1) !important; }`}</style>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-dark to-orange py-8 px-6">
          <div className="container mx-auto max-w-[1020px]">
            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-3 transition-colors">
              ← Kembali
            </button>
            <h1 className="text-2xl font-black text-white mb-1">Lengkapi Pesanan</h1>
            <p className="text-white/70 text-sm">Masukkan data tamu untuk menyelesaikan pemesanan</p>
          </div>
        </div>

        <div className="container mx-auto max-w-[1020px] px-6 py-8">
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-red-600 text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Passengers */}
              {passengers.map((pax, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-black text-dark text-base mb-5 flex items-center gap-2">
                    <span className="w-7 h-7 bg-orange text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    Tamu {i + 1} {i === 0 && <span className="text-xs text-gray-400 font-normal">(Tamu Utama)</span>}
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Sapaan</label>
                      <select value={pax.title} onChange={e => updatePax(i, 'title', e.target.value)} className={inputCls}>
                        {TITLES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Nama Depan</label>
                      <input value={pax.first_name} onChange={e => updatePax(i, 'first_name', e.target.value.toUpperCase())} required placeholder="JOHN" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nama Belakang</label>
                      <input value={pax.last_name} onChange={e => updatePax(i, 'last_name', e.target.value.toUpperCase())} required placeholder="DOE" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Kewarganegaraan</label>
                      <select value={pax.nationality_code} onChange={e => updatePax(i, 'nationality_code', e.target.value)} className={inputCls}>
                        {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.name} ({n.code})</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {/* Contact */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-black text-dark text-base mb-5">📞 Data Kontak</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nama Depan</label>
                    <input value={contact.first_name} onChange={e => setContact(c => ({ ...c, first_name: e.target.value }))} required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nama Belakang</label>
                    <input value={contact.last_name} onChange={e => setContact(c => ({ ...c, last_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Email</label>
                    <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Kode Negara</label>
                    <input value={contact.calling_code} onChange={e => setContact(c => ({ ...c, calling_code: e.target.value }))} placeholder="62" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nomor HP</label>
                    <input value={contact.mobile} onChange={e => setContact(c => ({ ...c, mobile: e.target.value }))} required placeholder="08123456789" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Special Request */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-black text-dark text-base mb-4">
                  💬 Permintaan Khusus <span className="text-gray-400 font-normal text-sm">(opsional)</span>
                </h2>
                <textarea
                  value={specialRequest}
                  onChange={e => setSpecialRequest(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Non-smoking room, high floor, extra pillow, late check-in..."
                  className={`${inputCls} resize-y`}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-full font-bold text-white text-base transition-all flex items-center justify-center gap-2"
                style={{
                  background: loading ? '#fdba74' : 'linear-gradient(135deg, #F97316, #EA6B0A)',
                  boxShadow: loading ? 'none' : '0 6px 24px rgba(249,115,22,0.3)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '⏳ Memproses...' : '💳 Lanjut ke Pembayaran'}
              </button>
            </form>

            {/* Order Summary */}
            <div className="bg-white rounded-2xl border-2 border-orange/20 shadow-sm p-6 sticky top-20">
              <h3 className="font-black text-dark text-base mb-4">📋 Ringkasan Pesanan</h3>
              <div className="bg-orange-light rounded-xl p-4 mb-4">
                <p className="font-bold text-dark text-sm mb-3">{hotelName}</p>
                <div className="space-y-2 text-xs">
                  {[
                    ['📅 Check-in', checkinDate],
                    ['📅 Check-out', checkoutDate],
                    ['🌙 Durasi', `${nights} malam`],
                    ['👥 Tamu', `${adultCount} dewasa`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-semibold text-dark">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {sp.get('room_desc') && (
                <p className="text-xs text-gray-400 mb-4">🛏️ {sp.get('room_desc')}</p>
              )}
              <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-dark">IDR {totalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Biaya layanan</span>
                  <span className="text-green-600 font-semibold">Gratis</span>
                </div>
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
                <span className="font-bold text-dark">Total</span>
                <span className="font-black text-orange text-xl">IDR {totalAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-center text-xs text-green-600 font-medium">
                🔒 Pembayaran aman via Midtrans
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div style={{ width: 32, height: 32, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
