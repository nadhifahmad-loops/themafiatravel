'use client';
import { memo, useMemo, useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { CARRIER_CODE_TO_AIRLINE } from '@/lib/providers';
import { airportCity } from '@/lib/geo';
import FavoriteButton from '@/components/favorite/FavoriteButton';

function formatDuration(elapsed: string) {
  if (!elapsed) return '-';
  const parts = elapsed.split(':').map(Number);
  if (parts.length === 4) return `${parts[1]}j ${parts[2]}m`;
  if (parts.length >= 2) return `${parts[0]}j ${parts[1]}m`;
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

function getAirlineLogoUrl(code: string) {
  return `https://assets.wego.com/image/upload/h_72,c_fit,f_auto,fl_lossy,q_auto/v20250101/flights/airlines_square/${code}.png`;
}

function FlightCard({ journey, onSelect, adultCount, isCheapest = false, searchParams }: any) {
  const { language } = useLanguage();
  const t = i18n.flightSearch[language];
  const tf = i18n.searchForm[language].flight;
  const [showFares, setShowFares] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const seg = journey.segments?.[0];
  const lastSeg = journey.segments?.[journey.segments.length - 1];
  const fares = useMemo(() => seg?.fares || [], [seg]);

  const airlineCode = seg?.carrier_code || '';
  const airlineName = CARRIER_CODE_TO_AIRLINE[airlineCode] || seg?.carrier_name || airlineCode;
  const flightNum = seg?.carrier_number || '';
  const stopsCount = (journey.segments?.length || 1) - 1;
  const originCode = seg?.origin || journey.origin || '';
  const destCode = seg?.destination || journey.destination || '';

  const departureTime = useMemo(() => formatTime(seg?.departure_date), [seg]);
  const arrivalTime = useMemo(() => formatTime(lastSeg?.arrival_date), [lastSeg]);

  const lowestPrice = useMemo(() => {
    if (!fares.length) return 0;
    const fare = fares[0];
    const summary = fare.service_charge_summary?.[0];
    if (!summary) return 0;
    return ((summary.base_fare || 0) + (summary.base_tax || 0)) * adultCount;
  }, [fares, adultCount]);

  const handleSelect = useCallback(async (fare: any) => {
    if (isSelecting) return;
    setIsSelecting(true);
    try { await onSelect(journey, fare); }
    catch (err) { console.error(err); }
    finally { setIsSelecting(false); }
  }, [journey, onSelect, isSelecting]);

  // Get baggage info from fare_details
  const baggageInfo = useMemo(() => {
    const details = fares[0]?.fare_details || [];
    const bga = details.find((d: any) => d.detail_type === 'BGA');
    if (bga) return `${bga.amount} ${bga.unit}`;
    return '20 KG';
  }, [fares]);

  return (
    <>
      {isSelecting && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5 max-w-sm w-full mx-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-[6px] border-orange-100"></div>
              <div className="absolute inset-0 rounded-full border-[6px] border-orange-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-ticket text-orange-600 text-2xl"></i>
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-black text-xl text-brand-ink">Sedang Diproses...</h3>
              <p className="text-sm text-slate-500 mt-2">Mohon tunggu sebentar</p>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      )}

      <div className={`relative bg-white rounded-2xl border shadow-card overflow-hidden hover:shadow-md transition-all duration-200 ${isCheapest ? 'border-orange-400 ring-2 ring-orange-400/30' : 'border-slate-100 hover:border-orange-200'}`}>
        <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

        {/* Simpan penerbangan ini sebagai favorit */}
        <FavoriteButton
          entityType="flight"
          dedupeKey={`flight:${airlineCode}${flightNum}:${(seg?.departure_date || '').slice(0, 10)}:${originCode}-${destCode}`}
          title={
            originCode && destCode
              ? `${airportCity(originCode)} → ${airportCity(destCode)}`
              : `${airlineName}${airlineCode || flightNum ? ` ${airlineCode}${flightNum}` : ''}`
          }
          subtitle={`${airlineName}${flightNum ? ` ${airlineCode}${flightNum}` : ''}`}
          price={lowestPrice}
          image={getAirlineLogoUrl(airlineCode)}
          searchParams={{
            ...(searchParams || {}),
            _airline: airlineName,
            _flight_no: `${airlineCode}${flightNum}`,
            _dep_time: departureTime,
            _arr_time: arrivalTime,
            _elapsed: seg?.elapsed || '',
            _stops: stopsCount,
          }}
          className="absolute top-4 right-4 z-10"
        />

        {/* Promo & termurah badge */}
        {(isCheapest || fares[0]?.fare_name) && (
          <div className="px-5 pt-3 pb-0 flex flex-wrap items-center gap-2">
            {isCheapest && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm">
                <i className="fa-solid fa-tags text-[9px]"></i>
                Harga Termurah
              </span>
            )}
            {fares[0]?.fare_name && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">
                <i className="fa-solid fa-tag text-[9px]"></i>
                {fares[0].fare_name}
              </span>
            )}
          </div>
        )}

        <div className="p-4 md:p-5 flex flex-col md:flex-row items-stretch gap-4">
          {/* Left: Airline */}
          <div className="flex items-center gap-3 md:w-48 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={getAirlineLogoUrl(airlineCode)}
                alt={airlineName}
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<i class="fa-solid fa-plane text-orange-400 text-xl"></i>`;
                }}
              />
            </div>
            <div>
              <p className="font-black text-brand-ink text-sm leading-tight">{airlineName.split(' ')[0]}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{airlineCode}{flightNum ? ` ${flightNum}` : ''}</p>
              <p className="text-[11px] text-slate-400">{fares[0]?.cabin_class === 'C' ? tf.business : tf.economy}</p>
            </div>
          </div>

          {/* Center: Route */}
          <div className="flex-1 flex items-center justify-between gap-2">
            <div className="text-center">
              <p className="text-2xl font-black text-brand-ink">{departureTime}</p>
              <p className="text-xs font-bold text-slate-500 uppercase">{seg?.origin || journey.origin}</p>
            </div>

            <div className="flex flex-col items-center flex-1 px-2">
              <p className="text-[11px] font-bold text-slate-400 mb-1">{formatDuration(journey.elapsed_time)}</p>
              <div className="w-full flex items-center gap-1">
                <div className="flex-1 h-px bg-slate-200"></div>
                <i className="fa-solid fa-plane text-orange-500 text-[10px]"></i>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              <p className={`text-[10px] font-bold mt-1 uppercase ${stopsCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {stopsCount === 0 ? t.directOnly : `${stopsCount} Transit`}
              </p>
            </div>

            <div className="text-center">
              <p className="text-2xl font-black text-brand-ink">{arrivalTime}</p>
              <p className="text-xs font-bold text-slate-500 uppercase">{lastSeg?.destination || journey.destination}</p>
            </div>
          </div>

          {/* Right: Baggage + Price + Button */}
          <div className="md:w-52 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 flex flex-col gap-2">
            {/* Baggage tag */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-full px-2.5 py-1 self-start">
              <i className="fa-solid fa-suitcase-rolling text-slate-400"></i>
              <span className="font-semibold">{baggageInfo} Bagasi</span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Mulai dari</p>
              <p className="text-xl font-black text-orange-600 leading-tight">{fmtIDR(lowestPrice)}</p>
              <p className="text-[10px] text-slate-400">/orang</p>
            </div>

            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => handleSelect(fares[0])}
                disabled={isSelecting || !fares.length}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm transition-all disabled:opacity-50 active:scale-95"
              >
                {t.selectFlight}
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

            {/* Detail link */}
            <button
              onClick={() => setShowFares(!showFares)}
              className="text-[11px] text-slate-400 hover:text-orange-500 transition-colors text-left"
            >
              Detail · Keuntungan Tambahan · Refund
            </button>
          </div>
        </div>

        {/* Expanded Fares */}
        {showFares && (
          <div className="bg-slate-50 border-t border-slate-100 p-5">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4">Pilih Paket Tarif</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {fares.map((fare: any, i: number) => {
                const summary = fare.service_charge_summary?.[0];
                const farePrice = ((summary?.base_fare || 0) + (summary?.base_tax || 0)) * adultCount;
                const bagDetails = (fare.fare_details || []).filter((d: any) => d.detail_type === 'BGA');
                const colorMap = ['border-slate-200 hover:border-orange-400', 'border-orange-300 bg-orange-50/50 hover:border-orange-500', 'border-emerald-300 bg-emerald-50/50 hover:border-emerald-500'];
                const badgeMap = ['', 'Terlaris', 'Flexible'];
                const badgeColorMap = ['', 'bg-orange-500 text-white', 'bg-emerald-500 text-white'];

                return (
                  <div
                    key={i}
                    onClick={() => handleSelect(fare)}
                    className={`bg-white rounded-xl border-2 ${colorMap[i] || colorMap[0]} p-4 cursor-pointer transition-all hover:shadow-md relative`}
                  >
                    {badgeMap[i] && (
                      <span className={`absolute -top-2 right-3 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badgeColorMap[i]}`}>
                        {badgeMap[i]}
                      </span>
                    )}
                    <div className="mb-3">
                      <p className="text-lg font-black text-brand-ink">{fmtIDR(farePrice)}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">per orang</p>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {bagDetails.length > 0 ? bagDetails.map((b: any, bi: number) => (
                        <div key={bi} className="flex items-center gap-1.5">
                          <i className="fa-solid fa-suitcase text-orange-400"></i>
                          <span>{b.detail_name || `${b.amount} ${b.unit}`}</span>
                        </div>
                      )) : (
                        <div className="flex items-center gap-1.5"><i className="fa-solid fa-suitcase text-orange-400"></i><span>20 KG Bagasi</span></div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <i className={`fa-solid fa-circle-check ${i >= 1 ? 'text-emerald-500' : 'text-slate-300'}`}></i>
                        <span className={i >= 1 ? '' : 'text-slate-300'}>Reschedule</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <i className={`fa-solid fa-circle-check ${i >= 2 ? 'text-emerald-500' : 'text-slate-300'}`}></i>
                        <span className={i >= 2 ? '' : 'text-slate-300'}>Refund</span>
                      </div>
                    </div>
                    <button className="mt-4 w-full py-2 rounded-lg bg-slate-100 hover:bg-orange-600 hover:text-white text-slate-700 font-black text-xs transition-all">
                      Pilih Paket
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

export default memo(FlightCard);
