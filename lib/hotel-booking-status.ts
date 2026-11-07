export type NormalizedHotelBookingStatus = {
  order_number: string;
  pnr: string;
  state: string;
  state_description: string;
  reconcile_state: string;
  checkin_date: string;
  checkout_date: string;
  room_count: number | null;
  total: number | null;
  hotel_name: string;
  hotel_address: string;
  hotel_phone: string;
  hotel_city_name: string;
  hotel_country_name: string;
  hotel_rating: string;
  room_name: string;
  room_type: string;
  meal_type: string;
  guest_count: number | null;
  cancellation_policy: string[];
  cancellation_policy_str: string;
  special_request: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
      const row = asRecord(item);
      if (!row) return [];
      const label = text(row.description) || text(row.policy) || text(row.name) || text(row.text);
      return label ? [label] : [];
    });
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function findPayload(value: unknown): Record<string, unknown> {
  const root = asRecord(value) ?? {};
  const candidates = [
    root,
    asRecord(root.response),
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.booking),
    asRecord(root.summary),
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  return candidates.find((item) =>
    'state' in item
    || 'hotel_name' in item
    || 'order_number' in item
    || 'hotel_rooms' in item
  ) ?? root;
}

export function normalizeHotelBookingStatus(value: unknown): NormalizedHotelBookingStatus {
  const root = findPayload(value);
  const rooms = Array.isArray(root.hotel_rooms) ? root.hotel_rooms : [];
  const room = asRecord(rooms[0]) ?? {};
  const dates = Array.isArray(room.dates) ? room.dates : [];
  const firstDate = asRecord(dates[0]) ?? {};
  const passengers = Array.isArray(root.passengers) ? root.passengers : [];
  const policyList = stringList(root.cancellation_policy);

  return {
    order_number: text(root.order_number),
    pnr: text(root.pnr),
    state: text(root.state),
    state_description: text(root.state_description) || text(root.state),
    reconcile_state: text(root.reconcile_state),
    checkin_date: text(root.checkin_date),
    checkout_date: text(root.checkout_date),
    room_count: numeric(root.room_count),
    total: numeric(root.total),
    hotel_name: text(root.hotel_name),
    hotel_address: text(root.hotel_address),
    hotel_phone: text(root.hotel_phone),
    hotel_city_name: text(root.hotel_city_name) || text(root.hotel_city),
    hotel_country_name: text(root.hotel_country_name),
    hotel_rating: text(root.hotel_rating),
    room_name: text(room.room_name) || text(root.room_name),
    room_type: text(room.room_type),
    meal_type: text(room.meal_type) || text(firstDate.meal_type) || text(root.meal_type),
    guest_count: numeric(room.person) || (passengers.length || null),
    cancellation_policy: policyList.length
      ? policyList
      : [text(root.cancellation_policy_str)].filter(Boolean),
    cancellation_policy_str: text(root.cancellation_policy_str),
    special_request: text(root.special_request),
  };
}
