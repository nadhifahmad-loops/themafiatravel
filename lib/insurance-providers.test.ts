import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInsuranceDestination, resolveInsuranceDestinationArea } from './insurance-providers';

test('maps an Asian destination to each provider area', () => {
  assert.equal(resolveInsuranceDestinationArea('assistcard', 'Asia', true), 'Asia');
  assert.equal(resolveInsuranceDestinationArea('bcainsurance', 'Asia', true), 'Asia Pasifik');
  assert.equal(resolveInsuranceDestinationArea('zurich', 'Asia', true), 'Asia Pacific');
  assert.equal(resolveInsuranceDestinationArea('great_eastern', 'Asia', true), 'Asia Pacific');
  assert.equal(resolveInsuranceDestinationArea('oona', 'Asia', true), 'APAC');
});

test('uses a worldwide provider area for Europe and multiple regions when needed', () => {
  assert.equal(resolveInsuranceDestinationArea('bcainsurance', 'Europe', true), 'Worldwide');
  assert.equal(resolveInsuranceDestinationArea('assistcard', 'Multiple Destinations', true), 'Multiple Destinations');
  assert.equal(resolveInsuranceDestinationArea('zurich', 'Multiple Destinations', true), 'Worldwide');
});

test('uses each provider domestic area for domestic travel', () => {
  assert.equal(resolveInsuranceDestinationArea('assistcard', 'Domestic', false), 'Domestic');
  assert.equal(resolveInsuranceDestinationArea('bcainsurance', 'Domestic', false), 'Domestik');
  assert.equal(resolveInsuranceDestinationArea('zurich', 'Domestic', false), 'Domestic');
  assert.equal(resolveInsuranceDestinationArea('great_eastern', 'Domestic', false), 'Domestic');
  assert.equal(resolveInsuranceDestinationArea('oona', 'Domestic', false), 'Domestic');
});

test('prefers destination areas returned by the provider configuration', () => {
  assert.equal(
    resolveInsuranceDestinationArea('bcainsurance', 'Asia', true, ['Asia Zone', 'Rest of World', 'Indonesia']),
    'Asia Zone',
  );
  assert.equal(
    resolveInsuranceDestinationArea('bcainsurance', 'Domestic', false, ['Asia Zone', 'Indonesia']),
    'Indonesia',
  );
});

test('maps annual coverage to the provider annual area or international fallback', () => {
  assert.equal(resolveInsuranceDestinationArea('assistcard', 'Worldwide', true, ['Asia', 'Annual Card'], 'annual'), 'Annual Card');
  assert.equal(resolveInsuranceDestinationArea('bcainsurance', 'Worldwide', true, ['Asia Pasifik', 'Worldwide'], 'annual'), 'Worldwide');
  assert.equal(resolveInsuranceDestinationArea('oona', 'Worldwide', true, ['Domestic', 'Worldwide Exc USA CA', 'Worldwide'], 'annual'), 'Worldwide');
});

test('maps selected countries to the provider country names from its city master', () => {
  assert.equal(resolveInsuranceDestination('Jepang, Singapura', ['Japan', 'Singapore', 'Malaysia']), 'Japan, Singapore');
  assert.equal(resolveInsuranceDestination('Japan', ['Jepang', 'Singapura']), 'Jepang');
});
