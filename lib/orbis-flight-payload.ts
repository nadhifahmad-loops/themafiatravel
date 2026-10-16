import type { OrbisPassenger, OrbisPassengerIdentity } from '@/lib/orbis';
import { createHash } from 'node:crypto';

/**
 * Pembentuk payload untuk action `update_contacts` (§3.12) dan
 * `update_passengers` (§3.13) pada dokumentasi "API - Airline 2.2".
 *
 * Kedua action WAJIB berjalan sebelum `get_seat_availability`
 * (§2.4.1 Recommendation Flow: step 6 & 8 sebelum step 11). Tanpa keduanya
 * Orbis membalas 4011 "Missing Requirements" sehingga peta kursi tidak pernah
 * termuat.
 *
 * Helper ini dipakai BERSAMA oleh:
 *   • `app/api/flight/lock/route.ts`    → saat peta kursi dibuka (prepare)
 *   • `app/api/flight/book/route.ts`    → saat commit booking
 *
 * Satu sumber kebenaran format payload supaya data yang tersimpan di sesi
 * prepare selalu identik dengan data final yang dibukukan.
 */

export interface ContactPayload {
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  calling_code: string;
  mobile: string;
  nationality_code: string;
  is_also_booker: boolean;
}

/**
 * Cek kelayakan `update_contacts` (§3.12.1.2 Contact Value).
 * Mengikuti field wajib yang memang divalidasi aplikasi (bookerSchema):
 * first_name, email, mobile — `last_name` boleh kosong (nama tunggal) dan
 * dikirim sebagai '' persis perilaku booking yang sudah berjalan.
 */
export function isContactComplete(booker: any): boolean {
  return !!(booker?.first_name && booker?.email && booker?.mobile);
}

/**
 * Cek kelayakan `update_passengers` (§3.13.1.2 Passenger Value).
 * `birth_date` bertanda M (wajib) di dokumentasi, jadi tanpa tanggal lahir
 * Orbis akan menolak seluruh pesanan.
 */
export function isPassengerComplete(passengers: any): boolean {
  if (!Array.isArray(passengers) || passengers.length === 0) return false;
  return passengers.every(
    (p: any) => !!(p?.first_name && p?.birth_date && p?.pax_type)
  );
}

/**
 * Bentuk payload `update_contacts`.
 *
 * §3.12 mencatat: "the value contact in the booker must same with the value in
 * the contact person" dan tabel Contact Value menandai `is_also_booker` dengan
 * "Must True" — maka booker dan tiap kontak sama-sama `true`, dan keduanya
 * dibentuk dari fungsi yang sama sehingga isinya identik.
 */
export function buildOrbisContacts(
  booker: any,
  contacts?: any[] | null
): { booker: ContactPayload; contacts: ContactPayload[] } {
  const toContact = (c: any): ContactPayload => ({
    title: c?.title || 'MR',
    first_name: c?.first_name || '',
    last_name: c?.last_name || '',
    email: c?.email || '',
    calling_code: c?.calling_code || '62',
    mobile: c?.mobile || '',
    nationality_code: c?.nationality_code || 'ID',
    is_also_booker: true,
  });

  return {
    booker: toContact(booker),
    contacts: (contacts && contacts.length > 0 ? contacts : [booker]).map(toContact),
  };
}

/**
 * Bentuk payload `update_passengers`.
 * `identity` bersifat opsional (§3.13.1.3, repetisi 0..1) dan hanya dikirim
 * bila identity_number terisi; paspor wajib punya tanggal kadaluarsa.
 */
export function buildOrbisPassengers(passengers: any[]): OrbisPassenger[] {
  return passengers.map((p: any, idx: number) => {
    const identType: string = p?.identity?.identity_type || 'ktp';
    let identity: OrbisPassengerIdentity | undefined;

    if (p?.identity?.identity_number) {
      if (identType === 'passport') {
        if (!p.identity.identity_expdate) {
          throw Object.assign(
            new Error(
              `Tanggal kadaluarsa paspor penumpang ke-${idx + 1} (${p.first_name}) wajib diisi.`
            ),
            { clientError: true }
          );
        }
        identity = {
          identity_type: 'passport',
          identity_number: p.identity.identity_number,
          identity_expdate: p.identity.identity_expdate,
          identity_country_of_issued_code:
            p.identity.identity_country_of_issued_code || 'ID',
        };
      } else {
        identity = {
          identity_type: identType as OrbisPassengerIdentity['identity_type'],
          identity_number: p.identity.identity_number,
          identity_expdate: '',
          identity_country_of_issued_code: '',
        };
      }
    }

    return {
      title: p.title || 'MR',
      first_name: p.first_name,
      last_name: p.last_name || p.first_name,
      birth_date: p.birth_date,
      pax_type: p.pax_type || 'ADT',
      ...(p.gender && { gender: p.gender }),
      nationality_code: p.nationality_code || 'ID',
      ...(identity && { identity }),
    };
  });
}

/** SHA-256 hex dari payload ternormalisasi. */
const sha256 = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Sidik jari payload `update_contacts` yang dikirim saat prepare.
 * Dikembalikan `/api/flight/lock` lalu dikirim balik oleh checkout sebagai
 * `preparedContactsHash` ketika booking.
 *
 * Dihitung TERPISAH dari `hashOrbisPassengers` supaya tiap bagian dinilai
 * sendiri-sendiri — ada kasus di mana kontak sudah tersinkron tetapi
 * penumpang ditolak maskapai (4013 "Identity ktp / passport required"), dan
 * saat itu sesi TIDAK perlu dibuang.
 *
 * Pemakaian di `/api/flight/book`:
 *  • hash cocok  → sesi sudah berisi data identik, langkah dilewati supaya sesi
 *                  (dan kode kursi pilihan user) dipertahankan;
 *  • hash beda   → langkah dijalankan; bila kena 4014 "You had already call
 *                  this function", sesi sudah berisi data flow lain → buat
 *                  sesi baru dan ulangi flow.
 */
export function hashOrbisContacts(booker: any, contacts?: any[] | null): string {
  return sha256(buildOrbisContacts(booker, contacts));
}

/**
 * Sidik jari payload `update_passengers` yang dikirim saat prepare.
 * Bisa melempar error (mis. paspor tanpa tanggal kadaluarsa) — pemanggil wajib
 * membungkusnya dengan try/catch.
 */
export function hashOrbisPassengers(passengers?: any[] | null): string {
  return sha256(buildOrbisPassengers(Array.isArray(passengers) ? passengers : []));
}
