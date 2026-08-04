import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const currentUserId = session.user.id;

  // Ambil dari DB lokal — sumber kebenaran untuk kepemilikan booking.
  let booking;
  try {
    booking = await prisma.booking.findUnique({
      where: { id },
      include: { payments: true },
    });
  } catch (e: any) {
    console.error('[Insurance Booking Detail] DB error:', e.message);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }

  // Tidak ditemukan di DB kita → jangan pernah fallback ke Orbis dengan id
  // mentah, karena Orbis tidak tahu konsep "pemilik" di sistem kita dan itu
  // akan membocorkan booking asuransi milik user lain (IDOR). 404 generik
  // (bukan 403) supaya tidak mengonfirmasi ke penyerang bahwa id itu valid.
  if (!booking || booking.userId !== currentUserId) {
    return NextResponse.json({ success: false, error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  // Opsional: sinkronkan status terbaru dari Orbis untuk booking yang memang
  // terverifikasi milik user ini.
  try {
    const orderNumber = booking.orderNumber || id;
    const fresh = await insuranceAPI.getBooking(orderNumber);
    return NextResponse.json({ success: true, data: { ...booking, orbis: fresh } });
  } catch (e) {
    // Orbis gagal/timeout → tetap kembalikan data lokal yang sudah tervalidasi kepemilikannya.
    return NextResponse.json({ success: true, data: booking });
  }
}