'use client';

import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

interface SeatOnMap {
  seat_code?: number | string;
  column?: string;
  sequence?: number;
  availability?: number;
}

interface WagonMap {
  cabin_number?: number;
  cabin_code?: string;
  cabin_name?: string;
  maximum_column_number?: number;
  seat_rows?: Array<{ row_number?: string | number; seats?: SeatOnMap[] }>;
}

interface TrainMap {
  fare_code?: string;
  wagons: WagonMap[];
}

interface JourneyEntry {
  pbIdx: number;
  journeySeq: number | string;
  fareCode: string;
  origin: string;
  destination: string;
  seats: Array<{
    seat?: string;
    seat_code?: string | number;
    passenger?: string;
    passenger_sequence?: number;
  }>;
}

interface SeatChoice {
  seat_code: number | string;
  cabin_code: string;
  seat_row: number;
  seat_column: string;
  label: string;
}

interface RowRef {
  row: string | number;
  seat: SeatOnMap;
  wagon: WagonMap;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

const strOf = (v: unknown): string => (typeof v === 'string' ? v : '');

function numOf(v: unknown): number | string {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return v;
  return 0;
}

function normalizeTrainList(data: unknown): TrainMap[] {
  let raw: unknown[] = [];
  if (Array.isArray(data)) raw = data;
  else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.trains)) raw = obj.trains;
    else if (Array.isArray(obj.schedules)) raw = obj.schedules;
    else if (Array.isArray(obj.list)) raw = obj.list;
    else raw = [obj];
  }
  return raw.map(normalizeTrain).filter((t): t is TrainMap => t !== null);
}

function normalizeTrain(t: unknown): TrainMap | null {
  const obj = asRecord(t);
  const wagons = normalizeWagons(obj);
  if (!wagons.length) return null;
  return {
    fare_code: strOf(obj.fare_code) || strOf(obj.fare),
    wagons,
  };
}

function normalizeWagons(t: Record<string, unknown>): WagonMap[] {
  if (Array.isArray(t.wagons)) return t.wagons as WagonMap[];
  if (Array.isArray(t.wagon)) return t.wagon as WagonMap[];
  if (Array.isArray(t.cabins)) return t.cabins as WagonMap[];
  if (t.seat_rows !== undefined || t.cabin_code !== undefined || t.cabin_number != null) {
    return [t as unknown as WagonMap];
  }
  return [];
}

function parseJourneyEntries(providerBookings: unknown[]): JourneyEntry[] {
  const out: JourneyEntry[] = [];
  providerBookings.forEach((pbRaw, pbIdx) => {
    const pb = asRecord(pbRaw);
    const journeys = Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    journeys.forEach((jRaw) => {
      const j = asRecord(jRaw);
      const rawSeats = Array.isArray(j.seats) ? (j.seats as unknown[]) : [];
      const seats = rawSeats.map((sr): JourneyEntry['seats'][number] => {
        const s = asRecord(sr);
        const seq = typeof s.passenger_sequence === 'number' ? s.passenger_sequence : Number(s.passenger_sequence) || undefined;
        return {
          seat: strOf(s.seat) || undefined,
          seat_code: typeof s.seat_code === 'string' || typeof s.seat_code === 'number'
            ? (s.seat_code as string | number)
            : undefined,
          passenger: strOf(s.passenger) || undefined,
          passenger_sequence: seq,
        };
      });
      out.push({
        pbIdx,
        journeySeq: numOf(j.sequence ?? j.seq ?? j.journey_seq),
        fareCode: strOf(j.fare_code),
        origin: strOf(j.origin_name) || strOf(j.origin),
        destination: strOf(j.destination_name) || strOf(j.destination),
        seats,
      });
    });
  });
  return out;
}

function mapTrainsToEntries(trains: TrainMap[], entries: JourneyEntry[]): (TrainMap | null)[] {
  const arr: (TrainMap | null)[] = entries.map(() => null);
  entries.forEach((e, i) => {
    if (!e.fareCode) return;
    const idx = trains.findIndex((t) => t.fare_code && String(t.fare_code) === String(e.fareCode));
    if (idx >= 0) arr[i] = trains[idx];
  });
  const used = new Set<number>();
  entries.forEach((_, i) => {
    if (arr[i]) used.add(trains.indexOf(arr[i]!));
  });
  trains.forEach((t, ti) => {
    if (used.has(ti)) return;
    const free = arr.findIndex((x) => x === null);
    if (free >= 0) { arr[free] = t; used.add(ti); }
  });
  return arr;
}

function findSeatByCode(train: TrainMap | null, seatCode: number | string | undefined): RowRef | null {
  if (!train || seatCode == null) return null;
  const code = String(seatCode);
  for (const w of train.wagons) {
    for (const r of w.seat_rows || []) {
      for (const s of r.seats || []) {
        if (s.seat_code != null && String(s.seat_code) === code) {
          return { row: r.row_number ?? '', seat: s, wagon: w };
        }
      }
    }
  }
  return null;
}

function toChoice(ref: RowRef, rowLabel: string | number): SeatChoice {
  return {
    seat_code: ref.seat.seat_code!,
    cabin_code: strOf(ref.wagon.cabin_code) || strOf(ref.wagon.cabin_name) || String(ref.wagon.cabin_number ?? ''),
    seat_row: Number(rowLabel) || 0,
    seat_column: strOf(ref.seat.column),
    label: `${rowLabel}${strOf(ref.seat.column)}`,
  };
}

function buildAuthBody(orderId: string, opts: { bookerEmail?: string; orderNumber?: string; phone?: string }): Record<string, unknown> {
  const body: Record<string, unknown> = { orderId };
  if (opts.bookerEmail) body.booker_email = opts.bookerEmail;
  if (opts.orderNumber) body.orderNumber = opts.orderNumber;
  if (opts.phone) body.phone = opts.phone;
  return body;
}

export default function TrainSeatPicker({ orderId, providerBookings, passengers, bookerEmail, orderNumber, phone, onSaved }: {
  orderId: string;
  providerBookings: Array<Record<string, unknown>>;
  passengers: Array<Record<string, unknown>>;
  bookerEmail?: string;
  orderNumber?: string;
  phone?: string;
  onSaved: () => Promise<void>;
}) {
  const { language } = useLanguage();
  const t = i18n.bookingDetail[language].train;

  const [open, setOpen] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [trains, setTrains] = useState<TrainMap[]>([]);
  const [activePaxByJourney, setActivePaxByJourney] = useState<Record<number, number>>({});
  const [sel, setSel] = useState<Record<string, SeatChoice>>({});

  const entries = useMemo(() => parseJourneyEntries(providerBookings as unknown[]), [providerBookings]);

  const paxList = useMemo(
    () => passengers
      .map((p, i) => ({ paxType: strOf(p.pax_type), seq: i + 1 }))
      .filter((p) => p.paxType !== 'INF'),
    [passengers]
  );

  const trainsByEntry = useMemo(() => mapTrainsToEntries(trains, entries), [trains, entries]);

  // Kursi saat ini (dari get_booking) — state turunan, tanpa setState.
  const currentSeats = useMemo(() => {
    const map: Record<string, SeatChoice> = {};
    entries.forEach((e, ei) => {
      const train = trainsByEntry[ei];
      if (!train) return;
      (e.seats || []).forEach((s) => {
        const seq = Number(s.passenger_sequence);
        if (!seq || !paxList.some((p) => p.seq === seq)) return;
        const found = findSeatByCode(train, s.seat_code);
        if (found) map[`${ei}:${seq}`] = toChoice(found, found.row);
      });
    });
    return map;
  }, [entries, trainsByEntry, paxList]);

  const effectiveChoice = (key: string): SeatChoice | null => sel[key] ?? currentSeats[key] ?? null;

  const openMap = async () => {
    setOpen(true);
    setError('');
    setMsg('');
    if (trains.length) return;
    if (!entries.length) {
      setError(t.loadingMapFailed);
      return;
    }
    const fareCodes = Array.from(new Set(entries.map((e) => e.fareCode).filter(Boolean)));
    if (!fareCodes.length) {
      setError(t.loadingMapFailed);
      return;
    }
    setLoadingMap(true);
    try {
      const res = await fetch('/api/train/seat-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAuthBody(orderId, { bookerEmail, orderNumber, phone })),
      });
      const json: { success?: boolean; data?: unknown; error?: string } = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || t.loadingMapFailed);
      setTrains(normalizeTrainList(json.data));
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || t.loadingMapFailed);
    } finally {
      setLoadingMap(false);
    }
  };

  const closeMap = () => {
    if (saving) return;
    setOpen(false);
    setError('');
    setMsg('');
  };

  const chooseSeat = (entryIdx: number, paxSeq: number, ref: RowRef) => {
    setSel((prev) => {
      const key = `${entryIdx}:${paxSeq}`;
      const target = String(ref.seat.seat_code);
      const eff = prev[key] ? String(prev[key].seat_code) : currentSeats[key] ? String(currentSeats[key].seat_code) : null;
      if (eff === target) {
        if (prev[key]) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return prev;
      }
      return { ...prev, [key]: toChoice(ref, ref.row) };
    });
  };

  const buildChanges = () => {
    const out: Array<Record<string, unknown>> = [];
    entries.forEach((e, ei) => {
      const changedPax = paxList
        .filter((p) => sel[`${ei}:${p.seq}`] != null)
        .filter((p) => {
          const cur = currentSeats[`${ei}:${p.seq}`] ? String(currentSeats[`${ei}:${p.seq}`].seat_code) : null;
          const chosen = String(sel[`${ei}:${p.seq}`].seat_code);
          return cur === null || cur !== chosen;
        });
      changedPax.forEach((p) => {
        const c = sel[`${ei}:${p.seq}`];
        out.push({
          journeyIdx: ei,
          passenger_sequence: p.seq,
          cabin_code: c.cabin_code,
          seat_row: c.seat_row,
          seat_column: c.seat_column,
        });
      });
    });
    return out;
  };

  const save = async () => {
    if (saving) return;
    const changes = buildChanges();
    if (!changes.length) {
      setMsg(t.noChange);
      return;
    }
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch('/api/train/assign-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildAuthBody(orderId, { bookerEmail, orderNumber, phone }),
          changes,
        }),
      });
      const json: { success?: boolean; error?: string } = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || t.loadingMapFailed);
      await onSaved();
      setMsg(t.seatChanged);
      window.setTimeout(closeMap, 1200);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || t.loadingMapFailed);
    } finally {
      setSaving(false);
    }
  };

  const chosenByOthers = (entryIdx: number, meSeq: number) => {
    const map: Record<string, number> = {};
    paxList.forEach((p) => {
      if (p.seq === meSeq) return;
      const eff = effectiveChoice(`${entryIdx}:${p.seq}`);
      if (eff) map[String(eff.seat_code)] = p.seq;
    });
    return map;
  };

  return (
    <>
      <button
        onClick={openMap}
        className="flex-1 py-3.5 border border-orange-400 text-orange-600 hover:bg-orange-50 font-bold text-sm rounded-xl transition-all text-center"
      >
        <i className="fa-solid fa-chair mr-2"></i>
        {t.selectSeat}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-chair text-orange-500"></i>
                  {t.seatMapTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{t.seatMapNote}</p>
              </div>
              <button onClick={closeMap} disabled={saving} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center disabled:opacity-40">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingMap && (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                  {t.loadingMap}
                </div>
              )}
              {!loadingMap && (!entries.length || !trainsByEntry.some(Boolean)) && (
                <p className="text-slate-400 text-sm py-10 text-center">{t.loadingMapFailed}</p>
              )}
              {!loadingMap && entries.length > 0 && (
                <div className="space-y-6">
                  {entries.map((e, ei) => {
                    const train = trainsByEntry[ei];
                    if (!train) return null;
                    const active = activePaxByJourney[ei] ?? paxList[0]?.seq ?? 0;
                    const label = e.origin && e.destination ? `${e.origin} → ${e.destination}` : `${t.journeyLabel} ${ei + 1}`;
                    return (
                      <div key={ei} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <p className="text-sm font-bold text-slate-700">
                            <i className="fa-solid fa-train text-slate-400 mr-1.5 text-xs"></i>
                            {label}
                          </p>
                          <div className="flex gap-1.5">
                            {paxList.map((p) => {
                              const has = effectiveChoice(`${ei}:${p.seq}`) != null;
                              return (
                                <button
                                  key={p.seq}
                                  onClick={() => setActivePaxByJourney((prev) => ({ ...prev, [ei]: p.seq }))}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                    active === p.seq
                                      ? 'bg-slate-800 text-white border-slate-800'
                                      : has
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                  }`}
                                >
                                  {has ? '✓ ' : ''}{t.paxLabel} {p.seq}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 mb-2">
                          {t.selectPerPax} {t.paxLabel} {active}
                          {effectiveChoice(`${ei}:${active}`) && (
                            <span className="text-emerald-600 font-semibold"> · {t.currentSeat}: {effectiveChoice(`${ei}:${active}`)!.label}</span>
                          )}
                        </p>

                        <div className="flex flex-wrap gap-x-6 gap-y-4">
                          {train.wagons.map((wagon, wi) => {
                            const rows = wagon.seat_rows || [];
                            if (!rows.length) return null;
                            const allCols = Array.from(new Set(rows.flatMap((r) => (r.seats || []).map((s) => s.column).filter((c): c is string => Boolean(c))))).sort();
                            if (!allCols.length) return null;
                            const aisleAfter = allCols.length > 3 ? Math.floor(allCols.length / 2) - 1 : -1;
                            return (
                              <div key={wi} className="min-w-[240px] flex-1">
                                <p className="text-[11px] font-bold text-slate-500 mb-1">
                                  {t.cabinLabel} {strOf(wagon.cabin_name) || strOf(wagon.cabin_code) || String(wagon.cabin_number ?? '') || wi + 1}
                                </p>
                                <div className="flex items-center gap-1 mb-1 pl-9">
                                  {allCols.map((col, idx) => (
                                    <div key={col} className="flex items-center">
                                      {idx === aisleAfter + 1 && <div className="w-3"></div>}
                                      <div className="w-7 text-center text-[9px] font-bold text-slate-400">{col}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                                  {rows.map((row) => {
                                    const colMap: Record<string, SeatOnMap | undefined> = {};
                                    (row.seats || []).forEach((s) => { if (s.column) colMap[s.column] = s; });
                                    const rowRefs: Record<string, RowRef> = {};
                                    (row.seats || []).forEach((s) => {
                                      if (s.column && s.availability !== -1) {
                                        rowRefs[s.column] = { row: row.row_number ?? '', seat: s, wagon };
                                      }
                                    });
                                    return (
                                      <div key={String(row.row_number)} className="flex items-center gap-1">
                                        <div className="w-9 text-center text-[9px] text-slate-400 font-bold flex-shrink-0">{row.row_number}</div>
                                        {allCols.map((col, idx) => {
                                          const seat = colMap[col];
                                          const isSpacer = !seat || seat.availability === -1 || seat.seat_code == null;
                                          const isOccupied = !isSpacer && seat.availability === 0;
                                          const ref = rowRefs[col];
                                          const key = `${ei}:${active}`;
                                          const eff = !isSpacer ? effectiveChoice(key) : null;
                                          const chosenByMe = !isSpacer && eff != null && String(eff.seat_code) === String(seat!.seat_code);
                                          const chosenByOther = !isSpacer && chosenByOthers(ei, active)[String(seat!.seat_code)] != null;
                                          if (isSpacer) {
                                            return (
                                              <div key={col} className="flex items-center">
                                                {idx === aisleAfter + 1 && <div className="w-3"></div>}
                                                <div className="w-7 h-7"></div>
                                              </div>
                                            );
                                          }
                                          let cls = 'w-7 h-7 rounded-md text-[9px] font-bold flex items-center justify-center transition-all border ';
                                          if (isOccupied) cls += 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed';
                                          else if (chosenByMe) cls += 'bg-slate-800 border-slate-800 text-white scale-105 shadow cursor-pointer';
                                          else if (chosenByOther) cls += 'bg-emerald-200 border-emerald-400 text-emerald-700 cursor-not-allowed';
                                          else cls += 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:scale-105 cursor-pointer';
                                          return (
                                            <div key={col} className="flex items-center">
                                              {idx === aisleAfter + 1 && <div className="w-3"></div>}
                                              <button
                                                disabled={isOccupied || chosenByOther}
                                                onClick={() => ref && chooseSeat(ei, active, ref)}
                                                className={cls}
                                                title={`${strOf(row.row_number)}${strOf(seat!.column)}${isOccupied ? ' (' + t.occupied + ')' : ''}`}
                                              >
                                                {isOccupied ? '✕' : `${row.row_number}${seat!.column}`}
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!loadingMap && trainsByEntry.some(Boolean) && (
              <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-300"></span>{t.available}</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200"></span>{t.occupied}</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-800"></span>{t.chosen}</span>
              </div>
            )}

            <div className="px-5 py-4 border-t border-slate-100">
              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              {msg && <p className="text-xs text-emerald-600 mb-2">{msg}</p>}
              <div className="flex gap-3">
                <button onClick={closeMap} disabled={saving} className="flex-1 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm rounded-xl disabled:opacity-50">
                  {t.close}
                </button>
                <button onClick={save} disabled={saving || loadingMap} className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2">
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t.saving}
                    </>
                  ) : (
                    <><i className="fa-solid fa-chair"></i>{t.saveSeat}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}