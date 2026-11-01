import test from 'node:test';
import assert from 'node:assert/strict';
import { refundDecision, DEFAULT_REFUND_AUTO_MAX } from './refund';

test('refundDecision: hotel, train, dan insurance memerlukan review manual', () => {
  assert.equal(refundDecision('insurance', 1_000_000), 'manual');
  assert.equal(refundDecision('train', 5_000_000), 'manual');
  assert.equal(refundDecision('hotel', 1), 'manual');
});

test('refundDecision: flight memakai ambang nominal', () => {
  assert.equal(refundDecision('flight', DEFAULT_REFUND_AUTO_MAX, DEFAULT_REFUND_AUTO_MAX), 'auto');
  assert.equal(refundDecision('flight', DEFAULT_REFUND_AUTO_MAX + 1, DEFAULT_REFUND_AUTO_MAX), 'manual');
  assert.equal(refundDecision('flight', 1, DEFAULT_REFUND_AUTO_MAX), 'auto');
  assert.equal(refundDecision('flight', 0, DEFAULT_REFUND_AUTO_MAX), 'manual');
});

test('layanan tanpa quote nominal vendor tidak otomatis diproses', () => {
  assert.equal(refundDecision('hotel', 1), 'manual');
  assert.equal(refundDecision('train', 900_000), 'manual');
  assert.equal(refundDecision('insurance', 1_000_000), 'manual');
});
