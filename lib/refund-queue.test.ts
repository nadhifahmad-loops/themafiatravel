import test from 'node:test';
import assert from 'node:assert/strict';
import { getRefundQueueStatuses, isRefundQueueBooking } from './refund-queue';

test('menampilkan booking refund queue hanya untuk status yang sesuai', () => {
  assert.equal(isRefundQueueBooking('refund_requested'), true);
  assert.equal(isRefundQueueBooking('refund'), true);
  assert.equal(isRefundQueueBooking('paid'), false);
  assert.equal(isRefundQueueBooking('issued'), false);
  assert.equal(isRefundQueueBooking('cancelled'), false);
});

test('mengembalikan daftar status refund queue yang konsisten', () => {
  assert.deepEqual(getRefundQueueStatuses(), ['refund_requested', 'refund']);
});
