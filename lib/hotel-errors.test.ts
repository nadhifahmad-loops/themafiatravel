import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOTEL_OUTAGE_MESSAGE,
  HOTEL_PROVIDER_UNAVAILABLE,
  isHotelProviderOutage,
  resolveHotelApiError,
} from './hotel-errors';

function orbisError(code: number, message = 'vendor rejected the request') {
  return Object.assign(new Error(message), { orbisCode: code });
}

test('treats 9952 and the vendor connection message as a provider outage', () => {
  assert.equal(isHotelProviderOutage(orbisError(9952)), true);
  assert.equal(
    isHotelProviderOutage(new Error('Connection error to Hotel Webservice code: 9952')),
    true,
  );
  assert.equal(isHotelProviderOutage(orbisError(4043)), false);
});

test('maps 9952 to a friendly service-unavailable response', () => {
  const resolved = resolveHotelApiError(orbisError(9952), 'fallback');
  assert.equal(resolved.status, 503);
  assert.equal(resolved.code, HOTEL_PROVIDER_UNAVAILABLE);
  assert.equal(resolved.message, HOTEL_OUTAGE_MESSAGE);
});

test('maps cancel policy failures and does not leak the vendor message', () => {
  const resolved = resolveHotelApiError(orbisError(4043, 'raw vendor text'), 'fallback');
  assert.equal(resolved.status, 422);
  assert.equal(resolved.code, 'HOTEL_CANCEL_NOT_ALLOWED');
  assert.equal(resolved.message.includes('raw vendor text'), false);
});

test('maps unknown vendor codes to a safe 502 response', () => {
  const resolved = resolveHotelApiError(orbisError(3999, 'internal stack trace'), 'Silakan coba lagi.');
  assert.equal(resolved.status, 502);
  assert.equal(resolved.code, 'HOTEL_VENDOR_ERROR');
  assert.equal(resolved.message, 'Silakan coba lagi.');
  assert.equal(resolved.message.includes('stack trace'), false);
});
