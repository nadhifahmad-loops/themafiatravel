import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENT_TIMEOUT_MS,
  PAYMENT_URGENCY_MS,
  getPaymentCountdown,
  isPaymentWindowPassed,
} from './payment-window';

test('window pembayaran tepat 1 jam, ambang merah 15 menit', () => {
  assert.equal(PAYMENT_TIMEOUT_MS, 60 * 60 * 1000);
  assert.equal(PAYMENT_URGENCY_MS, 15 * 60 * 1000);
});

test('countdown dihitung dari createdAt (booking), bukan dari halaman', () => {
  const now = Date.parse('2026-11-01T10:00:00.000Z');
  const created = '2026-11-01T09:01:00.000Z'; // 59 menit lalu → sisa 1 menit

  const cd = getPaymentCountdown(created, now);
  assert.equal(cd.expired, false);
  assert.equal(cd.hours, 0);
  assert.equal(cd.minutes, 1);
  assert.equal(cd.seconds, 0);
  assert.equal(cd.total, 60_000);
  assert.equal(isPaymentWindowPassed(created, now), false);
});

test('lewat 61 menit → expired dan window dianggap lewat', () => {
  const now = Date.parse('2026-11-01T10:01:00.000Z');
  const created = '2026-11-01T09:00:00.000Z'; // 61 menit lalu

  assert.equal(isPaymentWindowPassed(created, now), true);
  const cd = getPaymentCountdown(created, now);
  assert.equal(cd.expired, true);
  assert.equal(cd.total, 0);
});

test('createdAt kosong/tidak valid → countdown dianggap habis', () => {
  assert.equal(getPaymentCountdown('', Date.now()).expired, true);
  assert.equal(getPaymentCountdown(null).expired, true);
  assert.equal(getPaymentCountdown('bukan-tanggal').expired, true);
  // isValid tidak diketahui → window TIDAK dianggap lewat (biarkan alur normal),
  // tapi countdownd-nya tetap tampil habis agar UI tidak pernah salah aman.
  assert.equal(isPaymentWindowPassed('bukan-tanggal'), false);
});
