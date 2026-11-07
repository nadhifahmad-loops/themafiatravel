import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrbisHotelBookingPayload,
  getOrbisHotelBookingIdentifiers,
  getOrbisHotelProvisionPriceCode,
  normalizeHotelChildAges,
} from './orbis-hotel-payload';

test('builds the hotel booking payload from provisioned data', () => {
  const payload = buildOrbisHotelBookingPayload({
    hotel_code: 'hotel-1',
    price_code: '87261',
    passenger: [{ first_name: 'Ayu' }],
    contact: [{ email: 'ayu@example.com' }],
    booker: { first_name: 'Ayu', last_name: 'Putri' },
    search_data: {
      checkin_date: '2026-11-21',
      checkout_date: '2026-11-22',
      destination_id: 'SG7355',
      adult: '2',
      child: '1',
      child_ages: [5],
      room: '1',
      nationality: 'ID',
      hotel_id: 'not-part-of-booking-search-data',
    },
  });

  assert.equal(payload.hotel_code, 'hotel-1');
  assert.equal(payload.price_codes, '87261');
  assert.equal(payload.price_code, undefined);
  assert.deepEqual(payload.passengers, [{ first_name: 'Ayu' }]);
  assert.deepEqual(payload.kwargs, { force_issued: 'True' });
  assert.deepEqual(payload.search_data, {
    checkin_date: '2026-11-21',
    checkout_date: '2026-11-22',
    destination_id: 'SG7355',
    adult: 2,
    child: 1,
    child_ages: '[5]',
    rooms: 1,
    nationality: 'ID',
  });
});

test('normalizes child ages and drops invalid values at the Orbis boundary', () => {
  assert.equal(normalizeHotelChildAges('[5, 7, 99, invalid]'), '[5,7]');
  assert.equal(normalizeHotelChildAges(undefined), '[]');
});

test('uses the provision response price code for the booking request', () => {
  assert.equal(getOrbisHotelProvisionPriceCode({ price_code: 87261 }, 'old-code'), '87261');
  assert.equal(getOrbisHotelProvisionPriceCode({}, 'old-code'), 'old-code');
});

test('extracts booking status identifiers from the Orbis hotel response', () => {
  assert.deepEqual(getOrbisHotelBookingIdentifiers({
    order_number: 'ORB-123',
    hotel_rooms: [{ pnr: 'HOTEL-456', provider: 'mgjarvis' }],
  }, 'display-name', 'Ayu Putri'), {
    orderNumber: 'ORB-123',
    pnr: 'HOTEL-456',
    issuedName: 'HOTEL-456',
    provider: 'mgjarvis',
  });
});
