import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, matchGuestContact } from './booking-contact-match';

test('normalizePhone: 08xx / +62 / 62 mentah / tanpa prefix → 62', () => {
  assert.equal(normalizePhone('0812-3456-7890'), '6281234567890');
  assert.equal(normalizePhone('+62 812 3456 7890'), '6281234567890');
  assert.equal(normalizePhone('6281234567890'), '6281234567890');
  assert.equal(normalizePhone('81234567890'), '6281234567890');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone('abc'), '');
});

test('email: cocok persis dan case-insensitive', () => {
  const bd = { booker: { email: 'Budi.Santoso@Gmail.com' } };
  assert.equal(matchGuestContact('budi.santoso@gmail.com', bd, []).ok, true);
  assert.equal(matchGuestContact('  BUDI.SANTOSO@GMAIL.COM  ', bd, []).ok, true);
});

test('email: salah → mismatch (bukan fallback substring)', () => {
  const bd = { booker: { email: 'budi@gmail.com' }, tamu: { email: 'ani@yahoo.com' } };
  const r = matchGuestContact('budi@gmail.co', bd, []);
  assert.equal(r.ok, false);
});

test('email: input sebagian tidak lagi dianggap cocok (false positive substring hilang)', () => {
  const bd = { booker: { email: 'budi.santoso@gmail.com' } };
  assert.equal(matchGuestContact('santoso@gmail.com', bd, []).ok, false);
  assert.equal(matchGuestContact('budi@gmail.com', bd, []).ok, false);
});

test('email: fallback substring aktif saat nol kandidat terekstrak (format di luar regex)', () => {
  // 'admin@localhost' tidak punya TLD → regex tidak mengekstrak apapun → fallback.
  const bd = { booker: { email: 'admin@localhost' } };
  assert.equal(matchGuestContact('admin@localhost', bd, []).ok, true);
});

test('email: fallback tidak menembus bila sudah ada kandidat lain (presisi diutamakan)', () => {
  const bd = { a: 'x@y.co', note: 'admin@localhost' };
  assert.equal(matchGuestContact('admin@localhost', bd, []).ok, false);
});

test('telepon: format berbeda diwajibkan match (08xx ↔ +62 ↔ 62)', () => {
  const bd = { contacts: [{ mobile: '0812-3456-7890' }] };
  assert.equal(matchGuestContact('081234567890', bd, []).ok, true);
  assert.equal(matchGuestContact('+6281234567890', bd, []).ok, true);
  assert.equal(matchGuestContact('62 812 3456 7890', bd, []).ok, true);
  assert.equal(matchGuestContact('81234567890', bd, []).ok, true);
});

test('telepon: data tersimpan internasional, input lokal', () => {
  const bd = { c: { phone: '+62 812-3456-7890' } };
  assert.equal(matchGuestContact('081234567890', bd, []).ok, true);
});

test('telepon: input salah → mismatch, tanpa false positive dari nomor lebih panjang', () => {
  const bd = { c: { phone: '6281234567890123' } }; // mengandung input sebagai substring
  assert.equal(matchGuestContact('6281234567890', bd, []).ok, false);
});

test('telepon: terlalu pendek → invalid-input', () => {
  const r = matchGuestContact('0812', { a: 'b' }, []);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, 'invalid-input');
});

test('telepon: kandidat tanggal tidak menimbulkan match palsu', () => {
  const bd = { created: '2026-10-23T08:30:00.000Z', p: { phone: '081234567890' } };
  assert.equal(matchGuestContact('081234567890', bd, []).ok, true);
  assert.equal(matchGuestContact('0899999999999', bd, []).ok, false);
});

test('telepon: tanpa nomor sama sekali di data → mismatch', () => {
  const r = matchGuestContact('081234567890', { note: 'tanpa nomor' }, []);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, 'mismatch');
});

test('kandidat diambil dari bookingData DAN passengerData', () => {
  const bd = { booker: { email: 'budi@gmail.com' } };
  const pd = [{ first_name: 'Ani', email: 'penumpang@gmail.com', mobile: '0811-1222-3333' }];
  assert.equal(matchGuestContact('penumpang@gmail.com', bd, pd).ok, true);
  assert.equal(matchGuestContact('081112223333', bd, pd).ok, true);
  assert.equal(matchGuestContact('budi@gmail.com', bd, pd).ok, true);
});

test('input kosong / whitespace → invalid-input', () => {
  const r = matchGuestContact('   ', {}, []);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, 'invalid-input');
});

test('data null/undefined tidak membuat crash', () => {
  assert.equal(matchGuestContact('budi@gmail.com', null, undefined).ok, false);
  assert.equal(matchGuestContact('081234567890', null, null).ok, false);
});
