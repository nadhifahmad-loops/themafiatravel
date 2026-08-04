import test from 'node:test';
import assert from 'node:assert/strict';
import { refundDecision, computeRefundAmount, estimateRefundByType, DEFAULT_REFUND_AUTO_MAX } from './refund';

test('refundDecision: insurance & train selalu auto', () => {
  assert.equal(refundDecision('insurance', 1_000_000), 'auto');
  assert.equal(refundDecision('train', 5_000_000), 'auto');
});

test('refundDecision: flight memakai ambang nominal', () => {
  assert.equal(refundDecision('flight', DEFAULT_REFUND_AUTO_MAX, DEFAULT_REFUND_AUTO_MAX), 'auto');
  assert.equal(refundDecision('flight', DEFAULT_REFUND_AUTO_MAX + 1, DEFAULT_REFUND_AUTO_MAX), 'manual');
  assert.equal(refundDecision('flight', 1, DEFAULT_REFUND_AUTO_MAX), 'auto');
});

test('refundDecision: hotel selalu manual', () => {
  assert.equal(refundDecision('hotel', 1), 'manual');
});

test('computeRefundAmount per tipe layanan', () => {
  assert.equal(computeRefundAmount({ bookingType: 'hotel', totalAmount: 1_000_000 }), 1_000_000);
  assert.equal(computeRefundAmount({ bookingType: 'train', totalAmount: 1_000_000 }), 900_000);
  assert.equal(computeRefundAmount({ bookingType: 'insurance', totalAmount: 500_000 }), 500_000);
  const flight = estimateRefundByType('flight', 1_000_000);
  assert.equal(computeRefundAmount({ bookingType: 'flight', totalAmount: 1_000_000 }), flight.estimated_refund_amount);
  assert.equal(computeRefundAmount({ bookingType: 'hotel', totalAmount: 0 }), 0);
});
