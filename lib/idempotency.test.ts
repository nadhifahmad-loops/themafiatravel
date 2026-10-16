import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, hashPayload, buildRecordKey } from './idempotency';

test('canonicalJson: urutan key tidak mempengaruhi hasil', () => {
  const a = canonicalJson({ b: 1, a: 2, c: { z: 1, y: 2 } });
  const b = canonicalJson({ c: { y: 2, z: 1 }, a: 2, b: 1 });
  assert.equal(a, b);
});

test('canonicalJson: array tetap terjaga urutannya (posisi pax berarti)', () => {
  const a = canonicalJson({ pax: ['ADI', 'BUDI'] });
  const b = canonicalJson({ pax: ['BUDI', 'ADI'] });
  assert.notEqual(a, b);
});

test('canonicalJson: undefined dibuang, bukan jadi string "undefined"', () => {
  assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(canonicalJson(undefined), 'null');
});

test('hashPayload: payload identik (beda urutan key) → hash sama', () => {
  const first = hashPayload({ total_amount: 100000, passengers: [{ first_name: 'ADI' }], coupon_code: null });
  const second = hashPayload({ passengers: [{ first_name: 'ADI' }], coupon_code: null, total_amount: 100000 });
  assert.equal(first, second);
});

test('hashPayload: payload berbeda → hash beda', () => {
  assert.notEqual(hashPayload({ total_amount: 100000 }), hashPayload({ total_amount: 99999 }));
});

test('hashPayload: selalu 64 karakter hex (sha256)', () => {
  assert.match(hashPayload({ a: 1 }), /^[0-9a-f]{64}$/);
});

test('buildRecordKey: memisahkan user agar key user lain tidak bisa dipakai lintas akun', () => {
  const mine = buildRecordKey('flight', 'user-1', 'uuid-abc');
  const theirs = buildRecordKey('flight', 'user-2', 'uuid-abc');
  const guest = buildRecordKey('flight', null, 'uuid-abc');
  assert.notEqual(mine, theirs);
  assert.notEqual(mine, guest);
  assert.equal(mine, 'flight:user-1:uuid-abc');
  assert.equal(guest, 'flight:anon:uuid-abc');
});

test('buildRecordKey: tipe booking berbeda → record terpisah', () => {
  assert.notEqual(
    buildRecordKey('flight', null, 'uuid-abc'),
    buildRecordKey('insurance', null, 'uuid-abc'),
  );
});
