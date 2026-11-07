import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOrbisError, hotelSearchSchema } from './validate';

const documentedRequest = {
  checkin_date: '2026-11-21',
  checkout_date: '2026-11-22',
  destination_id: 'SG7355',
  adult: 2,
  child: 0,
  child_ages: [],
  room: 1,
  nationality: 'SG',
};

test('hotel search accepts and normalizes the documented request', () => {
  const parsed = hotelSearchSchema.parse({ ...documentedRequest, nationality: 'sg' });
  assert.equal(parsed.nationality, 'SG');
  assert.equal(parsed.destination_id, 'SG7355');
});

test('hotel search accepts integer occupancy sent as strings', () => {
  const parsed = hotelSearchSchema.parse({
    ...documentedRequest,
    adult: '4',
    child: '2',
    child_ages: [5, 7],
    room: '2',
  });
  assert.equal(parsed.adult, 4);
  assert.equal(parsed.child, 2);
  assert.equal(parsed.room, 2);
});

test('hotel search rejects invalid dates and a checkout not after checkin', () => {
  for (const dates of [
    { checkin_date: '2026-02-30', checkout_date: '2026-03-01' },
    { checkin_date: '2026-11-21', checkout_date: '2026-11-21' },
    { checkin_date: '2026/11/21', checkout_date: '2026-11-22' },
  ]) {
    assert.equal(hotelSearchSchema.safeParse({ ...documentedRequest, ...dates }).success, false);
  }
});

test('hotel search enforces documented occupancy limits and room/adult relation', () => {
  for (const occupancy of [
    { adult: 0 },
    { adult: 10 },
    { child: 10, child_ages: Array(10).fill(5) },
    { adult: 1, room: 2 },
    { child: 1, child_ages: [] },
    { child: 1, child_ages: [13] },
  ]) {
    assert.equal(hotelSearchSchema.safeParse({ ...documentedRequest, ...occupancy }).success, false);
  }
});

test('hotel search requires a two-letter nationality code', () => {
  assert.equal(hotelSearchSchema.safeParse({ ...documentedRequest, nationality: 'IDN' }).success, false);
});

test('hotel search surfaces Orbis 9952 as a provider outage, not an empty result', async () => {
  const response = handleOrbisError(
    Object.assign(new Error('Hotel Search Result, Connection error to Hotel Webservice'), { orbisCode: 9952 }),
    'HOTEL SEARCH',
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.code, 'HOTEL_PROVIDER_UNAVAILABLE');
  assert.match(body.error, /gangguan koneksi/i);
});
