import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAirlineRefundAmount,
  getAirlineRefundCancellationStatus,
  getAirlineRescheduleStatus,
  hasFlightDeparted,
  getAirlineProviderBookings,
  toAirlineRefundBookings,
  getFlightCabinClass,
} from './orbis-post-booking';

test('membangun provider booking refund dari snapshot Orbis', () => {
  const providerBookings = getAirlineProviderBookings({
    orderNumber: 'AL.123',
    pnr: 'PNR123',
    provider: 'garuda',
    origin: 'CGK',
    destination: 'DPS',
    departureDate: '2026-12-01T04:00:00.000Z',
    passengerData: [{ name: 'A' }, { name: 'B' }],
    bookingData: {
      provider_bookings: [{
        pnr: 'PNR123',
        provider: 'garuda',
        journeys: [{
          origin: 'CGK',
          destination: 'DPS',
          departure_date: '2026-12-01 11:00:00',
        }],
      }],
    },
  });

  assert.deepEqual(providerBookings, [{
    pnr: 'PNR123',
    provider: 'garuda',
    journeys: [{
      origin: 'CGK',
      destination: 'DPS',
      departure_date: '2026-12-01 11:00:00',
      pax: [0, 1],
    }],
  }]);
  assert.deepEqual(toAirlineRefundBookings({
    orderNumber: 'AL.123',
    pnr: 'PNR123',
    provider: 'garuda',
    origin: 'CGK',
    destination: 'DPS',
    departureDate: '2026-12-01T04:00:00.000Z',
    bookingData: {
      provider_bookings: [{
        pnr: 'PNR123',
        provider: 'garuda',
        journeys: [{
          origin: 'CGK',
          destination: 'DPS',
          departure_date: '2026-12-01 11:00:00',
        }],
      }],
    },
  }), [{
    pnr: 'PNR123',
    journeys: [{
      origin: 'CGK',
      destination: 'DPS',
      departure_date: '2026-12-01 11:00:00',
      pax: [0],
    }],
  }]);
});

test('fallback itinerary dan cabin class menjaga format request untuk booking lama', () => {
  const booking = {
    orderNumber: 'AL.456',
    origin: 'SUB',
    destination: 'CGK',
    departureDate: new Date('2026-12-15T00:00:00.000Z'),
  };
  assert.deepEqual(getAirlineProviderBookings(booking), [{
    pnr: 'AL.456',
    journeys: [{
      origin: 'SUB',
      destination: 'CGK',
      departure_date: '2026-12-15T00:00:00.000Z',
      pax: [0],
    }],
  }]);
  assert.equal(getFlightCabinClass({ ...booking, bookingData: { cabin_class: 'C' } }), 'C');
  assert.equal(getFlightCabinClass(booking), 'Y');
});

test('membaca nominal refund vendor dari response dan menangani nominal invalid', () => {
  assert.equal(extractAirlineRefundAmount({ refundable_amount: '1250000' }), 1_250_000);
  assert.equal(extractAirlineRefundAmount({
    refund_list: [{ refund_amount: 850_000 }, { refund_amount: '150000' }],
  }), 1_000_000);
  assert.equal(extractAirlineRefundAmount({
    provider_bookings: [
      { refund_fee: [{ received_amount: 300_000 }, { received_amount: 200_000 }] },
      { refundable_amount: 500_000 },
    ],
  }), 1_000_000);
  assert.equal(extractAirlineRefundAmount({
    provider_bookings: [
      { refundable_amount: 250_000 },
      { refund_fee: [{ received_amount: 125_000 }] },
    ],
  }), 375_000);
  assert.equal(extractAirlineRefundAmount({ refundable_amount: -1 }), null);
});

test('hanya mengonfirmasi refund cancel jika semua PNR berstatus refund tanpa error', () => {
  assert.equal(getAirlineRefundCancellationStatus({
    provider_bookings: [
      { pnr: 'PNR1', state: 'refund' },
      { pnr: 'PNR2', state: 'refund' },
    ],
  }, ['PNR1', 'PNR2']).confirmed, true);

  assert.equal(getAirlineRefundCancellationStatus({
    provider_bookings: [
      { pnr: 'PNR1', state: 'refund' },
      { pnr: 'PNR2', state: 'failed' },
    ],
  }, ['PNR1', 'PNR2']).confirmed, false);

  assert.equal(getAirlineRefundCancellationStatus({
    provider_bookings: [{ pnr: 'PNR1', state: 'refund' }],
  }, ['PNR1', 'PNR2']).confirmed, false);

  assert.equal(getAirlineRefundCancellationStatus({
    state: 'refund',
    pnr: 'PNR1',
    error_msg: 'Refund rejected',
  }, ['PNR1']).confirmed, false);
});

test('reschedule hanya sukses saat setiap PNR dikonfirmasi vendor', () => {
  assert.deepEqual(getAirlineRescheduleStatus({
    sell_reschedule_provider: [
      { pnr: 'PNR1', status: 'SUCCEED' },
      { pnr: 'PNR2', status: 'succeed' },
    ],
  }, ['PNR1', 'PNR2']), {
    allSucceeded: true,
    partialSuccess: false,
    providers: [
      { pnr: 'PNR1', status: 'SUCCEED', error: '' },
      { pnr: 'PNR2', status: 'SUCCEED', error: '' },
    ],
  });

  const partial = getAirlineRescheduleStatus({
    sell_reschedule_provider: [
      { pnr: 'PNR1', status: 'SUCCEED' },
      { pnr: 'PNR2', status: 'FAILED', error_msg: 'Fare unavailable' },
    ],
  }, ['PNR1', 'PNR2']);
  assert.equal(partial.allSucceeded, false);
  assert.equal(partial.partialSuccess, true);

  const failed = getAirlineRescheduleStatus({
    sell_reschedule_provider: [{ pnr: 'PNR1', status: 'FAILED' }],
  }, ['PNR1']);
  assert.equal(failed.allSucceeded, false);
  assert.equal(failed.partialSuccess, false);

  const mismatched = getAirlineRescheduleStatus({
    sell_reschedule_provider: [
      { pnr: 'PNR1', status: 'SUCCEED' },
      { pnr: 'UNKNOWN', status: 'SUCCEED' },
    ],
  }, ['PNR1', 'PNR2']);
  assert.equal(mismatched.allSucceeded, false);
  assert.equal(mismatched.partialSuccess, true);

  const contradictory = getAirlineRescheduleStatus({
    sell_reschedule_provider: [{ pnr: 'PNR1', status: 'SUCCEED', error_msg: 'Rejected' }],
  }, ['PNR1']);
  assert.equal(contradictory.allSucceeded, false);
  assert.equal(contradictory.partialSuccess, false);
});

test('menentukan kelayakan penerbangan berdasarkan waktu dan semua segmen itinerary', () => {
  const now = new Date('2026-11-01T04:00:00.000Z');
  assert.equal(hasFlightDeparted({ departureDate: new Date('2026-11-01T03:59:00.000Z') }, now), true);
  assert.equal(hasFlightDeparted({ departureDate: new Date('2026-11-01T04:01:00.000Z') }, now), false);
  assert.equal(hasFlightDeparted({ departureDate: '2026-10-31' }, now), true);
  assert.equal(hasFlightDeparted({ departureDate: '2026-11-01' }, now), false);
  assert.equal(hasFlightDeparted({
    bookingData: {
      provider_bookings: [{
        journeys: [
          { departure_date: '2026-10-31T23:00:00+07:00' },
          { segments: [{ departure_date: '2026-11-01T03:00:00Z' }] },
        ],
      }],
    },
  }, now), true);
  assert.equal(hasFlightDeparted({ bookingData: { provider_bookings: [] } }, now), false);
});
