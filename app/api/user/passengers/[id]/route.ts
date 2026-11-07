import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateSavedPassengerInput } from '@/lib/saved-passengers';

async function getOwnedPassenger(userId: string, id: string) {
  const passenger = await prisma.savedPassenger.findUnique({ where: { id } });
  if (!passenger || passenger.userId !== userId) return null;
  return passenger;
}

// PATCH /api/user/passengers/[id] — ubah data penumpang tersimpan.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getOwnedPassenger(session.user.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Penumpang tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const validation = validateSavedPassengerInput(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const duplicate = await prisma.savedPassenger.findFirst({
      where: {
        userId: session.user.id,
        id: { not: id },
        identityType: validation.data.identityType,
        identityNumber: { equals: validation.data.identityNumber, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Penumpang dengan identitas ini sudah tersimpan.' },
        { status: 409 }
      );
    }

    const passenger = await prisma.savedPassenger.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json({ success: true, passenger });
  } catch (error) {
    console.error('[SavedPassengers PATCH Error]', error);
    return NextResponse.json({ error: 'Gagal memperbarui penumpang' }, { status: 500 });
  }
}

// DELETE /api/user/passengers/[id] — hapus penumpang milik user login.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getOwnedPassenger(session.user.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Penumpang tidak ditemukan' }, { status: 404 });
    }

    await prisma.savedPassenger.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SavedPassengers DELETE Error]', error);
    return NextResponse.json({ error: 'Gagal menghapus penumpang' }, { status: 500 });
  }
}
