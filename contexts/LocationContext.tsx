'use client';
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { findNearest, loadAirportGeo, STATION_COORDS } from '@/lib/geo';

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

type Nearest = { code: string; name: string; city?: string; country?: string } | null;

type LocationContextValue = {
  status: LocationStatus;
  nearestAirport: Nearest;
  nearestStation: Nearest;
  error: string | null;
  requestLocation: () => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

const LS_KEY = 'mafia_user_location';

function loadCache(): { nearestAirport: Nearest; nearestStation: Nearest } {
  if (typeof window === 'undefined') return { nearestAirport: null, nearestStation: null };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { nearestAirport: null, nearestStation: null };
    const parsed = JSON.parse(raw);
    const a = parsed?.nearestAirport || null;
    const s = parsed?.nearestStation || null;
    // Cache lama (tanpa country/city) dianggap tidak valid → minta deteksi ulang.
    if (a && !a.country) return { nearestAirport: null, nearestStation: s };
    return { nearestAirport: a, nearestStation: s };
  } catch {
    return { nearestAirport: null, nearestStation: null };
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadCache);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [nearestAirport, setNearestAirport] = useState<Nearest>(initial.nearestAirport);
  const [nearestStation, setNearestStation] = useState<Nearest>(initial.nearestStation);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setError('Browser tidak mendukung geolokasi.');
      return;
    }

    setStatus('requesting');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude };

        const airports = await loadAirportGeo();
        const nearAirport = findNearest(airports, point);
        const nearStation = findNearest(Object.values(STATION_COORDS), point);

        const a = nearAirport ? { code: nearAirport.code, name: nearAirport.name, city: nearAirport.city, country: nearAirport.country } : null;
        const s = nearStation ? { code: nearStation.code, name: nearStation.name } : null;

        setNearestAirport(a);
        setNearestStation(s);
        setStatus('granted');

        try {
          localStorage.setItem(LS_KEY, JSON.stringify({ nearestAirport: a, nearestStation: s }));
        } catch {}
      },
      (err) => {
        setStatus('denied');
        setError(
          err.code === 1
            ? 'Izin lokasi ditolak.'
            : err.code === 3
              ? 'Waktu deteksi lokasi habis.'
              : 'Lokasi tidak dapat dideteksi.',
        );
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  return (
    <LocationContext.Provider
      value={{ status, nearestAirport, nearestStation, error, requestLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
