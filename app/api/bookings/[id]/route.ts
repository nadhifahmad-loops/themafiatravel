import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  // 🔥 PERUBAHAN 1: Tipe data params sekarang dibungkus Promise
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    // 🔥 PERUBAHAN 2: Tambahkan kata 'await' untuk membuka isi params
    const resolvedParams = await params;
    const id = resolvedParams.id;

    console.log("Mencari ID pesanan:", id);

    const booking = await prisma.booking.findFirst({ 
      where: { 
        OR: [
          { id: id }, 
          { orderNumber: id }
        ] 
      } 
    });
    
    console.log("Hasil dari database:", booking);

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak ditemukan di database' }, 
        { status: 404 }
      );
    }

    const responseData = {
      ...booking,
      serviceType: booking.bookingType 
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error("Error Fetch Booking Detail:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' }, 
      { status: 500 }
    );
  }
}