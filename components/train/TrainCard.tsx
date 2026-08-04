'use client';
import { memo, useMemo, useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

const CABIN_LABELS: Record<string, string> = {
  E: 'Eksekutif', B: 'Bisnis', K: 'Ekonomi', P: 'Prioritas',
};

function formatDuration(elapsed: string) {
  if (!elapsed) return '-';
  const parts = elapsed.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  }
  return elapsed;
}

function formatTime(dt: string) {
  if (!dt) return '--:--';
  return dt.split(' ')[1]?.substring(0, 5) || dt.substring(11, 16);
}

function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function TrainCard({ journey, onSelect, adultCount, isCheapest = false }: { journey: any; onSelect: (journey: any, fare: any) => void; adultCount: number; isCheapest?: boolean; }) {
  const { language } = useLanguage();
  const t = i18n.trainSearch[language];
  const [showFares, setShowFares] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const fares: any[] = useMemo(() => journey.fares || [], [journey]);
  const trainName = journey.carrier_name || '';
  const trainCode = journey.carrier_code || '';
  const trainNum = journey.carrier_number || '';
  
  const departureTime = useMemo(() => formatTime(journey.departure_date), [journey]);
  const arrivalTime = useMemo(() => formatTime(journey.arrival_date), [journey]);

  const lowestPrice = useMemo(() => {
    if (!fares.length) return 0;
    const fare = fares[0];
    const summary = fare.service_charge_summary?.[0];
    if (!summary) return 0;
    return (summary.base_price || summary.base_fare || 0) * adultCount;
  }, [fares, adultCount]);

  const handleSelect = useCallback(async (fare: any) => {
    if (isSelecting) return;
    setIsSelecting(true);
    try { await onSelect(journey, fare); }
    catch (err) { console.error(err); }
    finally { setIsSelecting(false); }
  }, [journey, onSelect, isSelecting]);

  const seatAvail = journey.available_count ?? 0;
  const cabinLabel = CABIN_LABELS[journey.cabin_class] || `${t.class} ${journey.cabin_class}`;

  return (
    <>
      {isSelecting && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5 max-w-sm w-full mx-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-[6px] border-orange-100"></div>
              <div className="absolute inset-0 rounded-full border-[6px] border-orange-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-train-subway text-orange-600 text-2xl"></i>
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-black text-xl text-slate-900">Mengunci Kursi...</h3>
              <p className="text-sm text-slate-500 mt-2">Memproses kereta {trainName}</p>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 ${isCheapest ? 'border-orange-400 ring-2 ring-orange-400/30' : 'border-slate-200 hover:border-orange-200'}`}>
        <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />
        {isCheapest && (
          <div className="px-5 pt-3 pb-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm">
              <i className="fa-solid fa-tags text-[9px]"></i>
              Harga Termurah
            </span>
          </div>
        )}
        <div className="p-4 md:p-5 flex flex-col md:flex-row items-stretch gap-4">
          
          {/* Bagian Kiri: Operator / KAI */}
          <div className="flex items-center gap-3 md:w-48 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center overflow-hidden shrink-0">
               <i className="fa-solid fa-train text-orange-500 text-xl"></i>
            </div>
            <div>
              <p className="font-black text-slate-800 text-sm leading-tight">{trainName}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{trainCode}{trainNum ? ` ${trainNum}` : ''}</p>
              <p className="text-[11px] text-slate-400">{cabinLabel} {journey.class_of_service && `· ${journey.class_of_service}`}</p>
            </div>
          </div>

          {/* Bagian Tengah: Rute & Waktu */}
          <div className="flex-1 flex items-center justify-between gap-2">
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{departureTime}</p>
              <p className="text-xs font-bold text-slate-500 uppercase">{journey.origin}</p>
            </div>

            <div className="flex flex-col items-center flex-1 px-2">
              <p className="text-[11px] font-bold text-slate-400 mb-1">{formatDuration(journey.elapsed_time)}</p>
              <div className="w-full flex items-center gap-1">
                <div className="flex-1 h-px bg-slate-200"></div>
                <i className="fa-solid fa-train-tram text-orange-500 text-[10px]"></i>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              <p className="text-[10px] font-bold mt-1 uppercase text-emerald-600">
                Langsung
              </p>
            </div>

            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{arrivalTime}</p>
              <p className="text-xs font-bold text-slate-500 uppercase">{journey.destination}</p>
            </div>
          </div>

          {/* Bagian Kanan: Harga & Tombol */}
          <div className="md:w-52 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 flex flex-col gap-2">
            
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 rounded-full px-2.5 py-1 self-start">
               <i className="fa-solid fa-couch text-slate-400"></i>
               {seatAvail > 20 ? (
                 <span className="font-semibold text-emerald-600">{t.available} {seatAvail} {t.seat}</span>
               ) : seatAvail > 0 ? (
                 <span className="font-semibold text-amber-600">Sisa {seatAvail} kursi</span>
               ) : (
                 <span className="font-semibold text-red-500">Habis Terjual</span>
               )}
            </div>

            <div className="mt-1">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Mulai dari</p>
              <p className="text-xl font-black text-orange-600 leading-tight">{fmtIDR(lowestPrice)}</p>
              <p className="text-[10px] text-slate-400">/orang</p>
            </div>

            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => handleSelect(fares[0])}
                disabled={isSelecting || !fares.length || seatAvail === 0}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm transition-all disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-95"
              >
                {seatAvail === 0 ? 'Habis' : t.selectTrain}
              </button>
              {fares.length > 1 && (
                <button
                  onClick={() => setShowFares(!showFares)}
                  className={`px-3 rounded-xl border-2 text-sm font-bold transition-all ${showFares ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <i className={`fa-solid fa-chevron-${showFares ? 'up' : 'down'} text-xs`}></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fares yang Diekspansi */}
        {showFares && fares.length > 1 && (
          <div className="bg-slate-50 border-t border-slate-100 p-5">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4">Pilih Sub-Kelas Tarif</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {fares.map((fare: any, i: number) => {
                const summary = fare.service_charge_summary?.[0];
                const farePrice = (summary?.base_price || summary?.base_fare || 0) * adultCount;
                
                return (
                  <div
                    key={i}
                    onClick={() => { if (seatAvail > 0) handleSelect(fare); }}
                    className={`bg-white rounded-xl border-2 border-slate-200 hover:border-orange-400 p-4 ${seatAvail > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} transition-all hover:shadow-md relative`}
                  >
                    <div className="mb-3">
                      <p className="text-lg font-black text-slate-900">{fmtIDR(farePrice)}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">per orang</p>
                    </div>
                    
                    <button disabled={seatAvail === 0} className="mt-2 w-full py-2 rounded-lg bg-slate-100 hover:bg-orange-600 hover:text-white text-slate-700 font-black text-xs transition-all">
                      Pilih Tarif
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(TrainCard);