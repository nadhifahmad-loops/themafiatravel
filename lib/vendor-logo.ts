const LOGO_FOLDERS: Record<string, string> = {
  flight: 'airlines',
  hotel: 'hotels',
  insurance: 'insurance',
  train: 'trains',
};

const LOGO_KEYS: Record<string, Set<string>> = {
  flight: new Set(['airasia', 'batik', 'citilink', 'garuda', 'lion', 'pelita', 'superairjet']),
  hotel: new Set(['hotelbeds', 'mgjarvis', 'rdx03', 'rdx07']),
  insurance: new Set(['assistcard', 'bcainsurance', 'great_eastern', 'oona', 'zurich']),
};

export function getVendorLogo(
  bookingType: string,
  provider: string,
  airlineName = ''
): string | null {
  const folder = LOGO_FOLDERS[bookingType];
  if (!folder) return null;

  if (bookingType === 'train') return '/images/trains/kai.png';

  const keys = LOGO_KEYS[bookingType];
  const raw = provider || airlineName || '';
  const key = raw.trim().toLowerCase();
  if (!keys) return null;

  if (keys.has(key)) return `/images/${folder}/${key}.png`;

  const firstWord = key.split(/\s+/)[0] || '';
  if (keys.has(firstWord)) return `/images/${folder}/${firstWord}.png`;

  return null;
}