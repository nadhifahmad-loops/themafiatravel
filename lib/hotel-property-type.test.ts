import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesHotelPropertyType, parseHotelPropertyType } from './hotel-property-type';

test('parses only supported property tabs from search URLs', () => {
  assert.equal(parseHotelPropertyType('villa'), 'villa');
  assert.equal(parseHotelPropertyType('hotel'), 'hotel');
  assert.equal(parseHotelPropertyType('unsupported'), 'all');
  assert.equal(parseHotelPropertyType(null), 'all');
});

test('all property tab includes both hotels and villas', () => {
  assert.equal(matchesHotelPropertyType({ name: 'Holiday Inn Atrium' }, 'all'), true);
  assert.equal(matchesHotelPropertyType({ name: 'Bali Villa Resort' }, 'all'), true);
});

test('villa tab uses explicit property metadata and falls back to the name', () => {
  assert.equal(matchesHotelPropertyType({ name: 'Green Retreat', property_type: 'villa' }, 'villa'), true);
  assert.equal(matchesHotelPropertyType({ name: 'Bali Villas Resort' }, 'villa'), true);
  assert.equal(matchesHotelPropertyType({ name: 'Village Hotel Bugis' }, 'villa'), false);
});

test('hotel tab excludes villas', () => {
  assert.equal(matchesHotelPropertyType({ name: 'Holiday Inn Atrium' }, 'hotel'), true);
  assert.equal(matchesHotelPropertyType({ name: 'Green Retreat', hotel_type: 'villa' }, 'hotel'), false);
});
