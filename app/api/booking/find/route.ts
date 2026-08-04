import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req as unknown as Request);
    const rateLimit = await checkRateLimit(`guest-booking:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan pencarian booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const body = await req.json();
    const { orderNumber, phone } = body;

    if (!orderNumber || !phone) {
      return NextResponse.json({ success: false, error: 'Nomor Pesanan dan Nomor HP wajib diisi.' }, { status: 400 });
    }

    // 1. Cari pesanan di database berdasarkan orderNumber (Kode Tiket)
    const booking = await prisma.booking.findFirst({
      where: {
        orderNumber: orderNumber
      }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan. Periksa kembali Nomor Pesanan Anda.' }, { status: 404 });
    }

    // 2. Validasi Nomor HP
    // Karena saat checkout nomor HP pemesan biasanya disimpan di dalam JSON `bookingData` atau `passengerData` (kontak pemesan).
    // Kita akan ubah data JSON tersebut menjadi string dan mengecek apakah nomor HP yang diinput ada di dalamnya.
    const bookingDataStr = JSON.stringify(booking.bookingData || {});
    const passengerDataStr = JSON.stringify(booking.passengerData || {});
    
    // Hapus karakter non-angka dari nomor HP inputan user untuk pencocokan yang akurat
    const cleanPhoneInput = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';

    // FIX (Bug #1 - security): nomor HP Indonesia minimal 8 digit. Tanpa batas ini,
    // input non-numerik (mis. "abc") menghasilkan cleanPhoneInput = '' dan
    // `anyString.includes('')` SELALU true di JavaScript -- artinya verifikasi bisa
    // dilewati sepenuhnya. Tolak lebih dulu sebelum melakukan pencocokan apapun.
    if (cleanPhoneInput.length < 8) {
      return NextResponse.json({
        success: false,
        error: 'Nomor HP tidak valid.'
      }, { status: 400 });
    }

    // Cek apakah nomor HP tersebut eksis di data pesanan
    const isPhoneMatch = bookingDataStr.includes(cleanPhoneInput) || passengerDataStr.includes(cleanPhoneInput);

    if (!isPhoneMatch) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nomor HP tidak cocok dengan data pemesan tiket ini.' 
      }, { status: 403 }); // 403 Forbidden
    }

    // 3. Jika Valid, kembalikan ID database-nya agar frontend bisa redirect ke halaman Rincian Pesanan
    return NextResponse.json({ 
      success: true, 
      bookingId: booking.id 
    }, { status: 200 });

  } catch (error) {
    console.error('[GUEST BOOKING SEARCH ERROR]:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem. Silakan coba lagi nanti.' }, { status: 500 });
  }
}