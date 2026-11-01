import test from 'node:test';
import assert from 'node:assert/strict';
import { getExpiryWindow } from './booking-expiry';

// Window pembayaran kini 1 jam sejak booking dibuat (lib/payment-window.ts).
test('marks only bookings older than the 1-hour payment window as expired', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');

  assert.equal(getExpiryWindow(new Date('2026-08-03T12:00:00.000Z'), now), true); // 24 jam lalu
  assert.equal(getExpiryWindow(new Date('2026-08-04T10:00:00.000Z'), now), true); // 2 jam lalu
  assert.equal(getExpiryWindow(new Date('2026-08-04T10:59:00.000Z'), now), true); // 61 menit lalu
  assert.equal(getExpiryWindow(new Date('2026-08-04T11:00:00.000Z'), now), true); // tepat 60 menit (batas)
  assert.equal(getExpiryWindow(new Date('2026-08-04T11:01:00.000Z'), now), false); // 59 menit lalu
  assert.equal(getExpiryWindow(new Date('2026-08-04T11:59:59.000Z'), now), false); // baru saja dibuat
});
