'use client';
import { Suspense, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { isValidName, isValidEmail, isValidPhone, isValidIdentityNumber, isValidBirthDate, parsePhoneWithCode, scrollToFirstError, buildCheckoutCallbackUrl } from '@/lib/checkout-utils';
import CouponInput from '@/components/checkout/CouponInput';
import DatePickerField from '@/components/checkout/DatePickerField';
import SavedPassengerPicker, { SavedPassengerNotice } from '@/components/checkout/SavedPassengerPicker';
import { useSavedPassengers } from '@/components/hooks/useSavedPassengers';
import { savedPassengerToPassenger, type SavedPassengerRecord } from '@/lib/saved-passengers';
import { COUNTRY_OPTIONS as PASSENGER_COUNTRIES } from '@/lib/countries';

const TITLES = ['MR', 'MRS', 'MS'];
const INFANT_TITLES = ['MSTR', 'MISS'];
const CABIN_LABELS: Record<string, string> = { E: 'Eksekutif', B: 'Bisnis', K: 'Ekonomi', P: 'Prioritas' };

interface MarkupSettings { flight: number; hotel: number; train: number; insurance: number; }

function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtTime(dt: string) { if (!dt) return '--:--'; return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16); }
function fmtDate(dt: string) { if (!dt) return ''; return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDur(e: string) {
  if (!e) return '';
  const p = e.split(':');
  if (p.length >= 2) { const h = parseInt(p[0], 10); const m = parseInt(p[1], 10); return h > 0 ? `${h}j ${m}m` : `${m}m`; }
  return e;
}
function PassengerForm({ pax, index, fieldCls, labelCls, selectCls, errors, onChange, savedPicker }: {
  pax: any; index: number; fieldCls: (err?: string) => string; selectCls: string; labelCls: string;
  errors?: Record<string,string>;
  onChange: (idx: number, field: string, value: any) => void;
  savedPicker?: ReactNode;
}) {
  const { language } = useLanguage();
  const t = i18n.trainCheckout[language];
  const tc = i18n.common[language];
  const paxLabel = pax.pax_type==='ADT' ? t.adult : t.infant;
  const isInfant = pax.pax_type === 'INF';
  const titleOptions = isInfant ? INFANT_TITLES : TITLES;
  const k = (key: string) => `${key}_${index}`;
  const errFirst = errors?.[k('pax_first')];
  const errLast = errors?.[k('pax_last')];
  const errBirth = errors?.[k('pax_birth')];
  const errId = errors?.[k('pax_id')];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5" id={`pax_card_${index}`}>
      {savedPicker}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">{index+1}</span>
        <span className="text-xs font-bold text-slate-400">{tc.passenger} {index+1}</span>
        <span className="text-xs text-slate-300">·</span>
        <span className="text-xs font-semibold text-slate-400">{paxLabel}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={labelCls}>Sapaan</label>
          <select value={pax.title} onChange={e=>onChange(index,'title',e.target.value)} className={selectCls}>
            {titleOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>Nama Depan (Sesuai ID)</label>
          <input id={k('pax_first')} value={pax.first_name} onChange={e=>onChange(index,'first_name',e.target.value.toUpperCase())} className={fieldCls(errFirst)} placeholder="BUDI"/>
          {errFirst && <p className="text-[11px] text-red-600 mt-1">{errFirst}</p>}
        </div>
        <div><label className={labelCls}>{t.lastName}</label>
          <input id={k('pax_last')} value={pax.last_name} onChange={e=>onChange(index,'last_name',e.target.value.toUpperCase())} className={fieldCls(errLast)} placeholder="SANTOSO"/>
          {errLast && <p className="text-[11px] text-red-600 mt-1">{errLast}</p>}
        </div>
        <div><label className={labelCls}>Kewarganegaraan</label>
          <select value={pax.nationality_code} onChange={e=>onChange(index,'nationality_code',e.target.value)} className={selectCls}>
            {PASSENGER_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>{country.label}</option>
            ))}
          </select>
        </div>
        <div><label className={labelCls}>{t.birthDate}</label>
          <DatePickerField
            id={k('pax_birth')}
            value={pax.birth_date}
            onChange={(iso) => onChange(index, 'birth_date', iso)}
            error={errBirth}
            maxDate={new Date()}
            placeholder="Pilih tanggal lahir"
            defaultMonth={new Date(2000, 0, 1)}
          />
          {errBirth && <p className="text-[11px] text-red-600 mt-1">{errBirth}</p>}
        </div>
        <div><label className={labelCls}>{t.idType}</label>
          <select value={pax.identity.identity_type} onChange={e=>onChange(index,'identity',{...pax.identity,identity_type:e.target.value})} className={selectCls}>
            <option value="ktp">{t.ktp}</option><option value="passport">{t.passport}</option>
            {isInfant && <option value="other">Lainnya (Tanggal Lahir)</option>}
          </select>
        </div>
        <div className="sm:col-span-2"><label className={labelCls}>{t.idNumber}</label>
          <input id={k('pax_id')} value={pax.identity.identity_number} onChange={e=>onChange(index,'identity',{...pax.identity,identity_number:e.target.value.toUpperCase()})} className={fieldCls(errId)} placeholder="16 Digit NIK / No. Paspor"/>
          {errId && <p className="text-[11px] text-red-600 mt-1">{errId}</p>}
        </div>
        {pax.identity.identity_type==='passport'&&(
          <>
            <div><label className={labelCls}>Berlaku Hingga</label>
              <DatePickerField
                value={pax.identity.identity_expdate}
                onChange={(iso) => onChange(index, 'identity', { ...pax.identity, identity_expdate: iso })}
                minDate={new Date()}
                endMonth={new Date(new Date().getFullYear() + 15, 11, 31)}
                placeholder="Pilih tanggal kedaluwarsa"
              />
            </div>
            <div><label className={labelCls}>Negara Penerbit</label>
              <select value={pax.identity.identity_country_of_issued_code} onChange={e=>onChange(index,'identity',{...pax.identity,identity_country_of_issued_code:e.target.value})} className={selectCls}>
                {PASSENGER_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>{country.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function TrainCheckoutContent() {
  const { language } = useLanguage();
  const t = i18n.trainCheckout[language];
  // Label stepper langkah + teks CTA mobile (konsisten antar modul checkout).
  const cs = i18n.checkoutSteps[language];

  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  const isSubmittingRef = useRef(false);
  // SATU Idempotency-Key per attempt checkout. Dibuat sekali di mount sehingga
  // klik ganda memakai key yang SAMA dan server bisa mengenali keduanya sebagai
  // satu permintaan — walau lolos guard, eksekusi tetap hanya satu.
  const idempotencyKey = useIdempotencyKey();
  // Callback agar guest kembali ke halaman checkout ini setelah login/register.
  const checkoutCallbackUrl = buildCheckoutCallbackUrl(pathname, sp.toString());
  const { openLogin, openRegister } = useAuthModal();

  const origin       = sp.get('origin') || '';
  const destination  = sp.get('destination') || '';
  const departureDate = sp.get('departure_date') || '';
  const arrivalDate  = sp.get('arrival_date') || '';
  const trainName    = sp.get('train_name') || '';
  const trainNumber  = sp.get('train_number') || '';
  const journeyCode  = sp.get('journey_code') || '';
  const fareCode     = sp.get('fare_code') || '';
  const cabinClass   = sp.get('cabin_class') || '';
  const classOfService = sp.get('class_of_service') || '';
  const elapsedTime  = sp.get('elapsed_time') || '';
  const baseAmount   = parseFloat(sp.get('base_amount') || sp.get('total_amount') || '0');
  const adultCount   = parseInt(sp.get('adult') || '1');
  const infantCount  = parseInt(sp.get('infant') || '0');
  const paxCount     = adultCount + infantCount;

  usePageTitle(`Pembayaran Kereta: ${origin} → ${destination}`);

  const ADDON_PRICES = { insurance: 45000, refund: 30000 };
  const [addInsurance, setAddInsurance] = useState(false);
  const [addRefund, setAddRefund] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markup, setMarkup] = useState<MarkupSettings>({ flight: 50000, hotel: 10, train: 15000, insurance: 5 });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Ref section tiap langkah → target scroll-spy CheckoutStepBar (di-memo agar
  // identitasnya stabil dan observer tidak dipasang ulang tiap render).
  const sectionContact = useRef<HTMLDivElement>(null);
  const sectionPassengers = useRef<HTMLDivElement>(null);
  const sectionAddons = useRef<HTMLDivElement>(null);
  const sectionRefs = useMemo(() => [sectionContact, sectionPassengers, sectionAddons], []);

  // Dialog Syarat & Ketentuan dibuka di tempat (tanpa navigasi) agar data form
  // tetap utuh dan LeaveGuard tidak memunculkan dialog "Yakin keluar?".
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/markup').then(r=>r.json()).then(d=>{ if(d?.train!==undefined) setMarkup(d); }).catch(()=>{});
  }, []);

  const insuranceFee = addInsurance ? ADDON_PRICES.insurance * paxCount : 0;
  const refundFee = addRefund ? ADDON_PRICES.refund * paxCount : 0;
  const adminFee = markup.train * paxCount;
  const pricingAmount = baseAmount + insuranceFee + refundFee;
  const grandTotal = Math.max(0, baseAmount + insuranceFee + refundFee + adminFee - discountAmount);

  const initPax = (type: string, count: number) =>
    Array.from({ length: count }, () => ({
      pax_type: type, title: type === 'INF' ? 'MSTR' : 'MR', first_name: '', last_name: '',
      birth_date: '', nationality_code: 'ID',
      identity: { identity_type: 'ktp', identity_number: '', identity_expdate: '', identity_country_of_issued_code: 'ID' },
    }));

  const [passengers, setPassengers] = useState<any[]>([...initPax('ADT', adultCount), ...initPax('INF', infantCount)]);
  const {
    savedPassengers,
    loading: savedPassengersLoading,
    error: savedPassengersError,
    refetch: refetchSavedPassengers,
  } = useSavedPassengers(status === 'authenticated');
  const [contact, setContact] = useState({
    title: 'MR', first_name: '', last_name: '', email: session?.user?.email || '',
    calling_code: '62', mobile: '', nationality_code: 'ID', is_also_booker: true,
  });

  const updatePax = (i: number, field: string, val: any) => {
    setPassengers(p => p.map((x, j) => {
      if (j !== i) return x;
      if (field === 'identity') return { ...x, identity: val };
      return { ...x, [field]: val };
    }));
  };

  const applySavedPassenger = (index: number, saved: SavedPassengerRecord) => {
    setPassengers(prev => prev.map((pax, i) => {
      if (i !== index) return pax;
      return { ...pax, ...savedPassengerToPassenger(saved, pax.pax_type) };
    }));
    setFormErrors(prev => {
      const next = { ...prev };
      [`pax_first_${index}`, `pax_last_${index}`, `pax_birth_${index}`, `pax_id_${index}`]
        .forEach((key) => delete next[key]);
      return next;
    });
  };

  useEffect(() => {
    if (session?.user) {
      const nameParts = (session.user.name || '').split(' ');
      setContact(c => ({ ...c, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '', email: session.user?.email || '' }));
    }
    if (session?.user?.phone) {
      const parsed = parsePhoneWithCode(session.user.phone);
      setContact(c => ({ ...c, calling_code: parsed.code, mobile: parsed.number }));
    }
  }, [session]);

  const clearErr = (key: string) => setFormErrors(f => { if (!f[key]) return f; const n={...f}; delete n[key]; return n; });

  const validate = (): Record<string,string> => {
    const errs: Record<string,string> = {};
    if (!isValidName(contact.first_name)) errs.booker_name = 'Nama pemesan wajib diisi.';
    if (!isValidEmail(contact.email)) errs.booker_email = 'Format email tidak valid.';
    if (!isValidPhone(contact.mobile)) errs.booker_phone = 'Nomor HP minimal 8 digit angka.';
    passengers.forEach((p, i) => {
      if (!isValidName(p.first_name)) errs[`pax_first_${i}`] = 'Nama depan wajib diisi.';
      if (!isValidName(p.last_name)) errs[`pax_last_${i}`] = 'Nama belakang wajib diisi.';
      if (!isValidBirthDate(p.birth_date)) errs[`pax_birth_${i}`] = 'Tanggal lahir wajib diisi.';
      if (p.identity?.identity_type !== 'other' && !isValidIdentityNumber(p.identity?.identity_number || '', p.identity?.identity_type === 'passport' ? 'passport' : 'ktp')) {
        errs[`pax_id_${i}`] = p.identity?.identity_type === 'passport'
          ? 'No. paspor harus alfanumerik minimal 6 karakter.'
          : 'NIK harus 16 digit angka.';
      }
    });
    return errs;
  };

  // ── Status langkah untuk stepper ─────────────────────────────
  // Chip ✓ di CheckoutStepBar ditentukan oleh field wajib yang SUDAH TERISI,
  // bukan posisi scroll — memakai `validate()` yang sama sehingga chip hanya
  // hijau bila submit juga tidak akan ditolak. Langkah 3 "Pelengkap"
  // (pilih kursi) semuanya opsional → ditandai `optional`, ✓-nya menyusul
  // saat section-nya sudah dikunjungi.
  const stepErrs = validate();
  const stepCompleted = [
    !stepErrs.booker_name && !stepErrs.booker_email && !stepErrs.booker_phone,
    !Object.keys(stepErrs).some(k => k.startsWith('pax_')),
  ];

  const handleSubmit = async () => {
    if (isSubmittingRef.current || checkoutDone) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      const ids = ['booker_name','booker_phone','booker_email', ...passengers.flatMap((_,i)=>[`pax_first_${i}`,`pax_last_${i}`,`pax_birth_${i}`,`pax_id_${i}`])];
      scrollToFirstError(ids);
      return;
    }
    setFormErrors({});
    isSubmittingRef.current = true;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/train/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Penanda "kedua request ini sama" — server hanya mengeksekusi satu.
          'Idempotency-Key': idempotencyKey.getKey(),
        },
        body: JSON.stringify({
          contacts: [contact], passengers, booker: { ...contact },
          schedules: [{ journeys: [{ journey_code: journeyCode, fare_code: fareCode }], provider: 'kai' }],
          // Server menambahkan markup train satu kali sebelum membuat transaksi Midtrans.
          total_amount: pricingAmount, base_amount: baseAmount, origin, destination, departure_date: departureDate, arrival_date: arrivalDate,
          train_name: trainName, train_number: trainNumber, cabin_class: cabinClass,
          ...(appliedCoupon && { coupon_code: appliedCoupon.code, discount_amount: discountAmount }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Kegagalan yang DIJAWAB server → klaim idempotency sudah dilepas di
        // sana, jadi siapkan key segar untuk percobaan berikutnya.
        idempotencyKey.regenerate();
        if (data?.error === 'IN_PROGRESS') {
          throw new Error('Pesanan Anda sedang diproses. Silakan klik tombol bayar sekali lagi untuk melanjutkan.');
        }
        if (data?.error === 'IDEMPOTENCY_CONFLICT') {
          throw new Error('Permintaan duplikat terdeteksi. Silakan muat ulang halaman lalu coba lagi.');
        }
        throw new Error(data.message || data.error || 'Gagal membuat pesanan kereta.');
      }
      setCheckoutDone(true);
      const bookingId = data.orderId || '';
      if (bookingId) router.push(`/bookings/${bookingId}/review`);
      else router.push('/bookings');
    } catch (e: any) {
      // Gagal di level JARINGAN sengaja TIDAK me-regenerate key: bisa jadi
      // request pertama justru sukses di server, dan retry dengan key yang
      // sama akan membalas duplicate + orderId yang benar.
      if (e?.message) setError(e.message);
    } finally { setLoading(false); isSubmittingRef.current = false; }
  };

  const baseInputCls = 'w-full px-4 py-2.5 bg-white border rounded-lg text-slate-800 text-sm outline-none transition-colors';
  const fieldCls = (err?: string) => baseInputCls + (err ? ' border-red-400 focus:border-red-400' : ' border-slate-200 focus:border-slate-400');
  const inputCls = fieldCls();
  const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1.5';
  const selectCls = inputCls + ' cursor-pointer appearance-none';

  return (    <div className="min-h-screen bg-slate-50">
      <LeaveGuard
        active={!checkoutDone}
        fallbackHref="/train/search"
        // Overlay loading memakai z-[12000] → dialog "Yakin keluar?" harus
        // berada di atasnya supaya tetap terlihat saat user menekan Back.
        zIndex={loading ? 'z-[13000]' : 'z-[1400]'}
      />
      {/* Bar brand (logo + wordmark) — identik header halaman utama */}
      <CheckoutNavbar />
      {/* Bar kedua: "← Kembali" + stepper langkah. Sticky di SEMUA ukuran
          layar (top-0 di HP, top-60px di desktop). */}
      <CheckoutStepBar
        labels={[cs.booker, cs.passengers, cs.addons]}
        sections={sectionRefs}
        completed={stepCompleted}
        optional={[false, false, true]}
        title={`${origin} → ${destination}`}
        subtitle={trainName}
        onBack={() => router.back()}
      />

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-28 lg:pb-10">
        {isGuest && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-sm">?</div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Belum punya akun?</p>
                <p className="text-xs text-slate-400"><button type="button" onClick={() => openLogin({ callbackUrl: checkoutCallbackUrl })} className="text-slate-600 underline">Masuk</button> atau <button type="button" onClick={() => openRegister({ callbackUrl: checkoutCallbackUrl })} className="text-slate-600 underline">daftar</button> untuk melihat e-tiket.</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
            <p className="font-semibold mb-1">Pemesanan Gagal</p>
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-5">
            <div ref={sectionContact} className="scroll-mt-[60px] lg:scroll-mt-[124px] bg-white rounded-xl border border-slate-200 p-5">
              <SectionHeader
                icon="fa-user"
                title={t.contactDetails}
                description={
                  isGuest
                    ? 'E-tiket akan dikirim ke email dan nomor HP di bawah ini.'
                    : 'Data diisi otomatis dari akun Anda. Silakan lengkapi jika diperlukan.'
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nama Lengkap Pemesan</label>
                  <input id="booker_name" value={`${contact.first_name}${contact.last_name ? ' '+contact.last_name : ''}`.trim()}
                    onChange={e => { const p = e.target.value.split(' '); setContact(c => ({ ...c, first_name: p[0]||'', last_name: p.slice(1).join(' ')||'' })); clearErr('booker_name'); }}
                    className={fieldCls(formErrors.booker_name)} placeholder="Sesuai KTP / Identitas" />
                  {formErrors.booker_name && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_name}</p>}
                </div>
                <div>
                  <label className={labelCls}>{t.contactPhone}</label>
                  <div className="flex gap-2">
                    <select value={contact.calling_code} onChange={e=>setContact(c=>({...c, calling_code:e.target.value}))} className="w-20 px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm outline-none focus:border-slate-400 cursor-pointer">
                      <option value="62">+62</option>
                    </select>
                    <input id="booker_phone" value={contact.mobile} onChange={e=>{setContact(c=>({...c, mobile:e.target.value.replace(/\D/g,'')})); clearErr('booker_phone');}} className={fieldCls(formErrors.booker_phone)} placeholder="8123456xxxx"/>
                  </div>
                  {formErrors.booker_phone && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_phone}</p>}
                </div>
                <div>
                  <label className={labelCls}>{t.contactEmail}</label>
                  <input id="booker_email" type="email" value={contact.email} onChange={e=>{setContact(c=>({...c, email:e.target.value})); clearErr('booker_email');}} className={fieldCls(formErrors.booker_email)} placeholder="email@contoh.com"/>
                  {formErrors.booker_email && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_email}</p>}
                </div>
              </div>
            </div>

            {/* Section "Data Penumpang" — target scroll-spy chip langkah */}
            <div ref={sectionPassengers} className="scroll-mt-[60px] lg:scroll-mt-[124px] space-y-5">
              {status === 'authenticated' && (savedPassengers.length === 0 || savedPassengersError) && (
                <SavedPassengerNotice
                  loading={savedPassengersLoading}
                  error={!!savedPassengersError}
                  onRetry={refetchSavedPassengers}
                />
              )}
              {passengers.map((pax, i) => (
                <PassengerForm
                  key={i}
                  pax={pax}
                  index={i}
                  fieldCls={fieldCls}
                  labelCls={labelCls}
                  selectCls={selectCls}
                  errors={formErrors}
                  onChange={updatePax}
                  savedPicker={status === 'authenticated' && savedPassengers.length > 0 ? (
                    <SavedPassengerPicker
                      passengers={savedPassengers}
                      context={{ mode: 'train', paxType: pax.pax_type }}
                      onSelect={(saved) => applySavedPassenger(i, saved)}
                    />
                  ) : undefined}
                />
              ))}
            </div>
            <div ref={sectionAddons} className="scroll-mt-[60px] lg:scroll-mt-[124px]">
              <SectionHeader icon="fa-plus" title="Pelengkap Perjalanan" />
              <div className="space-y-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-800 text-sm">{t.seatSelection}</p>
                  <p className="text-xs text-slate-400 mt-1">Peta dan pemilihan kursi KAI dapat dilakukan setelah pembayaran berhasil pada halaman detail transaksi.</p>
                </div>

                <div className={`bg-white rounded-xl border p-4 transition-all ${addRefund?'border-slate-800':'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Jaminan Uang Kembali</p>
                      <p className="text-xs text-slate-400">Batalkan tiket sebelum keberangkatan.</p>
                    </div>
                    <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addRefund?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddRefund(!addRefund)}>
                      <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addRefund?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                    </div>
                  </div>
                  {addRefund && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(refundFee)}</p>}
                </div>

                <div className={`bg-white rounded-xl border p-4 transition-all ${addInsurance?'border-slate-800':'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Asuransi Perjalanan Kereta</p>
                      <p className="text-xs text-slate-400">Perlindungan ekstra selama perjalanan darat.</p>
                    </div>
                    <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addInsurance?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddInsurance(!addInsurance)}>
                      <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addInsurance?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                    </div>
                  </div>
                  {addInsurance && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(insuranceFee)}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-[104px]">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Ringkasan Tiket</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">KAI</span>
                  <span className="text-xs font-semibold text-slate-600">{trainName} ({trainNumber})</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-slate-900">{fmtTime(departureDate)}</p>
                  <p className="text-xs text-slate-400">{fmtDur(elapsedTime)}</p>
                  <p className="text-xl font-bold text-slate-900">{fmtTime(arrivalDate)}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{origin}</span>
                  <span className="flex-1 h-px bg-slate-200"></span>
                  <span>{destination}</span>
                </div>
                <p className="text-xs text-slate-400">{fmtDate(departureDate)}</p>
                <span className="inline-flex text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {CABIN_LABELS[cabinClass]} {classOfService && `(${classOfService})`}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">{t.priceDetails}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{t.baseFare} ×{adultCount}</span>
                  <span className="font-semibold">{fmtIDR(baseAmount)}</span>
                </div>
                {infantCount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tiket Bayi ×{infantCount}</span>
                    <span className="font-semibold text-slate-500">Gratis</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Biaya Admin</span>
                  <span className="font-semibold">{fmtIDR(adminFee)}</span>
                </div>
                {addInsurance && (
                  <div className="flex justify-between text-slate-600">
                    <span>Asuransi Perjalanan</span>
                    <span className="font-semibold">{fmtIDR(insuranceFee)}</span>
                  </div>
                )}
                {addRefund && (
                  <div className="flex justify-between text-slate-600">
                    <span>Jaminan Uang Kembali</span>
                    <span className="font-semibold">{fmtIDR(refundFee)}</span>
                  </div>
                )}
                <div className="pt-2">
                  <CouponInput
                    category="train"
                    totalAmount={baseAmount + insuranceFee + refundFee + adminFee}
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
                <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
                  <span className="font-bold text-slate-800">{t.total}</span>
                  <span className="font-bold text-slate-900 text-base">{fmtIDR(grandTotal)}</span>
                </div>
              </div>

              {Object.keys(formErrors).length > 0 && !loading && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                  <span>Masih ada {Object.keys(formErrors).length} data yang belum lengkap. Periksa kembali kolom bertanda merah.</span>
                </div>
              )}
              {/* CTA desktop; di mobile digantikan MobileCheckoutBar */}
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

      {/* CTA mobile: total + tombol bayar selalu terjangkau di layar kecil */}
      <MobileCheckoutBar
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
        onClick={handleSubmit}
      />

      {/* Dialog S&K — menutupi konten tanpa navigasi, jadi LeaveGuard tak terpicu */}
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      {/* Menimpa seluruh halaman selama booking diproses: semua klik, scroll,
          dan navigasi keyboard tertahan sehingga user tidak bisa mengklik
          konten lain maupun mengirim order kedua. */}
      <CheckoutLoadingOverlay open={loading} />
    </div>
  );
}

export default function TrainCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin"/>
      </div>
    }>
      <TrainCheckoutContent/>
    </Suspense>
  );
}