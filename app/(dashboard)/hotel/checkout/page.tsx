'use client';
import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import LeaveGuard from '@/components/checkout/LeaveGuard';
import CheckoutLoadingOverlay from '@/components/checkout/CheckoutLoadingOverlay';
import CheckoutNavbar from '@/components/layout/CheckoutNavbar';
import CheckoutStepBar from '@/components/checkout/CheckoutStepBar';
import PayButton from '@/components/checkout/PayButton';
import MobileCheckoutBar from '@/components/checkout/MobileCheckoutBar';
import SectionHeader from '@/components/checkout/SectionHeader';
import TermsModal from '@/components/checkout/TermsModal';
import TermsAgreementText from '@/components/checkout/TermsAgreementText';
import { useIdempotencyKey } from '@/components/hooks/useIdempotencyKey';
import CouponInput from '@/components/checkout/CouponInput';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { buildCheckoutCallbackUrl } from '@/lib/checkout-utils';

type Passenger = {
  pax_type: string;
  first_name: string;
  last_name: string;
  title: string;
  nationality_code: string;
  identity_country_of_issued_code: string;
};

type Contact = {
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  calling_code: string;
  mobile: string;
  nationality_code: string;
};

type SnapHandler = {
  pay: (token: string, options: Record<string, () => void>) => void;
};

declare global {
  interface Window {
    snap?: SnapHandler;
  }
}

interface MarkupSettings { flight: number; hotel: number; train: number; insurance: number; }

const TITLES = ['MR', 'MRS', 'MS', 'MSTR', 'MISS'];
const NATIONALITIES = [
  { code: 'ID', name: 'Indonesia' },
  { code: 'SG', name: 'Singapura' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'US', name: 'Amerika Serikat' },
  { code: 'GB', name: 'Inggris' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Jepang' },
  { code: 'CN', name: 'Tiongkok' },
];

function formatDateShort(value: string) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function CheckoutContent() {
  const { language } = useLanguage();
  const t = i18n.hotelCheckout[language];
  const tc = i18n.common[language];
  // Label stepper langkah + teks CTA mobile (konsisten antar modul checkout).
  const cs = i18n.checkoutSteps[language];
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  // Callback agar guest kembali ke halaman checkout ini setelah login/register.
  const checkoutCallbackUrl = buildCheckoutCallbackUrl(pathname, sp.toString());

  const hotelId       = sp.get('hotel_id') || '';
  const priceCode     = sp.get('price_code') || '';
  const hotelName     = sp.get('hotel_name') || 'Hotel';
  const totalAmount   = parseFloat(sp.get('total_amount') || '0') || 0;
  const checkinDate   = sp.get('checkin_date') || '';
  const checkoutDate  = sp.get('checkout_date') || '';
  const adultCount    = Math.max(1, parseInt(sp.get('adult') || '1') || 1);
  const mealType      = sp.get('meal_type') || 'Room Only';
  const roomDesc      = sp.get('room_desc') || '';
  const provider      = sp.get('provider') || '';
  const nightsParam   = parseInt(sp.get('nights') || '1');

  usePageTitle(`Pembayaran Hotel: ${hotelName}`);

  const nights = useMemo(() => {
    if (!checkinDate || !checkoutDate) return Math.max(1, nightsParam);
    const diff = Math.round((new Date(checkoutDate).getTime() - new Date(checkinDate).getTime()) / 86400000);
    return Math.max(1, diff);
  }, [checkinDate, checkoutDate, nightsParam]);

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  // SATU Idempotency-Key per attempt checkout. Dibuat sekali di mount sehingga
  // klik ganda memakai key yang SAMA dan server bisa mengenali keduanya sebagai
  // satu permintaan — walau lolos guard, eksekusi tetap hanya satu.
  const idempotencyKey = useIdempotencyKey();
  const [error, setError] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [passengers, setPassengers] = useState<Passenger[]>(
    Array.from({ length: Math.max(1, adultCount) }, () => ({
      pax_type: 'ADT', first_name: '', last_name: '', title: 'MR',
      nationality_code: 'ID', identity_country_of_issued_code: 'ID',
    }))
  );
  const [contact, setContact] = useState<Contact>({
    title: 'MR', first_name: '', last_name: '', email: '', calling_code: '62', mobile: '', nationality_code: 'ID',
  });
  const [markup, setMarkup] = useState<MarkupSettings>({ flight: 50000, hotel: 10, train: 15000, insurance: 5 });
const [checkoutDone, setCheckoutDone] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Ref section tiap langkah → target scroll-spy CheckoutStepBar.
  // Di-memo agar identitasnya stabil (kalau inline, observer dipasang ulang
  // setiap kali form di-render).
  const sectionGuests = useRef<HTMLDivElement>(null);
  const sectionContact = useRef<HTMLDivElement>(null);
  const sectionRequest = useRef<HTMLDivElement>(null);
  const sectionRefs = useMemo(() => [sectionGuests, sectionContact, sectionRequest], []);

  // Dialog Syarat & Ketentuan dibuka di tempat (tanpa navigasi) agar data form
  // tetap utuh dan LeaveGuard tidak memunculkan dialog "Yakin keluar?".
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/markup').then(r=>r.json()).then(d=>{ if(d?.hotel!==undefined) setMarkup(d); }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (session?.user) {
      const nameParts = (session.user.name || '').split(' ');
      setContact(c => ({ ...c, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '', email: session.user?.email || '' }));
    }
  }, [session]);

  const updatePax = (i: number, key: keyof Passenger, value: string) =>
    setPassengers((current) => current.map((passenger, index) => (index === i ? { ...passenger, [key]: value } : passenger)));

  const adminFee = Math.round(totalAmount * (markup.hotel / 100));
  const grandTotal = Math.max(0, totalAmount + adminFee - discountAmount);

  /**
   * Pemeriksaan form MURNI (tanpa side effect) — satu-satunya sumber aturan
   * "sudah terisi belum" untuk dua tempat:
   *  - `handleSubmit` memakai error PERTAMA → banner tampil dengan pesan dan
   *    urutan yang sama persis seperti sebelum refactor ini;
   *  - stepper checkout memakai SEMUA error → chip tidak mungkin hijau bila
   *    tombol bayar masih akan ditolak.
   *
   * Urutan pemeriksaan di bawah sengaja dipertahankan: nama tamu → nama
   * kontak → email → nomor HP.
   */
  const validate = (): { key: string; message: string }[] => {
    const errs: { key: string; message: string }[] = [];
    passengers.forEach((p, i) => {
      if (!p.first_name.trim() || !p.last_name.trim()) {
        errs.push({ key: `guest_name_${i}`, message: 'Mohon lengkapi nama depan dan nama belakang semua tamu.' });
      }
    });
    if (!contact.first_name.trim() || !contact.last_name.trim()) {
      errs.push({ key: 'contact_name', message: 'Mohon lengkapi nama kontak utama.' });
    }
    if (!isValidEmail(contact.email.trim())) {
      errs.push({ key: 'contact_email', message: 'Format email tidak valid.' });
    }
    if (!/^\d{8,15}$/.test(contact.mobile.trim())) {
      errs.push({ key: 'contact_mobile', message: 'Nomor HP minimal 8 digit angka.' });
    }
    return errs;
  };

  // ── Status langkah untuk stepper ─────────────────────────────
  // Langkah 1 = Data Tamu, langkah 2 = Data Kontak (keduanya field wajib).
  // Langkah 3 "Permintaan" opsional → ditandai `optional`, ✓-nya menyusul
  // saat section-nya sudah dikunjungi.
  const stepErrs = validate();
  const stepCompleted = [
    !stepErrs.some(x => x.key.startsWith('guest_name')),
    !stepErrs.some(x => x.key.startsWith('contact_')),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutDone || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');

    const normalizedPassengers = passengers.map((pax) => ({
      ...pax, first_name: pax.first_name.trim(), last_name: pax.last_name.trim(), title: pax.title.trim(),
    }));
    const cleanCallingCode = String(contact.calling_code || '').replace(/^\+/, '');
    const normalizedContact = { ...contact, calling_code: cleanCallingCode, first_name: contact.first_name.trim(), last_name: contact.last_name.trim(), email: contact.email.trim(), mobile: contact.mobile.trim() };

    const errs = validate();
    if (errs.length) { setError(errs[0].message); setLoading(false); submittingRef.current = false; return; }
    if (!hotelId || !priceCode) { setError('Data kamar tidak lengkap. Silakan pilih kamar lagi.'); setLoading(false); submittingRef.current = false; return; }

    try {
      // FIX (ROUND 6): Detail page sudah memanggil provision SEBELUM redirect ke
      // checkout. Checkout TIDAK boleh provision lagi — Orbis hanya mengizinkan
      // SATU provision per price_code. Provision kedua "mengonsumsi" lock Orbis,
      // sehingga booked selalu return 4014 "Already call this function".
      // Langsung pakai price_code dari URL (sudah terverifikasi oleh detail page).

      const res = await fetch('/api/hotel/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Penanda "kedua request ini sama" — server hanya mengeksekusi satu.
          'Idempotency-Key': idempotencyKey.getKey(),
        },
        body: JSON.stringify({
          hotel_code: hotelId, price_code: priceCode, provider,
          passenger: normalizedPassengers, contact: [normalizedContact], booker: normalizedContact,
          special_request: specialRequest, total_amount: totalAmount, hotel_name: hotelName,
          ...(appliedCoupon && { coupon_code: appliedCoupon.code, discount_amount: discountAmount }),
          search_data: { checkin_date: checkinDate, checkout_date: checkoutDate, destination_id: sp.get('destination_id') || '', hotel_id: hotelId, search_name: sp.get('search_name') || '', adult: adultCount, child: parseInt(sp.get('child') || '0'), child_ages: (() => { try { return JSON.parse(sp.get('child_ages') || '[]'); } catch { return []; } })(), room: parseInt(sp.get('room') || '1'), nationality: sp.get('nationality') || 'ID', nights, meal_type: sp.get('meal_type') || '', room_description: sp.get('room_desc') || '' },
        }),
      });
      const data = await res.json();
      // FIX: sebelumnya pakai `data.error` duluan — tapi untuk response
      // PRICE_CHANGED/SCHEDULE_ALREADY_USED, `error` itu KODE mesin
      // ("PRICE_CHANGED", "SCHEDULE_ALREADY_USED"), bukan pesan buat
      // manusia. Pesan yang enak dibaca ada di `data.message`. User
      // sebelumnya bisa melihat teks error mentah seperti
      // "SCHEDULE_ALREADY_USED" tanpa penjelasan.
      if (!res.ok || !data.success) {
        // Kegagalan yang DIJAWAB server → klaim idempotency sudah dilepas di
        // sana, jadi siapkan key segar untuk percobaan berikutnya.
        idempotencyKey.regenerate();
        if (data?.error === 'IN_PROGRESS') throw new Error('Pesanan Anda sedang diproses. Silakan klik tombol bayar sekali lagi untuk melanjutkan.');
        if (data?.error === 'IDEMPOTENCY_CONFLICT') throw new Error('Permintaan duplikat terdeteksi. Silakan muat ulang halaman lalu coba lagi.');
        throw new Error(data.message || data.error || 'Gagal membuat pesanan');
      }
      setCheckoutDone(true);

      router.push(data.orderId ? `/bookings/${data.orderId}/review` : '/bookings');
    } catch (error) {
      // Gagal di level JARINGAN (timeout / Failed to fetch) sengaja TIDAK
      // me-regenerate key: bisa jadi request pertama justru sukses di server,
      // dan retry dengan key yang sama akan membalas duplicate + orderId yang
      // benar, alih-alih membuat order kedua.
      setError(error instanceof Error && error.message ? error.message : tc.error + '.');
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const inputCls  = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm outline-none focus:border-slate-400 transition-colors';
  const labelCls  = 'block text-[11px] font-semibold text-slate-500 mb-1.5';
  const selectCls = `${inputCls} cursor-pointer appearance-none`;

  if (!hotelId || !priceCode) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header brand tetap tampil agar halaman error pun konsisten */}
        <CheckoutNavbar />
        <div className="px-4 md:px-6 lg:px-8 py-16 flex items-center justify-center">
          <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900 mb-2">Data pemesanan tidak lengkap</h1>
            <p className="text-sm text-slate-500 mb-6">Silakan kembali ke halaman detail hotel dan pilih kamar.</p>
            <button onClick={() => router.push('/hotel/search')} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors">
              Cari Hotel Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <LeaveGuard
          active={!checkoutDone}
          fallbackHref="/hotel/search"
          // Overlay loading memakai z-[12000] → dialog "Yakin keluar?" harus
          // berada di atasnya supaya tetap terlihat saat user menekan Back.
          zIndex={loading ? 'z-[13000]' : 'z-[1400]'}
        />
        {/* Bar brand (logo + wordmark) — identik header halaman utama */}
        <CheckoutNavbar />
        {/* Bar kedua: "← Kembali" + judul + stepper langkah. Sticky di SEMUA
            ukuran layar (top-0 di HP, top-60px di desktop). */}
        <CheckoutStepBar
          labels={[cs.guests, cs.contact, cs.request]}
          sections={sectionRefs}
          completed={stepCompleted}
          optional={[false, false, true]}
          title={t.title}
          subtitle={hotelName}
          onBack={() => router.back()}
        />

        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-28 lg:pb-10">
          {/* Guest banner */}
          {isGuest && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-sm">?</div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Belum punya akun?</p>
                  <p className="text-xs text-slate-400"><Link href={`/login?callbackUrl=${checkoutCallbackUrl}`} className="text-slate-600 underline">Masuk</Link> atau <Link href={`/register?callbackUrl=${checkoutCallbackUrl}`} className="text-slate-600 underline">daftar</Link> untuk melihat riwayat pesanan.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            {/* LEFT: Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Section "Data Tamu" — target scroll-spy chip langkah */}
              <div ref={sectionGuests} className="scroll-mt-[60px] lg:scroll-mt-[124px] space-y-5">
              {passengers.map((pax, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                  <SectionHeader
                    icon="fa-user"
                    title={<>Tamu {i + 1}{i === 0 && <span className="text-slate-400 font-normal ml-1">(Tamu Utama)</span>}</>}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Sapaan</label>
                      <select value={pax.title} onChange={e => updatePax(i, 'title', e.target.value)} className={selectCls}>
                        {TITLES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{t.firstName} *</label>
                      <input value={pax.first_name} onChange={e => updatePax(i, 'first_name', e.target.value.toUpperCase())} required placeholder="JOHN" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t.lastName} *</label>
                      <input value={pax.last_name} onChange={e => updatePax(i, 'last_name', e.target.value.toUpperCase())} required placeholder="DOE" className={inputCls} />
                    </div>
                    <div className="sm:col-span-3">
                      <label className={labelCls}>{t.nationality}</label>
                      <select value={pax.nationality_code} onChange={e => updatePax(i, 'nationality_code', e.target.value)} className={selectCls}>
                        {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {/* Contact Person */}
              <div ref={sectionContact} className="scroll-mt-[60px] lg:scroll-mt-[124px] bg-white rounded-xl border border-slate-200 p-5">
                <SectionHeader icon="fa-address-card" title={t.contactDetails} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Sapaan</label>
                    <select value={contact.title} onChange={e => setContact(c => ({ ...c, title: e.target.value }))} className={selectCls}>
                      {TITLES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t.firstName} *</label>
                    <input value={contact.first_name} onChange={e => setContact(c => ({ ...c, first_name: e.target.value }))} required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.lastName}</label>
                    <input value={contact.last_name} onChange={e => setContact(c => ({ ...c, last_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.nationality}</label>
                    <select value={contact.nationality_code} onChange={e => setContact(c => ({ ...c, nationality_code: e.target.value }))} className={selectCls}>
                      {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t.email} *</label>
                    <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} required placeholder="email@example.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Kode Negara</label>
                    <input value={contact.calling_code} onChange={e => setContact(c => ({ ...c, calling_code: e.target.value }))} placeholder="62" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.phone} *</label>
                    <input value={contact.mobile} onChange={e => setContact(c => ({ ...c, mobile: e.target.value }))} required placeholder="8123456789" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Special Request */}
              <div ref={sectionRequest} className="scroll-mt-[60px] lg:scroll-mt-[124px] bg-white rounded-xl border border-slate-200 p-5">
                <SectionHeader icon="fa-message" title={<>{t.specialRequest} <span className="text-slate-400 font-normal">(opsional)</span></>} />
                <textarea value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} rows={3}
                  placeholder={t.specialRequestPlaceholder} className={`${inputCls} resize-y`} />
                <p className="text-[10px] text-slate-400 mt-1">* Tidak dijamin terpenuhi, tergantung ketersediaan hotel.</p>
              </div>

              {/* CTA mobile menempel di bawah layar. Sengaja diletakkan DI DALAM
                  <form> agar tetap menjadi submit button — display:none di
                  desktop tidak menghapusnya dari DOM, jadi Enter/Go di keyboard
                  tetap mengirim form. Klik mouse di desktop memakai tombol pada
                  kartu ringkasan, sehingga CTA tidak pernah tampil dua kali. */}
              <MobileCheckoutBar
                type="submit"
                totalLabel={cs.total}
                total={fmtIDR(grandTotal)}
                ctaLabel={cs.pay}
                loading={loading}
                loadingLabel={t.processing}
                note={<TermsAgreementText
                  prefix={cs.agreePrefix}
                  termsLabel={cs.termsLabel}
                  suffix={cs.agreeSuffix}
                  onOpen={() => setTermsOpen(true)}
                />}
              />
            </form>

            {/* RIGHT: Order Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-[104px]">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Ringkasan Pesanan</h3>

              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="font-bold text-slate-900 text-sm mb-2 leading-tight">{hotelName}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">{t.checkin}</span><span className="font-semibold text-slate-700">{formatDateShort(checkinDate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.checkout}</span><span className="font-semibold text-slate-700">{formatDateShort(checkoutDate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.duration}</span><span className="font-semibold text-slate-700">{nights} {t.nights}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tamu</span><span className="font-semibold text-slate-700">{adultCount} {t.adult}</span></div>
                </div>
              </div>

              {roomDesc && <p className="text-xs text-slate-500 mb-3">{roomDesc}</p>}
              {mealType && <p className="text-xs text-slate-400 mb-3">{mealType}</p>}
              {provider && <p className="text-xs text-slate-400 mb-3">Provider: <span className="font-semibold text-slate-600">{provider}</span></p>}

              <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.roomRate}</span>
                  <span className="text-slate-700">{fmtIDR(totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biaya Admin ({markup.hotel}%)</span>
                  <span className="text-slate-700">{fmtIDR(adminFee)}</span>
                </div>
              </div>

              <div className="pt-2">
                <CouponInput
                  category="hotel"
                  totalAmount={totalAmount + adminFee}
                  onApply={(coupon: any, disc: number) => { setAppliedCoupon(coupon); setDiscountAmount(disc); }}
                  onRemove={() => { setAppliedCoupon(null); setDiscountAmount(0); }}
                  appliedCoupon={appliedCoupon}
                  discountAmount={discountAmount}
                />
              </div>
              {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Diskon Kupon</span>
                <span className="font-semibold">-{fmtIDR(discountAmount)}</span>
              </div>
              )}
              <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
                <span className="font-bold text-slate-800">{t.total}</span>
                <span className="font-bold text-slate-900 text-lg">{fmtIDR(grandTotal)}</span>
              </div>

              {/* CTA desktop — satu-satunya tombol bayar yang tampil di layar lebar */}
              <div className="hidden lg:block">
                <PayButton
                  onClick={handleSubmit}
                  disabled={loading}
                  loading={loading}
                  loadingLabel={t.processing}
                  className="mt-4"
                >
                  {`Bayar ${fmtIDR(grandTotal)}`}
                </PayButton>
                <TermsAgreementText
                  prefix={cs.agreePrefix}
                  termsLabel={cs.termsLabel}
                  suffix={cs.agreeSuffix}
                  onOpen={() => setTermsOpen(true)}
                  className="block text-center mt-2"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog S&K — menutupi konten tanpa navigasi, jadi LeaveGuard tak terpicu */}
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      {/* Menimpa seluruh halaman selama booking diproses: semua klik, scroll,
          dan navigasi keyboard tertahan sehingga user tidak bisa mengklik
          konten lain maupun mengirim order kedua. */}
      <CheckoutLoadingOverlay open={loading} />
    </>
  );
}

function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
