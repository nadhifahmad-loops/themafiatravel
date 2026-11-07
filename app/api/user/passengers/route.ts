import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  SAVED_PASSENGER_LIMIT,
  validateSavedPassengerInput,
} from '@/lib/saved-passengers';

// GET /api/user/passengers — daftar penumpang tersimpan milik user login.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passengers = await prisma.savedPassenger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, passengers });
  } catch (error) {
    console.error('[SavedPassengers GET Error]', error);
    return NextResponse.json({ error: 'Gagal mengambil data penumpang' }, { status: 500 });
  }
}

// POST /api/user/passengers — tambah penumpang tersimpan.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const validation = validateSavedPassengerInput(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const total = await prisma.savedPassenger.count({
      where: { userId: session.user.id },
    });
    if (total >= SAVED_PASSENGER_LIMIT) {
      return NextResponse.json(
        { error: `Maksimal ${SAVED_PASSENGER_LIMIT} penumpang tersimpan.` },
        { status: 400 }
      );
    }

    const duplicate = await prisma.savedPassenger.findFirst({
      where: {
        userId: session.user.id,
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

    const passenger = await prisma.savedPassenger.create({
      data: {
        userId: session.user.id,
        ...validation.data,
      },
    });

    return NextResponse.json({ success: true, passenger }, { status: 201 });
  } catch (error) {
    console.error('[SavedPassengers POST Error]', error);
    return NextResponse.json({ error: 'Gagal menyimpan penumpang' }, { status: 500 });
  }
}
