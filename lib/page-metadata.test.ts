import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDocumentTitle,
  getPageMetadata,
  localizePageTitle,
} from './page-metadata';

test('resolves localized metadata for all major booking routes', () => {
  assert.equal(getPageMetadata('/flight/search', 'ID').title, 'Cari Tiket Pesawat');
  assert.equal(getPageMetadata('/flight/search', 'EN').title, 'Search Flights');
  assert.equal(getPageMetadata('/bookings/FLIGHT-123/review', 'ID').title, 'Review Pesanan');
  assert.equal(getPageMetadata('/bookings/FLIGHT-123/review', 'EN').title, 'Review Your Booking');
  assert.equal(getPageMetadata('/admin/refund-queue', 'EN').title, 'Refund Queue');
});

test('localizes static and dynamic client page titles', () => {
  assert.equal(localizePageTitle('Kebijakan Privasi', 'EN'), 'Privacy Policy');
  assert.equal(localizePageTitle('Pembayaran Hotel: Bali Resort', 'EN'), 'Hotel Checkout: Bali Resort');
  assert.equal(localizePageTitle('Pencarian Hotel: Bali', 'EN'), 'Hotel Search: Bali');
  assert.equal(localizePageTitle('Asuransi Perjalanan: Japan', 'EN'), 'Travel Insurance: Japan');
  assert.equal(localizePageTitle('Asuransi Perjalanan', 'EN'), 'Travel Insurance');
  assert.equal(localizePageTitle('Review your order', 'EN'), 'Review your order');
  assert.equal(localizePageTitle('Kebijakan Privasi', 'ID'), 'Kebijakan Privasi');
});

test('formats app title once without duplicating the brand', () => {
  assert.equal(formatDocumentTitle('Search Flights'), 'Search Flights | The Mafia Travel');
  assert.equal(formatDocumentTitle('The Mafia Travel — Better Journeys'), 'The Mafia Travel — Better Journeys');
});
