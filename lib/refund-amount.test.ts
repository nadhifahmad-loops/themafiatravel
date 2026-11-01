import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVendorRefundAmount } from './refund-amount';

test('reads documented direct vendor cancellation amounts', () => {
  assert.equal(extractVendorRefundAmount({ received_amount: '125000' }), 125_000);
  assert.equal(extractVendorRefundAmount({ refund_amount: 250_000 }), 250_000);
  assert.equal(extractVendorRefundAmount({
    check_refund_amount: { refund_fee: [{ received_amount: '30000' }] },
  }), 30_000);
});

test('sums hotel refund fee amounts and rejects absent or invalid amounts', () => {
  assert.equal(extractVendorRefundAmount({
    refund_fee: [{ received_amount: 125_000 }, { received_amount: '75000' }],
  }), 200_000);
  assert.equal(extractVendorRefundAmount({ refund_fee: [{ received_amount: 'unknown' }] }), null);
  assert.equal(extractVendorRefundAmount({ state: 'void' }), null);
});
