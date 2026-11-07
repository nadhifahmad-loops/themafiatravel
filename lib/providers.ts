// ============================================================
// DAFTAR PROVIDER MASKAPAI YANG DIDUKUNG ORBIS
// Ditambah/kurangi sesuai kontrak API yang aktif
// ============================================================

export interface AirlineProvider {
  id: string;           // provider key untuk API
  label: string;        // nama tampilan
  carrierCodes: string[]; // IATA codes yang tersedia di provider ini
  requiresCarrierCode: boolean; // jika true, harus kirim carrier_codes
}

// Provider yang akan disearch secara paralel
export const FLIGHT_PROVIDERS: AirlineProvider[] = [
  { id: 'citilink',   label: 'Citilink',        carrierCodes: ['QG'],             requiresCarrierCode: false },
  { id: 'lionair',    label: 'Lion Air',         carrierCodes: ['JT'],             requiresCarrierCode: false },
  { id: 'batikair',   label: 'Batik Air',        carrierCodes: ['ID'],             requiresCarrierCode: false },
  { id: 'airasia',    label: 'AirAsia',          carrierCodes: ['AK', 'QZ', 'XT'], requiresCarrierCode: false },
  { id: 'sriwijaya',  label: 'Sriwijaya Air',    carrierCodes: ['SJ', 'IN'],       requiresCarrierCode: false },
  { id: 'amadeus',    label: 'Garuda & Intl',    carrierCodes: [],                 requiresCarrierCode: false },
  { id: 'sia',        label: 'Singapore & Intl', carrierCodes: [],                 requiresCarrierCode: false },
];

// Providers yang wajib berjalan untuk semua search
export const PROVIDER_IDS = FLIGHT_PROVIDERS.map(p => p.id);

// Map provider ID → label (buat resolve "citilink" → "Citilink", dll)
export const PROVIDER_ID_TO_LABEL: Record<string, string> = Object.fromEntries(
  FLIGHT_PROVIDERS.map(p => [p.id, p.label])
);

// Kelompok maskapai yang tampil sebagai satu entitas di UI walaupun
// memiliki beberapa kode IATA (mis. Indonesia AirAsia, AirAsia X, Thai AirAsia).
export const AIRLINE_GROUPS: Record<string, string[]> = {
  AirAsia: ['AK', 'QZ', 'XT', 'D7', 'FD', 'XJ', 'Z2', 'KT', 'I5'],
};

const GROUPED_CARRIER_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(AIRLINE_GROUPS).flatMap(([name, codes]) => codes.map(code => [code, name]))
);

// Map agar mudah lookup nama maskapai dari carrier code
export const CARRIER_CODE_TO_AIRLINE: Record<string, string> = {
  // Indonesia
  QG: 'Citilink',
  JT: 'Lion Air',
  ID: 'Batik Air',
  GA: 'Garuda Indonesia',
  AK: 'AirAsia',
  QZ: 'AirAsia',
  XT: 'AirAsia',
  SJ: 'Sriwijaya Air',
  IN: 'Nam Air',
  IW: 'Wings Air',
  BI: 'Brunei Airlines',
  // Malaysia
  OD: 'Batik Air Malaysia',
  MH: 'Malaysia Airlines',
  FY: 'Firefly',
  // Singapore
  SQ: 'Singapore Airlines',
  TR: 'Scoot',
  // Thailand
  TG: 'Thai Airways',
  SL: 'Thai Lion Air',
  WE: 'Thai VietJet Air',
  FD: 'AirAsia',
  D7: 'AirAsia',
  XJ: 'AirAsia',
  KT: 'AirAsia',
  I5: 'AirAsia',
  // Vietnam
  VJ: 'VietJet Air',
  VN: 'Vietnam Airlines',
  // Philippines
  PR: 'Philippine Airlines',
  Z2: 'AirAsia',
  '5J': 'Cebu Pacific',
  // Hong Kong
  CX: 'Cathay Pacific',
  UO: 'HK Express',
  // Taiwan
  CI: 'China Airlines',
  BR: 'EVA Air',
  // China
  MU: 'China Eastern Airlines',
  CA: 'Air China',
  CZ: 'China Southern Airlines',
  HU: 'Hainan Airlines',
  '3U': 'Sichuan Airlines',
  MF: 'Xiamen Air',
  // Japan
  NH: 'ANA',
  JL: 'Japan Airlines',
  MM: 'Peach Aviation',
  // Korea
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  // India
  AI: 'Air India',
  '6E': 'IndiGo',
  SG: 'SpiceJet',
  // Middle East
  EK: 'Emirates',
  EY: 'Etihad Airways',
  TK: 'Turkish Airlines',
  QR: 'Qatar Airways',
  GF: 'Gulf Air',
  WY: 'Oman Air',
  SV: 'Saudia',
  // Europe
  BA: 'British Airways',
  LH: 'Lufthansa',
  AF: 'Air France',
  KL: 'KLM',
  SK: 'SAS',
  AZ: 'ITA Airways',
  IB: 'Iberia',
  TP: 'TAP Air Portugal',
  // USA
  AA: 'American Airlines',
  DL: 'Delta Air Lines',
  UA: 'United Airlines',
  WN: 'Southwest Airlines',
  B6: 'JetBlue Airways',
  AS: 'Alaska Airlines',
  // Australia
  QF: 'Qantas',
  VA: 'Virgin Australia',
  JQ: 'Jetstar Airways',
};

// Nama tampilan kanonik untuk sebuah carrier code.
export function getAirlineDisplayName(code?: string, fallbackName?: string): string {
  const upper = (code || '').trim().toUpperCase();
  if (upper && GROUPED_CARRIER_CODES[upper]) return GROUPED_CARRIER_CODES[upper];
  if (upper && CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
  const cleanName = fallbackName?.replace(/\s+/g, ' ').trim();
  if (cleanName && /air\s*asia/i.test(cleanName)) return 'AirAsia';
  return cleanName || upper || 'Maskapai';
}
