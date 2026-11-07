// Daftar negara yang dipakai form penumpang (kewarganegaraan & penerbit paspor).
// Dibuat satu sumber agar data penumpang tersimpan selalu bisa dipilih di form
// pesawat maupun kereta.

export type CountryOption = {
  code: string;
  label: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'ID', label: 'Indonesia' },
  { code: 'SG', label: 'Singapura' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'TH', label: 'Thailand' },
  { code: 'PH', label: 'Filipina' },
  { code: 'VN', label: 'Vietnam' },
  { code: 'JP', label: 'Jepang' },
  { code: 'KR', label: 'Korea Selatan' },
  { code: 'CN', label: 'China' },
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'Amerika Serikat' },
  { code: 'GB', label: 'Inggris' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Jerman' },
  { code: 'FR', label: 'Prancis' },
  { code: 'AE', label: 'Uni Emirat Arab' },
  { code: 'SA', label: 'Arab Saudi' },
  { code: 'NL', label: 'Belanda' },
];

export const COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map((country) => country.code));

export function countryLabel(code: string | null | undefined): string {
  if (!code) return '-';
  return COUNTRY_OPTIONS.find((country) => country.code === code)?.label || code;
}
