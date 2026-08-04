import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executeBookingRefund, RefundExecutionError } from '@/lib/refund';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

// ─── POST (Admin: eksekusi refund dari antrian review) ───────────────────────
// Valid: status booking harus 'refund_requested'. Berhasil → status 'cancelled'.
// Gagal (Midtrans) → booking tetap 'refund_requested' supaya admin bisa retry.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Akses ditolak: bukan admin' }, { status: 403 });
    }

    const { id } = await params;

    const result = await executeBookingRefund(id, admin.email);

    await recordAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.refund.executed',
      entityType: 'booking',
      entityId: id,
      metadata: { amount: result.amount },
      ip: auditIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
      data: { bookingId: id, amount: result.amount, mode: 'manual' },
    });

  } catch (e: unknown) {
    if (e instanceof RefundExecutionError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.status });
    }
    console.error('[Refund Execute] Error:', e);
    return NextResponse.json(
      { success: false, message: (e as Error)?.message || 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
