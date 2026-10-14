'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import LeaveGuard from '@/components/checkout/LeaveGuard';
import CouponInput from '@/components/checkout/CouponInput';
import DatePickerField from '@/components/checkout/DatePickerField';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { buildCheckoutCallbackUrl } from '@/lib/checkout-utils';

const TITLES = ['MR', 'MRS', 'MS', 'MSTR', 'MISS'];
interface MarkupSettings { flight: number; hotel: number; train: number; insurance: number; }

function fmtIDR(n: number) { if (!n) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtDate(d: string) { if (!d) return ''; return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }

const inp = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:border-slate-400 transition-colors placeholder-slate-400";
const sel = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:border-slate-400 transition-colors appearance-none";

function InsuranceCheckoutContent() {
  const { language } = useLanguage();
  const t = i18n.insuranceCheckout[language];
  const tc = i18n.common[language];
  const sp             = useSearchParams();
  const router         = useRouter();
  const pathname       = usePathname();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  // Callback agar guest kembali ke halaman checkout ini setelah login/register.
  const checkoutCallbackUrl = buildCheckoutCallbackUrl(pathname, sp.toString());

  const productCode  = sp.get('product_code') || '';
  const packageId    = sp.get('package') || '1';
  const productName  = sp.get('product_name') || 'Asuransi Perjalanan';
  const provider     = sp.get('provider')     || '';
  const carrierCode  = sp.get('carrier_code') || provider;
  const carrierName  = sp.get('carrier_name') || provider;
  const dateStart    = sp.get('date_start')   || '';
  const dateEnd      = sp.get('date_end')     || '';
  const paxCount     = Math.max(1, parseInt(sp.get('pax') || '1') || 1);
  const isSenior     = sp.get('is_senior') === 'true';
  const destination  = sp.get('destination')  || '';
  const destinationArea = sp.get('destination_area') || destination;
  const totalAmount  = parseFloat(sp.get('total_amount') || '0') || 0;
  const sectorType   = sp.get('sector_type')  || '';
  const productType  = sp.get('product_type') || 'individual';
  const tripType     = sp.get('trip_type')    || 'single_trip';
  const nights       = parseInt(sp.get('nights') || '1');

  usePageTitle(`Pembayaran Asuransi: ${destination || productName}`);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [markup, setMarkup] = useState<MarkupSettings>({ flight: 50000, hotel: 10, train: 15000, insurance: 5 });
const [checkoutDone, setCheckoutDone] = useState(false);
const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
const [discountAmount, setDiscountAmount] = useState(0);

  useEffect(() => {
    fetch('/api/markup').then(r=>r.json()).then(d=>{ if(d?.insurance!==undefined) setMarkup(d); }).catch(()=>{});
  }, []);

  const adminFee = Math.round(totalAmount * (markup.insurance / 100));
  const pricingAmount = totalAmount;
  const grandTotal = Math.max(0, pricingAmount + adminFee - discountAmount);

  const initPax = () => Array.from({ length: paxCount }, (_, i) => ({
    pax_type: 'ADT', title: 'MR', first_name: '', last_name: '',
    birth_date: '', nationality_code: 'ID',
    email: i === 0 ? (session?.user?.email || '') : '',
    phone_number: '',
    identity: { identity_type: 'passport', identity_number: '', identity_expdate: '', identity_country_of_issued_code: 'ID' },
    data_insurance: { city: '', place_of_birth: '', address: '', postal_code: '', province: '', country: 'Indonesia', relation: [], beneficiary: {}, addons: '', subdistrict: '', village_district: '' },
    behaviors: {}, description: '', is_also_booker: i === 0, is_also_contact: i === 0,
  }));

  const [passengers, setPassengers] = useState<any[]>(initPax);
  const [contact, setContact] = useState({
    title: 'MR', first_name: '', last_name: '',
    email: session?.user?.email || '', calling_code: '62', mobile: '', nationality_code: 'ID',
  });

  useEffect(() => {
    if (session?.user?.email) setContact(c => ({ ...c, email: c.email || session.user!.email! }));
    if (session?.user?.name) {
      const parts = (session.user.name || '').split(' ');
      setContact(c => ({ ...c, first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' }));
    }
  }, [session]);

  const updatePax = (i: number, path: string, val: string) => {
    setPassengers(prev => prev.map((x, j) => {
      if (j !== i) return x;
      if (path.startsWith('identity.'))        return { ...x, identity:        { ...x.identity,        [path.slice(9)]:  val } };
      if (path.startsWith('data_insurance.'))  return { ...x, data_insurance:  { ...x.data_insurance,  [path.slice(15)]: val } };
      return { ...x, [path]: val };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (checkoutDone) return;
    if (!contact.first_name) { setError('Nama kontak wajib diisi.'); return; }
    if (!contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) { setError('Format email tidak valid.'); return; }
    if (!contact.mobile || !/^\d{8,15}$/.test(contact.mobile)) { setError('Nomor HP minimal 8 digit angka.'); return; }
    if (!passengers.length) { setError('Minimal 1 penumpang wajib diisi.'); return; }
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.first_name) { setError(`Nama depan penumpang ${i + 1} wajib diisi.`); return; }
      if (!p.birth_date) { setError(`Tanggal lahir penumpang ${i + 1} wajib diisi.`); return; }
    }
    setLoading(true); setError('');
    try {
      const formattedPax = passengers.map((pax, idx) => ({
        ...pax,
        passenger_seq_id: (session?.user as any)?.id ? `CU.${(session?.user as any).id}` : `GUEST.${idx + 1}`,
        email: pax.email || contact.email,
        phone_number: pax.phone_number || (contact.calling_code + contact.mobile),
        is_also_booker: idx === 0, is_also_contact: idx === 0,
      }));
      const formattedContact = { ...contact, contact_seq_id: (session?.user as any)?.id ? `CU.${(session?.user as any).id}` : 'GUEST.1', is_also_booker: true };
      const formattedBooker = { ...contact, booker_seq_id: (session?.user as any)?.id ? `CU.${(session?.user as any).id}` : 'GUEST.1' };

      const res = await fetch('/api/insurance/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [formattedContact], passengers: formattedPax, booker: formattedBooker,
          provider, carrier_code: carrierCode, total_amount: pricingAmount, product_name: productName, product_code: productCode,
          package: packageId,
          date_start: dateStart, date_end: dateEnd, destination, destination_area: destinationArea,
          is_senior: isSenior,
          international: !/domestic|domestik/i.test(destinationArea), type: tripType, product_type: productType,
          ...(appliedCoupon && { coupon_code: appliedCoupon.code, discount_amount: discountAmount }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuat pesanan');
      setCheckoutDone(true);

      router.push(data.orderId ? `/payment/${data.orderId}` : '/bookings');
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1.5';

  return (
    <>
      <div className="bg-slate-50 min-h-screen">
        <LeaveGuard active={!checkoutDone} fallbackHref="/insurance/search" />
        {/* Header */}
        <div className="bg-white border-b border-slate-200 py-4 px-6">
          <div className="max-w-[1280px] mx-auto flex items-center justify-between">
            <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
              ← {tc.back}
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">Data Peserta Asuransi</p>
              <p className="text-xs text-slate-400">{productName}</p>
            </div>
            <div className="w-16"/>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
          {/* Guest banner */}
          {isGuest && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-sm">?</div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Belum punya akun?</p>
                  <p className="text-xs text-slate-400"><Link href={`/login?callbackUrl=${checkoutCallbackUrl}`} className="text-slate-600 underline">Masuk</Link> atau <Link href={`/register?callbackUrl=${checkoutCallbackUrl}`} className="text-slate-600 underline">daftar</Link> untuk melihat riwayat polis.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* LEFT: Form */}
              <div className="flex-1 min-w-0 space-y-4">
                {passengers.map((pax, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                    <h2 className="text-sm font-bold text-slate-800 mb-4">
                      Peserta {i + 1}{i === 0 && <span className="text-slate-400 font-normal ml-1">(Utama)</span>}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Sapaan *</label>
                        <select value={pax.title} onChange={e => updatePax(i, 'title', e.target.value)} className={sel}>
                          {TITLES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>{t.firstName} *</label>
                        <input value={pax.first_name} onChange={e => updatePax(i, 'first_name', e.target.value.toUpperCase())} placeholder="JOHN" required className={inp} />
                      </div>
                      <div>
                        <label className={labelCls}>{t.lastName}</label>
                        <input value={pax.last_name} onChange={e => updatePax(i, 'last_name', e.target.value.toUpperCase())} placeholder="DOE" className={inp} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className={labelCls}>{t.birthDate} *</label>
                        <DatePickerField
                          value={pax.birth_date}
                          onChange={(iso) => updatePax(i, 'birth_date', iso)}
                          maxDate={new Date()}
                          placeholder="Pilih tanggal lahir"
                          defaultMonth={new Date(2000, 0, 1)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>{t.passport} *</label>
                        <input value={pax.identity.identity_number} onChange={e => updatePax(i, 'identity.identity_number', e.target.value.toUpperCase())} placeholder="A1234567" required className={inp} />
                      </div>
                      <div>
                        <label className={labelCls}>Paspor Berlaku Sampai *</label>
                        <DatePickerField
                          value={pax.identity.identity_expdate}
                          onChange={(iso) => updatePax(i, 'identity.identity_expdate', iso)}
                          minDate={new Date()}
                          endMonth={new Date(new Date().getFullYear() + 15, 11, 31)}
                          placeholder="Pilih tanggal kedaluwarsa"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className={labelCls}>{t.email}</label>
                        <input type="email" value={pax.email} onChange={e => updatePax(i, 'email', e.target.value)} placeholder="peserta@email.com" className={inp} />
                      </div>
                      <div>
                        <label className={labelCls}>Kewarganegaraan</label>
                        <input value={pax.nationality_code} onChange={e => updatePax(i, 'nationality_code', e.target.value.toUpperCase())} placeholder="ID" maxLength={2} className={inp} />
                      </div>
                    </div>

                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none list-none">
                        Data Tambahan (Alamat & Kota Kelahiran) ▾
                      </summary>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Kota Tinggal</label>
                          <input value={pax.data_insurance.city} onChange={e => updatePax(i, 'data_insurance.city', e.target.value)} placeholder="Jakarta" className={inp} />
                        </div>
                        <div>
                          <label className={labelCls}>Tempat Lahir</label>
                          <input value={pax.data_insurance.place_of_birth} onChange={e => updatePax(i, 'data_insurance.place_of_birth', e.target.value)} placeholder="Jakarta" className={inp} />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Alamat Lengkap</label>
                          <input value={pax.data_insurance.address} onChange={e => updatePax(i, 'data_insurance.address', e.target.value)} placeholder="Jl. Sudirman No. 1" className={inp} />
                        </div>
                        <div>
                          <label className={labelCls}>Kode Pos</label>
                          <input value={pax.data_insurance.postal_code} onChange={e => updatePax(i, 'data_insurance.postal_code', e.target.value)} placeholder="12345" className={inp} />
                        </div>
                        <div>
                          <label className={labelCls}>Provinsi</label>
                          <input value={pax.data_insurance.province} onChange={e => updatePax(i, 'data_insurance.province', e.target.value)} placeholder="DKI Jakarta" className={inp} />
                        </div>
                      </div>
                    </details>
                  </div>
                ))}

                {/* Data Kontak */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-bold text-slate-800 mb-4">{t.contactDetails}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Sapaan *</label>
                      <select value={contact.title} onChange={e => setContact(c => ({ ...c, title: e.target.value }))} className={sel}>
                        {TITLES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{t.firstName} *</label>
                      <input value={contact.first_name} onChange={e => setContact(c => ({ ...c, first_name: e.target.value.toUpperCase() }))} required placeholder="JOHN" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls}>{t.lastName}</label>
                      <input value={contact.last_name} onChange={e => setContact(c => ({ ...c, last_name: e.target.value.toUpperCase() }))} placeholder="DOE" className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className={labelCls}>Kode Negara *</label>
                      <input value={contact.calling_code} onChange={e => setContact(c => ({ ...c, calling_code: e.target.value }))} placeholder="62" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls}>{t.phone} *</label>
                      <input value={contact.mobile} onChange={e => setContact(c => ({ ...c, mobile: e.target.value }))} placeholder="081234567890" required className={inp} />
                    </div>
                    <div>
                      <label className={labelCls}>{t.email} *</label>
                      <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} required placeholder="email@contoh.com" className={inp} />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{t.processing}</>
                  ) : (
                    <>{t.proceedPayment} →</>
                  )}
                </button>
              </div>

              {/* RIGHT: Summary */}
              <div className="w-full lg:w-[320px] shrink-0 sticky top-24 space-y-4">
                {/* Ringkasan Produk */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Ringkasan Polis</h3>

                  <div className="bg-slate-50 rounded-lg p-3 mb-4">
                    <h4 className="font-bold text-slate-900 text-sm leading-snug mb-1">{productName}</h4>
                    <p className="text-[11px] text-slate-400 font-mono">{productCode}</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    {destination && <div className="flex justify-between"><span className="text-slate-500">Destinasi</span><span className="font-semibold text-slate-700">{destination}</span></div>}
                    {dateStart && <div className="flex justify-between"><span className="text-slate-500">Mulai</span><span className="font-semibold text-slate-700">{fmtDate(dateStart)}</span></div>}
                    {dateEnd && <div className="flex justify-between"><span className="text-slate-500">Selesai</span><span className="font-semibold text-slate-700">{fmtDate(dateEnd)}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Durasi</span><span className="font-semibold text-slate-700">{nights} hari</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Peserta</span><span className="font-semibold text-slate-700">{paxCount} orang</span></div>
                    {tripType && <div className="flex justify-between"><span className="text-slate-500">Tipe</span><span className="font-semibold text-slate-700">{/annual|anual|yearly/i.test(String(tripType)) ? 'Tahunan' : 'Sekali Jalan'}</span></div>}
                    {sectorType && <div className="flex justify-between"><span className="text-slate-500">Sektor</span><span className="font-semibold text-slate-700">{sectorType}</span></div>}
                  </div>

                  <div className="border-t border-slate-100 mt-4 pt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Premi</span>
                      <span className="font-semibold text-slate-700">{fmtIDR(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Biaya Admin ({markup.insurance}%)</span>
                      <span className="font-semibold text-slate-700">{fmtIDR(adminFee)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <CouponInput
                      category="insurance"
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
                </div>

                {/* Keunggulan singkat */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Yang Kamu Dapatkan</h4>
                  <div className="space-y-2 text-xs text-slate-600">
                    <p>Biaya medis darurat luar negeri</p>
                    <p>Pembatalan & penundaan perjalanan</p>
                    <p>Kehilangan & kerusakan bagasi</p>
                    <p>Kecelakaan diri & evakuasi darurat</p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function InsuranceCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    }>
      <InsuranceCheckoutContent />
    </Suspense>
  );
}
