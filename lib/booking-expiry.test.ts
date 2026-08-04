import test from 'node:test';
import assert from 'node:assert/strict';
import { getExpiryWindow } from './booking-expiry';

test('marks only bookings older than 24 hours as expired', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');

  assert.equal(getExpiryWindow(new Date('2026-08-03T12:00:00.000Z'), now), true);
  assert.equal(getExpiryWindow(new Date('2026-08-04T10:00:00.000Z'), now), false);
  assert.equal(getExpiryWindow(new Date('2026-08-04T11:59:59.000Z'), now), false);
});
