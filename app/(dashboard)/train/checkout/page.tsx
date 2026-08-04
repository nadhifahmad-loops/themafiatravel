'use client';
import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import LeaveGuard from '@/components/checkout/LeaveGuard';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { isValidName, isValidEmail, isValidPhone, isValidIdentityNumber, isValidBirthDate, parsePhoneWithCode, scrollToFirstError } from '@/lib/checkout-utils';

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
function PassengerForm({ pax, index, fieldCls, labelCls, selectCls, errors, onChange }: {
  pax: any; index: number; fieldCls: (err?: string) => string; selectCls: string; labelCls: string;
  errors?: Record<string,string>;
  onChange: (idx: number, field: string, value: any) => void;
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
            <option value="ID">Indonesia</option><option value="SG">Singapura</option><option value="MY">Malaysia</option>
          </select>
        </div>
        <div><label className={labelCls}>{t.birthDate}</label>
          <input id={k('pax_birth')} type="date" value={pax.birth_date} onChange={e=>onChange(index,'birth_date',e.target.value)} className={fieldCls(errBirth)}/>
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
              <input type="date" value={pax.identity.identity_expdate} onChange={e=>onChange(index,'identity',{...pax.identity,identity_expdate:e.target.value})} className={fieldCls()}/>
            </div>
            <div><label className={labelCls}>Negara Penerbit</label>
              <select value={pax.identity.identity_country_of_issued_code} onChange={e=>onChange(index,'identity',{...pax.identity,identity_country_of_issued_code:e.target.value})} className={selectCls}>
                <option value="ID">Indonesia</option><option value="SG">Singapura</option>
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
  const tc = i18n.common[language];

  const sp = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  const isSubmittingRef = useRef(false);

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
  const baseAmount   = parseFloat(sp.get('total_amount') || '0');
  const adultCount   = parseInt(sp.get('adult') || '1');
  const infantCount  = parseInt(sp.get('infant') || '0');
  const paxCount     = adultCount + infantCount;

  const ADDON_PRICES = { insurance: 45000, refund: 30000 };
  const [addInsurance, setAddInsurance] = useState(false);
  const [addRefund, setAddRefund] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markup, setMarkup] = useState<MarkupSettings>({ flight: 50000, hotel: 10, train: 15000, insurance: 5 });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [checkoutDone, setCheckoutDone] = useState(false);

  useEffect(() => {
    fetch('/api/markup').then(r=>r.json()).then(d=>{ if(d?.train!==undefined) setMarkup(d); }).catch(()=>{});
  }, []);

  const insuranceFee = addInsurance ? ADDON_PRICES.insurance * paxCount : 0;
  const refundFee = addRefund ? ADDON_PRICES.refund * paxCount : 0;
  const adminFee = markup.train * paxCount;
  const pricingAmount = baseAmount + insuranceFee + refundFee;
  const grandTotal = pricingAmount + adminFee;

  const initPax = (type: string, count: number) =>
    Array.from({ length: count }, () => ({
      pax_type: type, title: type === 'INF' ? 'MSTR' : 'MR', first_name: '', last_name: '',
      birth_date: '', nationality_code: 'ID',
      identity: { identity_type: 'ktp', identity_number: '', identity_expdate: '', identity_country_of_issued_code: 'ID' },
    }));

  const [passengers, setPassengers] = useState<any[]>([...initPax('ADT', adultCount), ...initPax('INF', infantCount)]);
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [contact], passengers, booker: { ...contact },
          schedules: [{ journeys: [{ journey_code: journeyCode, fare_code: fareCode }], provider: 'kai' }],
          total_amount: pricingAmount, origin, destination, departure_date: departureDate, arrival_date: arrivalDate,
          train_name: trainName, train_number: trainNumber, cabin_class: cabinClass,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuat pesanan kereta.');
      setCheckoutDone(true);
      const bookingId = data.orderId || '';
      if (bookingId) router.push(`/payment/${bookingId}`);
      else router.push('/bookings');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); isSubmittingRef.current = false; }
  };

  const baseInputCls = 'w-full px-4 py-2.5 bg-white border rounded-lg text-slate-800 text-sm outline-none transition-colors';
  const fieldCls = (err?: string) => baseInputCls + (err ? ' border-red-400 focus:border-red-400' : ' border-slate-200 focus:border-slate-400');
  const inputCls = fieldCls();
  const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1.5';
  const selectCls = inputCls + ' cursor-pointer appearance-none';

  return (    <div className="min-h-screen bg-slate-50">
      <LeaveGuard active={!checkoutDone} />
      <div className="bg-white border-b border-slate-200 sticky top-16 z-10">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
            ← {tc.back}
          </button>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-800">1. Data Diri</span>
            <span className="text-slate-300">→</span>
            <span className="text-slate-400">2. Pembayaran</span>
          </div>
          <div className="w-16"/>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        {isGuest && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-sm">?</div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Belum punya akun?</p>
                <p className="text-xs text-slate-400"><Link href="/login" className="text-slate-600 underline">Masuk</Link> atau <Link href="/register" className="text-slate-600 underline">daftar</Link> untuk melihat e-tiket.</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center"><i className="fa-solid fa-user text-[9px]"></i></div>
                <h2 className="text-sm font-bold text-slate-800">{t.contactDetails}</h2>
              </div>
              {isGuest ? (
                <p className="text-xs text-slate-400 mt-1 mb-4">E-tiket akan dikirim ke email dan nomor HP di bawah ini.</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1 mb-4">Data diisi otomatis dari akun Anda. Silakan lengkapi jika diperlukan.</p>
              )}
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
                  {!formErrors.booker_phone && contact.mobile && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1"><i className="fa-solid fa-circle-check text-[9px]"></i>Nomor terisi otomatis dari akun</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>{t.contactEmail}</label>
                  <input id="booker_email" type="email" value={contact.email} onChange={e=>{setContact(c=>({...c, email:e.target.value})); clearErr('booker_email');}} className={fieldCls(formErrors.booker_email)} placeholder="email@contoh.com"/>
                  {formErrors.booker_email && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_email}</p>}
                </div>
              </div>
            </div>

            {passengers.map((pax, i) => (
              <PassengerForm key={i} pax={pax} index={i} fieldCls={fieldCls} labelCls={labelCls} selectCls={selectCls} errors={formErrors} onChange={updatePax}/>
            ))}
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Pelengkap Perjalanan</h2>
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

          <div className="space-y-4 sticky top-28">
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
              <button onClick={handleSubmit} disabled={loading}
                className="mt-4 w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all text-sm active:scale-[0.98]">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>{t.processing}</span>
                  : `Bayar ${fmtIDR(grandTotal)}`
                }
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Menekan tombol berarti Anda setuju dengan Syarat & Ketentuan KAI.
              </p>
            </div>
          </div>
        </div>
      </div>
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