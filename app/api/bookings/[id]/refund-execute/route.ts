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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Request body tidak valid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Request body tidak valid.' }, { status: 400 });
    }
    const amount = (body as Record<string, unknown>).amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ success: false, message: 'Nominal refund positif atau nol wajib dikonfirmasi admin.' }, { status: 400 });
    }

    const { id } = await params;

    const result = await executeBookingRefund(id, admin.email, amount);

    await recordAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.refund.executed',
      entityType: 'booking',
      entityId: id,
      metadata: { amount: result.amount, noRefund: result.noRefund },
      ip: auditIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
      data: { bookingId: id, amount: result.amount, mode: 'manual', noRefund: result.noRefund },
    });

  } catch (e: unknown) {
    if (e instanceof RefundExecutionError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.status });
    }
    console.error('[Refund Execute] Error:', e);
    const message = e instanceof Error ? e.message : 'Terjadi kesalahan pada server';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
