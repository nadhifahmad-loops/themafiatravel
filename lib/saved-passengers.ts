// Data penumpang tersimpan: tipe, validasi murni, dan pemetaan ke form checkout.
// File ini tidak mengakses database supaya bisa dipakai server (API) dan client
// (halaman akun + pemilih penumpang di checkout).

import { isValidBirthDate, isValidIdentityNumber, isValidPassportExpiry } from './checkout-utils';
import { COUNTRY_CODES } from './countries';

export const SAVED_PASSENGER_LIMIT = 40;

export const SAVED_PASSENGER_TITLES = ['MR', 'MRS', 'MS', 'MSTR', 'MISS'] as const;
export const SAVED_PASSENGER_IDENTITY_TYPES = ['ktp', 'passport', 'sim', 'other'] as const;
export const SAVED_PASSENGER_GENDERS = ['male', 'female'] as const;

export type SavedPassengerTitle = (typeof SAVED_PASSENGER_TITLES)[number];
export type SavedPassengerIdentityType = (typeof SAVED_PASSENGER_IDENTITY_TYPES)[number];
export type SavedPassengerGender = (typeof SAVED_PASSENGER_GENDERS)[number];

export type SavedPassengerRecord = {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  /** 'YYYY-MM-DD' atau ISO datetime dari API. */
  birthDate: string;
  gender?: string | null;
  nationalityCode: string;
  identityType: string;
  identityNumber: string;
  identityExpDate?: string | null;
  identityCountryCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SavedPassengerField =
  | 'title'
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'nationalityCode'
  | 'identityType'
  | 'identityNumber'
  | 'identityExpDate'
  | 'identityCountryCode';

export type SavedPassengerIssue =
  | { code: 'missing_field'; field: SavedPassengerField }
  | { code: 'invalid_field'; field: SavedPassengerField }
  | { code: 'invalid_birth_date' }
  | { code: 'invalid_identity_number' }
  | { code: 'unsupported_identity'; identityType: string }
  | { code: 'passport_required' }
  | { code: 'passport_expired' };

export type SavedPassengerCheckContext = {
  mode: 'flight' | 'train';
  isInternational?: boolean;
  /** Tipe penumpang pada form tujuan: ADT, CHD, INF, dsb. */
  paxType?: string;
};

export type SavedPassengerData = {
  title: SavedPassengerTitle;
  firstName: string;
  lastName: string;
  birthDate: Date;
  gender: SavedPassengerGender | null;
  nationalityCode: string;
  identityType: SavedPassengerIdentityType;
  identityNumber: string;
  identityExpDate: Date | null;
  identityCountryCode: string | null;
};

export type SavedPassengerValidationResult =
  | { ok: true; data: SavedPassengerData }
  | { ok: false; error: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ambil bagian tanggal dari string ISO/Date tanpa menggeser zona waktu. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> Date UTC tengah malam, aman untuk kolom DATE di Prisma. */
export function dateInputToUtcDate(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function normalizeIdentityNumber(value: string, type: SavedPassengerIdentityType): string {
  const trimmed = value.trim();
  if (type === 'passport') return trimmed.toUpperCase();
  if (type === 'ktp') return trimmed.replace(/\D/g, '');
  return trimmed;
}

/**
 * Validasi payload API (POST/PATCH). Mengembalikan data yang sudah dinormalisasi
 * atau pesan error yang aman ditampilkan ke user.
 */
export function validateSavedPassengerInput(body: unknown): SavedPassengerValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Data penumpang tidak valid.' };
  }

  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim().toUpperCase() : '';
  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
  const birthDateInput = toDateInput(typeof raw.birthDate === 'string' ? raw.birthDate : '');
  const genderRaw = typeof raw.gender === 'string' ? raw.gender.trim().toLowerCase() : '';
  const nationalityCode = typeof raw.nationalityCode === 'string'
    ? raw.nationalityCode.trim().toUpperCase()
    : '';
  const identityTypeRaw = typeof raw.identityType === 'string'
    ? raw.identityType.trim().toLowerCase()
    : '';
  const identityNumberRaw = typeof raw.identityNumber === 'string' ? raw.identityNumber : '';
  const identityExpInput = toDateInput(
    typeof raw.identityExpDate === 'string' ? raw.identityExpDate : ''
  );
  const identityCountryCode = typeof raw.identityCountryCode === 'string'
    ? raw.identityCountryCode.trim().toUpperCase()
    : '';

  if (!SAVED_PASSENGER_TITLES.includes(title as SavedPassengerTitle)) {
    return { ok: false, error: 'Sapaan penumpang tidak valid.' };
  }
  if (firstName.length < 2) {
    return { ok: false, error: 'Nama depan minimal 2 karakter.' };
  }
  if (lastName.length < 2) {
    return { ok: false, error: 'Nama belakang minimal 2 karakter.' };
  }
  if (firstName.length > 80 || lastName.length > 80) {
    return { ok: false, error: 'Nama penumpang terlalu panjang.' };
  }
  if (!isValidBirthDate(birthDateInput)) {
    return { ok: false, error: 'Tanggal lahir tidak valid.' };
  }
  if (!COUNTRY_CODES.has(nationalityCode)) {
    return { ok: false, error: 'Kewarganegaraan tidak valid.' };
  }
  if (!SAVED_PASSENGER_IDENTITY_TYPES.includes(identityTypeRaw as SavedPassengerIdentityType)) {
    return { ok: false, error: 'Jenis identitas tidak valid.' };
  }

  const identityType = identityTypeRaw as SavedPassengerIdentityType;
  const identityNumber = normalizeIdentityNumber(identityNumberRaw, identityType);

  if (!identityNumber) {
    return { ok: false, error: 'Nomor identitas wajib diisi.' };
  }
  if (identityNumber.length > 32) {
    return { ok: false, error: 'Nomor identitas terlalu panjang.' };
  }
  if (!isValidIdentityNumber(identityNumber, identityType)) {
    return { ok: false, error: 'Nomor identitas tidak valid.' };
  }

  let identityExpDate: Date | null = null;
  let normalizedIdentityCountry: string | null = null;

  if (identityType === 'passport') {
    if (!identityExpInput) {
      return { ok: false, error: 'Tanggal kedaluwarsa paspor wajib diisi.' };
    }
    if (!isValidPassportExpiry(identityExpInput)) {
      return { ok: false, error: 'Paspor sudah kedaluwarsa.' };
    }
    if (!COUNTRY_CODES.has(identityCountryCode)) {
      return { ok: false, error: 'Negara penerbit paspor tidak valid.' };
    }

    identityExpDate = dateInputToUtcDate(identityExpInput);
    if (!identityExpDate) {
      return { ok: false, error: 'Tanggal kedaluwarsa paspor tidak valid.' };
    }
    normalizedIdentityCountry = identityCountryCode;
  }

  const birthDate = dateInputToUtcDate(birthDateInput);
  if (!birthDate) {
    return { ok: false, error: 'Tanggal lahir tidak valid.' };
  }

  const gender = SAVED_PASSENGER_GENDERS.includes(genderRaw as SavedPassengerGender)
    ? (genderRaw as SavedPassengerGender)
    : null;

  return {
    ok: true,
    data: {
      title: title as SavedPassengerTitle,
      firstName,
      lastName,
      birthDate,
      gender,
      nationalityCode,
      identityType,
      identityNumber,
      identityExpDate,
      identityCountryCode: normalizedIdentityCountry,
    },
  };
}

/**
 * Cek apakah data tersimpan bisa dipakai pada form checkout saat ini.
 * Semua aturan mengikuti field yang memang ada di form pesawat/kereta.
 */
export function getSavedPassengerIssue(
  passenger: SavedPassengerRecord,
  context: SavedPassengerCheckContext
): SavedPassengerIssue | null {
  if (!passenger.title?.trim()) return { code: 'missing_field', field: 'title' };
  if (!SAVED_PASSENGER_TITLES.includes(passenger.title.trim().toUpperCase() as SavedPassengerTitle)) {
    return { code: 'invalid_field', field: 'title' };
  }
  if (!passenger.firstName?.trim()) return { code: 'missing_field', field: 'firstName' };
  if (!passenger.lastName?.trim()) return { code: 'missing_field', field: 'lastName' };
  if (!passenger.birthDate) return { code: 'missing_field', field: 'birthDate' };
  if (!isValidBirthDate(toDateInput(passenger.birthDate))) return { code: 'invalid_birth_date' };
  if (!passenger.nationalityCode?.trim()) return { code: 'missing_field', field: 'nationalityCode' };
  if (!COUNTRY_CODES.has(passenger.nationalityCode.trim().toUpperCase())) {
    return { code: 'invalid_field', field: 'nationalityCode' };
  }
  if (!passenger.identityType?.trim()) return { code: 'missing_field', field: 'identityType' };
  if (!passenger.identityNumber?.trim()) return { code: 'missing_field', field: 'identityNumber' };

  const identityType = passenger.identityType.trim().toLowerCase();

  if (context.mode === 'flight') {
    if (context.isInternational && identityType !== 'passport') {
      return { code: 'passport_required' };
    }
    if (!['ktp', 'passport'].includes(identityType)) {
      return { code: 'unsupported_identity', identityType };
    }
  } else {
    if (!['ktp', 'passport', 'other'].includes(identityType)) {
      return { code: 'unsupported_identity', identityType };
    }
    if (identityType === 'other' && context.paxType !== 'INF') {
      return { code: 'unsupported_identity', identityType };
    }
  }

  if (!isValidIdentityNumber(passenger.identityNumber, identityType)) {
    return { code: 'invalid_identity_number' };
  }

  if (identityType === 'passport') {
    if (!passenger.identityExpDate) {
      return { code: 'missing_field', field: 'identityExpDate' };
    }
    if (!isValidPassportExpiry(toDateInput(passenger.identityExpDate))) {
      return { code: 'passport_expired' };
    }
    if (!passenger.identityCountryCode?.trim()) {
      return { code: 'missing_field', field: 'identityCountryCode' };
    }
    if (!COUNTRY_CODES.has(passenger.identityCountryCode.trim().toUpperCase())) {
      return { code: 'invalid_field', field: 'identityCountryCode' };
    }
  }

  return null;
}

export function isSavedPassengerEligible(
  passenger: SavedPassengerRecord,
  context: SavedPassengerCheckContext
): boolean {
  return getSavedPassengerIssue(passenger, context) === null;
}

/** Data tersimpan -> field form penumpang, dengan tipe penumpang tetap dipertahankan. */
export function savedPassengerToPassenger(
  passenger: SavedPassengerRecord,
  paxType: string
) {
  const storedTitle = passenger.title?.trim().toUpperCase();
  const infantTitle = storedTitle === 'MRS' || storedTitle === 'MS' || storedTitle === 'MISS'
    ? 'MISS'
    : 'MSTR';
  const adultTitle = storedTitle === 'MSTR'
    ? 'MR'
    : storedTitle === 'MISS'
      ? 'MS'
      : storedTitle || 'MR';
  const gender: 'male' | 'female' | undefined =
    passenger.gender === 'male' || passenger.gender === 'female'
      ? passenger.gender
      : undefined;
  const storedIdentityType = passenger.identityType?.trim().toLowerCase();
  const identityType: SavedPassengerIdentityType =
    storedIdentityType === 'passport' ||
    storedIdentityType === 'sim' ||
    storedIdentityType === 'other'
      ? storedIdentityType
      : 'ktp';

  return {
    title: paxType === 'INF' ? infantTitle : adultTitle,
    first_name: passenger.firstName?.trim() || '',
    last_name: passenger.lastName?.trim() || '',
    birth_date: toDateInput(passenger.birthDate),
    nationality_code: passenger.nationalityCode?.trim().toUpperCase() || 'ID',
    gender,
    identity: {
      identity_type: identityType,
      identity_number: passenger.identityNumber?.trim() || '',
      identity_expdate: toDateInput(passenger.identityExpDate),
      identity_country_of_issued_code: passenger.identityCountryCode?.trim().toUpperCase() || 'ID',
    },
  };
}

/** Masking nomor identitas untuk daftar akun/checkout. */
export function maskIdentityNumber(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '-';
  if (raw.length <= 6) {
    return `${raw.slice(0, 1)}${'*'.repeat(Math.max(1, raw.length - 1))}`;
  }
  return `${raw.slice(0, 4)}${'*'.repeat(Math.max(4, raw.length - 6))}${raw.slice(-2)}`;
}
