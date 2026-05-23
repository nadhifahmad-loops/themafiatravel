import { NextRequest, NextResponse } from 'next/server';
import { insuranceAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const insuranceData = body.data || {
      product_code: body.product_code,
      provider: body.provider,
      carrier_code: body.carrier_code,
    };

    if (!insuranceData.product_code || !insuranceData.provider) {
      return NextResponse.json({ error: 'product_code dan provider wajib diisi' }, { status: 400 });
    }

    const paxCount = body.adult || body.pax || 1;

    // Bangun array age sesuai age_type
    let ageArray: string[];
    const ageType: 'age' | 'birth_date' = body.age_type || 'birth_date';

    if (body.age && Array.isArray(body.age) && body.age.length > 0) {
      ageArray = body.age;
    } else if (ageType === 'birth_date') {
      // Default: tanggal lahir 30 tahun lalu
      const defaultBirth = new Date();
      defaultBirth.setFullYear(defaultBirth.getFullYear() - 30);
      const bd = defaultBirth.toISOString().split('T')[0];
      ageArray = Array(paxCount).fill(bd);
    } else {
      ageArray = Array(paxCount).fill('30');
    }

    const payload = {
      data: insuranceData,
      pax: paxCount,
      package: body.package || 1,
      age: ageArray,
      age_type: ageType,
      adult: paxCount,
      ...(body.child && body.child > 0 ? { child: body.child } : {}),
      ...(body.infant && body.infant > 0 ? { infant: body.infant } : {}),
    };

    console.log('[INSURANCE SELL PAYLOAD]:', JSON.stringify(payload, null, 2));

    const data = await insuranceAPI.sellInsurance(payload);
    return NextResponse.json({ success: true, data });

  } catch (e: any) {
    console.error('[INSURANCE SELL ERROR]:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}