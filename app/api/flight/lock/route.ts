import { NextRequest, NextResponse } from 'next/server';
import { flightAPI, OrbisSchedule } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  buildOrbisContacts,
  buildOrbisPassengers,
  hashOrbisContacts,
  hashOrbisPassengers,
  isContactComplete,
  isPassengerComplete,
} from '@/lib/orbis-flight-payload';

/**
 * Prepare sesi booking pesawat — dokumentasi "API - Airline 2.2" §2.4.1
 * Recommendation Flow (Pre Booking).
 *
 * Urutan yang dijalankan endpoint ini:
 *   5. sell_journeys       → kunci jadwal (§3.10)
 *   6. update_contacts     → booker + contact person (§3.12)
 *   8. update_passengers   → data penumpang (§3.13)
 *
 * Sesudahnya barulah `get_seat_availability` (§3.16, step 11) boleh dipanggil.
 * Selama step 6 & 8 belum jalan, Orbis membalas 4011 "Missing Requirements" —
 * bukan sesi expired. `update_passengers` juga menjadi prasyarat
 * `get_ssr_availability` (step 9).
 *
 * CATATAN AUTH: endpoint ini sengaja TIDAK memeriksa sesi login, sama seperti
 * `/api/flight/book`. Yang dibutuhkan adalah sesi Orbis (signature), bukan sesi
 * pengguna aplikasi, sehingga tamu (guest) tetap boleh memilih kursi. Sebelumnya
 * endpoint ini memakai `getServerSession` dan membalas 401 untuk guest —
 * karena itulah peta kursi tidak pernah tercapai sama sekali.
 */
export async function POST(req: NextRequest) {
  // Rate limit tetap berbasis IP (pengganti cek login yang dihapus).
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`lock:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const { adult, child, infant, schedules, booker, contacts, passengers } = body ?? {};

    // 1. Validasi data jadwal
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Data jadwal penerbangan tidak ditemukan.' },
        { status: 400 }
      );
    }

    console.log(
      '[Flight Lock] Prepare sesi: sell_journeys → update_contacts → update_passengers'
    );

    // ── STEP 5: sell_journeys (§3.10) ────────────────────────────────────────
    try {
      await flightAPI.sellJourneys({
        adult: Number(adult) || 1,
        child: Number(child) || 0,
        infant: Number(infant) || 0,
        schedules: schedules as OrbisSchedule[],
        promo_codes: [],
      });
      console.log('[Flight Lock] ✅ sell_journeys OK');
    } catch (error: any) {
      const code = error?.orbisCode;
      const msg = error.message || '';

      // 4014 = "You had already call this function" → jadwal sudah terkunci.
      if (code === 4014) {
        console.log('[Flight Lock] 4014 — jadwal sudah terkunci sebelumnya, lanjut aman.');
      } else {
        console.error('[Flight Lock] sell_journeys gagal:', code, msg);

        if (code === 4011) {
          return NextResponse.json(
            { success: false, error: 'SESSION_EXPIRED', message: 'Sesi pencarian habis.' },
            { status: 410 }
          );
        }
        if (code === 4016 || msg.includes('Schedule is not available') || msg.includes('fare class')) {
          return NextResponse.json(
            {
              success: false,
              error: 'FARE_UNAVAILABLE',
              message: 'Kelas kursi tidak tersedia. Silakan pilih penerbangan lain.',
            },
            { status: 422 }
          );
        }
        return NextResponse.json({ success: false, error: msg || 'Gagal mengunci jadwal' }, { status: 500 });
      }
    }

    // ── STEP 6: update_contacts (§3.12) ──────────────────────────────────────
    let contactsReady = false;
    let contactsSyncedFresh = false;
    if (isContactComplete(booker)) {
      try {
        const { booker: bookerContact, contacts: contactList } = buildOrbisContacts(booker, contacts);
        await flightAPI.updateContacts({ booker: bookerContact, contacts: contactList });
        contactsReady = true;
        contactsSyncedFresh = true;
        console.log('[Flight Lock] ✅ update_contacts OK');
      } catch (error: any) {
        if (error?.orbisCode === 4014) {
          // Sesi global sudah pernah menerima kontak → state terpenuhi, tetapi
          // isinya milik flow LAMA, jadi jangan dianggap sebagai sinkronisasi
          // data kita sendiri.
          contactsReady = true;
          console.log('[Flight Lock] update_contacts 4014 — sudah pernah dipanggil, lanjut.');
        } else {
          console.warn('[Flight Lock] update_contacts gagal (dilewati):', error?.orbisCode, error.message);
        }
      }
    } else {
      console.log('[Flight Lock] update_contacts dilewati — data pemesan belum lengkap.');
    }

    // ── STEP 8: update_passengers (§3.13) ────────────────────────────────────
    let passengersReady = false;
    let passengersSyncedFresh = false;
    let passengersError: string | null = null;
    if (isPassengerComplete(passengers)) {
      try {
        const formatted = buildOrbisPassengers(passengers);
        await flightAPI.updatePassengers({ passengers: formatted });
        passengersReady = true;
        passengersSyncedFresh = true;
        console.log('[Flight Lock] ✅ update_passengers OK');
      } catch (error: any) {
        if (error?.clientError) {
          passengersError = error.message;
          console.warn('[Flight Lock] update_passengers ditolak (data penumpang):', error.message);
        } else if (error?.orbisCode === 4014) {
          passengersReady = true;
          console.log('[Flight Lock] update_passengers 4014 — sudah pernah dipanggil, lanjut.');
        } else if (error?.orbisCode === 4013) {
          // 4013 "Data Validation Error: Identity ktp / passport required for
          // this flight" — beberapa maskapai mewajibkan identitas penumpang.
          passengersError = 'Identitas KTP/paspor penumpang wajib diisi untuk penerbangan ini.';
          console.warn('[Flight Lock] update_passengers ditolak (identitas):', error.message);
        } else {
          console.warn('[Flight Lock] update_passengers gagal (dilewati):', error?.orbisCode, error.message);
        }
      }
    } else {
      console.log('[Flight Lock] update_passengers dilewati — data penumpang belum lengkap.');
    }

    // `contactsReady` / `passengersReady` + `passengersError` dilaporkan ke UI:
    // sesi TETAP dipakai untuk memuat peta kursi walau belum sinkron penuh
    // (sebagian maskapai menyanggupinya); bila Orbis menolak dengan 4011,
    // pesan `passengersError` yang ditampilkan sehingga user tahu field mana
    // yang kurang. Klik "coba lagi" menyiapkan ulang sesi dengan data terbaru.
    //
    // Dua hash terpisah (kontak & penumpang) dikirim balik saat booking supaya
    // server tahu bagian mana yang sudah benar-benar tersimpan di sesi ini
    // (lihat hashOrbisContacts / hashOrbisPassengers). Dihitung hanya bila action
    // tadi benar-benar dijalankan dengan data kita — kalau cuma kena 4014, sesi
    // bisa berisi data flow lama, jadi hash terverifikasi sengaja null.
    // `*HashCurrent` tetap dikirim (hash data yang BARU diserahkan) supaya client
    // bisa mempertahankan hash lama bila ternyata datanya tidak berubah — kalau
    // tidak, prepare kedua yang kena 4014 akan memaksa sesi dibuat ulang saat
    // booking, padahal sesinya masih memegang data yang sama.
    let contactsHash: string | null = null;
    let passengersHash: string | null = null;
    let contactsHashCurrent: string | null = null;
    let passengersHashCurrent: string | null = null;
    try { contactsHashCurrent = hashOrbisContacts(booker, contacts); } catch { contactsHashCurrent = null; }
    try { passengersHashCurrent = hashOrbisPassengers(passengers); } catch { passengersHashCurrent = null; }
    if (contactsSyncedFresh) contactsHash = contactsHashCurrent;
    if (passengersSyncedFresh) passengersHash = passengersHashCurrent;

    return NextResponse.json({
      success: true,
      message: 'Sesi booking siap.',
      contactsReady,
      passengersReady,
      passengersError,
      contactsHash,
      passengersHash,
      contactsHashCurrent,
      passengersHashCurrent,
    });
  } catch (error: any) {
    const code = error?.orbisCode;
    const msg = error.message || 'Gagal menyiapkan sesi booking';
    console.error('[Flight Lock Error]', code, msg);

    if (code === 4011) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED', message: 'Sesi pencarian habis.' },
        { status: 410 }
      );
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
