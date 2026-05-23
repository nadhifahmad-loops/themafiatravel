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

// Map agar mudah lookup nama maskapai dari carrier code
export const CARRIER_CODE_TO_AIRLINE: Record<string, string> = {
  QG: 'Citilink',
  JT: 'Lion Air',
  ID: 'Batik Air',
  GA: 'Garuda Indonesia',
  AK: 'AirAsia',
  QZ: 'AirAsia Indonesia',
  XT: 'AirAsia X',
  SJ: 'Sriwijaya Air',
  IN: 'Nam Air',
  IW: 'Wings Air',
  SQ: 'Singapore Airlines',
  MH: 'Malaysia Airlines',
  CX: 'Cathay Pacific',
  EK: 'Emirates',
  TK: 'Turkish Airlines',
  QR: 'Qatar Airways',
  NH: 'ANA',
  JL: 'Japan Airlines',
  KE: 'Korean Air',
};
