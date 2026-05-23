import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Sesuaikan dengan path Prisma Boss

export async function POST(req: NextRequest) {
  try {
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
    const cleanPhoneInput = phone.replace(/\D/g, '');
    
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