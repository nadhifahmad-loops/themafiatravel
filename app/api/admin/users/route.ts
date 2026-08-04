import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: 'Unauthorized', status: 401 };
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== 'admin') return { error: 'Bukan admin', status: 403 };
  return { admin: user };
}

// ─── PATCH: Update user role ──────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ success: false, message: 'userId dan role wajib diisi.' }, { status: 400 });
    }

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ success: false, message: 'Role harus "user" atau "admin".' }, { status: 400 });
    }

    // Tidak boleh downgrade diri sendiri
    if (userId === auth.admin.id && role === 'user') {
      return NextResponse.json({ success: false, message: 'Tidak bisa mengubah role diri sendiri.' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan.' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, image: true },
    });

    await recordAudit({
      adminId: auth.admin.id,
      adminEmail: auth.admin.email,
      action: 'user.role.update',
      entityType: 'user',
      entityId: userId,
      before: { role: target.role },
      after: { role: updated.role },
      metadata: { targetEmail: target.email, targetName: target.name },
      ip: auditIpFromRequest(request),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin PATCH Users]', error);
    return NextResponse.json({ success: false, message: 'Gagal update user.' }, { status: 500 });
  }
}

// ─── DELETE: Hapus user ───────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId wajib diisi.' }, { status: 400 });
    }

    // Tidak boleh hapus diri sendiri
    if (userId === auth.admin.id) {
      return NextResponse.json({ success: false, message: 'Tidak bisa menghapus akun sendiri.' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Jika user punya booking aktif, tolak hapus
    const activeBookings = await prisma.booking.count({
      where: { userId, status: { in: ['pending_payment', 'paid', 'issued'] } },
    });
    if (activeBookings > 0) {
      return NextResponse.json(
        { success: false, message: `User masih memiliki ${activeBookings} pesanan aktif. Batalkan atau selesaikan pesanan terlebih dahulu.` },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    await recordAudit({
      adminId: auth.admin.id,
      adminEmail: auth.admin.email,
      action: 'user.delete',
      entityType: 'user',
      entityId: userId,
      before: { role: target.role, name: target.name, email: target.email },
      after: null,
      metadata: { targetEmail: target.email, targetName: target.name },
      ip: auditIpFromRequest(request),
    });

    return NextResponse.json({ success: true, message: `User ${target.email} berhasil dihapus.` });
  } catch (error) {
    console.error('[Admin DELETE Users]', error);
    return NextResponse.json({ success: false, message: 'Gagal menghapus user.' }, { status: 500 });
  }
}
