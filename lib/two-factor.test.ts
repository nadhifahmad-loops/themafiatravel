import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBackupCodes,
  hashBackupCode,
  verifyTwoFactorBackupCode,
  consumeBackupCode,
} from './two-factor';

test('generateBackupCodes menghasilkan kode unik 8 digit', () => {
  const codes = generateBackupCodes(8);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const code of codes) {
    assert.match(code, /^\d{8}$/);
  }
});

test('generateBackupCodes menghormati jumlah custom', () => {
  assert.equal(generateBackupCodes(4).length, 4);
});

test('hashBackupCode: deterministik, 64 hex, bukan plaintext', () => {
  const code = '12345678';
  const h = hashBackupCode(code);
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.equal(hashBackupCode(code), h);
  assert.notEqual(h, code);
  assert.notEqual(h, hashBackupCode('87654321'));
});

test('verifyTwoFactorBackupCode: cocok dengan format hash yang disimpan', () => {
  const codes = generateBackupCodes(8);
  const stored = codes.map(hashBackupCode);
  assert.equal(verifyTwoFactorBackupCode(stored, codes[0]), true);
  assert.equal(verifyTwoFactorBackupCode(stored, codes[3]), true);
  assert.equal(verifyTwoFactorBackupCode(stored, '00000000'), false);
  assert.equal(verifyTwoFactorBackupCode(stored, ''), false);
});

test('verifyTwoFactorBackupCode: tetap menerima plaintext legacy', () => {
  const legacy = ['12345678', '87654321'];
  assert.equal(verifyTwoFactorBackupCode(legacy, '12345678'), true);
  assert.equal(verifyTwoFactorBackupCode(legacy, '99999999'), false);
});

test('consumeBackupCode: hapus kode terpakai, sisakan lainnya', () => {
  const codes = generateBackupCodes(8);
  const stored = codes.map(hashBackupCode);
  const remaining = consumeBackupCode(stored, codes[0]);
  assert.equal(remaining.length, 7);
  assert.equal(remaining.includes(hashBackupCode(codes[0])), false);
  assert.equal(remaining.includes(hashBackupCode(codes[1])), true);
});

test('consumeBackupCode: hapus entry plaintext legacy', () => {
  const remaining = consumeBackupCode(['12345678', '87654321'], '12345678');
  assert.deepEqual(remaining, ['87654321']);
});

test('consumeBackupCode: kode yang tak dikenal tidak mengubah array', () => {
  const stored = ['12345678'];
  assert.deepEqual(consumeBackupCode(stored, '00000000'), ['12345678']);
});
