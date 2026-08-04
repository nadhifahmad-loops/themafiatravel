export type GeoPoint = { lat: number; lon: number };

export type GeoAirport = { code: string; name: string; city?: string; country?: string } & GeoPoint;

export type GeoStation = { code: string; name: string } & GeoPoint;

/** Jarak dua titik di permukaan bumi (kilometer) — rumus haversine. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Ambil item terdekat dari sekumpulan titik. */
export function findNearest<T extends GeoPoint>(items: T[], point: GeoPoint): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = haversineKm(point, item);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

/* ─────────────────────────────────────────────────────────────
   KOORDINAT BANDARA (dataset global JSON-Airports)
   - Dimuat sekali dan di-cache di window (pola sama seperti Algolia).
   - Diberi koordinat lat/lon, dipakai untuk "bandara terdekat".
───────────────────────────────────────────────────────────── */

const AIRPORTS_GEO_URL =
  'https://raw.githubusercontent.com/jbrooksuk/JSON-Airports/master/airports.json';

let _airportsGeoPromise: Promise<GeoAirport[]> | null = null;

/** Nama kota ramah label untuk bandara Indonesia (dataset JSON-Airports tidak menyediakan `city`). */
const AIRPORT_CITY: Record<string, string> = {
  CGK: 'Jakarta', HLP: 'Jakarta', SUB: 'Surabaya', DPS: 'Bali', KNO: 'Medan', MES: 'Medan',
  BDO: 'Bandung', JOG: 'Yogyakarta', YIA: 'Yogyakarta', SRG: 'Semarang', UPG: 'Makassar',
  BPN: 'Balikpapan', PLM: 'Palembang', LOP: 'Lombok', PDG: 'Padang', BTJ: 'Banda Aceh',
  PKU: 'Pekanbaru', BKS: 'Bengkulu', PLG: 'Palangka Raya', DJJ: 'Jayapura', TKG: 'Bandar Lampung',
  AMQ: 'Ambon', SOQ: 'Sorong', TIM: 'Timika', KDI: 'Kendari', TRK: 'Tarakan', BTH: 'Batam',
  TNJ: 'Tanjung Pinang', PNK: 'Pontianak', BDJ: 'Banjarmasin', GTO: 'Gorontalo', TTE: 'Ternate',
  MDC: 'Manado', LBJ: 'Labuan Bajo', KOE: 'Kupang', SWQ: 'Sumbawa', MQQ: 'Maumere', TXT: 'Tanjung Pandan',
};

type RawGeoAirport = {
  iata?: string;
  name?: string | null;
  city?: string | null;
  iso?: string | null;
  country?: string | null;
  lat?: number | string;
  lon?: number | string;
  type?: string;
  status?: number;
};

export function loadAirportGeo(): Promise<GeoAirport[]> {
  if (typeof window === 'undefined') return Promise.resolve([]);
  const win = window as Window & { mafiaAirportsGeo?: GeoAirport[] };
  if (win.mafiaAirportsGeo) return Promise.resolve(win.mafiaAirportsGeo);
  if (_airportsGeoPromise) return _airportsGeoPromise;

  _airportsGeoPromise = fetch(AIRPORTS_GEO_URL)
    .then((res) => res.json())
    .then((data: RawGeoAirport[]) => {
      const list: GeoAirport[] = [];
      if (Array.isArray(data)) {
        for (const a of data) {
          if (!a || a.status !== 1 || a.type !== 'airport' || !a.iata) continue;
          const lat = Number(a.lat);
          const lon = Number(a.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          list.push({
            code: a.iata,
            name: a.name || a.iata,
            city: a.city || AIRPORT_CITY[a.iata],
            country: a.iso || a.country || undefined,
            lat,
            lon,
          });
        }
      }
      win.mafiaAirportsGeo = list;
      return list;
    })
    .catch(() => {
      win.mafiaAirportsGeo = [];
      return [];
    });

  return _airportsGeoPromise;
}

/* ─────────────────────────────────────────────────────────────
   KOORDINAT STASIUN KERETA (KAI)
   - API KAI tidak menyediakan koordinat, jadi dipetakan manual.
   - Hanya stasiun utama yang bisa dihitung jaraknya.
───────────────────────────────────────────────────────────── */

export const STATION_COORDS: Record<string, GeoStation> = {
  GMR: { code: 'GMR', name: 'Gambir', lat: -6.1769, lon: 106.8308 },
  PSE: { code: 'PSE', name: 'Pasar Senen', lat: -6.1745, lon: 106.8442 },
  JAKK: { code: 'JAKK', name: 'Jakarta Kota', lat: -6.1375, lon: 106.8144 },
  JNG: { code: 'JNG', name: 'Jatinegara', lat: -6.215, lon: 106.8692 },
  BKS: { code: 'BKS', name: 'Bekasi', lat: -6.2358, lon: 106.9964 },
  CKR: { code: 'CKR', name: 'Cikarang', lat: -6.2546, lon: 107.1404 },
  DP: { code: 'DP', name: 'Depok', lat: -6.4044, lon: 106.8167 },
  BOO: { code: 'BOO', name: 'Bogor', lat: -6.5944, lon: 106.7897 },
  BD: { code: 'BD', name: 'Bandung', lat: -6.9147, lon: 107.6005 },
  CMI: { code: 'CMI', name: 'Cimahi', lat: -6.8795, lon: 107.5434 },
  YK: { code: 'YK', name: 'Yogyakarta', lat: -7.7886, lon: 110.3634 },
  LPN: { code: 'LPN', name: 'Lempuyangan', lat: -7.79, lon: 110.3744 },
  SLO: { code: 'SLO', name: 'Solo Balapan', lat: -7.5565, lon: 110.7891 },
  PWS: { code: 'PWS', name: 'Purwosari', lat: -7.5548, lon: 110.8055 },
  SMT: { code: 'SMT', name: 'Semarang Tawang', lat: -6.9683, lon: 110.4286 },
  SMC: { code: 'SMC', name: 'Semarang Poncol', lat: -6.9746, lon: 110.4084 },
  SGU: { code: 'SGU', name: 'Surabaya Gubeng', lat: -7.2655, lon: 112.7515 },
  SBI: { code: 'SBI', name: 'Surabaya Pasar Turi', lat: -7.2465, lon: 112.73 },
  ML: { code: 'ML', name: 'Malang', lat: -7.9771, lon: 112.6331 },
  PWT: { code: 'PWT', name: 'Purwokerto', lat: -7.4206, lon: 109.2348 },
  TGU: { code: 'TGU', name: 'Medan', lat: 3.5852, lon: 98.6786 },
};
