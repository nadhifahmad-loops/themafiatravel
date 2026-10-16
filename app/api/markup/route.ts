import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULTS = { flight: 50000, hotel: 10, train: 15000, insurance: 5 };
const VALID_TYPES = ['flat', 'percent'];

/**
 * GET markup — nilai/biaya layanan yang ditampilkan di halaman checkout.
 *
 * Dibuka tanpa login karena checkout pesawat/kereta/hotel/asuransi tetap
 * dilayani untuk tamu (guest). Nilai ini ikut menentukan total yang
 * ditampilkan ke pengguna, jadi saat 401 tamu memakai nilai default hardcoded
 * padahal server memakai markup asli → total yang tampil tidak sama dengan
 * yang ditagihkan.
 *
 * CATATAN: PUT tetap khusus admin.
 */
export async function GET() {
  try {
    let setting = await prisma.markupSetting.findUnique({ where: { key: 'default' } });
    if (!setting) {
      setting = await prisma.markupSetting.create({
        data: { key: 'default', ...DEFAULTS },
      });
    }
    return NextResponse.json({
      flight: setting.flight,
      flight_type: setting.flight_type,
      hotel: setting.hotel,
      hotel_type: setting.hotel_type,
      train: setting.train,
      train_type: setting.train_type,
      insurance: setting.insurance,
      insurance_type: setting.insurance_type,
    });
  } catch {
    return NextResponse.json({ ...DEFAULTS, flight_type: 'flat', hotel_type: 'percent', train_type: 'flat', insurance_type: 'percent' });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { flight, hotel, train, insurance, flight_type, hotel_type, train_type, insurance_type } = body;

    if (flight === undefined || hotel === undefined || train === undefined || insurance === undefined) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }

    const flightNum = Number(flight);
    const hotelNum = Number(hotel);
    const trainNum = Number(train);
    const insuranceNum = Number(insurance);

    if ([flightNum, hotelNum, trainNum, insuranceNum].some(v => isNaN(v) || v < 0)) {
      return NextResponse.json({ error: 'Nilai markup harus angka positif' }, { status: 400 });
    }

    const flightType = VALID_TYPES.includes(flight_type) ? flight_type : 'flat';
    const hotelType = VALID_TYPES.includes(hotel_type) ? hotel_type : 'percent';
    const trainType = VALID_TYPES.includes(train_type) ? train_type : 'flat';
    const insuranceType = VALID_TYPES.includes(insurance_type) ? insurance_type : 'percent';

    const setting = await prisma.markupSetting.upsert({
      where: { key: 'default' },
      update: {
        flight: flightNum, flight_type: flightType,
        hotel: hotelNum, hotel_type: hotelType,
        train: trainNum, train_type: trainType,
        insurance: insuranceNum, insurance_type: insuranceType,
      },
      create: {
        key: 'default',
        flight: flightNum, flight_type: flightType,
        hotel: hotelNum, hotel_type: hotelType,
        train: trainNum, train_type: trainType,
        insurance: insuranceNum, insurance_type: insuranceType,
      },
    });

    return NextResponse.json({
      success: true,
      flight: setting.flight, flight_type: setting.flight_type,
      hotel: setting.hotel, hotel_type: setting.hotel_type,
      train: setting.train, train_type: setting.train_type,
      insurance: setting.insurance, insurance_type: setting.insurance_type,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Gagal menyimpan' }, { status: 500 });
  }
}
