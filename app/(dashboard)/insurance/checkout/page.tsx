'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const TITLES = ['MR', 'MRS', 'MS', 'MSTR', 'MISS'];

function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  assistcard:    { label: '🩺 Assist Card',    bg: 'bg-blue-100',    text: 'text-blue-700'    },
  bcainsurance:  { label: '🏦 BCA Insurance',  bg: 'bg-sky-100',     text: 'text-sky-700'     },
  zurich:        { label: '🔵 Zurich',         bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
  great_eastern: { label: '🟢 Great Eastern',  bg: 'bg-emerald-100', text: 'text-emerald-700' },
  oona:          { label: '🟠 Oona',           bg: 'bg-orange-100',  text: 'text-orange-700'  },
};

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50">
        <i className={`fa-solid ${icon} text-orange-500`}></i>
        <h2 className="font-black text-slate-800 text-sm">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4`}>{children}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inp = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200 transition-colors placeholder-slate-400";
const sel = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200 transition-colors appearance-none";

function InsuranceCheckoutContent() {
  const sp             = useSearchParams();
  const router         = useRouter();
  const { data: session } = useSession();

  const productCode  = sp.get('product_code') || '';
  const productName  = sp.get('product_name') || 'Asuransi Perjalanan';
  const provider     = sp.get('provider')     || '';
  const carrierCode  = sp.get('carrier_code') || provider;
  const carrierName  = sp.get('carrier_name') || provider;
  const dateStart    = sp.get('date_start')   || '';
  const dateEnd      = sp.get('date_end')     || '';
  const paxCount     = parseInt(sp.get('pax') || '1');
  const destination  = sp.get('destination')  || '';
  const totalAmount  = parseFloat(sp.get('total_amount') || '0');
  const sectorType   = sp.get('sector_type')  || '';
  const productType  = sp.get('product_type') || 'individual';
  const tripType     = sp.get('trip_type')    || 'single_trip';
  const nights       = parseInt(sp.get('nights') || '1');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const initPax = () => Array.from({ length: paxCount }, (_, i) => ({
    pax_type: 'ADT', title: 'MR',
    first_name: '', last_name: '',
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

  // Sinkron email session ke contact
  useEffect(() => {
    if (session?.user?.email) setContact(c => ({ ...c, email: session.user!.email! }));
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
    e.preventDefault(); setLoading(true); setError('');
    try {
      const formattedPax = passengers.map((pax, idx) => ({
        ...pax,
        passenger_seq_id: (session?.user as any)?.id ? `CU.${(session.user as any).id}` : `GUEST.${idx + 1}`,
        email:        pax.email        || contact.email,
        phone_number: pax.phone_number || (contact.calling_code + contact.mobile),
        is_also_booker:  idx === 0,
        is_also_contact: idx === 0,
      }));

      const formattedContact = {
        ...contact,
        contact_seq_id: (session?.user as any)?.id ? `CU.${(session.user as any).id}` : 'GUEST.1',
        is_also_booker: true,
      };

      const formattedBooker = {
        ...contact,
        booker_seq_id: (session?.user as any)?.id ? `CU.${(session.user as any).id}` : 'GUEST.1',
      };

      const res = await fetch('/api/insurance/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [formattedContact], passengers: formattedPax, booker: formattedBooker,
          provider, carrier_code: carrierCode,
          total_amount: totalAmount, product_name: productName, product_code: productCode,
          date_start: dateStart, date_end: dateEnd, destination,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuat pesanan');

      if (data.snapToken && typeof (window as any).snap !== 'undefined') {
        (window as any).snap.pay(data.snapToken, {
          onSuccess: () => router.push(`/insurance/confirmation?order=${data.orderId}&status=success`),
          onPending: () => router.push(`/insurance/confirmation?order=${data.orderId}&status=pending`),
          onError:   () => { setError('Pembayaran gagal.'); setLoading(false); },
          onClose:   () => setLoading(false),
        });
      } else if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        router.push(`/insurance/confirmation?order=${data.orderId || 'unknown'}&status=pending`);
      }
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const badge = PROVIDER_BADGE[provider] || { label: carrierName || provider, bg: 'bg-slate-100', text: 'text-slate-700' };

  return (
    <>
      <script src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} async />

      <div className="bg-[#f4f6fb] min-h-screen pt-20">
        {/* Banner */}
        <div className="bg-blue-800 text-white">
          <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex items-center gap-2 text-sm">
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-blue-300 hover:text-white transition-colors mr-2">
              <i className="fa-solid fa-arrow-left text-xs"></i> Kembali
            </button>
            <i className="fa-solid fa-shield-halved text-blue-300"></i>
            <span className="font-black">Data Peserta Asuransi</span>
            <span className="text-blue-300">·</span>
            <span className="text-blue-100">{productName}</span>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 mb-5">
              <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
              <div>
                <h3 className="font-bold text-red-800 text-sm">Terjadi Kesalahan</h3>
                <p className="text-sm text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* ── Kolom Kiri: Form ── */}
              <div className="flex-1 min-w-0">

                {/* Data tiap peserta */}
                {passengers.map((pax, i) => (
                  <SectionCard key={i} title={`Peserta ${i + 1}`} icon={i === 0 ? 'fa-user' : 'fa-user-plus'}>
                    {/* Baris 1: Sapaan + Nama */}
                    <FieldRow cols={3}>
                      <Field label="Sapaan" required>
                        <select value={pax.title} onChange={e => updatePax(i, 'title', e.target.value)} className={sel}>
                          {TITLES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Nama Depan" required>
                        <input value={pax.first_name} onChange={e => updatePax(i, 'first_name', e.target.value.toUpperCase())} placeholder="JOHN" required className={inp} />
                      </Field>
                      <Field label="Nama Belakang">
                        <input value={pax.last_name} onChange={e => updatePax(i, 'last_name', e.target.value.toUpperCase())} placeholder="DOE" className={inp} />
                      </Field>
                    </FieldRow>

                    {/* Baris 2: Lahir + Passport */}
                    <FieldRow cols={3}>
                      <Field label="Tanggal Lahir" required>
                        <input type="date" value={pax.birth_date} onChange={e => updatePax(i, 'birth_date', e.target.value)} required className={inp} />
                      </Field>
                      <Field label="No. Paspor" required>
                        <input value={pax.identity.identity_number} onChange={e => updatePax(i, 'identity.identity_number', e.target.value.toUpperCase())} placeholder="A1234567" required className={inp} />
                      </Field>
                      <Field label="Paspor Berlaku Sampai" required>
                        <input type="date" value={pax.identity.identity_expdate} onChange={e => updatePax(i, 'identity.identity_expdate', e.target.value)} required className={inp} />
                      </Field>
                    </FieldRow>

                    {/* Baris 3: Email + Kewarganegaraan */}
                    <FieldRow cols={2}>
                      <Field label="Email Peserta">
                        <input type="email" value={pax.email} onChange={e => updatePax(i, 'email', e.target.value)} placeholder="peserta@email.com" className={inp} />
                      </Field>
                      <Field label="Kewarganegaraan">
                        <input value={pax.nationality_code} onChange={e => updatePax(i, 'nationality_code', e.target.value.toUpperCase())} placeholder="ID" maxLength={2} className={inp} />
                      </Field>
                    </FieldRow>

                    {/* Data tambahan (collapsible) */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-bold text-orange-600 flex items-center gap-1.5 select-none list-none">
                        <i className="fa-solid fa-chevron-down text-[9px]"></i>
                        Data Tambahan (Alamat & Kota Kelahiran)
                      </summary>
                      <div className="mt-3 space-y-3">
                        <FieldRow cols={2}>
                          <Field label="Kota Tinggal">
                            <input value={pax.data_insurance.city} onChange={e => updatePax(i, 'data_insurance.city', e.target.value)} placeholder="Jakarta" className={inp} />
                          </Field>
                          <Field label="Tempat Lahir">
                            <input value={pax.data_insurance.place_of_birth} onChange={e => updatePax(i, 'data_insurance.place_of_birth', e.target.value)} placeholder="Jakarta" className={inp} />
                          </Field>
                        </FieldRow>
                        <Field label="Alamat Lengkap">
                          <input value={pax.data_insurance.address} onChange={e => updatePax(i, 'data_insurance.address', e.target.value)} placeholder="Jl. Sudirman No. 1, Jakarta" className={inp} />
                        </Field>
                        <FieldRow cols={2}>
                          <Field label="Kode Pos">
                            <input value={pax.data_insurance.postal_code} onChange={e => updatePax(i, 'data_insurance.postal_code', e.target.value)} placeholder="12345" className={inp} />
                          </Field>
                          <Field label="Provinsi">
                            <input value={pax.data_insurance.province} onChange={e => updatePax(i, 'data_insurance.province', e.target.value)} placeholder="DKI Jakarta" className={inp} />
                          </Field>
                        </FieldRow>
                      </div>
                    </details>
                  </SectionCard>
                ))}

                {/* Data Kontak */}
                <SectionCard title="Data Kontak & Pemesan" icon="fa-phone">
                  <FieldRow cols={3}>
                    <Field label="Sapaan" required>
                      <select value={contact.title} onChange={e => setContact(c => ({ ...c, title: e.target.value }))} className={sel}>
                        {TITLES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Nama Depan" required>
                      <input value={contact.first_name} onChange={e => setContact(c => ({ ...c, first_name: e.target.value.toUpperCase() }))} required placeholder="JOHN" className={inp} />
                    </Field>
                    <Field label="Nama Belakang">
                      <input value={contact.last_name} onChange={e => setContact(c => ({ ...c, last_name: e.target.value.toUpperCase() }))} placeholder="DOE" className={inp} />
                    </Field>
                  </FieldRow>
                  <FieldRow cols={3}>
                    <Field label="Kode Negara" required>
                      <input value={contact.calling_code} onChange={e => setContact(c => ({ ...c, calling_code: e.target.value }))} placeholder="62" className={inp} />
                    </Field>
                    <Field label="No. HP" required>
                      <input value={contact.mobile} onChange={e => setContact(c => ({ ...c, mobile: e.target.value }))} placeholder="081234567890" required className={inp} />
                    </Field>
                    <Field label="Email" required>
                      <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} required placeholder="email@contoh.com" className={inp} />
                    </Field>
                  </FieldRow>
                </SectionCard>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-black text-base rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-600/20"
                >
                  {loading ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Memproses Polis...</>
                  ) : (
                    <>Lanjut ke Pembayaran <i className="fa-solid fa-arrow-right"></i></>
                  )}
                </button>
              </div>

              {/* ── Kolom Kanan: Summary ── */}
              <div className="w-full lg:w-[320px] shrink-0 sticky top-24 space-y-4">
                {/* Ringkasan Produk */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-5 py-4 border-b border-slate-100">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-receipt text-orange-500"></i> Ringkasan Polis
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {/* Badge provider */}
                    <span className={`inline-flex items-center text-xs font-black px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>

                    {/* Nama produk */}
                    <div className="bg-slate-50 rounded-xl p-3">
                      <h4 className="font-black text-slate-900 text-sm leading-snug mb-1">{productName}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">{productCode}</p>
                    </div>

                    {/* Info trip */}
                    <div className="space-y-2">
                      {[
                        { icon: 'fa-location-dot',  label: 'Destinasi',    val: destination  },
                        { icon: 'fa-calendar',       label: 'Mulai',        val: fmtDate(dateStart) },
                        { icon: 'fa-calendar-check', label: 'Selesai',      val: fmtDate(dateEnd)   },
                        { icon: 'fa-clock',          label: 'Durasi',       val: `${nights} hari`   },
                        { icon: 'fa-users',          label: 'Peserta',      val: `${paxCount} orang`},
                        { icon: 'fa-plane',          label: 'Tipe',         val: tripType === 'annual_trip' ? 'Tahunan' : 'Sekali Jalan' },
                        { icon: 'fa-globe',          label: 'Sektor',       val: sectorType || 'Internasional' },
                        { icon: 'fa-tag',            label: 'Jenis',        val: productType  },
                      ].filter(r => r.val).map((r, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <i className={`fa-solid ${r.icon} w-3.5 text-center text-[10px]`}></i>
                            {r.label}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 text-right max-w-[55%]">{r.val}</span>
                        </div>
                      ))}
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Total harga */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Total Premi</p>
                        <p className="text-2xl font-black text-orange-600">{fmtIDR(totalAmount)}</p>
                        <p className="text-[10px] text-slate-400">Belum termasuk pajak aplikasi</p>
                      </div>
                    </div>

                    {/* Trust badge */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <i className="fa-solid fa-lock text-emerald-600 text-sm"></i>
                      <div>
                        <p className="text-xs font-black text-emerald-800">Pembayaran Aman</p>
                        <p className="text-[10px] text-emerald-600">Diproses via Midtrans SSL</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keunggulan singkat */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3">Yang Kamu Dapatkan</h4>
                  <div className="space-y-2">
                    {[
                      { icon: 'fa-hospital',       text: 'Biaya medis darurat luar negeri' },
                      { icon: 'fa-plane-slash',    text: 'Pembatalan & penundaan perjalanan' },
                      { icon: 'fa-suitcase',       text: 'Kehilangan & kerusakan bagasi' },
                      { icon: 'fa-person-falling', text: 'Kecelakaan diri & evakuasi darurat' },
                    ].map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <i className={`fa-solid ${b.icon} text-orange-500 text-xs w-4 text-center`}></i>
                        <span className="text-xs text-slate-600">{b.text}</span>
                      </div>
                    ))}
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
      <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <InsuranceCheckoutContent />
    </Suspense>
  );
}