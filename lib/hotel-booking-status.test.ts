import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHotelBookingStatus } from './hotel-booking-status';

test('normalizes get_summary_booking hotel fields safely', () => {
  const status = normalizeHotelBookingStatus({
    order_number: 'HTL-1',
    pnr: 'PNR-1',
    state: 'issued',
    state_description: 'Issued',
    checkin_date: '2026-12-10',
    checkout_date: '2026-12-12',
    total: 4673988,
    hotel_name: 'Holiday Inn Atrium',
    hotel_address: '317 Outram Road',
    hotel_phone: '+6567330188',
    hotel_city_name: 'Singapore',
    hotel_country_name: 'Singapore',
    hotel_rating: '4',
    cancellation_policy: [{ description: 'Free cancellation until 5 Nov 2026' }],
    special_request: 'Non-smoking',
    hotel_rooms: [{
      room_name: 'standard room,1 queen bed',
      room_type: '1',
      person: 2,
      meal_type: 'RO',
      dates: [{ date: '2026-12-10 00:00:00', meal_type: 'RO' }],
    }],
  });

  assert.equal(status.order_number, 'HTL-1');
  assert.equal(status.state, 'issued');
  assert.equal(status.hotel_name, 'Holiday Inn Atrium');
  assert.equal(status.room_name, 'standard room,1 queen bed');
  assert.equal(status.meal_type, 'RO');
  assert.equal(status.guest_count, 2);
  assert.equal(status.room_count, null);
  assert.deepEqual(status.cancellation_policy, ['Free cancellation until 5 Nov 2026']);
  assert.equal(status.special_request, 'Non-smoking');
});

test('accepts a documented response nested under data and falls back to policy text', () => {
  const status = normalizeHotelBookingStatus({
    data: {
      order_number: 'HTL-2',
      state: 'hold',
      hotel_name: 'Test Hotel',
      cancellation_policy_str: 'No cancellation on: 05 Nov 2026 onward(s)',
      hotel_rooms: [{ room_name: 'Deluxe', person: 1 }],
    },
  });

  assert.equal(status.order_number, 'HTL-2');
  assert.equal(status.state, 'hold');
  assert.equal(status.state_description, 'hold');
  assert.equal(status.room_name, 'Deluxe');
  assert.deepEqual(status.cancellation_policy, ['No cancellation on: 05 Nov 2026 onward(s)']);
});
