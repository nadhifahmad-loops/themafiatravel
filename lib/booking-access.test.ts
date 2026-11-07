import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeBookingAccess } from './booking-access';

const guestBooking = {
  bookingUserId: null,
  requesterId: null,
  isAdmin: false,
  bookingData: { contacts: [{ mobile: '081234567890' }] },
  passengerData: [],
};

test('guest booking needs contact proof', () => {
  const result = authorizeBookingAccess(guestBooking);
  assert.deepEqual(result, {
    allowed: false,
    status: 401,
    message: 'Verifikasi kontak pemesan diperlukan',
  });
});

test('guest booking rejects a mismatched contact', () => {
  const result = authorizeBookingAccess({
    ...guestBooking,
    guestContact: '089999999999',
  });
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.status, 403);
});

test('guest booking accepts the verified contact', () => {
  assert.deepEqual(
    authorizeBookingAccess({ ...guestBooking, guestContact: '+62 812 3456 7890' }),
    { allowed: true, isAdmin: false },
  );
});

test('account booking requires its owner', () => {
  assert.equal(
    authorizeBookingAccess({
      ...guestBooking,
      bookingUserId: 'owner',
      requesterId: null,
    }).allowed,
    false,
  );
  const result = authorizeBookingAccess({
    ...guestBooking,
    bookingUserId: 'owner',
    requesterId: 'other',
  });
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.status, 403);
  assert.deepEqual(
    authorizeBookingAccess({
      ...guestBooking,
      bookingUserId: 'owner',
      requesterId: 'owner',
    }),
    { allowed: true, isAdmin: false },
  );
});

test('admin can access any booking', () => {
  assert.deepEqual(
    authorizeBookingAccess({ ...guestBooking, isAdmin: true }),
    { allowed: true, isAdmin: true },
  );
});
