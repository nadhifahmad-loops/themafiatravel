import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSubmittedPrice } from './price-check';

test('two-way: harga segar sama → ok', () => {
  const r = checkSubmittedPrice({ submitted: 1000000, refreshed: 1000000 });
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'ok');
});

test('two-way: naik di atas toleransi 5% → changed', () => {
  const r = checkSubmittedPrice({ submitted: 1000000, refreshed: 1200000 });
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'changed');
  assert.equal(r.newPrice, 1200000);
});

test('two-way: selisih dalam 5% → ok', () => {
  const r = checkSubmittedPrice({ submitted: 1000000, refreshed: 1040000 });
  assert.equal(r.ok, true);
});

test('refreshed tidak tersedia → unverifiable (fail-closed)', () => {
  const r = checkSubmittedPrice({ submitted: 1000000, refreshed: undefined });
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'unverifiable');
});

test('submitted tidak valid (0/negatif) → invalid', () => {
  assert.equal(checkSubmittedPrice({ submitted: 0 }).kind, 'invalid');
  assert.equal(checkSubmittedPrice({ submitted: -5 }).kind, 'invalid');
});

test('lowerBoundOnly: submitted jauh lebih rendah → changed', () => {
  const r = checkSubmittedPrice({ submitted: 500000, refreshed: 1000000, lowerBoundOnly: true });
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'changed');
});

test('lowerBoundOnly: submitted lebih tinggi (biaya admin wajar) → ok', () => {
  const r = checkSubmittedPrice({ submitted: 1050000, refreshed: 1000000, lowerBoundOnly: true });
  assert.equal(r.ok, true);
});

test('lowerBoundOnly: selisih di bawah toleransi → ok', () => {
  const r = checkSubmittedPrice({ submitted: 970000, refreshed: 1000000, lowerBoundOnly: true });
  assert.equal(r.ok, true);
});