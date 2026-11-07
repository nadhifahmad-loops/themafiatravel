import test from 'node:test';
import assert from 'node:assert/strict';
import { genVerificationHash, isValidVerificationHash } from './ticket-verify';

test('ticket verification signature validates only for the signed booking id', () => {
  const previousSecret = process.env.TICKET_VERIFY_SECRET;
  const previousAuthSecret = process.env.NEXTAUTH_SECRET;
  process.env.TICKET_VERIFY_SECRET = 'test-ticket-verification-secret-32-bytes-minimum';

  try {
    const code = genVerificationHash('booking-id');
    assert.match(code, /^TMT-[A-F0-9]{32}$/);
    assert.equal(isValidVerificationHash('booking-id', code), true);
    assert.equal(isValidVerificationHash('another-booking-id', code), false);
    assert.equal(isValidVerificationHash('booking-id', `${code}00`), false);
  } finally {
    if (previousSecret === undefined) delete process.env.TICKET_VERIFY_SECRET;
    else process.env.TICKET_VERIFY_SECRET = previousSecret;
    if (previousAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousAuthSecret;
  }
});

test('ticket verification requires a sufficiently long secret', () => {
  const previousSecret = process.env.TICKET_VERIFY_SECRET;
  const previousAuthSecret = process.env.NEXTAUTH_SECRET;
  delete process.env.TICKET_VERIFY_SECRET;
  delete process.env.NEXTAUTH_SECRET;

  try {
    assert.throws(() => genVerificationHash('booking-id'), /requires a secret/);
  } finally {
    if (previousSecret === undefined) delete process.env.TICKET_VERIFY_SECRET;
    else process.env.TICKET_VERIFY_SECRET = previousSecret;
    if (previousAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousAuthSecret;
  }
});
