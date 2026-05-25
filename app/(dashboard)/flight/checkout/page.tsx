'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import CheckoutNavbar from '@/components/CheckoutNavbar';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface SeatInfo { seat_code: string; column: string; row_number: string; availability: number; base_price: number; seat_name: string; description: string[]; }
interface CabinData { cabin_name: string; cabin_code: string; seat_rows: { row_number: string; seats: SeatInfo[] }[]; }
interface SegmentSeatData { segment_code: string; origin: string; destination: string; carrier_name: string; provider: string; cabins: CabinData[]; }
interface SelectedSeat { seat_code: string; base_price: number; }
interface PassengerIdentity { identity_type: 'ktp' | 'passport'; identity_number: string; identity_expdate: string; identity_country_of_issued_code: string; }
interface Passenger { title: string; first_name: string; last_name: string; birth_date: string; pax_type: 'ADT' | 'CHD' | 'INF'; nationality_code: string; identity: PassengerIdentity; }
interface PriceBreakdown { adultFare: number; adultTax: number; adultCount: number; childFare: number; childTax: number; childCount: number; infantFare: number; infantTax: number; infantCount: number; otherCharges: number; totalFlight: number; }

// Baggage SSR dari API
interface BaggageSsr { ssr_code: string; name: string; kg: number; base_price: number; journey_code: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtTime(dt: string) { if (!dt) return '--:--'; return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16); }
function fmtDate(dt: string) { if (!dt) return ''; return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }

function parsePriceBreakdown(priceResponse: any): PriceBreakdown | null {
  if (!priceResponse) return null;
  const pip = priceResponse?.price_itinerary_provider || [];
  if (!pip.length) return null;
  let adultFare=0,adultTax=0,adultCount=0,childFare=0,childTax=0,childCount=0,infantFare=0,infantTax=0,infantCount=0,otherCharges=0;
  for (const provider of pip) {
    for (const journey of (provider.journeys || [])) {
      for (const seg of (journey.segments || [])) {
        const ff = seg.fares?.[0];
        if (ff?.service_charge_summary) {
          for (const sc of ff.service_charge_summary) {
            const paxCount = sc.pax_count || 1;
            const farePerPax = sc.base_fare || (sc.total_fare/paxCount) || 0;
            const taxPerPax = sc.base_tax || (sc.total_tax/paxCount) || 0;
            for (const ch of (sc.service_charges||[])) { if (ch.charge_type!=='FARE'&&ch.charge_type!=='TAX') otherCharges+=(ch.total||0); }
            if (sc.pax_type==='ADT'){adultFare+=farePerPax;adultTax+=taxPerPax;adultCount=paxCount;}
            else if (sc.pax_type==='CHD'){childFare+=farePerPax;childTax+=taxPerPax;childCount=paxCount;}
            else if (sc.pax_type==='INF'){infantFare+=farePerPax;infantTax+=taxPerPax;infantCount=paxCount;}
          }
        }
      }
    }
  }
  const totalFlight = priceResponse.total_price || ((adultFare+adultTax)*adultCount)+((childFare+childTax)*childCount)+((infantFare+infantTax)*infantCount)+otherCharges;
  return {adultFare,adultTax,adultCount,childFare,childTax,childCount,infantFare,infantTax,infantCount,otherCharges,totalFlight};
}

// ─── Parse SSR Baggage dari respons API ────────────────────────────────────────
// Mengembalikan opsi bagasi per journey_code. Jika ada beberapa journey (RT/Multi),
// akan dikembalikan semua agar UI bisa filter per journey.
function parseBaggageSsr(ssrData: any): BaggageSsr[] {
  if (!ssrData) return [];

  // Terima format: { ssr_availability_provider: [...] }
  // atau sudah di-unwrap ke level response
  const providers: any[] =
    ssrData?.ssr_availability_provider ||
    ssrData?.response?.ssr_availability_provider ||
    [];

  if (!providers.length) return [];

  // key = `${ssr_code}::${journey_code}` agar per-rute tidak tabrakan
  const ssrMap = new Map<string, BaggageSsr>();

  for (const provider of providers) {
    const baggageList: any[] = provider?.ssr_availability?.baggage || [];
    for (const bag of baggageList) {
      const journeyCode = bag.journey_code || '';
      const ssrs: any[] = bag?.ssrs || [];

      for (const ssr of ssrs) {
        // Hanya proses tipe BG (baggage)
        if (ssr.ssr_type !== 'BG') continue;

        // Ambil kg dari nama SSR (e.g. "10 Kg Baggage" → 10)
        const kgMatch = (ssr.name || '').match(/(\d+)\s*[Kk][Gg]/);
        const kg = kgMatch ? parseInt(kgMatch[1]) : 0;
        if (kg === 0) continue;

        // Cari harga untuk ADT; fallback ke charge pertama
        const scForAdt = (ssr.service_charges || []).find(
          (c: any) => c.pax_type === 'ADT'
        ) || ssr.service_charges?.[0];

        if (!scForAdt) continue;

        const price = ssr.base_price || scForAdt.amount || scForAdt.total || 0;
        if (price === 0) continue;

        const key = `${ssr.ssr_code}::${journeyCode}`;
        if (!ssrMap.has(key)) {
          ssrMap.set(key, {
            ssr_code:     ssr.ssr_code,
            name:         ssr.name,
            kg,
            base_price:   price,
            journey_code: journeyCode,
          });
        }
      }
    }
  }

  // Kembalikan unik per ssr_code (ambil harga terkecil jika ada duplikat ssr_code)
  const byCode = new Map<string, BaggageSsr>();
  for (const item of ssrMap.values()) {
    const existing = byCode.get(item.ssr_code);
    if (!existing || item.base_price < existing.base_price) {
      byCode.set(item.ssr_code, item);
    }
  }

  return Array.from(byCode.values()).sort((a, b) => a.kg - b.kg);
}

// ─── Seat Map Component ───────────────────────────────────────────────────────
function SeatMap({ segment, passengerCount, selectedSeats, onSelectSeat }: {
  segment: SegmentSeatData; passengerCount: number;
  selectedSeats: Record<string,SelectedSeat>;
  onSelectSeat: (segCode: string, paxIdx: number, seat: SeatInfo) => void;
}) {
  const [activePassenger, setActivePassenger] = useState(0);
  const validCabins = segment.cabins.filter(c => c.seat_rows?.length > 0);
  if (!validCabins.length) return <p className="text-slate-400 text-sm py-4">Data kursi tidak tersedia.</p>;

  const selectedForSeg = Object.entries(selectedSeats)
    .filter(([k]) => k.startsWith(segment.segment_code+'__'))
    .reduce<Record<number,SelectedSeat>>((acc,[k,v]) => { acc[parseInt(k.split('__')[1])]=v; return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {Array.from({length:passengerCount}).map((_,i) => {
          const hasSel = selectedForSeg[i];
          return (
            <button key={i} onClick={()=>setActivePassenger(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${activePassenger===i?'bg-slate-900 text-white border-slate-900':hasSel?'bg-emerald-50 text-emerald-700 border-emerald-300':'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
              {hasSel?'✓ ':''}Pax {i+1}
            </button>
          );
        })}
      </div>
      {validCabins.map((cabin,ci) => {
        const allCols = Array.from(new Set(cabin.seat_rows.flatMap(r=>r.seats.map(s=>s.column).filter(Boolean)))).sort();
        const aisleAfter = allCols.length>3?Math.floor(allCols.length/2)-1:1;
        return (
          <div key={ci}>
            <div className="flex items-center gap-1 mb-2 pl-10">
              {allCols.map((col,idx)=>(<div key={col} className="flex items-center">{idx===aisleAfter+1&&<div className="w-4"/>}<div className="w-8 text-center text-[10px] font-bold text-slate-400">{col}</div></div>))}
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {cabin.seat_rows.map(row => {
                const colMap: Record<string,SeatInfo|null>={};
                row.seats.forEach(s=>{if(s.column)colMap[s.column]=s;});
                return (
                  <div key={row.row_number} className="flex items-center gap-1">
                    <div className="w-9 text-center text-[10px] text-slate-400 font-bold flex-shrink-0">{row.row_number}</div>
                    {allCols.map((col,idx)=>{
                      const seat=colMap[col]||null;
                      const isSpacer=!seat||seat.availability===-1||!seat.seat_code;
                      const isUnavail=!isSpacer&&seat&&seat.availability<=0;
                      const selBySelf=!isSpacer&&selectedForSeg[activePassenger]?.seat_code===seat?.seat_code;
                      const selByOther=!isSpacer&&Object.entries(selectedForSeg).some(([k,v])=>parseInt(k)!==activePassenger&&v.seat_code===seat?.seat_code);
                      if(isSpacer)return(<div key={col} className="flex items-center">{idx===aisleAfter+1&&<div className="w-4"/>}<div className="w-8 h-8"/></div>);
                      const hasFee=seat&&seat.base_price>0;
                      let cls='w-8 h-8 rounded-md text-[9px] font-bold flex items-center justify-center transition-all border ';
                      if(isUnavail)cls+='bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed';
                      else if(selBySelf)cls+='bg-orange-500 border-orange-600 text-white scale-105 shadow-md cursor-pointer';
                      else if(selByOther)cls+='bg-emerald-200 border-emerald-400 text-emerald-700 cursor-not-allowed';
                      else if(hasFee)cls+='bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:scale-105 cursor-pointer';
                      else cls+='bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:scale-105 cursor-pointer';
                      return(
                        <div key={col} className="flex items-center">
                          {idx===aisleAfter+1&&<div className="w-4"/>}
                          <button disabled={isUnavail||selByOther} onClick={()=>seat&&onSelectSeat(segment.segment_code,activePassenger,seat)} className={cls} title={seat?`${col}${row.row_number}${hasFee?` +${fmtIDR(seat.base_price)}`:' Gratis'}`:''}>
                            {isUnavail?'✕':`${col}${row.row_number}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
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
              <button onClick={()=>setDetailOpen(!detailOpen)} className="text-xs text-orange-600 hover:underline font-semibold mt-0.5">
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
function PassengerForm({ pax, index, inputCls, labelCls, selectCls, onChange }: {
  pax: Passenger; index: number; inputCls: string; labelCls: string; selectCls: string;
  onChange: (idx: number, field: string, value: any) => void;
}) {
  const paxLabel = pax.pax_type==='ADT'?'Dewasa':pax.pax_type==='CHD'?'Anak':'Bayi';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black text-xs">{index+1}</div>
        <h3 className="font-black text-slate-800 text-sm">Penumpang {index+1} · <span className="font-semibold text-slate-500">{paxLabel}</span></h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={labelCls}>Sapaan</label>
          <select value={pax.title} onChange={e=>onChange(index,'title',e.target.value)} className={selectCls}>
            <option value="MR">Tn. (Mr.)</option><option value="MRS">Ny. (Mrs.)</option><option value="MS">Nn. (Ms.)</option>
          </select>
        </div>
        <div><label className={labelCls}>Nama Depan (Sesuai KTP/Paspor)</label>
          <input value={pax.first_name} onChange={e=>onChange(index,'first_name',e.target.value)} className={inputCls} placeholder="Contoh: BUDI"/>
        </div>
        <div><label className={labelCls}>Nama Belakang</label>
          <input value={pax.last_name} onChange={e=>onChange(index,'last_name',e.target.value)} className={inputCls} placeholder="Contoh: SANTOSO"/>
        </div>
        <div><label className={labelCls}>Kewarganegaraan</label>
          <select value={pax.nationality_code} onChange={e=>onChange(index,'nationality_code',e.target.value)} className={selectCls}>
            <option value="ID">Indonesia</option><option value="SG">Singapura</option><option value="MY">Malaysia</option><option value="US">Amerika Serikat</option><option value="GB">Inggris</option><option value="AU">Australia</option>
          </select>
        </div>
        <div><label className={labelCls}>Tanggal Lahir</label>
          <input type="date" value={pax.birth_date} onChange={e=>onChange(index,'birth_date',e.target.value)} className={inputCls}/>
        </div>
        <div><label className={labelCls}>Jenis Identitas</label>
          <select value={pax.identity.identity_type} onChange={e=>onChange(index,'identity',{...pax.identity,identity_type:e.target.value})} className={selectCls}>
            <option value="ktp">KTP</option><option value="passport">Paspor</option>
          </select>
        </div>
        <div className="sm:col-span-2"><label className={labelCls}>Nomor {pax.identity.identity_type==='passport'?'Paspor':'KTP'}</label>
          <input value={pax.identity.identity_number} onChange={e=>onChange(index,'identity',{...pax.identity,identity_number:e.target.value})} className={inputCls} placeholder={pax.identity.identity_type==='passport'?'A1234567':'1234567890123456'}/>
        </div>
        {pax.identity.identity_type==='passport'&&(
          <>
            <div><label className={labelCls}>Berlaku Hingga</label>
              <input type="date" value={pax.identity.identity_expdate} onChange={e=>onChange(index,'identity',{...pax.identity,identity_expdate:e.target.value})} className={inputCls}/>
            </div>
            <div><label className={labelCls}>Negara Penerbit</label>
              <select value={pax.identity.identity_country_of_issued_code} onChange={e=>onChange(index,'identity',{...pax.identity,identity_country_of_issued_code:e.target.value})} className={selectCls}>
                <option value="ID">Indonesia</option><option value="SG">Singapura</option><option value="MY">Malaysia</option><option value="US">Amerika Serikat</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Price Detail Panel ───────────────────────────────────────────────────────
function PriceDetailPanel({ breakdown, addons, totalFinal }: { breakdown: PriceBreakdown|null; addons: {label:string;value:number}[]; totalFinal: number; }) {
  return (
    <div className="space-y-2 text-xs">
      {breakdown && breakdown.adultCount>0 && (
        <div className="flex justify-between text-slate-600">
          <span>Tiket Dewasa ×{breakdown.adultCount}</span>
          <span className="font-semibold">{fmtIDR((breakdown.adultFare+breakdown.adultTax)*breakdown.adultCount)}</span>
        </div>
      )}
      {breakdown && breakdown.childCount>0 && (
        <div className="flex justify-between text-slate-600">
          <span>Tiket Anak ×{breakdown.childCount}</span>
          <span className="font-semibold">{fmtIDR((breakdown.childFare+breakdown.childTax)*breakdown.childCount)}</span>
        </div>
      )}
      {breakdown && breakdown.infantCount>0 && (
        <div className="flex justify-between text-slate-600">
          <span>Tiket Bayi ×{breakdown.infantCount}</span>
          <span className="font-semibold">{fmtIDR((breakdown.infantFare+breakdown.infantTax)*breakdown.infantCount)}</span>
        </div>
      )}
      {addons.filter(a=>a.value>0).map((a,i)=>(
        <div key={i} className="flex justify-between text-slate-600">
          <span className="flex items-center gap-1"><i className="fa-solid fa-plus text-orange-400 text-[9px]"></i>{a.label}</span>
          <span className="font-semibold text-orange-600">{fmtIDR(a.value)}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between font-black text-slate-900">
        <span>Total Harga Anda Bayar</span>
        <span className="text-orange-600 text-base">{fmtIDR(totalFinal)}</span>
      </div>
    </div>
  );
}

// ─── Main Checkout ────────────────────────────────────────────────────────────
function FlightCheckoutContent() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  const isSubmittingRef = useRef(false);

  const [flightData, setFlightData] = useState<any>(null);
  const [booker, setBooker] = useState({ title: 'MR', first_name: '', last_name: '', email: '', mobile: '', phoneCode: '+62', nationality_code: 'ID' });
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  // Seat states
  const [selectedSeats, setSelectedSeats] = useState<Record<string,SelectedSeat>>({});
  const [segmentSeats, setSegmentSeats] = useState<SegmentSeatData[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatsError, setSeatsError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [skipSeats, setSkipSeats] = useState(false);

  // SSR Baggage — dari API
  const [baggageSsrs, setBaggageSsrs] = useState<BaggageSsr[]>([]);
  const [ssrLoading, setSsrLoading] = useState(false);
  const [selectedBaggage, setSelectedBaggage] = useState<BaggageSsr | null>(null); // null = tidak tambah

  // Addons — harga dari API insurance (statis fallback jika API gagal)
  const [addInsurance, setAddInsurance] = useState(false);
  const [addResched, setAddResched] = useState(false);
  const [addRefund, setAddRefund] = useState(false);
  const [addDelay, setAddDelay] = useState(false);
  const [addLostBag, setAddLostBag] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Harga addon per orang (dalam IDR) — akan di-update dari API jika tersedia
  const ADDON_PRICES = {
    insurance: 110000,
    resched: 70000,
    refund: 100000,
    delay: 50000,
    lostBag: 34000,
  };

  const adultCount = parseInt(flightData?.priceBody?.adult || flightData?.searchMeta?.adult || '1');
  const childCount = parseInt(flightData?.priceBody?.child || flightData?.searchMeta?.child || '0');
  const paxCount = adultCount + childCount;

  // Load flight data from session storage
  useEffect(() => {
    const raw = sessionStorage.getItem('flight_priced_data');
    if (!raw) { router.push('/flight/search'); return; }
    try {
      const parsed = JSON.parse(raw);
      setFlightData(parsed);

      const adult = parseInt(parsed.priceBody?.adult || parsed.searchMeta?.adult || '1');
      const child = parseInt(parsed.priceBody?.child || parsed.searchMeta?.child || '0');
      const infant = parseInt(parsed.priceBody?.infant || parsed.searchMeta?.infant || '0');
      const defaultIdentity = { identity_type: 'ktp' as const, identity_number: '', identity_expdate: '', identity_country_of_issued_code: 'ID' };
      const defaultPax = { title:'MR', first_name:'', last_name:'', birth_date:'', nationality_code:'ID', identity: defaultIdentity };
      const paxList: Passenger[] = [];
      for (let i=0;i<adult;i++) paxList.push({...defaultPax, pax_type:'ADT'});
      for (let i=0;i<child;i++) paxList.push({...defaultPax, pax_type:'CHD'});
      for (let i=0;i<infant;i++) paxList.push({...defaultPax, pax_type:'INF'});
      setPassengers(paxList);

      if (session?.user?.name) {
        const parts = (session.user.name||'').split(' ');
        setBooker(b=>({...b, first_name:parts[0]||'', last_name:parts.slice(1).join(' ')||'', email:session.user?.email||''}));
      }
    } catch { router.push('/flight/search'); }
  }, [session]);

  // Fetch SSR baggage prices dari API
  const fetchSsr = useCallback(async () => {
    if (ssrLoading || baggageSsrs.length > 0) return;
    setSsrLoading(true);
    try {
      const res  = await fetch('/api/flight/ssr', { method: 'POST' });
      const data = await res.json();

      // unavailable = maskapai tidak support SSR — bukan error, gunakan fallback statis
      if (data.unavailable) {
        console.log('[SSR] Maskapai tidak support SSR, gunakan opsi bagasi statis.');
        return;
      }

      if (data.success && data.data) {
        const payload = data.data?.response || data.data;
        const bags    = parseBaggageSsr(payload);
        if (bags.length > 0) {
          setBaggageSsrs(bags);
          console.log('[SSR] Baggage options dari API:', bags.length, 'opsi');
        }
      }
    } catch (err) {
      console.warn('[SSR] Gagal fetch SSR, gunakan opsi statis');
    } finally {
      setSsrLoading(false);
    }
  }, [ssrLoading, baggageSsrs.length]);

  // Fetch seats
  const fetchSeats = useCallback(async () => {
    if (seatsLoading) return;
    setSeatsLoading(true); setSeatsError('');
    try {
      if (flightData && !isLocked) {
        const lockRes = await fetch('/api/flight/lock', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(flightData.priceBody),
        });
        if (!lockRes.ok) { setSeatsError('Gagal mengunci sesi. Coba lagi.'); return; }
        setIsLocked(true);
        // Setelah lock, fetch SSR juga
        fetchSsr();
      }
      const res  = await fetch('/api/flight/seats', { method:'POST' });
      const data = await res.json();

      // unavailable = maskapai tidak expose seat map — bukan error fatal
      if (data.unavailable) {
        setSeatsError('Peta kursi tidak tersedia untuk penerbangan ini.\nBeberapa maskapai tidak menyediakan pilihan kursi online.');
        return;
      }

      if (!res.ok || !data.success) {
        if (data.error === 'SESSION_EXPIRED') {
          setSeatsError('Sesi habis. Silakan kembali dan cari ulang penerbangan.');
          return;
        }
        setSeatsError(data.error || 'Gagal memuat peta kursi.');
        return;
      }

      const providers: any[] = data.data?.seat_availability_provider
        || data.data?.response?.seat_availability_provider
        || [];

      if (!providers.length) {
        setSeatsError('Peta kursi tidak tersedia untuk penerbangan ini.');
        return;
      }

      const allSegments: SegmentSeatData[] = [];
      providers.forEach((provider: any) => {
        (provider.segments||[]).forEach((seg: any) => {
          const cabins = (seg.seat_cabins||[]).map((cabin: any) => ({
            cabin_name: cabin.cabin_name, cabin_code: cabin.cabin_code,
            seat_rows: (cabin.seat_rows||[]).map((row: any) => ({
              row_number: String(row.row_number),
              seats: (row.seats||[]).map((s: any) => ({
                seat_code:   s.seat_code||'', column: s.column||'',
                row_number:  String(row.row_number), availability: s.availability??-1,
                base_price:  s.base_price||(s.service_charges?.[0]?.amount>0?s.service_charges[0].amount:0)||0,
                seat_name:   s.seat_name||'', description: s.description||[],
              })),
            })),
          }));
          allSegments.push({
            segment_code: seg.segment_code,
            origin:       seg.origin,
            destination:  seg.destination,
            carrier_name: seg.carrier_name||`${seg.carrier_code} ${seg.carrier_number}`,
            provider:     provider.provider||seg.provider||'',
            cabins,
          });
        });
      });
      setSegmentSeats(allSegments);
    } catch (e: any) {
      setSeatsError(e.message||'Gagal memuat kursi.');
    } finally {
      setSeatsLoading(false);
    }
  }, [flightData, isLocked, seatsLoading, fetchSsr]);

  const updatePassenger = (idx: number, field: string, value: any) =>
    setPassengers(prev => prev.map((p,i) => i===idx ? {...p,[field]:value} : p));

  const handleSeatSelect = (segCode: string, paxIdx: number, seat: SeatInfo) => {
    const key = `${segCode}__${paxIdx}`;
    setSelectedSeats(prev => {
      if (prev[key]?.seat_code===seat.seat_code) { const n={...prev}; delete n[key]; return n; }
      return {...prev, [key]:{seat_code:seat.seat_code,base_price:seat.base_price}};
    });
  };

  // Compute costs
  const seatFee = skipSeats ? 0 : Object.values(selectedSeats).reduce((sum,s)=>sum+(s.base_price||0),0);
  const baggageFee = selectedBaggage ? selectedBaggage.base_price * adultCount : 0;
  const insuranceFee = addInsurance ? ADDON_PRICES.insurance * paxCount : 0;
  const reschedFee = addResched ? ADDON_PRICES.resched * paxCount : 0;
  const refundFee = addRefund ? ADDON_PRICES.refund * paxCount : 0;
  const delayFee = addDelay ? ADDON_PRICES.delay * paxCount : 0;
  const lostBagFee = addLostBag ? ADDON_PRICES.lostBag * paxCount : 0;

  const flightBase = (() => {
    if (!flightData) return 0;
    if (flightData.priceResponse?.total_price) return flightData.priceResponse.total_price;
    const bd = parsePriceBreakdown(flightData.priceResponse);
    if (bd) return bd.totalFlight;
    return flightData.display?.basePrice || 0;
  })();

  const grandTotal = flightBase + seatFee + baggageFee + insuranceFee + reschedFee + refundFee + delayFee + lostBagFee;

  const isFormValid = () => {
    if (!booker.first_name.trim() || !booker.email.trim() || !booker.mobile.trim()) return false;
    return passengers.every(p => p.first_name.trim() && p.last_name.trim() && p.birth_date && p.identity?.identity_number?.trim());
  };

  const handleSubmit = async () => {
    if (!flightData || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true); setBookingError('');
    try {
      const seatRequestBySegment: Record<string,any> = {};
      if (!skipSeats) {
        Object.entries(selectedSeats).forEach(([key,sel]) => {
          const [segCode,pIdxStr] = key.split('__');
          const pIdx = parseInt(pIdxStr);
          const segData = segmentSeats.find(s=>s.segment_code===segCode);
          if (!seatRequestBySegment[segCode]) seatRequestBySegment[segCode]={segment_code:segCode,provider:segData?.provider||'',passengers:[]};
          seatRequestBySegment[segCode].passengers.push({passenger_number:pIdx+1,seat_code:sel.seat_code});
        });
      }
      const display = flightData.display || {};
      const res = await fetch('/api/flight/book', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          passengers, booker, contacts:[booker],
          schedules: flightData.priceBody?.schedules,
          is_combo_price: flightData.priceBody?.is_combo_price,
          adult: flightData.priceBody?.adult, child: flightData.priceBody?.child, infant: flightData.priceBody?.infant,
          total_amount: grandTotal,
          route_label:`${display.origin||''}→${display.destination||''}`,
          origin:display.origin||'', destination:display.destination||'',
          departure_date:display.departure, flight_number:display.flight_num||'', airline_name:display.carrier||'',
          selectedSeats:Object.values(seatRequestBySegment),
          selectedBaggage: selectedBaggage || null,
          addOns: {
            insurance:  addInsurance,
            reschedule: addResched,
            refund:     addRefund,
            delay:      addDelay,
            lostBag:    addLostBag,
          },
          is_locked_before: isLocked,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error==='SESSION_EXPIRED') {
          sessionStorage.removeItem('flight_priced_data');
          setBookingError('Sesi penerbangan telah berakhir. Silakan cari ulang.');
          setTimeout(()=>router.push('/flight/search'),2500); return;
        }
        throw new Error(data.error||'Pemesanan gagal.');
      }
      sessionStorage.removeItem('flight_priced_data');

      // Redirect ke Midtrans payment jika ada snapToken / redirectUrl
      if (data.redirectUrl) { window.location.href=data.redirectUrl; return; }
      if (data.snapToken) {
        const sandbox = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION!=='true';
        window.location.href = sandbox
          ? `https://app.sandbox.midtrans.com/snap/v2/vtweb/${data.snapToken}`
          : `https://app.midtrans.com/snap/v2/vtweb/${data.snapToken}`;
        return;
      }

      // Jika tidak ada payment gateway → redirect berdasarkan status login
      const orderNo = data.orderNumber || '';
      if (!isGuest) {
        // Sudah login → ke halaman riwayat booking
        router.push(orderNo ? `/booking?order=${orderNo}` : '/booking');
      } else {
        // Belum login → ke halaman cari booking (pakai order number)
        router.push(orderNo ? `/find-booking?order=${orderNo}` : '/find-booking');
      }
    } catch (e: any) { setBookingError(e.message||'Terjadi kesalahan.'); }
    finally { setSubmitting(false); isSubmittingRef.current=false; }
  };

  if (!flightData) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-slate-400 text-sm">Memuat data penerbangan...</p>
      </div>
    </div>
  );

  const display = flightData.display || {};
  const priceBreakdown = parsePriceBreakdown(flightData.priceResponse);
  const inputCls = 'w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-slate-800 text-sm outline-none focus:border-orange-400 focus:bg-white transition-all';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5';
  const selectCls = inputCls + ' cursor-pointer';

  // Baggage options: gunakan dari API jika tersedia, fallback ke statis
  const staticBaggageOpts: BaggageSsr[] = [
    { ssr_code:'NOBAG',  name:'Tidak',   kg:0,  base_price:0,      journey_code:'' },
    { ssr_code:'BAG05',  name:'+5 KG',   kg:5,  base_price:150000, journey_code:'' },
    { ssr_code:'BAG10',  name:'+10 KG',  kg:10, base_price:250000, journey_code:'' },
    { ssr_code:'BAG20',  name:'+20 KG',  kg:20, base_price:450000, journey_code:'' },
  ];
  const noBagOption: BaggageSsr = { ssr_code:'NOBAG', name:'Tidak', kg:0, base_price:0, journey_code:'' };
  const bagOpts: BaggageSsr[] = baggageSsrs.length > 0
    ? [noBagOption, ...baggageSsrs.slice(0,5)]
    : staticBaggageOpts;

  const addonRows = [
    { label:'Kursi Dipilih', value: seatFee },
    { label:'Bagasi Tambahan', value: baggageFee },
    { label:'Asuransi Perjalanan', value: insuranceFee },
    { label:'Perlindungan Reschedule', value: reschedFee },
    { label:'Jaminan Refund 100%', value: refundFee },
    { label:'Asuransi Keterlambatan', value: delayFee },
    { label:'Perlindungan Bagasi Hilang', value: lostBagFee },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <CheckoutNavbar />
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-10 shadow-sm">
        <div className="container mx-auto max-w-[1280px] px-4 py-3 flex items-center justify-between">
          <button onClick={()=>router.push('/flight/search')} className="flex items-center gap-2 text-slate-500 hover:text-orange-600 text-sm font-semibold transition-colors">
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
              <span className="hidden sm:block">Pembayaran Penerbangan</span>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-600">{display.carrier}</p>
            <p className="text-xs text-slate-400">{display.origin} → {display.destination}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-[1280px] px-4 py-6">
        {isGuest && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0"></i>
            <div className="text-sm"><p className="font-bold text-blue-800">Memesan sebagai tamu</p>
              <p className="text-blue-600"><Link href="/login" className="underline font-semibold">Masuk</Link> atau <Link href="/register" className="underline font-semibold">daftar</Link> untuk lacak riwayat pesanan.</p>
            </div>
          </div>
        )}
        {bookingError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3 text-red-700">
            <i className="fa-solid fa-circle-exclamation text-lg mt-0.5 shrink-0"></i>
            <div><p className="font-bold mb-1 text-sm">Pemesanan Gagal</p><p className="text-sm">{bookingError}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ─── LEFT ──────────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Data Pemesan */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-envelope text-orange-600 text-sm"></i>
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-sm">Data Pemesan (Untuk E-Tiket/Voucher)</h2>
                  <p className="text-xs text-orange-600 font-semibold">Rapikan pesanan dan dapatkan bantuan lebih.{' '}
                    <Link href="/login" className="underline">Masuk atau Daftar</Link>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nama Lengkap</label>
                  <input
                    value={`${booker.first_name}${booker.last_name?' '+booker.last_name:''}`.trim()}
                    onChange={e=>{const p=e.target.value.split(' '); setBooker(b=>({...b,first_name:p[0]||'',last_name:p.slice(1).join(' ')||''}));}}
                    className={inputCls} placeholder="Nama sesuai KTP/Paspor (tanpa gelar)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nomor KTP/SIM</label>
                  <input className={inputCls} placeholder="Contoh: 3171XXXXXXXXXXX"/>
                </div>
                <div>
                  <label className={labelCls}>No. Handphone</label>
                  <div className="flex gap-2">
                    {/* ✅ FIX: gunakan state phoneCode, bukan value hardcoded */}
                    <select
                      value={booker.phoneCode}
                      onChange={e=>setBooker(b=>({...b,phoneCode:e.target.value}))}
                      className="w-20 px-2 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-slate-600 text-sm outline-none focus:border-orange-400 cursor-pointer"
                    >
                      <option value="+62">+62</option>
                      <option value="+65">+65</option>
                      <option value="+60">+60</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                    </select>
                    <input value={booker.mobile} onChange={e=>setBooker(b=>({...b,mobile:e.target.value.replace(/\D/g,'')}))} className={inputCls} placeholder="8xxxxxxxxxx"/>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={booker.email} onChange={e=>setBooker(b=>({...b,email:e.target.value}))} className={inputCls} placeholder="email@contoh.com"/>
                </div>
              </div>
            </div>

            {/* Detail Traveler */}
            {passengers.map((pax,i) => (
              <PassengerForm key={i} pax={pax} index={i} inputCls={inputCls} labelCls={labelCls} selectCls={selectCls} onChange={updatePassenger}/>
            ))}

            {/* Pelengkap Penerbangan */}
            <div>
              <h2 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                <i className="fa-solid fa-puzzle-piece text-orange-500"></i>
                Pelengkap Penerbangan
              </h2>
              <div className="space-y-3">

                {/* ── BAGASI — Harga dari API ── */}
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-suitcase-rolling text-blue-600 text-base"></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">Bagasi</p>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Rekomendasi</span>
                        {ssrLoading && <span className="text-[10px] text-slate-400 animate-pulse">Memuat harga real...</span>}
                        {baggageSsrs.length > 0 && <span className="text-[10px] text-emerald-600 font-bold">✓ Harga dari maskapai</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Bawaan gratis hingga 20 kg/orang. Tambahkan bagasi ekstra jika perlu.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {bagOpts.map(opt => (
                      <button key={opt.ssr_code}
                        onClick={()=>setSelectedBaggage(opt.kg===0?null:opt)}
                        className={`py-2.5 px-2 text-xs font-bold rounded-xl border-2 transition-all text-center ${
                          (opt.kg===0&&selectedBaggage===null)||(selectedBaggage?.ssr_code===opt.ssr_code)
                            ?'border-blue-500 bg-blue-50 text-blue-700'
                            :'border-slate-200 text-slate-500 hover:border-blue-300'
                        }`}>
                        <div>{opt.kg===0?'Tidak Tambah':opt.name}</div>
                        <div className="text-[10px] font-semibold mt-0.5">{opt.kg===0?'Gratis':fmtIDR(opt.base_price)+'/org'}</div>
                      </button>
                    ))}
                  </div>
                  {selectedBaggage && baggageFee > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs text-slate-500">+{selectedBaggage.kg} KG × {adultCount} org</span>
                      <span className="text-sm font-black text-orange-600">+ {fmtIDR(baggageFee)}</span>
                    </div>
                  )}
                </div>

                {/* ── NOMOR KURSI ── */}
                <div className={`bg-white rounded-2xl border-2 transition-all ${showSeatMap?'border-orange-400':'border-slate-200'}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-chair text-orange-600 text-base"></i>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">Nomor Kursi</p>
                        <p className="text-xs text-slate-500">Pilih kursi untuk kenyamanan perjalanan.</p>
                        {Object.keys(selectedSeats).length > 0 && (
                          <p className="text-xs text-orange-600 font-semibold mt-0.5">
                            {Object.keys(selectedSeats).length} kursi dipilih · {fmtIDR(seatFee)}
                          </p>
                        )}
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${showSeatMap?'bg-orange-500':'bg-slate-200'}`}
                        onClick={()=>{ if(!showSeatMap){setShowSeatMap(true);fetchSeats();}else{setShowSeatMap(false);} }}>
                        <div className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${showSeatMap?'translate-x-5':'translate-x-1'}`}/>
                      </div>
                    </div>

                    {showSeatMap && (
                      <div className="mt-4">
                        {seatsLoading && <div className="py-6 text-center"><div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-slate-400">Memuat peta kursi...</p></div>}
                        {seatsError && !seatsLoading && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-600 text-xs">
                            <div className="flex items-start gap-3">
                              <i className="fa-solid fa-circle-info text-slate-400 mt-0.5 shrink-0"></i>
                              <div>
                                <p className="font-bold text-slate-700 mb-1">Pilih Kursi Tidak Tersedia</p>
                                <p className="whitespace-pre-line">{seatsError}</p>
                                {!seatsError.includes('tidak tersedia') && (
                                  <button onClick={fetchSeats} className="mt-2 px-3 py-1.5 bg-slate-600 text-white rounded-lg font-bold text-[11px]">Coba Lagi</button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {!seatsLoading && !seatsError && segmentSeats.length>0 && (
                          <div className="space-y-5">
                            {/* Legenda */}
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                              <div className="flex items-center gap-1"><div className="w-3.5 h-3.5 bg-emerald-100 border border-emerald-300 rounded-sm"></div>Gratis</div>
                              <div className="flex items-center gap-1"><div className="w-3.5 h-3.5 bg-amber-100 border border-amber-300 rounded-sm"></div>Berbayar</div>
                              <div className="flex items-center gap-1"><div className="w-3.5 h-3.5 bg-orange-500 rounded-sm"></div>Dipilih</div>
                              <div className="flex items-center gap-1"><div className="w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded-sm"></div>Tidak Tersedia</div>
                            </div>
                            {segmentSeats.map(seg => (
                              <div key={seg.segment_code}>
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                                  <i className="fa-solid fa-plane text-orange-400 text-xs"></i>
                                  <p className="font-black text-slate-700 text-xs">{seg.origin} → {seg.destination} · {seg.carrier_name}</p>
                                </div>
                                <SeatMap segment={seg} passengerCount={passengers.filter(p=>p.pax_type!=='INF').length} selectedSeats={selectedSeats} onSelectSeat={handleSeatSelect}/>
                              </div>
                            ))}
                          </div>
                        )}
                        {seatFee>0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-xs text-slate-500">{Object.keys(selectedSeats).length} kursi dipilih</span>
                            <span className="text-sm font-black text-orange-600">+ {fmtIDR(seatFee)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── JAMINAN REFUND ── */}
                <AddonCard icon="fa-shield-check" bgIcon="bg-emerald-100" title="Jaminan Refund 100%"
                  subtitle="Batalkan pesanan kapan saja dan dapatkan pengembalian dana penuh."
                  badge="Terlindungi" badgeColor="bg-emerald-100 text-emerald-700"
                  isChecked={addRefund} onToggle={()=>setAddRefund(!addRefund)}
                  price={refundFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-500 text-[10px]"></i>Batalkan dengan alasan apapun hingga 2 jam sebelum keberangkatan</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-500 text-[10px]"></i>Refund penuh diproses dalam 7 hari kerja</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-emerald-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.refund)}/penumpang</li>
                  </ul>
                </AddonCard>

                {/* ── RESCHEDULE ── */}
                <AddonCard icon="fa-calendar-xmark" bgIcon="bg-purple-100" title="Perlindungan Reschedule Maskapai"
                  subtitle="Dilindungi jika maskapai membatalkan atau mengubah jadwal penerbangan."
                  isChecked={addResched} onToggle={()=>setAddResched(!addResched)}
                  price={reschedFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-purple-500 text-[10px]"></i>Reschedule gratis jika maskapai yang ubah jadwal</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-purple-500 text-[10px]"></i>Berlaku untuk semua kelas penerbangan</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-purple-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.resched)}/penumpang</li>
                  </ul>
                </AddonCard>

                {/* ── ASURANSI PERJALANAN ── */}
                <AddonCard icon="fa-umbrella" bgIcon="bg-orange-100" title="Asuransi Perjalanan"
                  badge="Sudah Dipilih" badgeColor="bg-red-100 text-red-700"
                  subtitle="Perlindungan jiwa, bagasi, dan biaya medis selama perjalanan."
                  isChecked={addInsurance} onToggle={()=>setAddInsurance(!addInsurance)}
                  price={insuranceFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>Perlindungan jiwa penumpang maks. Rp 500.000.000</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>Perlindungan bagasi maks. Rp 20.000.000</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>Biaya medis darurat maks. Rp 200.000.000</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-orange-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.insurance)}/penumpang</li>
                  </ul>
                </AddonCard>

                {/* ── ASURANSI KETERLAMBATAN ── */}
                <AddonCard icon="fa-clock" bgIcon="bg-blue-100" title="Asuransi Keterlambatan"
                  subtitle={`Dapat kompensasi ${fmtIDR(300000)} jika penerbangan delay lebih dari 2 jam.`}
                  isChecked={addDelay} onToggle={()=>setAddDelay(!addDelay)}
                  price={delayFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-blue-500 text-[10px]"></i>Kompensasi otomatis tanpa klaim manual</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-blue-500 text-[10px]"></i>Berlaku untuk delay 2 jam atau lebih</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-blue-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.delay)}/penumpang</li>
                  </ul>
                </AddonCard>

                {/* ── PERLINDUNGAN BAGASI HILANG ── */}
                <AddonCard icon="fa-suitcase" bgIcon="bg-slate-100" title="Perlindungan Bagasi Hilang"
                  subtitle={`Mulai ${fmtIDR(ADDON_PRICES.lostBag)}/orang. Ganti rugi hingga Rp 2 juta jika bagasi hilang.`}
                  isChecked={addLostBag} onToggle={()=>setAddLostBag(!addLostBag)}
                  price={lostBagFee} expandable>
                  <ul className="space-y-1 text-xs text-slate-500">
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-slate-500 text-[10px]"></i>Klaim mudah lewat aplikasi</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-slate-500 text-[10px]"></i>Proses penggantian dalam 14 hari kerja</li>
                    <li className="flex items-center gap-2"><i className="fa-solid fa-check text-slate-500 text-[10px]"></i>{fmtIDR(ADDON_PRICES.lostBag)}/penumpang</li>
                  </ul>
                </AddonCard>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 text-xs space-y-1.5">
              <p className="font-bold text-sm flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i>Informasi Penting</p>
              <p>Pastikan data penumpang <strong>sesuai persis</strong> dengan KTP/Paspor.</p>
              <p>E-tiket dikirim ke email pemesan dalam 1×60 menit setelah pembayaran.</p>
            </div>
          </div>

          {/* ─── RIGHT: Sidebar Summary ─────────────────────────────────────── */}
          <div className="space-y-4 sticky top-32">
            {/* Flight info card — mendukung Single / RT / Multi-Kota */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-blue-800 px-4 py-3 flex items-center justify-between">
                <span className="text-white text-xs font-bold">Ringkasan Penerbangan</span>
                <span className="text-blue-200 text-xs">
                  {flightData?.searchMeta?.direction === 'RT'
                    ? 'Pulang Pergi'
                    : flightData?.searchMeta?.direction === 'Multi'
                    ? 'Multi-Kota'
                    : display.carrier}
                </span>
              </div>

              {/* Jika multi-leg: tampilkan tiap leg */}
              {flightData?.allLegsDisplay && flightData.allLegsDisplay.length > 1 ? (
                <div className="divide-y divide-slate-100">
                  {(flightData.allLegsDisplay as any[]).filter(Boolean).map((leg: any, i: number) => {
                    const legLabels = flightData?.searchMeta?.direction === 'RT'
                      ? ['Pergi', 'Pulang']
                      : (flightData?.searchMeta?.routes || []).map((_: any, j: number) => `Kota ${j + 1}`);
                    const BADGE_COLORS = ['bg-orange-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600'];
                    return (
                      <div key={i} className="p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full ${BADGE_COLORS[i % BADGE_COLORS.length]}`}>
                            {legLabels[i] || `Leg ${i + 1}`}
                          </span>
                          <span className="text-[10px] text-slate-400">{leg.carrier}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                          <span>{leg.origin}</span>
                          <div className="flex items-center gap-1 flex-1 px-1">
                            <div className="flex-1 h-px bg-slate-200"></div>
                            <i className="fa-solid fa-plane text-orange-400 text-[10px]"></i>
                            <div className="flex-1 h-px bg-slate-200"></div>
                          </div>
                          <span>{leg.destination}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xl font-black text-slate-900">{fmtTime(leg.departure)}</p>
                          <p className="text-[10px] text-slate-400">Langsung</p>
                          <p className="text-xl font-black text-slate-900">{fmtTime(leg.arrival)}</p>
                        </div>
                        <p className="text-xs text-slate-400">{fmtDate(leg.departure)}</p>
                      </div>
                    );
                  })}
                  <div className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                        <i className="fa-solid fa-suitcase-rolling text-orange-400 text-[10px]"></i>20 KG Gratis
                      </span>
                      {selectedBaggage && <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">+{selectedBaggage.kg} KG</span>}
                    </div>
                  </div>
                </div>
              ) : (
                /* Single flight */
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    <span>{display.origin}</span>
                    <div className="flex items-center gap-1 flex-1 px-2">
                      <div className="flex-1 h-px bg-slate-200"></div>
                      <i className="fa-solid fa-plane text-orange-400 text-[10px]"></i>
                      <div className="flex-1 h-px bg-slate-200"></div>
                    </div>
                    <span>{display.destination}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-2xl font-black text-slate-900">{fmtTime(display.departure)}</p></div>
                    <div className="text-center text-xs text-slate-400">Langsung</div>
                    <div className="text-right"><p className="text-2xl font-black text-slate-900">{fmtTime(display.arrival)}</p></div>
                  </div>
                  <p className="text-xs text-slate-400">{fmtDate(display.departure)}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      <i className="fa-solid fa-suitcase-rolling text-orange-400 text-[10px]"></i>20 KG Gratis
                    </span>
                    {selectedBaggage && <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">+{selectedBaggage.kg} KG</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-black text-slate-800 text-sm mb-3">Rincian Harga</h3>
              <PriceDetailPanel breakdown={priceBreakdown} addons={addonRows} totalFinal={grandTotal}/>

              <button
                onClick={handleSubmit}
                disabled={submitting || !isFormValid()}
                className="mt-4 w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all text-base active:scale-95 shadow-lg shadow-orange-600/20"
              >
                {submitting
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Memproses...</span>
                  : `Bayar ${fmtIDR(grandTotal)}`
                }
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Dengan menekan tombol, Anda menyetujui <span className="underline cursor-pointer">Syarat & Ketentuan</span> kami.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlightCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <FlightCheckoutContent/>
    </Suspense>
  );
}
