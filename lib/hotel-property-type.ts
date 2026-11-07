export type HotelPropertyType = 'all' | 'hotel' | 'villa';

export function parseHotelPropertyType(value: string | null): HotelPropertyType {
  return value === 'hotel' || value === 'villa' ? value : 'all';
}

function normalizedText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function matchesHotelPropertyType(
  hotel: Record<string, unknown>,
  selectedType: HotelPropertyType,
): boolean {
  if (selectedType === 'all') return true;

  const metadataType = [
    hotel.property_type,
    hotel.hotel_type,
    hotel.accommodation_type,
    hotel.category,
    hotel.type,
  ]
    .map(normalizedText)
    .find(Boolean);
  const propertyName = normalizedText(hotel.name ?? hotel.hotel_name);
  const isVilla = metadataType
    ? metadataType.includes('villa')
    : /\bvillas?\b/.test(propertyName);

  return selectedType === 'villa' ? isVilla : !isVilla;
}
