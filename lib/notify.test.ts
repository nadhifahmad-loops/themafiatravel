import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBookingContact, normalizePhone } from './notify';

const GUEST_BOOKING = {
  userId: null,
  bookingData: {
    booker: { first_name: 'Budi', last_name: 'Santoso', email: 'budi@example.com', calling_code: '62', mobile: '081234567890' },
    contacts: [{ first_name: 'Budi', last_name: 'Santoso', email: 'budi@example.com', calling_code: '62', mobile: '081234567890' }],
  },
  passengerData: [{ first_name: 'Budi', last_name: 'Santoso' }],
};

test('getBookingContact: guest booking (flight/train/insurance) memakai bookingData.contacts', () => {
  const contact = getBookingContact(GUEST_BOOKING);
  assert.equal(contact.email, 'budi@example.com');
  assert.equal(contact.phone, '6281234567890');
  assert.equal(contact.name, 'Budi Santoso');
});

test('getBookingContact: hotel booking memakai bookingData.contact', () => {
  const contact = getBookingContact({
    userId: null,
    bookingData: {
      order_number: 'TMT-HTL-1',
      contact: [{ first_name: 'Sari', email: 'sari@example.com', calling_code: '62', mobile: '81200001111' }],
    },
  });
  assert.equal(contact.email, 'sari@example.com');
  assert.equal(contact.phone, '6281200001111');
  assert.equal(contact.name, 'Sari');
});

test('getBookingContact: fallback ke passengerData saat bookingData tanpa kontak', () => {
  const contact = getBookingContact({
    bookingData: { order_number: 'X' },
    passengerData: [{ first_name: 'Andi', last_name: 'Wijaya', email: 'andi@example.com', mobile: '08110002222' }],
  });
  assert.equal(contact.email, 'andi@example.com');
  assert.equal(contact.phone, '628110002222');
});

test('getBookingContact: fallback ke akun terdaftar saat tanpa data kontak', () => {
  const contact = getBookingContact({
    bookingData: { order_number: 'Y' },
    user: { name: 'Dina', email: 'dina@example.com', phone: '62855556666' },
  });
  assert.equal(contact.email, 'dina@example.com');
  assert.equal(contact.phone, '62855556666');
  assert.equal(contact.name, 'Dina');
});

test('getBookingContact: kembali kosong jika semua sumber kosong', () => {
  const contact = getBookingContact({});
  assert.deepEqual(contact, { name: '', email: '', phone: '' });
});

test('normalizePhone: hilangkan 0 di depan dan abaikan karakter non-digit', () => {
  assert.equal(normalizePhone('0812-3456-7890', '62'), '6281234567890');
  assert.equal(normalizePhone('81234567890', '62'), '6281234567890');
  assert.equal(normalizePhone('6281234567890'), '6281234567890');
  assert.equal(normalizePhone('+62 812-3456-7890'), '6281234567890');
  assert.equal(normalizePhone(''), '');
});
