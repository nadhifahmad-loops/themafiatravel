import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSavedPassengerIssue,
  maskIdentityNumber,
  savedPassengerToPassenger,
  validateSavedPassengerInput,
  type SavedPassengerRecord,
} from './saved-passengers';

const FUTURE = `${new Date().getFullYear() + 5}-06-15`;
const PAST = `${new Date().getFullYear() - 1}-06-15`;

function passenger(overrides: Partial<SavedPassengerRecord> = {}): SavedPassengerRecord {
  return {
    id: 'p1',
    title: 'MR',
    firstName: 'BUDI',
    lastName: 'SANTOSO',
    birthDate: '1990-05-12',
    gender: 'male',
    nationalityCode: 'ID',
    identityType: 'ktp',
    identityNumber: '3175041205900001',
    identityExpDate: null,
    identityCountryCode: null,
    ...overrides,
  };
}

function validPayload() {
  return {
    title: 'mr',
    firstName: '  Budi ',
    lastName: 'Santoso',
    birthDate: '1990-05-12',
    gender: 'male',
    nationalityCode: 'id',
    identityType: 'KTP',
    identityNumber: '3175 0412 0590 0001',
    identityExpDate: '',
    identityCountryCode: '',
  };
}

test('validateSavedPassengerInput: payload valid dinormalisasi (KTP, nama, kode negara)', () => {
  const result = validateSavedPassengerInput(validPayload());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.title, 'MR');
  assert.equal(result.data.firstName, 'Budi');
  assert.equal(result.data.lastName, 'Santoso');
  assert.equal(result.data.nationalityCode, 'ID');
  assert.equal(result.data.identityType, 'ktp');
  assert.equal(result.data.identityNumber, '3175041205900001');
  assert.equal(result.data.identityExpDate, null);
  assert.equal(result.data.identityCountryCode, null);
  assert.ok(result.data.birthDate instanceof Date);
});

test('validateSavedPassengerInput: field wajib kosong / tanggal lahir tidak valid ditolak', () => {
  assert.equal(validateSavedPassengerInput(null).ok, false);
  assert.equal(validateSavedPassengerInput({ ...validPayload(), lastName: '  ' }).ok, false);
  assert.equal(validateSavedPassengerInput({ ...validPayload(), birthDate: '1990-02-31' }).ok, false);
  assert.equal(validateSavedPassengerInput({ ...validPayload(), birthDate: FUTURE }).ok, false);
  assert.equal(validateSavedPassengerInput({ ...validPayload(), identityNumber: '123' }).ok, false);
});

test('validateSavedPassengerInput: paspor wajib berlaku & punya negara penerbit', () => {
  const base = {
    ...validPayload(),
    identityType: 'passport',
    identityNumber: 'A1234567',
    identityCountryCode: 'ID',
  };

  assert.equal(validateSavedPassengerInput({ ...base, identityExpDate: '' }).ok, false);
  assert.equal(validateSavedPassengerInput({ ...base, identityExpDate: PAST }).ok, false);
  assert.equal(validateSavedPassengerInput({ ...base, identityExpDate: FUTURE }).ok, true);
});

test('flight domestik: KTP valid bisa dipilih, SIM ditolak sebagai tipe tak didukung', () => {
  assert.equal(getSavedPassengerIssue(passenger(), { mode: 'flight', isInternational: false }), null);

  const sim = getSavedPassengerIssue(
    passenger({ identityType: 'sim', identityNumber: '123456789012' }),
    { mode: 'flight', isInternational: false }
  );
  assert.deepEqual(sim, { code: 'unsupported_identity', identityType: 'sim' });
});

test('flight internasional: KTP ditolak dengan alasan paspor wajib', () => {
  const issue = getSavedPassengerIssue(passenger(), { mode: 'flight', isInternational: true });
  assert.deepEqual(issue, { code: 'passport_required' });
});

test('train: "Dokumen Lain" hanya valid untuk bayi (INF), bukan dewasa', () => {
  const other = passenger({ identityType: 'other', identityNumber: '12345' });

  assert.equal(
    getSavedPassengerIssue(other, { mode: 'train', paxType: 'INF' }),
    null
  );
  assert.deepEqual(
    getSavedPassengerIssue(other, { mode: 'train', paxType: 'ADT' }),
    { code: 'unsupported_identity', identityType: 'other' }
  );
  assert.deepEqual(
    getSavedPassengerIssue(other, { mode: 'train', paxType: 'CHD' }),
    { code: 'unsupported_identity', identityType: 'other' }
  );
});

test('paspor: kedaluwarsa & data hilang menghasilkan alasan spesifik', () => {
  const passport = {
    ...passenger({ identityType: 'passport', identityNumber: 'A1234567', identityCountryCode: 'ID' }),
  };

  assert.deepEqual(
    getSavedPassengerIssue(
      { ...passport, identityExpDate: null },
      { mode: 'flight', isInternational: false }
    ),
    { code: 'missing_field', field: 'identityExpDate' }
  );

  assert.deepEqual(
    getSavedPassengerIssue(
      { ...passport, identityExpDate: PAST },
      { mode: 'flight', isInternational: false }
    ),
    { code: 'passport_expired' }
  );

  assert.deepEqual(
    getSavedPassengerIssue(
      { ...passport, identityCountryCode: null, identityExpDate: FUTURE },
      { mode: 'flight', isInternational: false }
    ),
    { code: 'missing_field', field: 'identityCountryCode' }
  );

  assert.equal(
    getSavedPassengerIssue(
      { ...passport, identityExpDate: FUTURE },
      { mode: 'flight', isInternational: false }
    ),
    null
  );
});

test('data setengah jadi (nama belakang kosong) ditandai incomplete, bukan dipilih sebagian', () => {
  const issue = getSavedPassengerIssue(passenger({ lastName: '' }), {
    mode: 'flight',
    isInternational: false,
  });
  assert.deepEqual(issue, { code: 'missing_field', field: 'lastName' });
});

test('savedPassengerToPassenger: sapaan disesuaikan tipe penumpang tanpa mengubah pax_type', () => {
  const male = savedPassengerToPassenger(passenger({ title: 'MR' }), 'INF');
  assert.equal(male.title, 'MSTR');

  const female = savedPassengerToPassenger(passenger({ title: 'MRS' }), 'INF');
  assert.equal(female.title, 'MISS');

  const storedInfantTitle = savedPassengerToPassenger(passenger({ title: 'MISS' }), 'ADT');
  assert.equal(storedInfantTitle.title, 'MS');

  const mapped = savedPassengerToPassenger(passenger(), 'ADT');
  assert.equal(mapped.first_name, 'BUDI');
  assert.equal(mapped.last_name, 'SANTOSO');
  assert.equal(mapped.birth_date, '1990-05-12');
  assert.equal(mapped.nationality_code, 'ID');
  assert.equal(mapped.identity.identity_type, 'ktp');
  assert.equal(mapped.identity.identity_number, '3175041205900001');
});

test('maskIdentityNumber: sebagian besar digit tertutup', () => {
  assert.equal(maskIdentityNumber('3175041205900001'), '3175**********01');
  assert.equal(maskIdentityNumber(null), '-');
});
