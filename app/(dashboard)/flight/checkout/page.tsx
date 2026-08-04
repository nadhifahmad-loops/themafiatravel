'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import CheckoutNavbar from '@/components/layout/CheckoutNavbar';
import LeaveGuard from '@/components/checkout/LeaveGuard';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { isValidName, isValidEmail, isValidPhone, isValidIdentityNumber, isValidBirthDate, parsePhoneWithCode, scrollToFirstError } from '@/lib/checkout-utils';

interface SeatInfo { seat_code: string; column: string; row_number: string; availability: number; base_price: number; seat_name: string; description: string[]; }
interface CabinData { cabin_name: string; cabin_code: string; seat_rows: { row_number: string; seats: SeatInfo[] }[]; }
interface SegmentSeatData { segment_code: string; origin: string; destination: string; carrier_name: string; provider: string; cabins: CabinData[]; }
interface SelectedSeat { seat_code: string; base_price: number; }
interface PassengerIdentity { identity_type: 'ktp' | 'passport'; identity_number: string; identity_expdate: string; identity_country_of_issued_code: string; }
interface Passenger { title: string; first_name: string; last_name: string; birth_date: string; pax_type: 'ADT' | 'CHD' | 'INF'; nationality_code: string; identity: PassengerIdentity; }
interface PriceBreakdown { adultFare: number; adultTax: number; adultCount: number; childFare: number; childTax: number; childCount: number; infantFare: number; infantTax: number; infantCount: number; otherCharges: number; totalFlight: number; }
interface BaggageSsr { ssr_code: string; name: string; kg: number; base_price: number; journey_code: string; }
interface MarkupSettings { flight: number; hotel: number; train: number; insurance: number; }

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

function parseBaggageSsr(ssrData: any): BaggageSsr[] {
  if (!ssrData) return [];
  const providers: any[] = ssrData?.ssr_availability_provider || ssrData?.response?.ssr_availability_provider || [];
  if (!providers.length) return [];
  const ssrMap = new Map<string, BaggageSsr>();
  for (const provider of providers) {
    const baggageList: any[] = provider?.ssr_availability?.baggage || [];
    for (const bag of baggageList) {
      const journeyCode = bag.journey_code || '';
      const ssrs: any[] = bag?.ssrs || [];
      for (const ssr of ssrs) {
        if (ssr.ssr_type !== 'BG') continue;
        const kgMatch = (ssr.name || '').match(/(\d+)\s*[Kk][Gg]/);
        const kg = kgMatch ? parseInt(kgMatch[1]) : 0;
        if (kg === 0) continue;
        const scForAdt = (ssr.service_charges || []).find((c: any) => c.pax_type === 'ADT') || ssr.service_charges?.[0];
        if (!scForAdt) continue;
        const price = ssr.base_price || scForAdt.amount || scForAdt.total || 0;
        if (price === 0) continue;
        const key = `${ssr.ssr_code}::${journeyCode}`;
        if (!ssrMap.has(key)) ssrMap.set(key, { ssr_code: ssr.ssr_code, name: ssr.name, kg, base_price: price, journey_code: journeyCode });
      }
    }
  }
  const byCode = new Map<string, BaggageSsr>();
  for (const item of ssrMap.values()) {
    const existing = byCode.get(item.ssr_code);
    if (!existing || item.base_price < existing.base_price) byCode.set(item.ssr_code, item);
  }
  return Array.from(byCode.values()).sort((a, b) => a.kg - b.kg);
}

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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${activePassenger===i?'bg-slate-800 text-white border-slate-800':hasSel?'bg-emerald-50 text-emerald-700 border-emerald-300':'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
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
                      else if(selBySelf)cls+='bg-slate-800 border-slate-800 text-white scale-105 shadow cursor-pointer';
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

function PassengerForm({ pax, index, fieldCls, selectCls, labelCls, errors, onChange }: {
  pax: Passenger; index: number; fieldCls: (err?: string) => string; selectCls: string; labelCls: string;
  errors?: Record<string,string>;
  onChange: (idx: number, field: string, value: any) => void;
}) {
  const { language } = useLanguage();
  const t = i18n.flightCheckout[language];
  const paxLabel = pax.pax_type==='ADT'?t.adult:pax.pax_type==='CHD'?t.child:t.infant;
  const k = (key: string) => `${key}_${index}`;
  const errFirst = errors?.[k('pax_first')];
  const errLast = errors?.[k('pax_last')];
  const errBirth = errors?.[k('pax_birth')];
  const errId = errors?.[k('pax_id')];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5" id={`pax_card_${index}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">{index+1}</span>
        <span className="text-xs font-bold text-slate-500">{t.passengerTitle} {index+1}</span>
        <span className="text-xs text-slate-300">·</span>
        <span className="text-xs font-semibold text-slate-400">{paxLabel}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={labelCls}>Sapaan</label>
          <select value={pax.title} onChange={e=>onChange(index,'title',e.target.value)} className={selectCls}>
            <option value="MR">{t.titleMr}</option><option value="MRS">{t.titleMrs}</option><option value="MS">{t.titleMs}</option>
          </select>
        </div>
        <div><label className={labelCls}>{t.firstName} (Sesuai {t.ktp}/{t.passport})</label>
          <input id={k('pax_first')} value={pax.first_name} onChange={e=>onChange(index,'first_name',e.target.value)} className={fieldCls(errFirst)} placeholder="Contoh: BUDI"/>
          {errFirst && <p className="text-[11px] text-red-600 mt-1">{errFirst}</p>}
        </div>
        <div><label className={labelCls}>{t.lastName}</label>
          <input id={k('pax_last')} value={pax.last_name} onChange={e=>onChange(index,'last_name',e.target.value)} className={fieldCls(errLast)} placeholder="Contoh: SANTOSO"/>
          {errLast && <p className="text-[11px] text-red-600 mt-1">{errLast}</p>}
        </div>
        <div><label className={labelCls}>{t.nationality}</label>
          <select value={pax.nationality_code} onChange={e=>onChange(index,'nationality_code',e.target.value)} className={selectCls}>
            <option value="ID">Indonesia</option><option value="SG">Singapura</option><option value="MY">Malaysia</option><option value="US">Amerika Serikat</option><option value="GB">Inggris</option><option value="AU">Australia</option>
          </select>
        </div>
        <div><label className={labelCls}>{t.birthDate}</label>
          <input id={k('pax_birth')} type="date" value={pax.birth_date} onChange={e=>onChange(index,'birth_date',e.target.value)} className={fieldCls(errBirth)}/>
          {errBirth && <p className="text-[11px] text-red-600 mt-1">{errBirth}</p>}
        </div>
        <div><label className={labelCls}>{t.idType}</label>
          <select value={pax.identity.identity_type} onChange={e=>onChange(index,'identity',{...pax.identity,identity_type:e.target.value})} className={selectCls}>
            <option value="ktp">{t.ktp}</option><option value="passport">{t.passport}</option>
          </select>
        </div>
        <div className="sm:col-span-2"><label className={labelCls}>{t.idNumber} {pax.identity.identity_type==='passport'?t.passport:t.ktp}</label>
          <input id={k('pax_id')} value={pax.identity.identity_number} onChange={e=>onChange(index,'identity',{...pax.identity,identity_number:e.target.value})} className={fieldCls(errId)} placeholder={pax.identity.identity_type==='passport'?'A1234567':'1234567890123456'}/>
          {errId && <p className="text-[11px] text-red-600 mt-1">{errId}</p>}
        </div>
        {pax.identity.identity_type==='passport'&&(
          <>
            <div><label className={labelCls}>{t.idExpiry}</label>
              <input type="date" value={pax.identity.identity_expdate} onChange={e=>onChange(index,'identity',{...pax.identity,identity_expdate:e.target.value})} className={fieldCls()}/>
            </div>
            <div><label className={labelCls}>{t.idCountry}</label>
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

function FlightCheckoutContent() {
  const { language } = useLanguage();
  const t = i18n.flightCheckout[language];
  const tc = i18n.common[language];
  const router = useRouter();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  const isSubmittingRef = useRef(false);

  const [flightData, setFlightData] = useState<any>(null);
  const [booker, setBooker] = useState({ title: 'MR', first_name: '', last_name: '', email: '', mobile: '', calling_code: '62', nationality_code: 'ID' });
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Record<string,SelectedSeat>>({});
  const [segmentSeats, setSegmentSeats] = useState<SegmentSeatData[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatsError, setSeatsError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [skipSeats, setSkipSeats] = useState(false);
  const [baggageSsrs, setBaggageSsrs] = useState<BaggageSsr[]>([]);
  const [ssrLoading, setSsrLoading] = useState(false);
  const [selectedBaggage, setSelectedBaggage] = useState<BaggageSsr | null>(null);
  const [addInsurance, setAddInsurance] = useState(false);
  const [addResched, setAddResched] = useState(false);
  const [addRefund, setAddRefund] = useState(false);
  const [addDelay, setAddDelay] = useState(false);
  const [addLostBag, setAddLostBag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [markup, setMarkup] = useState<MarkupSettings>({ flight: 50000, hotel: 10, train: 15000, insurance: 5 });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
const [checkoutDone, setCheckoutDone] = useState(false);

  const ADDON_PRICES = { insurance: 110000, resched: 70000, refund: 100000, delay: 50000, lostBag: 34000 };

  const adultCount = parseInt(flightData?.priceBody?.adult || flightData?.searchMeta?.adult || '1');
  const childCount = parseInt(flightData?.priceBody?.child || flightData?.searchMeta?.child || '0');
  const paxCount = adultCount + childCount;

  useEffect(() => {
    fetch('/api/markup').then(r=>r.json()).then(d=>{ if(d?.flight!==undefined) setMarkup(d); }).catch(()=>{});
  }, []);

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
      if (session?.user?.phone) {
        const parsed = parsePhoneWithCode(session.user.phone);
        setBooker(b=>({...b, calling_code:'+'+parsed.code, mobile: parsed.number}));
      }
    } catch { router.push('/flight/search'); }
  }, [session]);

  const fetchSsr = useCallback(async () => {
    if (ssrLoading || baggageSsrs.length > 0) return;
    setSsrLoading(true);
    try {
      const res = await fetch('/api/flight/ssr', { method: 'POST' });
      const data = await res.json();
      if (data.unavailable) return;
      if (data.success && data.data) {
        const payload = data.data?.response || data.data;
        const bags = parseBaggageSsr(payload);
        if (bags.length > 0) setBaggageSsrs(bags);
      }
    } catch {} finally { setSsrLoading(false); }
  }, [ssrLoading, baggageSsrs.length]);

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
        fetchSsr();
      }
      const res = await fetch('/api/flight/seats', { method:'POST' });
      const data = await res.json();
      if (data.unavailable) { setSeatsError('Peta kursi tidak tersedia untuk penerbangan ini.'); return; }
      if (!res.ok || !data.success) {
        if (data.error === 'SESSION_EXPIRED') { setSeatsError('Sesi habis. Silakan kembali dan cari ulang.'); return; }
        setSeatsError(data.error || 'Gagal memuat peta kursi.'); return;
      }
      const providers: any[] = data.data?.seat_availability_provider || data.data?.response?.seat_availability_provider || [];
      if (!providers.length) { setSeatsError('Peta kursi tidak tersedia untuk penerbangan ini.'); return; }
      const allSegments: SegmentSeatData[] = [];
      providers.forEach((provider: any) => {
        (provider.segments||[]).forEach((seg: any) => {
          const cabins = (seg.seat_cabins||[]).map((cabin: any) => ({
            cabin_name: cabin.cabin_name, cabin_code: cabin.cabin_code,
            seat_rows: (cabin.seat_rows||[]).map((row: any) => ({
              row_number: String(row.row_number),
              seats: (row.seats||[]).map((s: any) => ({
                seat_code: s.seat_code||'', column: s.column||'',
                row_number: String(row.row_number), availability: s.availability??-1,
                base_price: s.base_price||(s.service_charges?.[0]?.amount>0?s.service_charges[0].amount:0)||0,
                seat_name: s.seat_name||'', description: s.description||[],
              })),
            })),
          }));
          allSegments.push({ segment_code: seg.segment_code, origin: seg.origin, destination: seg.destination, carrier_name: seg.carrier_name||`${seg.carrier_code} ${seg.carrier_number}`, provider: provider.provider||seg.provider||'', cabins });
        });
      });
      setSegmentSeats(allSegments);
    } catch (e: any) { setSeatsError(e.message||'Gagal memuat kursi.'); } finally { setSeatsLoading(false); }
  }, [flightData, isLocked, seatsLoading, fetchSsr]);

  const updatePassenger = (idx: number, field: string, value: any) =>
    setPassengers(prev => prev.map((p,i) => i===idx ? {...p,[field]:value} : p));

  const clearErr = (key: string) => setFormErrors(f => { if (!f[key]) return f; const n={...f}; delete n[key]; return n; });

  const handleSeatSelect = (segCode: string, paxIdx: number, seat: SeatInfo) => {
    const key = `${segCode}__${paxIdx}`;
    setSelectedSeats(prev => {
      if (prev[key]?.seat_code===seat.seat_code) { const n={...prev}; delete n[key]; return n; }
      return {...prev, [key]:{seat_code:seat.seat_code,base_price:seat.base_price}};
    });
  };

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

  const adminFee = markup.flight * paxCount;
  const pricingAmount = flightBase + seatFee + baggageFee + insuranceFee + reschedFee + refundFee + delayFee + lostBagFee;
  const grandTotal = pricingAmount + adminFee;

  const validate = (): Record<string,string> => {
    const errs: Record<string,string> = {};
    if (!isValidName(booker.first_name)) errs.booker_name = 'Nama pemesan wajib diisi.';
    if (!isValidEmail(booker.email)) errs.booker_email = 'Format email tidak valid.';
    if (!isValidPhone(booker.mobile)) errs.booker_phone = 'Nomor HP minimal 8 digit angka.';
    passengers.forEach((p, i) => {
      if (!isValidName(p.first_name)) errs[`pax_first_${i}`] = 'Nama depan wajib diisi.';
      if (!isValidName(p.last_name)) errs[`pax_last_${i}`] = 'Nama belakang wajib diisi.';
      if (!isValidBirthDate(p.birth_date)) errs[`pax_birth_${i}`] = 'Tanggal lahir wajib diisi.';
      if (!isValidIdentityNumber(p.identity?.identity_number || '', p.identity?.identity_type || 'ktp')) {
        errs[`pax_id_${i}`] = p.identity?.identity_type === 'passport'
          ? 'No. paspor harus alfanumerik minimal 6 karakter.'
          : 'NIK harus 16 digit angka.';
      }
    });
    return errs;
  };

  const handleSubmit = async () => {
    if (!flightData || isSubmittingRef.current || checkoutDone) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      const ids = ['booker_name','booker_phone','booker_email', ...passengers.flatMap((_,i)=>[`pax_first_${i}`,`pax_last_${i}`,`pax_birth_${i}`,`pax_id_${i}`])];
      scrollToFirstError(ids);
      return;
    }
    setFormErrors({});
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
      const baggagePayload = (selectedBaggage && selectedBaggage.ssr_code !== 'NOBAG')
        ? { ssr_code: selectedBaggage.ssr_code, journey_code: selectedBaggage.journey_code || '', kg: selectedBaggage.kg || 0, name: selectedBaggage.name || '' }
        : undefined;
      const contactPayload = {
        title: booker.title || 'MR',
        first_name: booker.first_name,
        last_name: booker.last_name || '',
        email: booker.email,
        calling_code: booker.calling_code || '62',
        mobile: booker.mobile || '',
        nationality_code: booker.nationality_code || 'ID',
      };
      const bookerPayload = {
        ...contactPayload,
        is_also_booker: true,
      };
      const payload = {
        passengers,
        booker: bookerPayload,
        contacts: [contactPayload],
        schedules: flightData.priceBody?.schedules || [],
        is_combo_price: !!flightData.priceBody?.is_combo_price,
        cabin_class: flightData.priceBody?.cabin_class || 'Y',
        adult: Number(flightData.priceBody?.adult) || 1,
        child: Number(flightData.priceBody?.child) || 0,
        infant: Number(flightData.priceBody?.infant) || 0,
        total_amount: pricingAmount,
        route_label: `${display.origin||''}→${display.destination||''}`,
        origin: display.origin || '',
        destination: display.destination || '',
        departure_date: display.departure || '',
        arrival_date: display.arrival || '',
        flight_number: display.flight_num || '',
        airline_name: display.carrier || '',
        selectedSeats: Object.values(seatRequestBySegment),
        ...(baggagePayload && { selectedBaggage: baggagePayload }),
        addOns: { insurance: addInsurance, reschedule: addResched, refund: addRefund, delay: addDelay, lostBag: addLostBag },
        is_locked_before: isLocked,
      };
      const res = await fetch('/api/flight/book', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error==='SESSION_EXPIRED') { sessionStorage.removeItem('flight_priced_data'); setBookingError('Sesi penerbangan telah berakhir. Silakan cari ulang.'); setTimeout(()=>router.push('/flight/search'),2500); return; }
        const details = data.details ? Object.entries(data.details).map(([k,v])=>`${k}: ${(v as string[]).join(', ')}`).join('; ') : '';
        throw new Error(data.error + (details ? ` (${details})` : '') || 'Pemesanan gagal.');
      }
      sessionStorage.removeItem('flight_priced_data');
      setCheckoutDone(true);
      const bookingId = data.orderId || '';
      if (bookingId) router.push(`/payment/${bookingId}`);
      else router.push('/bookings');
    } catch (e: any) { setBookingError(e.message||`${tc.error}.`); }
    finally { setSubmitting(false); isSubmittingRef.current=false; }
  };

  if (!flightData) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto"/>
        <p className="text-slate-400 text-sm">Memuat data penerbangan...</p>
      </div>
    </div>
  );

  const display = flightData.display || {};
  const priceBreakdown = parsePriceBreakdown(flightData.priceResponse);
  const baseInputCls = 'w-full px-4 py-2.5 bg-white border rounded-lg text-slate-800 text-sm outline-none transition-colors';
  const fieldCls = (err?: string) => baseInputCls + (err ? ' border-red-400 focus:border-red-400' : ' border-slate-200 focus:border-slate-400');
  const inputCls = fieldCls();
  const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1.5';
  const selectCls = inputCls + ' cursor-pointer appearance-none';

  const staticBaggageOpts: BaggageSsr[] = [
    { ssr_code:'NOBAG',  name:'Tidak',   kg:0,  base_price:0,      journey_code:'' },
    { ssr_code:'BAG05',  name:'+5 KG',   kg:5,  base_price:150000, journey_code:'' },
    { ssr_code:'BAG10',  name:'+10 KG',  kg:10, base_price:250000, journey_code:'' },
    { ssr_code:'BAG20',  name:'+20 KG',  kg:20, base_price:450000, journey_code:'' },
  ];
  const noBagOption: BaggageSsr = { ssr_code:'NOBAG', name:'Tidak', kg:0, base_price:0, journey_code:'' };
  const bagOpts: BaggageSsr[] = baggageSsrs.length > 0 ? [noBagOption, ...baggageSsrs.slice(0,5)] : staticBaggageOpts;

  const addonRows = [
    { label:'Biaya Admin', value: adminFee },
    { label:'Kursi Dipilih', value: seatFee },
    { label:'Bagasi Tambahan', value: baggageFee },
    { label:'Asuransi Perjalanan', value: insuranceFee },
    { label:'Perlindungan Reschedule', value: reschedFee },
    { label:'Jaminan Refund 100%', value: refundFee },
    { label:'Asuransi Keterlambatan', value: delayFee },
    { label:'Perlindungan Bagasi Hilang', value: lostBagFee },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <CheckoutNavbar />
      <LeaveGuard active={!checkoutDone} />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-[73px] z-10">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={()=>router.push('/flight/search')} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
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
        {/* Guest banner */}
        {isGuest && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-sm">?</div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Belum punya akun?</p>
                <p className="text-xs text-slate-400"><Link href="/login" className="text-slate-600 underline">Masuk</Link> atau <Link href="/register" className="text-slate-600 underline">daftar</Link> untuk melihat riwayat pesanan.</p>
              </div>
            </div>
          </div>
        )}

        {bookingError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
            <p className="font-semibold mb-1">Pemesanan Gagal</p>
            <p>{bookingError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* LEFT */}
          <div className="space-y-5">
            {/* Data Pemesan */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center"><i className="fa-solid fa-user text-[9px]"></i></div>
                <h2 className="text-sm font-bold text-slate-800">Data Pemesan</h2>
              </div>
              {isGuest ? (
                <p className="text-xs text-slate-400 mt-1 mb-4">E-tiket akan dikirim ke email dan nomor HP di bawah ini.</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1 mb-4">Data diisi otomatis dari akun Anda. Silakan lengkapi jika diperlukan.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nama Lengkap</label>
                  <input
                    id="booker_name"
                    value={`${booker.first_name}${booker.last_name?' '+booker.last_name:''}`.trim()}
                    onChange={e=>{const p=e.target.value.split(' '); setBooker(b=>({...b,first_name:p[0]||'',last_name:p.slice(1).join(' ')||''})); clearErr('booker_name');}}
                    className={fieldCls(formErrors.booker_name)} placeholder="Nama sesuai KTP/Paspor"
                  />
                  {formErrors.booker_name && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_name}</p>}
                </div>
                <div>
                  <label className={labelCls}>{t.contactPhone}</label>
                  <div className="flex gap-2">
                    <select value={booker.calling_code} onChange={e=>setBooker(b=>({...b,calling_code:e.target.value}))} className="w-20 px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm outline-none focus:border-slate-400 cursor-pointer">
                      <option value="+62">+62</option><option value="+65">+65</option><option value="+60">+60</option><option value="+1">+1</option><option value="+44">+44</option>
                    </select>
                    <input id="booker_phone" value={booker.mobile} onChange={e=>{setBooker(b=>({...b,mobile:e.target.value.replace(/\D/g,'')})); clearErr('booker_phone');}} className={fieldCls(formErrors.booker_phone)} placeholder="8xxxxxxxxxx"/>
                  </div>
                  {formErrors.booker_phone && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_phone}</p>}
                  {!formErrors.booker_phone && booker.mobile && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1"><i className="fa-solid fa-circle-check text-[9px]"></i>Nomor terisi otomatis dari akun</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>{t.contactEmail}</label>
                  <input id="booker_email" type="email" value={booker.email} onChange={e=>{setBooker(b=>({...b,email:e.target.value})); clearErr('booker_email');}} className={fieldCls(formErrors.booker_email)} placeholder="email@contoh.com"/>
                  {formErrors.booker_email && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_email}</p>}
                </div>
              </div>
            </div>

            {/* Penumpang */}
            {passengers.map((pax,i) => (
              <PassengerForm key={i} pax={pax} index={i} fieldCls={fieldCls} labelCls={labelCls} selectCls={selectCls} errors={formErrors} onChange={updatePassenger}/>
            ))}

            {/* Pelengkap Penerbangan */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Pelengkap Penerbangan</h2>
              <div className="space-y-3">

                {/* Bagasi */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-800 text-sm mb-1">{t.baggage}</p>
                  <p className="text-xs text-slate-400 mb-3">Bawaan gratis hingga 20 kg/orang.</p>
                  {ssrLoading && <p className="text-xs text-slate-400 animate-pulse mb-2">Memuat harga bagasi...</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {bagOpts.map(opt => (
                      <button key={opt.ssr_code}
                        onClick={()=>setSelectedBaggage(opt.kg===0?null:opt)}
                        className={`py-2.5 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                          (opt.kg===0&&selectedBaggage===null)||(selectedBaggage?.ssr_code===opt.ssr_code)
                            ?'border-slate-800 bg-slate-800 text-white'
                            :'border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}>
                        <div>{opt.kg===0?tc.no:opt.name}</div>
                        <div className="text-[10px] font-normal mt-0.5 opacity-70">{opt.kg===0?'Gratis':fmtIDR(opt.base_price)+'/org'}</div>
                      </button>
                    ))}
                  </div>
                  {selectedBaggage && baggageFee > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-500">+{selectedBaggage.kg} KG × {adultCount} orang</span>
                      <span className="font-semibold text-slate-800">{fmtIDR(baggageFee)}</span>
                    </div>
                  )}
                </div>

                {/* Kursi */}
                <div className={`bg-white rounded-xl border transition-all ${showSeatMap?'border-slate-800':'border-slate-200'}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{t.seatSelection}</p>
                        <p className="text-xs text-slate-400">{t.seatOptional}</p>
                        {Object.keys(selectedSeats).length > 0 && (
                          <p className="text-xs text-slate-600 font-semibold mt-1">
                            {Object.keys(selectedSeats).length} kursi · {fmtIDR(seatFee)}
                          </p>
                        )}
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${showSeatMap?'bg-slate-800':'bg-slate-200'}`}
                        onClick={()=>{ if(!showSeatMap){setShowSeatMap(true);fetchSeats();}else{setShowSeatMap(false);} }}>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${showSeatMap?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                      </div>
                    </div>
                    {showSeatMap && (
                      <div className="mt-4">
                        {seatsLoading && <div className="py-6 text-center"><div className="w-6 h-6 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-slate-400">Memuat peta kursi...</p></div>}
                        {seatsError && !seatsLoading && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                            <p className="font-semibold mb-1">{seatsError}</p>
                            {!seatsError.includes('tidak tersedia') && <button onClick={fetchSeats} className="mt-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg font-semibold text-[11px]">{tc.retry}</button>}
                          </div>
                        )}
                        {!seatsLoading && !seatsError && segmentSeats.length>0 && (
                          <div className="space-y-5 mt-2">
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-50 border border-emerald-300 rounded-sm"></div>Gratis</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-50 border border-amber-300 rounded-sm"></div>Berbayar</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 rounded-sm"></div>Dipilih</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-sm"></div>Tidak Tersedia</div>
                            </div>
                            {segmentSeats.map(seg => (
                              <div key={seg.segment_code}>
                                <p className="text-xs font-semibold text-slate-600 mb-2">{seg.origin} → {seg.destination} · {seg.carrier_name}</p>
                                <SeatMap segment={seg} passengerCount={passengers.filter(p=>p.pax_type!=='INF').length} selectedSeats={selectedSeats} onSelectSeat={handleSeatSelect}/>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Addons */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Perlindungan & Asuransi</p>

                  <div className={`bg-white rounded-xl border p-4 transition-all ${addRefund?'border-slate-800':'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Jaminan Refund 100%</p>
                        <p className="text-xs text-slate-400">Batalkan kapan saja, pengembalian dana penuh.</p>
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addRefund?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddRefund(!addRefund)}>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addRefund?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                      </div>
                    </div>
                    {addRefund && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(refundFee)}</p>}
                  </div>

                  <div className={`bg-white rounded-xl border p-4 transition-all ${addResched?'border-slate-800':'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Perlindungan Reschedule</p>
                        <p className="text-xs text-slate-400">Dilindungi jika maskapai ubah jadwal.</p>
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addResched?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddResched(!addResched)}>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addResched?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                      </div>
                    </div>
                    {addResched && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(reschedFee)}</p>}
                  </div>

                  <div className={`bg-white rounded-xl border p-4 transition-all ${addInsurance?'border-slate-800':'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Asuransi Perjalanan</p>
                        <p className="text-xs text-slate-400">Perlindungan jiwa, bagasi, biaya medis.</p>
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addInsurance?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddInsurance(!addInsurance)}>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addInsurance?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                      </div>
                    </div>
                    {addInsurance && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(insuranceFee)}</p>}
                  </div>

                  <div className={`bg-white rounded-xl border p-4 transition-all ${addDelay?'border-slate-800':'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Asuransi Keterlambatan</p>
                        <p className="text-xs text-slate-400">Kompensasi jika delay lebih dari 2 jam.</p>
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addDelay?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddDelay(!addDelay)}>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addDelay?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                      </div>
                    </div>
                    {addDelay && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(delayFee)}</p>}
                  </div>

                  <div className={`bg-white rounded-xl border p-4 transition-all ${addLostBag?'border-slate-800':'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Perlindungan Bagasi Hilang</p>
                        <p className="text-xs text-slate-400">Ganti rugi hingga Rp 2 juta jika bagasi hilang.</p>
                      </div>
                      <div className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors cursor-pointer ${addLostBag?'bg-slate-800':'bg-slate-200'}`} onClick={()=>setAddLostBag(!addLostBag)}>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${addLostBag?'translate-x-[22px]':'translate-x-[3px]'}`}/>
                      </div>
                    </div>
                    {addLostBag && <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-100">+ {fmtIDR(lostBagFee)}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-xs space-y-1">
              <p className="font-semibold text-sm">Informasi Penting</p>
              <p>Pastikan data penumpang sesuai persis dengan KTP/Paspor.</p>
              <p>E-tiket dikirim ke email pemesan dalam 1×60 menit setelah pembayaran.</p>
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-4 sticky top-28">
            {/* Flight info */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">{t.flightDetails}</span>
              </div>
              {flightData?.allLegsDisplay && flightData.allLegsDisplay.length > 1 ? (
                <div className="divide-y divide-slate-100">
                  {(flightData.allLegsDisplay as any[]).filter(Boolean).map((leg: any, i: number) => {
                    const legLabels = flightData?.searchMeta?.direction === 'RT' ? ['Pergi', 'Pulang'] : (flightData?.searchMeta?.routes || []).map((_: any, j: number) => `Kota ${j + 1}`);
                    return (
                      <div key={i} className="p-4 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{legLabels[i] || `Leg ${i + 1}`}</span>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-slate-900">{fmtTime(leg.departure)}</p>
                          <p className="text-[10px] text-slate-400">{t.direct}</p>
                          <p className="text-lg font-bold text-slate-900">{fmtTime(leg.arrival)}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{leg.origin}</span>
                          <span className="flex-1 h-px bg-slate-200"></span>
                          <span>{leg.destination}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{fmtDate(leg.departure)} · {leg.carrier}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold text-slate-900">{fmtTime(display.departure)}</p>
                    <p className="text-xs text-slate-400">{t.direct}</p>
                    <p className="text-xl font-bold text-slate-900">{fmtTime(display.arrival)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{display.origin}</span>
                    <span className="flex-1 h-px bg-slate-200"></span>
                    <span>{display.destination}</span>
                  </div>
                  <p className="text-xs text-slate-400">{fmtDate(display.departure)} · {display.carrier}</p>
                  <div className="flex gap-2 flex-wrap pt-1">
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">20 KG Gratis</span>
                    {selectedBaggage && <span className="text-[11px] font-semibold bg-slate-800 text-white px-2 py-0.5 rounded">+{selectedBaggage.kg} KG</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">{t.priceDetails}</h3>
              <div className="space-y-2 text-xs">
                {priceBreakdown && priceBreakdown.adultCount>0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tiket {t.adult} ×{priceBreakdown.adultCount}</span>
                    <span className="font-semibold">{fmtIDR((priceBreakdown.adultFare+priceBreakdown.adultTax)*priceBreakdown.adultCount)}</span>
                  </div>
                )}
                {priceBreakdown && priceBreakdown.childCount>0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tiket {t.child} ×{priceBreakdown.childCount}</span>
                    <span className="font-semibold">{fmtIDR((priceBreakdown.childFare+priceBreakdown.childTax)*priceBreakdown.childCount)}</span>
                  </div>
                )}
                {priceBreakdown && priceBreakdown.infantCount>0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tiket {t.infant} ×{priceBreakdown.infantCount}</span>
                    <span className="font-semibold">{fmtIDR((priceBreakdown.infantFare+priceBreakdown.infantTax)*priceBreakdown.infantCount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Biaya Admin</span>
                  <span className="font-semibold">{fmtIDR(adminFee)}</span>
                </div>
                {addonRows.filter(a=>a.value>0 && a.label!=='Biaya Admin').map((a,i)=>(
                  <div key={i} className="flex justify-between text-slate-600">
                    <span>{a.label}</span>
                    <span className="font-semibold">{fmtIDR(a.value)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
                  <span className="font-bold text-slate-800">{t.total}</span>
                  <span className="font-bold text-slate-900 text-base">{fmtIDR(grandTotal)}</span>
                </div>
              </div>

              {Object.keys(formErrors).length > 0 && !submitting && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                  <span>Masih ada {Object.keys(formErrors).length} data yang belum lengkap. Periksa kembali kolom bertanda merah.</span>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-4 w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all text-sm active:scale-[0.98]"
              >
                {submitting
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>{t.processing}</span>
                  : `Bayar ${fmtIDR(grandTotal)}`
                }
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Dengan menekan tombol, Anda menyetujui Syarat & Ketentuan kami.
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin"/>
      </div>
    }>
      <FlightCheckoutContent/>
    </Suspense>
  );
}
