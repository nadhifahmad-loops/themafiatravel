'use client';
import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

// ─── Interfaces & Constants ───────────────────────────────────────────────────
const TITLES = ['MR', 'MRS', 'MS'];
const INFANT_TITLES = ['MSTR', 'MISS'];
const PAX_LABELS: Record<string, string> = { ADT: 'Dewasa', INF: 'Bayi' };
const CABIN_LABELS: Record<string, string> = { E: 'Eksekutif', B: 'Bisnis', K: 'Ekonomi', P: 'Prioritas' };

function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtTime(dt: string) { if (!dt) return '--:--'; return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16); }
function fmtDate(dt: string) { if (!dt) return ''; return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDur(e: string) {
  if (!e) return '';
  const p = e.split(':');
  if (p.length >= 2) {
    const h = parseInt(p[0], 10);
    const m = parseInt(p[1], 10);
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  }
  return e;
}

// ─── Toggle Addon Card ────────────────────────────────────────────────────────
function AddonCard({ icon, bgIcon, title, subtitle, badge, badgeColor, children, isChecked, onToggle, price, expandable }: any) {
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${isChecked?'border-orange-400 shadow-sm':'border-slate-200'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgIcon||'bg-orange-100'}`}>
            <i className={`fa-solid ${icon} text-base`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-800 text-sm">{title}</p>
              {badge && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeColor||'bg-orange-100 text-orange-700'}`}>{badge}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            {expandable && (
              <button onClick={()=>setDetailOpen(!detailOpen)} type="button" className="text-xs text-orange-600 hover:underline font-semibold mt-0.5 outline-none">
                Selengkapnya {detailOpen?'▲':'▼'}
              </button>
            )}
          </div>
          {onToggle && (
            <div className={`relative inline-flex items-center w-10 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${isChecked?'bg-orange-500':'bg-slate-200'}`} onClick={onToggle}>
              <div className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${isChecked?'translate-x-5':'translate-x-1'}`}/>
            </div>
          )}
        </div>
        {detailOpen && children && <div className="mt-3">{children}</div>}
        {!expandable && children && <div className="mt-3">{children}</div>}
        {price !== undefined && price > 0 && isChecked && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">Ditambahkan</span>
            <span className="text-sm font-black text-orange-600">+ {fmtIDR(price)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Passenger Form ───────────────────────────────────────────────────────────
function PassengerForm({ pax, index, inputCls, labelCls, selectCls, onChange }: any) {
  const paxLabel = pax.pax_type==='ADT'?'Dewasa':'Bayi';
  const isInfant = pax.pax_type === 'INF';
  const titleOptions = isInfant ? INFANT_TITLES : TITLES;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black text-xs">{index+1}</div>
        <h3 className="font-black text-slate-800 text-sm">Penumpang {index+1} · <span className="font-semibold text-slate-500">{paxLabel}</span></h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={labelCls}>Sapaan</label>
          <select value={pax.title} onChange={e=>onChange(index,'title',e.target.value)} className={selectCls}>
            {titleOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>Nama Depan (Sesuai ID)</label>
          <input value={pax.first_name} onChange={e=>onChange(index,'first_name',e.target.value.toUpperCase())} className={inputCls} placeholder="Contoh: BUDI"/>
        </div>
        <div><label className={labelCls}>Nama Belakang</label>
          <input value={pax.last_name} onChange={e=>onChange(index,'last_name',e.target.value.toUpperCase())} className={inputCls} placeholder="Contoh: SANTOSO"/>
        </div>
        <div><label className={labelCls}>Kewarganegaraan</label>
          <select value={pax.nationality_code} onChange={e=>onChange(index,'nationality_code',e.target.value)} className={selectCls}>
            <option value="ID">Indonesia</option><option value="SG">Singapura</option><option value="MY">Malaysia</option>
          </select>
        </div>
        <div><label className={labelCls}>Tanggal Lahir</label>
          <input type="date" value={pax.birth_date} onChange={e=>onChange(index,'birth_date',e.target.value)} className={inputCls}/>
        </div>
        <div><label className={labelCls}>Jenis Identitas</label>
          <select value={pax.identity.identity_type} onChange={e=>onChange(index,'identity',{...pax.identity,identity_type:e.target.value})} className={selectCls}>
            <option value="ktp">KTP / NIK</option><option value="passport">Paspor</option>
            {isInfant && <option value="other">Lainnya (Tanggal Lahir)</option>}
          </select>
        </div>
        <div className="sm:col-span-2"><label className={labelCls}>Nomor Identitas</label>
          <input value={pax.identity.identity_number} onChange={e=>onChange(index,'identity',{...pax.identity,identity_number:e.target.value.toUpperCase()})} className={inputCls} placeholder="16 Digit NIK / No. Paspor"/>
        </div>
        {pax.identity.identity_type==='passport'&&(
          <>
            <div><label className={labelCls}>Berlaku Hingga</label>
              <input type="date" value={pax.identity.identity_expdate} onChange={e=>onChange(index,'identity',{...pax.identity,identity_expdate:e.target.value})} className={inputCls}/>
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

// ─── Main Checkout Content ────────────────────────────────────────────────────
function TrainCheckoutContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  const isSubmittingRef = useRef(false);

  // Payload extraction
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

  // Addons Prices
  const ADDON_PRICES = { insurance: 45000, refund: 30000 };
  const [addInsurance, setAddInsurance] = useState(false);
  const [addRefund, setAddRefund] = useState(false);

  const insuranceFee = addInsurance ? ADDON_PRICES.insurance * paxCount : 0;
  const refundFee = addRefund ? ADDON_PRICES.refund * paxCount : 0;
  const grandTotal = baseAmount + insuranceFee + refundFee;

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initPax = (type: string, count: number) =>
    Array.from({ length: count }, () => ({
      pax_type: type, title: type === 'INF' ? 'MSTR' : 'MR', first_name: '', last_name: '',
      birth_date: '', nationality_code: 'ID',
      identity: { identity_type: 'ktp', identity_number: '', identity_expdate: '', identity_country_of_issued_code: 'ID' },
    }));

  const [passengers, setPassengers] = useState<any[]>([
    ...initPax('ADT', adultCount),
    ...initPax('INF', infantCount),
  ]);

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

  const isFormValid = () => {
    if (!contact.first_name.trim() || !contact.email.trim() || !contact.mobile.trim()) return false;
    return passengers.every(p => p.first_name.trim() && p.birth_date && p.identity?.identity_number?.trim());
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current || !isFormValid()) return;
    isSubmittingRef.current = true;
    setLoading(true); setError('');

    try {
      const res = await fetch('/api/train/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [contact],
          passengers,
          booker: { ...contact },
          schedules: [{
            journeys: [{ journey_code: journeyCode, fare_code: fareCode }],
            provider: 'kai',
          }],
          total_amount: grandTotal,
          origin, destination, departure_date: departureDate,
          train_name: trainName, train_number: trainNumber, cabin_class: cabinClass,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuat pesanan kereta. Cek kembali rute atau tiket.');

      if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
      if (data.snapToken) {
        const sandbox = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION !== 'true';
        window.location.href = sandbox
          ? `https://app.sandbox.midtrans.com/snap/v2/vtweb/${data.snapToken}`
          : `https://app.midtrans.com/snap/v2/vtweb/${data.snapToken}`;
        return;
      }

      const orderNo = data.orderNumber || '';
      if (!isGuest) router.push(orderNo ? `/booking?order=${orderNo}` : '/booking');
      else router.push(orderNo ? `/find-booking?order=${orderNo}` : '/find-booking');

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // UI Classes (Tailwind)
  const inputCls = 'w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-slate-800 text-sm outline-none focus:border-orange-400 focus:bg-white transition-all';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5';
  const selectCls = inputCls + ' cursor-pointer';

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="container mx-auto max-w-[1280px] px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-orange-600 text-sm font-semibold transition-colors">
            <i className="fa-solid fa-arrow-left text-xs"></i> Kembali
          </button>
          <div className="flex items-center gap-2 text-xs font-bold">
            <div className="flex items-center gap-1.5 text-orange-600">
              <div className="w-5 h-5 bg-orange-600 text-white rounded-full flex items-center justify-center text-[9px]">1</div>
              <span className="hidden sm:block">Detail Perjalanan</span>
            </div>
            <i className="fa-solid fa-chevron-right text-slate-300 text-[10px]"></i>
            <div className="flex items-center gap-1.5 text-slate-400">
              <div className="w-5 h-5 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center text-[9px]">2</div>
              <span className="hidden sm:block">Pembayaran Kereta</span>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-600">{trainName}</p>
            <p className="text-xs text-slate-400">{origin} → {destination}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-[1280px] px-4 py-6">
        {isGuest && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0"></i>
            <div className="text-sm"><p className="font-bold text-blue-800">Memesan sebagai tamu</p>
              <p className="text-blue-600"><Link href="/login" className="underline font-semibold">Masuk</Link> atau <Link href="/register" className="underline font-semibold">daftar</Link> untuk mempermudah pengecekan e-tiket.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3 text-red-700">
            <i className="fa-solid fa-circle-exclamation text-lg mt-0.5 shrink-0"></i>
            <div><p className="font-bold mb-1 text-sm">Pemesanan Gagal</p><p className="text-sm">{error}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          
          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">
            {/* Data Pemesan */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-envelope text-orange-600 text-sm"></i>
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-sm">Data Kontak & Pemesan</h2>
                  <p className="text-xs text-slate-500">E-tiket akan dikirim ke kontak di bawah ini.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nama Lengkap Pemesan</label>
                  <input
                    value={`${contact.first_name}${contact.last_name ? ' '+contact.last_name : ''}`.trim()}
                    onChange={e => {
                      const p = e.target.value.split(' ');
                      setContact(c => ({ ...c, first_name: p[0]||'', last_name: p.slice(1).join(' ')||'' }));
                    }}
                    className={inputCls} placeholder="Sesuai KTP / Identitas"
                  />
                </div>
                <div>
                  <label className={labelCls}>No. Handphone</label>
                  <div className="flex gap-2">
                    <select value={contact.calling_code} onChange={e=>setContact(c=>({...c, calling_code:e.target.value}))} className="w-20 px-2 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-slate-600 text-sm outline-none focus:border-orange-400 cursor-pointer">
                      <option value="62">+62</option>
                    </select>
                    <input value={contact.mobile} onChange={e=>setContact(c=>({...c, mobile:e.target.value.replace(/\D/g,'')}))} className={inputCls} placeholder="8123456xxxx"/>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email Utama</label>
                  <input type="email" value={contact.email} onChange={e=>setContact(c=>({...c, email:e.target.value}))} className={inputCls} placeholder="email@contoh.com"/>
                </div>
              </div>
            </div>

            {/* Penumpang */}
            {passengers.map((pax, i) => (
              <PassengerForm key={i} pax={pax} index={i} inputCls={inputCls} labelCls={labelCls} selectCls={selectCls} onChange={updatePax}/>
            ))}

            {/* Pelengkap Perjalanan */}
            <div>
              <h2 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                <i className="fa-solid fa-puzzle-piece text-orange-500"></i>
                Pelengkap Perjalanan
              </h2>
              <div className="space-y-3">
                {/* Info Assign Seat KAI */}
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-chair text-slate-500 text-base"></i>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">Pemilihan Kursi</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Peta dan pemilihan kursi KAI dapat dilakukan <strong>setelah pembayaran berhasil (issued)</strong> pada halaman detail transaksi atau loket KAI.
                      </p>
                    </div>
                  </div>
                </div>

                <AddonCard icon="fa-shield-check" bgIcon="bg-emerald-100" title="Jaminan Uang Kembali"
                  subtitle="Batalkan tiket kereta sebelum keberangkatan dan dapatkan pengembalian."
                  badge="Fleksibel" badgeColor="bg-emerald-100 text-emerald-700"
                  isChecked={addRefund} onToggle={()=>setAddRefund(!addRefund)}
                  price={refundFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-500 text-[10px]"></i>Batal maksimal 2 jam sebelum keberangkatan</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.refund)}/penumpang</li>
                  </ul>
                </AddonCard>

                <AddonCard icon="fa-umbrella" bgIcon="bg-orange-100" title="Asuransi Perjalanan Kereta"
                  subtitle="Perlindungan ekstra selama perjalanan darat Anda."
                  isChecked={addInsurance} onToggle={()=>setAddInsurance(!addInsurance)}
                  price={insuranceFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>Biaya medis darurat akibat kecelakaan</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>Kehilangan bagasi bawaan di kereta</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.insurance)}/penumpang</li>
                  </ul>
                </AddonCard>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN (SUMMARY) ── */}
          <div className="space-y-4 sticky top-32">
            
            {/* Train Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-orange-600 px-4 py-3 flex items-center justify-between">
                <span className="text-white text-xs font-bold">Ringkasan Tiket</span>
                <span className="text-orange-200 text-xs">Sekali Jalan</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                     <i className="fa-solid fa-train text-orange-500 text-xs"></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-wide">KAI</span>
                    <span className="text-xs font-bold text-slate-700 ml-2">{trainName} ({trainNumber})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-wider mt-2">
                  <span>{origin}</span>
                  <div className="flex items-center gap-1 flex-1 px-2">
                    <div className="flex-1 h-px bg-slate-200"></div>
                    <i className="fa-solid fa-train-tram text-orange-400 text-[10px]"></i>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>
                  <span>{destination}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-xl font-black text-slate-900">{fmtTime(departureDate)}</p></div>
                  <div className="text-center text-xs text-slate-400">{fmtDur(elapsedTime)}</div>
                  <div className="text-right"><p className="text-xl font-black text-slate-900">{fmtTime(arrivalDate)}</p></div>
                </div>
                <p className="text-xs text-slate-400">{fmtDate(departureDate)}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                    {CABIN_LABELS[cabinClass]} {classOfService && `(${classOfService})`}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Detail */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-black text-slate-800 text-sm mb-3">Rincian Harga</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tiket KAI ×{adultCount}</span>
                  <span className="font-semibold">{fmtIDR(baseAmount)}</span>
                </div>
                {infantCount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tiket Bayi ×{infantCount}</span>
                    <span className="font-semibold text-emerald-600">Gratis</span>
                  </div>
                )}
                {addInsurance && (
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1"><i className="fa-solid fa-plus text-orange-400 text-[9px]"></i>Asuransi Perjalanan</span>
                    <span className="font-semibold text-orange-600">{fmtIDR(insuranceFee)}</span>
                  </div>
                )}
                {addRefund && (
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1"><i className="fa-solid fa-plus text-orange-400 text-[9px]"></i>Jaminan Uang Kembali</span>
                    <span className="font-semibold text-orange-600">{fmtIDR(refundFee)}</span>
                  </div>
                )}
                
                <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between font-black text-slate-900">
                  <span>Total Bayar</span>
                  <span className="text-orange-600 text-base">{fmtIDR(grandTotal)}</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !isFormValid()}
                className="mt-4 w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all text-base active:scale-95 shadow-lg shadow-orange-600/20"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Memproses...</span>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <TrainCheckoutContent/>
    </Suspense>
  );
}