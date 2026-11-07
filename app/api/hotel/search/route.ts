import { NextRequest, NextResponse } from 'next/server';
import { hotelAPI } from '@/lib/orbis';
import type { OrbisError } from '@/lib/orbis-types';
import { hotelSearchSchema, validateBody, handleOrbisError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// FIX: search hotel meng-agregasi banyak vendor sekaligus (RDX07, RDX03,
// hotelbeds, mgjarvis, dst — lihat doc 3.4.1.4) dan bisa lambat. Tanpa
// maxDuration eksplisit, platform (mis. Vercel) bisa mematikan function
// sebelum request 90 detik ke Orbis selesai, sehingga search selalu gagal.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak pencarian. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body tidak valid.' }, { status: 400 });
    }

    // Validasi field wajib siapa pun tidak bisa melewati
    const validation = validateBody(hotelSearchSchema, body);
    if (!validation.success) return validation.response;
    const v = validation.data;

    if (!v.destination_id) {
      return NextResponse.json({ error: 'destination_id wajib diisi' }, { status: 400 });
    }
    if (!v.checkin_date || !v.checkout_date) {
      return NextResponse.json({ error: 'Tanggal check-in dan check-out wajib diisi' }, { status: 400 });
    }

    const payload = {
      checkin_date: v.checkin_date,
      checkout_date: v.checkout_date,
      destination_id: v.destination_id,
      adult: v.adult,
      child: v.child,
      child_ages: v.child_ages,
      room: v.room,
      nationality: v.nationality,
    };

    const data = await hotelAPI.search(payload);

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    // FIX: sebelumnya setiap error Orbis (termasuk 4005 "Provider is
    // unavailable" atau destinasi/hotel yang tidak dikenali salah satu
    // vendor) langsung dilempar sebagai HTTP 500, sehingga UI selalu
    // menampilkan "gagal" walau sebenarnya cuma "tidak ada hasil".
    // handleOrbisError men-degradasi kasus semacam itu jadi hasil kosong
    // (success: true) dengan bentuk data yang sesuai response.response
    // pada doc 3.4.1.2 (hotel_ids/city_ids/destination_ids), dan tetap
    // melempar error asli untuk kasus yang benar-benar bug (kredensial,
    // validasi request, dll).
    if (e instanceof Error) {
      const error = e as OrbisError;
      console.error('[HOTEL SEARCH FAILURE]', {
        code: error.orbisCode ?? null,
        message: error.message,
        httpStatus: error.orbisHttpStatus ?? null,
      });
    } else {
      console.error('[HOTEL SEARCH FAILURE]', e);
    }

    return handleOrbisError(e, 'HOTEL SEARCH', { hotel_ids: [], city_ids: [], destination_ids: [] });
  }
}
