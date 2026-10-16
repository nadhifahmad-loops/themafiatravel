'use client';
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import CheckoutNavbar from '@/components/layout/CheckoutNavbar';
import CheckoutStepBar from '@/components/checkout/CheckoutStepBar';
import PayButton from '@/components/checkout/PayButton';
import MobileCheckoutBar from '@/components/checkout/MobileCheckoutBar';
import SectionHeader from '@/components/checkout/SectionHeader';
import TermsModal from '@/components/checkout/TermsModal';
import TermsAgreementText from '@/components/checkout/TermsAgreementText';
import DatePickerField from '@/components/checkout/DatePickerField';
import { COUNTRY_CODES } from '@/app/(dashboard)/account/edit/components';
import LeaveGuard from '@/components/checkout/LeaveGuard';
import CheckoutLoadingOverlay from '@/components/checkout/CheckoutLoadingOverlay';
import { useIdempotencyKey } from '@/components/hooks/useIdempotencyKey';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { isValidName, isValidEmail, isValidPhone, isValidIdentityNumber, isValidBirthDate, isValidPassportExpiry, parsePhoneWithCode, scrollToFirstError, buildCheckoutCallbackUrl } from '@/lib/checkout-utils';
import CouponInput from '@/components/checkout/CouponInput';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';

const AIRPORT_COUNTRY: Record<string, string> = {
  CGK:'ID', DPS:'ID', SUB:'ID', SOC:'ID', MLG:'ID', PNK:'ID', BPN:'ID', UPG:'ID', DJJ:'ID', SOQ:'ID', AMQ:'ID', PDG:'ID', PKU:'ID', PLM:'ID', BTJ:'ID', SRG:'ID', JOG:'ID', BDO:'ID', BTH:'ID', KOE:'ID', ABU:'ID', TMC:'ID', LBJ:'ID', MOF:'ID', TTE:'ID', BMU:'ID', WGP:'ID', LOP:'ID', BKS:'ID', DUM:'ID',
  SIN:'SG',
  KUL:'MY', SZB:'MY', BKI:'MY', KCH:'MY', JHB:'MY', PEN:'MY', AOR:'MY', LGK:'MY', TWU:'MY', SDK:'MY', TGG:'MY', MYY:'MY', SBW:'MY', BWN:'BN',
  BKK:'TH', DMK:'TH', HKT:'TH', CNX:'TH', USM:'TH', PHS:'TH', NNT:'TH', HGN:'TH', KOP:'TH', UTH:'TH', NST:'TH', UTP:'TH',
  HAN:'VN', SGN:'VN', DAD:'VN', CXR:'VN', PQC:'VN', VCA:'VN', VCL:'VN', VCS:'VN', UIH:'VN', DLI:'VN', HPH:'VN', VII:'VN', BMV:'VN',
  NRT:'JP', HND:'JP', KIX:'JP', NGO:'JP', CTS:'JP', FUK:'JP', SDJ:'JP', OKA:'JP', ITM:'JP', KMJ:'JP', KOJ:'JP', MYJ:'JP', TAK:'JP', AXJ:'JP', KCJ:'JP',
  ICN:'KR', GMP:'KR', PUS:'KR', CJU:'KR', MWX:'KR', TAE:'KR', YNY:'KR', CJJ:'KR',
  MNL:'PH', CEB:'PH', DVO:'PH', KLO:'PH', TAG:'PH', CRK:'PH', ILO:'PH', ZAM:'PH', PPS:'PH', CGY:'PH', DGT:'PH',
  TPE:'TW', KHH:'TW', RMQ:'TW', TXG:'TW',
  HKG:'HK', MFM:'MO',
  DEL:'IN', BOM:'IN', BLR:'IN', MAA:'IN', HYD:'IN', CCU:'IN', COK:'IN', TRV:'IN', GOI:'IN', AMD:'IN', PNQ:'IN', JAI:'IN', IXC:'IN', LKO:'IN', SXR:'IN', GAU:'IN', IMF:'IN', DIB:'IN', BBI:'IN', RPR:'IN', NAG:'IN', IDR:'IN', VTZ:'IN', RJA:'IN', CJB:'IN', TIR:'IN', UDR:'IN', JDH:'IN', ATQ:'IN', IXR:'IN',
  DXB:'AE', AUH:'AE', SHJ:'AE',
  DOH:'QA', RUH:'SA', JED:'SA', MED:'SA', DMM:'SA', AHB:'SA', ABT:'SA', TIF:'SA',
  IST:'TR', SAW:'TR', ADB:'TR', ESB:'TR', BJV:'TR', DLM:'TR', GZP:'TR', ASR:'TR', KYA:'TR', TZX:'TR', ERZ:'TR', GZT:'TR', VAN:'TR',
  MCT:'OM', KTM:'NP', BWA:'NP',
  CMB:'LK', JKF:'LK', TRR:'LK', HRI:'LK', MLE:'MV',
  LHR:'GB', LGW:'GB', STN:'GB', LTN:'GB', LCY:'GB', BHX:'GB', MAN:'GB', EDI:'GB', GLA:'GB', BRS:'GB', LPL:'GB', NCL:'GB', EMA:'GB', CWL:'GB', BFS:'GB',
  CDG:'FR', ORY:'FR', NCE:'FR', LYS:'FR', MRS:'FR', TLS:'FR', BOD:'FR', NTE:'FR', SXB:'FR', AJA:'FR',
  FRA:'DE', MUC:'DE', DUS:'DE', BER:'DE', HAM:'DE', STR:'DE', CGN:'DE', LEJ:'DE', HAJ:'DE', BRE:'DE', FMO:'DE', DTM:'DE', NUE:'DE', FKB:'DE',
  AMS:'NL', EIN:'NL', RTM:'NL',
  MAD:'ES', BCN:'ES', AGP:'ES', VLC:'ES', SVQ:'ES', PMI:'ES', ALC:'ES', LPA:'ES', TFN:'ES', TFS:'ES', VGO:'ES', SCQ:'ES',
  FCO:'IT', MXP:'IT', VCE:'IT', BLQ:'IT', NAP:'IT', PMO:'IT', CTA:'IT', BGY:'IT', LIN:'IT', TRN:'IT', GOA:'IT', PSA:'IT', OLB:'IT',
  LIS:'PT', OPO:'PT', FAO:'PT', FNC:'PT',
  ZRH:'CH', GVA:'CH', BSL:'CH', VIE:'AT', SZG:'AT', INN:'AT',
  ATH:'GR', SKG:'GR', HER:'GR', CHQ:'GR', RHO:'GR', ZTH:'GR', JMK:'GR', JTR:'GR', KGS:'GR', LCA:'GR', PVK:'GR',
  BRU:'BE', CRL:'BE',
  CPH:'DK', OSL:'NO', BGO:'NO', TOS:'NO', SVG:'NO', TRD:'NO',
  ARN:'SE', GOT:'SE', MMX:'SE', NYO:'SE',
  HEL:'FI', OUL:'FI', TKU:'FI',
  WAW:'PL', KRK:'PL', GDN:'PL', WRO:'PL', POZ:'PL', RZE:'PL', KTW:'PL',
  PRG:'CZ', BRQ:'CZ', BUD:'HU', DEB:'HU',
  OTP:'RO', CLJ:'RO', TSR:'RO', CND:'RO', SOF:'BG', VAR:'BG',
  BEG:'RS', TGD:'ME', SJJ:'BA', SKP:'MK', LJU:'SI', ZAG:'HR', DBV:'HR', SPU:'HR',
  JNB:'ZA', CPT:'ZA', DUR:'ZA',
  CAI:'EG', HRG:'EG', SSH:'EG',
  NBO:'KE', MBA:'KE', ADD:'ET',
  LOS:'NG', ABV:'NG', ACC:'GH', DAR:'TZ', JRO:'TZ',
  CMN:'MA', RAK:'MA', ALG:'DZ', TUN:'TN',
  GRU:'BR', GIG:'BR', EZE:'AR', SCL:'CL', BOG:'CO', MDE:'CO', LIM:'PE',
  MEX:'MX', CUN:'MX', GDL:'MX', PTY:'PA', SJO:'CR',
  JFK:'US', LAX:'US', SFO:'US', ORD:'US', MIA:'US', IAH:'US', ATL:'US', DFW:'US', SEA:'US', EWR:'US', BOS:'US', IAD:'US', DEN:'US', LAS:'US', PHX:'US', MSP:'US', DTW:'US', FLL:'US', MCO:'US', CLT:'US', PDX:'US', SLC:'US', HNL:'US', SAN:'US', TPA:'US', BWI:'US', HOU:'US', DAL:'US', OAK:'US', SJC:'US', SMF:'US', RNO:'US', ANC:'US',
  SYD:'AU', MEL:'AU', BNE:'AU', PER:'AU', ADL:'AU', OOL:'AU', CBR:'AU', CNS:'AU', HBA:'AU',
  AKL:'NZ', WLG:'NZ', CHC:'NZ', DUD:'NZ', ZQN:'NZ',
};

function isInternationalFlight(origin?: string, destination?: string): boolean {
  if (!origin || !destination) return false;
  const originCountry = AIRPORT_COUNTRY[origin.toUpperCase()];
  const destCountry = AIRPORT_COUNTRY[destination.toUpperCase()];
  if (!originCountry || !destCountry) return false;
  return originCountry !== destCountry;
}

interface SeatInfo { seat_code: string; column: string; row_number: string; availability: number; base_price: number; seat_name: string; description: string[]; }
interface CabinData { cabin_name: string; cabin_code: string; seat_rows: { row_number: string; seats: SeatInfo[] }[]; }
interface SegmentSeatData { segment_code: string; origin: string; destination: string; carrier_name: string; provider: string; cabins: CabinData[]; }
interface SelectedSeat { seat_code: string; base_price: number; }
interface PassengerIdentity { identity_type: 'ktp' | 'passport' | 'sim' | 'other'; identity_number: string; identity_expdate: string; identity_country_of_issued_code: string; }
interface Passenger { title: string; first_name: string; last_name: string; birth_date: string; pax_type: 'ADT' | 'CHD' | 'INF' | 'YCD' | 'STU'; gender?: 'male' | 'female'; nationality_code: string; identity: PassengerIdentity; }
interface PriceBreakdown { adultFare: number; adultTax: number; adultCount: number; childFare: number; childTax: number; childCount: number; infantFare: number; infantTax: number; infantCount: number; seniorFare: number; seniorTax: number; seniorCount: number; studentFare: number; studentTax: number; studentCount: number; otherCharges: number; totalFlight: number; orbisAdminFee: number; }
interface BaggageSsr { ssr_code: string; name: string; kg: number; base_price: number; journey_code: string; }
interface MealSsr { ssr_code: string; name: string; base_price: number; journey_code: string; }
interface MarkupSettings { flight: number; hotel: number; train: number; insurance: number; }

function fmtIDR(n: number) { if (!n || isNaN(n)) return 'Rp 0'; return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtTime(dt: string) { if (!dt) return '--:--'; return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16); }
function fmtDate(dt: string) { if (!dt) return ''; return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }

const SSR_TYPE_LABELS: Record<string, string> = {
  BG: 'Bagasi',
  BGA: 'Bagasi Pesawat',
  BGC: 'Bagasi Kabin',
  ML: 'Makanan',
};

function parsePriceBreakdown(priceResponse: any): PriceBreakdown | null {
  if (!priceResponse) return null;
  const pip = priceResponse?.price_itinerary_provider || [];
  if (!pip.length) return null;
  let adultFare=0,adultTax=0,adultCount=0,childFare=0,childTax=0,childCount=0,infantFare=0,infantTax=0,infantCount=0,seniorFare=0,seniorTax=0,seniorCount=0,studentFare=0,studentTax=0,studentCount=0,otherCharges=0;
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
            else if (sc.pax_type==='YCD'){seniorFare+=farePerPax;seniorTax+=taxPerPax;seniorCount=paxCount;}
            else if (sc.pax_type==='STU'){studentFare+=farePerPax;studentTax+=taxPerPax;studentCount=paxCount;}
          }
        }
      }
    }
  }
  const totalFlight = priceResponse.total_price || ((adultFare+adultTax)*adultCount)+((childFare+childTax)*childCount)+((infantFare+infantTax)*infantCount)+((seniorFare+seniorTax)*seniorCount)+((studentFare+studentTax)*studentCount)+otherCharges;
  const fareCalc = ((adultFare+adultTax)*adultCount)+((childFare+childTax)*childCount)+((infantFare+infantTax)*infantCount)+((seniorFare+seniorTax)*seniorCount)+((studentFare+studentTax)*studentCount)+otherCharges;
  const orbisAdminFee = Math.max(0, (priceResponse.total_price || 0) - fareCalc);
  return {adultFare,adultTax,adultCount,childFare,childTax,childCount,infantFare,infantTax,infantCount,seniorFare,seniorTax,seniorCount,studentFare,studentTax,studentCount,otherCharges,totalFlight,orbisAdminFee};
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

function parseMealSsr(ssrData: any): MealSsr[] {
  if (!ssrData) return [];
  const providers: any[] = ssrData?.ssr_availability_provider || ssrData?.response?.ssr_availability_provider || [];
  if (!providers.length) return [];
  const ssrMap = new Map<string, MealSsr>();
  for (const provider of providers) {
    const mealList: any[] = provider?.ssr_availability?.meal || [];
    for (const meal of mealList) {
      const journeyCode = meal.journey_code || '';
      const ssrs: any[] = meal?.ssrs || [];
      for (const ssr of ssrs) {
        if (ssr.ssr_type !== 'ML') continue;
        const scForAdt = (ssr.service_charges || []).find((c: any) => c.pax_type === 'ADT') || ssr.service_charges?.[0];
        if (!scForAdt) continue;
        const price = ssr.base_price || scForAdt.amount || scForAdt.total || 0;
        if (price === 0) continue;
        const key = `${ssr.ssr_code}::${journeyCode}`;
        if (!ssrMap.has(key)) ssrMap.set(key, { ssr_code: ssr.ssr_code, name: ssr.name, base_price: price, journey_code: journeyCode });
      }
    }
  }
  return Array.from(ssrMap.values()).sort((a, b) => a.base_price - b.base_price);
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
  const paxLabel = pax.pax_type==='ADT'?t.adult:pax.pax_type==='CHD'?t.child:pax.pax_type==='YCD'?t.senior:pax.pax_type==='STU'?t.student:t.infant;
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
            <option value="ID">Indonesia</option><option value="SG">Singapura</option><option value="MY">Malaysia</option><option value="TH">Thailand</option><option value="PH">Filipina</option><option value="VN">Vietnam</option><option value="JP">Jepang</option><option value="KR">Korea Selatan</option><option value="CN">China</option><option value="IN">India</option><option value="US">Amerika Serikat</option><option value="GB">Inggris</option><option value="AU">Australia</option><option value="DE">Jerman</option><option value="FR">Prancis</option><option value="AE">Uni Emirat Arab</option><option value="SA">Arab Saudi</option><option value="NL">Belanda</option><option value="SG">Singapura</option>
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
        <div><label className={labelCls}>{t.gender || 'Jenis Kelamin'}</label>
          <select value={pax.gender || ''} onChange={e=>onChange(index,'gender',e.target.value||undefined)} className={selectCls}>
            <option value="">-- Pilih --</option>
            <option value="male">{t.gender === 'Gender' ? 'Male' : 'Laki-laki'}</option>
            <option value="female">{t.gender === 'Gender' ? 'Female' : 'Perempuan'}</option>
          </select>
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
              <DatePickerField
                value={pax.identity.identity_expdate}
                onChange={(iso) => onChange(index, 'identity', { ...pax.identity, identity_expdate: iso })}
                minDate={new Date()}
                endMonth={new Date(new Date().getFullYear() + 15, 11, 31)}
                placeholder="Pilih tanggal kedaluwarsa"
              />
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
  const pathname = usePathname();
  const sp = useSearchParams();
  const { data: session, status } = useSession();
  const isGuest = status !== 'authenticated';
  const isSubmittingRef = useRef(false);
  // SATU Idempotency-Key per attempt checkout. Dibuat sekali di mount sehingga
  // klik ganda memakai key yang SAMA dan server bisa mengenali keduanya sebagai
  // satu permintaan — walau lolos guard, eksekusi tetap hanya satu.
  const idempotencyKey = useIdempotencyKey();
  // Callback agar guest kembali ke halaman checkout ini setelah login/register.
  const checkoutCallbackUrl = buildCheckoutCallbackUrl(pathname, sp.toString());

  usePageTitle('Pembayaran Pesawat');

  const [flightData, setFlightData] = useState<any>(null);
  const [isInternational, setIsInternational] = useState(false);
  const [booker, setBooker] = useState({ title: 'MR', first_name: '', last_name: '', email: '', mobile: '', calling_code: '62', nationality_code: 'ID' });
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Record<string,SelectedSeat>>({});
  const [segmentSeats, setSegmentSeats] = useState<SegmentSeatData[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatsError, setSeatsError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  // Sidik jari payload update_contacts / update_passengers yang benar-benar
  // tersimpan di sesi prepare. Dikirim balik saat booking agar server tahu
  // bagian mana yang masih perlu dikirim ulang — tanpa membuang sesi peta
  // kursi yang sudah dipilih user (lihat lib/orbis-flight-payload.ts).
  const [preparedHashes, setPreparedHashes] = useState<{ contacts: string | null; passengers: string | null }>({ contacts: null, passengers: null });
  // true bila update_contacts + update_passengers benar-benar tersinkron di sesi.
  // Bila false (data belum dilengkapi), buka peta kursi berikutnya menyiapkan
  // ulang sesi dengan data terbaru.
  const [seatsSynced, setSeatsSynced] = useState(false);
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [skipSeats, setSkipSeats] = useState(false);
  const [baggageSsrs, setBaggageSsrs] = useState<BaggageSsr[]>([]);
  const [mealSsrs, setMealSsrs] = useState<MealSsr[]>([]);
  const [ssrLoading, setSsrLoading] = useState(false);
  const [selectedBaggage, setSelectedBaggage] = useState<BaggageSsr | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealSsr | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [markup, setMarkup] = useState<MarkupSettings>({ flight: 50000, hotel: 10, train: 15000, insurance: 5 });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [phonePickerOpen, setPhonePickerOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const phonePickerRef = useRef<HTMLDivElement>(null);
  // Ref section tiap langkah → dipakai CheckoutStepBar untuk scroll-spy
  // (chip langkah aktif) dan untuk melompati section saat chip diklik).
  const section0 = useRef<HTMLDivElement>(null);
  const section1 = useRef<HTMLDivElement>(null);
  const section2 = useRef<HTMLDivElement>(null);
  // Array-nya di-memo agar identitasnya stabil — kalau dibuat inline, efek
  // IntersectionObserver di CheckoutStepBar akan dibuang & dipasang ulang
  // setiap kali form di-render (tiap ketikan).
  const sectionRefs = useMemo(() => [section0, section1, section2], []);

  // Dialog Syarat & Ketentuan dibuka di tempat (tanpa navigasi) agar data form
  // tetap utuh dan LeaveGuard tidak memunculkan dialog "Yakin keluar?".
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (!phonePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (phonePickerRef.current && !phonePickerRef.current.contains(e.target as Node)) setPhonePickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [phonePickerOpen]);

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
      const origin = parsed.display?.origin || parsed.priceBody?.schedules?.[0]?.journeys?.[0]?.segments?.[0]?.segment_code?.split(',')[2] || '';
      const dest = parsed.display?.destination || '';
      const intl = isInternationalFlight(origin, dest);
      setIsInternational(intl);
      const defaultIdentity = { identity_type: (intl ? 'passport' : 'ktp') as 'ktp' | 'passport', identity_number: '', identity_expdate: '', identity_country_of_issued_code: 'ID' };
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
        setBooker(b=>({...b, calling_code:parsed.code, mobile: parsed.number}));
      }
    } catch { router.push('/flight/search'); }
  }, [session]);

  // Data kontak pesanan (§3.12.1.2). Dipakai bersama oleh prepare peta kursi
  // dan payload booking supaya isinya identik di kedua tahap.
  const contactPayload = {
    title: booker.title || 'MR',
    first_name: booker.first_name,
    last_name: booker.last_name || '',
    email: booker.email,
    calling_code: booker.calling_code || '62',
    mobile: booker.mobile || '',
    nationality_code: booker.nationality_code || 'ID',
  };

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
        const meals = parseMealSsr(payload);
        if (meals.length > 0) setMealSsrs(meals);
      }
    } catch {} finally { setSsrLoading(false); }
  }, [ssrLoading, baggageSsrs.length]);

  const fetchSeats = useCallback(async () => {
    if (seatsLoading) return;
    setSeatsLoading(true); setSeatsError('');
    // Alasan sesi belum lengkap (mis. identitas wajib) — dipakai hanya bila
    // get_seat_availability menolak dengan 4011 "Missing Requirements".
    let prepareHint = '';
    try {
      // Siapkan sesi dulu (§2.4.1 step 5 → 6 → 8) kecuali sesi sudah terkunci
      // DAN data pemesan/penumpang sudah tersinkron penuh.
      if (flightData && !(isLocked && seatsSynced)) {
        const lockRes = await fetch('/api/flight/lock', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            ...flightData.priceBody,
            booker,
            contacts: [contactPayload],
            passengers,
          }),
        });
        const lockData = await lockRes.json().catch(() => ({}));
        if (!lockRes.ok) {
          if (lockData.error === 'FARE_UNAVAILABLE') { sessionStorage.removeItem('flight_priced_data'); setBookingError('__FARE_UNAVAILABLE__'); return; }
          if (lockData.error === 'SESSION_EXPIRED') { setSeatsError('Sesi habis. Silakan kembali dan cari ulang.'); return; }
          setSeatsError(lockData.message || lockData.error || 'Gagal menyiapkan sesi. Coba lagi.'); return;
        }

        // sell_journeys (step 5) sudah berjalan → sesi terkunci.
        setIsLocked(true);
        // `contactsHash` / `passengersHash` hanya terisi bila data BENAR-BENAR
        // tersinkron di sesi ini (bukan sekadar kena 4014). Kalau kosong tetapi
        // `*HashCurrent` sama dengan hash sinkron sebelumnya, datanya tidak
        // berubah sejak sinkron terakhir → hash lama dipertahankan agar sesi
        // peta kursi tidak dibuang saat booking.
        const pickHash = (verified: any, current: any, previous: string | null): string | null => {
          if (typeof verified === 'string') return verified;
          if (typeof current === 'string' && current === previous) return previous;
          return null;
        };
        setPreparedHashes(prev => ({
          contacts: pickHash(lockData.contactsHash, lockData.contactsHashCurrent, prev.contacts),
          passengers: pickHash(lockData.passengersHash, lockData.passengersHashCurrent, prev.passengers),
        }));

        // update_contacts (step 6) + update_passengers (step 8) adalah
        // prasyarat get_seat_availability (step 11). Bila belum tersinkron
        // karena data belum dilengkapi, sesi TETAP dipakai untuk memuat peta
        // kursi — sebagian maskapai tetap menyanggupinya. Kalau Orbis menolak
        // dengan 4011, prepareHint di bawah yang ditampilkan ke user.
        const synced = !!(lockData.contactsReady && lockData.passengersReady);
        setSeatsSynced(synced);
        if (!synced) {
          prepareHint =
            lockData.passengersError ||
            'Lengkapi data pemesan & penumpang (nama, tanggal lahir, identitas) lalu muat ulang peta kursi.';
        }
        fetchSsr();
      }
      const res = await fetch('/api/flight/seats', { method:'POST' });
      const data = await res.json();
      if (data.unavailable) { setSeatsError(data.message || 'Peta kursi tidak tersedia untuk penerbangan ini.'); return; }
      if (!res.ok || !data.success) {
        if (data.error === 'MISSING_REQUIREMENTS') { setSeatsError(prepareHint || data.message || 'Data pemesan/penumpang belum lengkap. Lengkapi lalu coba lagi.'); return; }
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
  }, [flightData, isLocked, seatsSynced, seatsLoading, fetchSsr, booker, passengers]);

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
  const mealFee = selectedMeal ? selectedMeal.base_price * (adultCount + childCount) : 0;

  const flightBase = (() => {
    if (!flightData) return 0;
    if (flightData.priceResponse?.total_price) return flightData.priceResponse.total_price;
    const bd = parsePriceBreakdown(flightData.priceResponse);
    if (bd) return bd.totalFlight;
    return flightData.display?.basePrice || 0;
  })();

  const adminFee = markup.flight * paxCount;
  const pricingAmount = flightBase + seatFee + baggageFee + mealFee;
  const grandTotal = Math.max(0, pricingAmount + adminFee - discountAmount);

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
      if (isInternational && p.identity?.identity_type !== 'passport') {
        errs[`pax_id_${i}`] = 'Penerbangan internasional memerlukan paspor.';
      }
      if (isInternational && p.identity?.identity_type === 'passport') {
        if (!p.identity?.identity_expdate) errs[`pax_passport_exp_${i}`] = 'Tanggal kadaluarsa paspor wajib diisi.';
        else if (!isValidPassportExpiry(p.identity.identity_expdate)) errs[`pax_passport_exp_${i}`] = 'Paspor sudah kedaluwarsa.';
      }
    });
    return errs;
  };

  // ── Status langkah untuk stepper ─────────────────────────────
  // Chip ✓ di CheckoutStepBar ditentukan oleh field wajib yang SUDAH TERISI,
  // bukan posisi scroll — memakai `validate()` yang sama sehingga chip hanya
  // hijau bila submit juga tidak akan ditolak. Langkah 3 "Pelengkap"
  // (bagasi/kursi/makan) semuanya opsional → ditandai `optional`, ✓-nya
  // menyusul saat section-nya sudah dikunjungi.
  const stepErrs = validate();
  const stepCompleted = [
    !stepErrs.booker_name && !stepErrs.booker_email && !stepErrs.booker_phone,
    !Object.keys(stepErrs).some(k => k.startsWith('pax_')),
  ];

  const handleSubmit = async () => {
    if (!flightData || isSubmittingRef.current || checkoutDone) return;
    if (bookingError) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      const ids = ['booker_name','booker_phone','booker_email', ...passengers.flatMap((_,i)=>[`pax_first_${i}`,`pax_last_${i}`,`pax_birth_${i}`,`pax_id_${i}`,`pax_passport_exp_${i}`])];
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
          // passenger_number 0-based sesuai seluruh contoh dokumentasi
          // (§3.17.3.1 assign_seats memakai 0, 1, 2, ...).
          seatRequestBySegment[segCode].passengers.push({passenger_number:pIdx,seat_code:sel.seat_code});
        });
      }
      const display = flightData.display || {};
      const baggagePayload = (selectedBaggage && selectedBaggage.ssr_code !== 'NOBAG')
        ? { ssr_code: selectedBaggage.ssr_code, journey_code: selectedBaggage.journey_code || '', kg: selectedBaggage.kg || 0, name: selectedBaggage.name || '' }
        : undefined;
      const mealPayload = selectedMeal
        ? { ssr_code: selectedMeal.ssr_code, journey_code: selectedMeal.journey_code || '', name: selectedMeal.name || '' }
        : undefined;
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
        airline_name: (() => {
          const raw = display.carrier || '';
          const upper = raw.trim().toUpperCase();
          if (CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
          const lower = raw.trim().toLowerCase();
          if (PROVIDER_ID_TO_LABEL[lower]) return PROVIDER_ID_TO_LABEL[lower];
          return raw;
        })(),
        selectedSeats: Object.values(seatRequestBySegment),
        ...(baggagePayload && { selectedBaggage: baggagePayload }),
        ...(mealPayload && { selectedMeal: mealPayload }),
        is_locked_before: isLocked,
        preparedContactsHash: preparedHashes.contacts,
        preparedPassengersHash: preparedHashes.passengers,
        ...(appliedCoupon && { coupon_code: appliedCoupon.code, discount_amount: discountAmount }),
      };
      const res = await fetch('/api/flight/book', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          // Penanda "kedua request ini sama" — server hanya mengeksekusi satu.
          'Idempotency-Key': idempotencyKey.getKey(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Semua kegagalan yang DIJAWAB server sudah melepas klaim idempotency
        // di sana → siapkan key segar agar percobaan berikutnya mulai bersih.
        // (Kegagalan jaringan tidak melewati blok ini dan sengaja TIDAK
        // me-regenerate key: bisa jadi request pertama justru sukses, lalu
        // retry akan membalas duplicate + orderId yang benar.)
        idempotencyKey.regenerate();
        if (data.error==='IN_PROGRESS') {
          setBookingError('Pesanan Anda sedang diproses. Silakan klik tombol bayar sekali lagi untuk melanjutkan.');
          return;
        }
        if (data.error==='IDEMPOTENCY_CONFLICT') {
          setBookingError('Permintaan duplikat terdeteksi. Silakan muat ulang halaman lalu coba lagi.');
          return;
        }
        if (data.error==='SESSION_EXPIRED') { sessionStorage.removeItem('flight_priced_data'); setBookingError('Sesi penerbangan telah berakhir. Silakan cari ulang.'); setTimeout(()=>router.push('/flight/search'),2500); return; }
        if (data.error==='FARE_UNAVAILABLE') { setBookingError('__FARE_UNAVAILABLE__'); return; }
        if (data.error==='PRICE_UNVERIFIABLE') { setBookingError('__PRICE_UNVERIFIABLE__'); return; }
        if (data.error==='PRICE_CHANGED') { setBookingError('__PRICE_CHANGED__'); return; }
        if (data.error==='PASSPORT_REQUIRED') { setBookingError('__PASSPORT_REQUIRED__'); return; }
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
    { label:'Makanan', value: mealFee },
  ];

  // Label langkah stepper + teks CTA mobile (konsisten antar modul checkout).
  const cs = i18n.checkoutSteps[language];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bar brand (logo + wordmark) — sticky, markup identik header utama */}
      <CheckoutNavbar />
      <LeaveGuard
        active={!checkoutDone}
        fallbackHref="/flight/search"
        // Overlay loading memakai z-[12000] → dialog "Yakin keluar?" harus
        // berada di atasnya supaya tetap terlihat saat user menekan Back.
        zIndex={submitting ? 'z-[13000]' : 'z-[1400]'}
      />

      {/* Bar kedua: "← Kembali" + judul langkah. Sticky di SEMUA ukuran layar
          (top-0 di HP, top-60px di desktop) supaya row langkah selalu terlihat
          saat scroll; bar brand justru ikut ter-scroll ke atas di HP. */}
      <CheckoutStepBar
        labels={[cs.booker, cs.passengers, cs.addons]}
        sections={sectionRefs}
        completed={stepCompleted}
        optional={[false, false, true]}
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

        {bookingError && bookingError === '__FARE_UNAVAILABLE__' ? (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 mb-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fa-solid fa-ticket text-amber-600 text-lg"></i>
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm mb-1">Kelas Kursi Tidak Tersedia</p>
                <p className="text-slate-600 text-sm mb-4">
                  Harga atau kelas kursi yang Anda pilih sudah tidak tersedia. Silakan pilih penerbangan lain.
                </p>
                <button
                  onClick={() => { sessionStorage.removeItem('flight_priced_data'); router.push('/flight/search'); }}
                  className="px-5 py-2.5 bg-orange-600 text-white font-bold text-sm rounded-xl hover:bg-orange-700 transition-all shadow-md shadow-orange-500/20"
                >
                  <i className="fa-solid fa-magnifying-glass mr-2"></i>Cari Penerbangan Lain
                </button>
              </div>
            </div>
          </div>
        ) : bookingError && bookingError === '__PRICE_UNVERIFIABLE__' ? (
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-6 mb-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fa-solid fa-rotate text-sky-600 text-lg"></i>
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm mb-1">Gagal Memverifikasi Harga</p>
                <p className="text-slate-600 text-sm mb-4">
                  Harga tiket tidak dapat diverifikasi untuk saat ini. Silakan coba beberapa saat lagi.
                </p>
                <button
                  onClick={() => setBookingError('')}
                  className="px-5 py-2.5 bg-sky-600 text-white font-bold text-sm rounded-xl hover:bg-sky-700 transition-all shadow-md shadow-sky-500/20"
                >
                  <i className="fa-solid fa-rotate mr-2"></i>Coba Lagi
                </button>
              </div>
            </div>
          </div>
        ) : bookingError && bookingError === '__PRICE_CHANGED__' ? (
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-6 mb-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fa-solid fa-tag text-rose-600 text-lg"></i>
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm mb-1">Harga Telah Berubah</p>
                <p className="text-slate-600 text-sm mb-4">
                  Harga penerbangan ini sudah berubah. Silakan pilih penerbangan lain atau coba lagi.
                </p>
                <button
                  onClick={() => { sessionStorage.removeItem('flight_priced_data'); router.push('/flight/search'); }}
                  className="px-5 py-2.5 bg-rose-600 text-white font-bold text-sm rounded-xl hover:bg-rose-700 transition-all shadow-md shadow-rose-500/20"
                >
                  <i className="fa-solid fa-magnifying-glass mr-2"></i>Cari Penerbangan Lain
                </button>
              </div>
            </div>
          </div>
        ) : bookingError && bookingError === '__PASSPORT_REQUIRED__' ? (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-6 mb-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fa-solid fa-passport text-indigo-600 text-lg"></i>
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm mb-1">Paspor Diperlukan</p>
                <p className="text-slate-600 text-sm mb-4">
                  Penerbangan internasional ini memerlukan data paspor. Silakan ubah tipe identitas ke Paspor dan isi data paspor Anda di bawah.
                </p>
                <button
                  onClick={() => { setBookingError(''); setIsInternational(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20"
                >
                  <i className="fa-solid fa-pen mr-2"></i>Isi Data Paspor
                </button>
              </div>
            </div>
          </div>
        ) : bookingError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
            <p className="font-semibold mb-1">Pemesanan Gagal</p>
            <p>{bookingError}</p>
            {/* Tombol bayar dinonaktifkan selama `bookingError` terisi, jadi
                kasih jalur agar user bisa mencoba lagi (klaim idempotency sudah
                dilepas di server, sehingga percobaan ulang aman — tidak dobel). */}
            <button
              onClick={() => setBookingError('')}
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* LEFT */}
          <div className="space-y-5">
            {/* Data Pemesan */}
            <div ref={section0} className="scroll-mt-[60px] lg:scroll-mt-[124px] bg-white rounded-xl border border-slate-200 p-5">
              <SectionHeader
                icon="fa-user"
                title="Data Pemesan"
                description={
                  isGuest
                    ? 'E-tiket akan dikirim ke email dan nomor HP di bawah ini.'
                    : 'Data diisi otomatis dari akun Anda. Silakan lengkapi jika diperlukan.'
                }
              />
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
                    <div className="relative" ref={phonePickerRef}>
                      <button type="button" onClick={() => setPhonePickerOpen(!phonePickerOpen)}
                        className={`flex items-center gap-2 px-3 py-2.5 bg-white border rounded-lg text-sm font-semibold outline-none transition-all shrink-0 ${phonePickerOpen ? 'border-orange-500' : 'border-slate-200 focus:border-slate-400'}`}>
                        <span className="text-slate-800">+{booker.calling_code}</span>
                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${phonePickerOpen ? 'rotate-180' : ''}`}></i>
                      </button>
                      {phonePickerOpen && (
                        <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                              <i className="fa-solid fa-magnifying-glass text-[11px] text-slate-400"></i>
                              <input type="text" value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)} placeholder="Cari negara..."
                                className="flex-1 bg-transparent text-[13px] font-medium text-slate-800 outline-none placeholder:text-slate-400" autoFocus />
                            </div>
                          </div>
                          <div className="max-h-[240px] overflow-y-auto p-1.5">
                            {COUNTRY_CODES.filter(c =>
                              c.name.toLowerCase().includes(phoneSearch.toLowerCase()) ||
                              c.code.includes(phoneSearch)
                            ).map(c => (
                              <button key={c.code} type="button"
                                onClick={() => { setBooker(b => ({ ...b, calling_code: c.code })); setPhonePickerOpen(false); setPhoneSearch(''); }}
                                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all ${c.code === booker.calling_code ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                                <span className="text-xl leading-none w-7 text-center">{c.flag}</span>
                                <span className="flex-1 text-[13px] font-semibold text-slate-700">{c.name}</span>
                                <span className={`text-[13px] font-bold ${c.code === booker.calling_code ? 'text-orange-600' : 'text-slate-400'}`}>+{c.code}</span>
                                {c.code === booker.calling_code && <i className="fa-solid fa-check text-[10px] text-orange-600"></i>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <input id="booker_phone" value={booker.mobile} onChange={e=>{setBooker(b=>({...b,mobile:e.target.value.replace(/\D/g,'')})); clearErr('booker_phone');}} className={fieldCls(formErrors.booker_phone)} placeholder="8xxxxxxxxxx"/>
                  </div>
                  {formErrors.booker_phone && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_phone}</p>}
                </div>
                <div>
                  <label className={labelCls}>{t.contactEmail}</label>
                  <input id="booker_email" type="email" value={booker.email} onChange={e=>{setBooker(b=>({...b,email:e.target.value})); clearErr('booker_email');}} className={fieldCls(formErrors.booker_email)} placeholder="email@contoh.com"/>
                  {formErrors.booker_email && <p className="text-[11px] text-red-600 mt-1">{formErrors.booker_email}</p>}
                </div>
              </div>
            </div>

            {/* Penumpang */}
            <div ref={section1} className="scroll-mt-[60px] lg:scroll-mt-[124px]">
              {passengers.map((pax,i) => (
                <PassengerForm key={i} pax={pax} index={i} fieldCls={fieldCls} labelCls={labelCls} selectCls={selectCls} errors={formErrors} onChange={updatePassenger}/>
              ))}
            </div>

            {/* Pelengkap Penerbangan */}
            <div ref={section2} className="scroll-mt-[60px] lg:scroll-mt-[124px]">
              <SectionHeader icon="fa-plus" title="Pelengkap Penerbangan" />
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

                {/* Makanan */}
                {mealSsrs.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-800 text-sm mb-1">{t.meal}</p>
                    <p className="text-xs text-slate-400 mb-3">Pilih makanan untuk penerbangan Anda.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        onClick={()=>setSelectedMeal(null)}
                        className={`py-2.5 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                          selectedMeal===null
                            ?'border-slate-800 bg-slate-800 text-white'
                            :'border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}>
                        <div>{tc.no}</div>
                        <div className="text-[10px] font-normal mt-0.5 opacity-70">Tanpa makanan</div>
                      </button>
                      {mealSsrs.map(meal => (
                        <button key={meal.ssr_code}
                          onClick={()=>setSelectedMeal(meal)}
                          className={`py-2.5 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                            selectedMeal?.ssr_code===meal.ssr_code
                              ?'border-slate-800 bg-slate-800 text-white'
                              :'border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}>
                          <div>{meal.name}</div>
                          <div className="text-[10px] font-normal mt-0.5 opacity-70">{fmtIDR(meal.base_price)+'/org'}</div>
                        </button>
                      ))}
                    </div>
                    {selectedMeal && mealFee > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                        <span className="text-slate-500">+{selectedMeal.name} × {adultCount + childCount} orang</span>
                        <span className="font-semibold text-slate-800">{fmtIDR(mealFee)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Kursi */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{t.seatSelection}</p>
                      <p className="text-xs text-slate-400">{t.seatOptional}</p>
                    </div>
                    <button type="button" onClick={() => { setShowSeatMap(true); fetchSeats(); }}
                      className="px-4 py-2 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-all">
                      {Object.keys(selectedSeats).length > 0 ? 'Ubah' : 'Pilih Kursi'}
                    </button>
                  </div>
                  {Object.keys(selectedSeats).length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      {passengers.filter(p => p.pax_type !== 'INF').map((pax, i) => {
                        const seat = Object.entries(selectedSeats).find(([k]) => k.endsWith(`__${i}`));
                        const seatLabel = seat ? seat[1].seat_code : '-';
                        const seatPrice = seat ? seat[1].base_price : 0;
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Pax {i + 1} ({pax.first_name || '-'})</span>
                            <span className="font-semibold text-slate-800">{seatLabel}{seatPrice > 0 && <span className="text-slate-400 font-normal ml-1">({fmtIDR(seatPrice)})</span>}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                        <span className="text-slate-500">Total kursi</span>
                        <span className="font-bold text-slate-800">{fmtIDR(seatFee)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">Belum memilih kursi</p>
                  )}
                </div>

                {/* Seat Map Modal */}
                {showSeatMap && (
                  <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowSeatMap(false)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">{t.seatSelection}</h3>
                          <p className="text-[11px] text-slate-400">{t.seatOptional}</p>
                        </div>
                        <button type="button" onClick={() => setShowSeatMap(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                          <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-5">
                        {seatsLoading && <div className="py-10 text-center"><div className="w-6 h-6 border-[3px] border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-slate-400">Memuat peta kursi...</p></div>}
                        {seatsError && !seatsLoading && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                            <p className="font-semibold mb-1">{seatsError}</p>
                            {!seatsError.includes('tidak tersedia') && <button onClick={fetchSeats} className="mt-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg font-semibold text-[11px]">{tc.retry}</button>}
                          </div>
                        )}
                        {!seatsLoading && !seatsError && segmentSeats.length > 0 && (
                          <div className="space-y-5">
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-50 border border-emerald-300 rounded-sm"></div>Gratis</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-50 border border-amber-300 rounded-sm"></div>Berbayar</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 rounded-sm"></div>Dipilih</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-sm"></div>Tidak Tersedia</div>
                            </div>
                            {segmentSeats.map(seg => (
                              <div key={seg.segment_code}>
                                <p className="text-xs font-semibold text-slate-600 mb-2">{seg.origin} → {seg.destination} · {seg.carrier_name}</p>
                                <SeatMap segment={seg} passengerCount={passengers.filter(p => p.pax_type !== 'INF').length} selectedSeats={selectedSeats} onSelectSeat={handleSeatSelect}/>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                        <div className="text-xs text-slate-500">
                          {Object.keys(selectedSeats).length > 0 ? (
                            <span><span className="font-semibold text-slate-800">{Object.keys(selectedSeats).length}</span> kursi dipilih · {fmtIDR(seatFee)}</span>
                          ) : (
                            <span>Belum memilih kursi</span>
                          )}
                        </div>
                        <button type="button" onClick={() => setShowSeatMap(false)}
                          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors">
                          Selesai
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
          <div className="space-y-4 lg:sticky lg:top-[104px]">
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
                {priceBreakdown && priceBreakdown.otherCharges > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Tambahan</span>
                    <span className="font-semibold">{fmtIDR(priceBreakdown.otherCharges)}</span>
                  </div>
                )}
                {priceBreakdown && priceBreakdown.orbisAdminFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Maskapai</span>
                    <span className="font-semibold">{fmtIDR(priceBreakdown.orbisAdminFee)}</span>
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
                <div className="pt-2">
                  <CouponInput
                    category="flight"
                    totalAmount={pricingAmount + adminFee}
                    onApply={(coupon, disc) => { setAppliedCoupon(coupon); setDiscountAmount(disc); }}
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

              {Object.keys(formErrors).length > 0 && !submitting && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                  <span>Masih ada {Object.keys(formErrors).length} data yang belum lengkap. Periksa kembali kolom bertanda merah.</span>
                </div>
              )}
              {/* CTA desktop. Di mobile digantikan MobileCheckoutBar yang
                  menempel di bawah layar. */}
              <div className="hidden lg:block">
                <PayButton
                  onClick={handleSubmit}
                  disabled={submitting || !!bookingError}
                  loading={submitting}
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
        loading={submitting}
        loadingLabel={t.processing}
        disabled={!!bookingError}
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
          konten lain (bagasi, kursi, kupon, navigasi) maupun mengirim order
          kedua. */}
      <CheckoutLoadingOverlay open={submitting} />
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
