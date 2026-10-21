import { NextRequest, NextResponse } from 'next/server';
import { revalidateInsurancePrice } from '@/lib/insurance-quote';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

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

    const paxCount = Number(body.pax ?? body.adult ?? 1);
    if (!Number.isInteger(paxCount) || paxCount < 1 || paxCount > 20) {
      return NextResponse.json({ error: 'Jumlah traveler harus antara 1 dan 20.' }, { status: 400 });
    }

    if (!body.date_start || !body.date_end) {
      return NextResponse.json({ error: 'Tanggal perjalanan wajib diisi untuk validasi harga.' }, { status: 400 });
    }

    const quote = await revalidateInsurancePrice({
      productCode: insuranceData.product_code,
      provider: insuranceData.provider,
      carrierCode: insuranceData.carrier_code,
      dateStart: body.date_start,
      dateEnd: body.date_end,
      pax: paxCount,
      destination: body.destination,
      destinationArea: body.destination_area,
      isSenior: body.is_senior,
      international: body.international,
      type: body.type,
      productType: body.product_type,
    });
    if (!quote.price) {
      return NextResponse.json({ error: 'Harga paket sudah tidak tersedia. Silakan cari ulang.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, data: quote.product, meta: { searchedArea: quote.area } });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal memvalidasi harga asuransi.';
    console.error('[INSURANCE PRICE ERROR]:', e);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}