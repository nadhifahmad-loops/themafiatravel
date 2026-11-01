import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasFlightDeparted } from '@/lib/orbis-post-booking';

// ─── POST ──────────────────────────────────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email;
    if (!sessionEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const requester = await prisma.user.findUnique({ where: { email: sessionEmail } });
    if (!requester) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Cari booking
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi ownership
    if (booking.userId) {
      if (requester.role !== 'admin' && booking.userId !== requester.id) {
        return NextResponse.json(
          { success: false, error: 'Akses ditolak' },
          { status: 403 }
        );
      }
    }

    // Hanya bisa estimasi jika status paid atau issued
    if (!['paid', 'issued'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: `Tidak bisa estimasi refund untuk status: ${booking.status}` },
        { status: 400 }
      );
    }

    if (booking.bookingType === 'flight' && hasFlightDeparted(booking)) {
      return NextResponse.json(
        { success: false, error: 'Estimasi refund mandiri tidak tersedia karena penerbangan sudah berangkat atau tanggalnya lewat. Hubungi customer service untuk pemeriksaan kebijakan maskapai.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'API vendor tidak menyediakan estimasi nominal untuk layanan ini. Nominal refund harus diverifikasi melalui proses pembatalan/review admin.',
      },
      { status: 422 }
    );
  } catch (error) {
    console.error('Error fetching refund estimate:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghitung estimasi refund' },
      { status: 500 }
    );
  }
}
