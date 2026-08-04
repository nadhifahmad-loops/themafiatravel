import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';
import { prisma } from '@/lib/prisma';
import { flightSearchSchema, validateBody, apiError, handleOrbisError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return apiError('Terlalu banyak pencarian. Silakan coba lagi nanti.', 429, { retryAfter: rateLimit.retryAfter });
  }

  let providerToSearch: string = 'unknown';
  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.orbisSession.deleteMany({
      where: { createdAt: { lt: fifteenMinsAgo } },
    });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError('Request body tidak valid.', 400);
    }
    const validation = validateBody(flightSearchSchema, body);
    if (!validation.success) return validation.response;
    const data = validation.data;

    providerToSearch = data.provider || 'citilink';

    let journey_list: { origin: string; destination: string; departure_date: string }[] = [];

    if (data.direction === 'Multi' && Array.isArray(data.routes) && data.routes.length > 0) {
      journey_list = data.routes.map((r) => ({
        origin: r.origin,
        destination: r.destination,
        departure_date: r.departure_date,
      }));
    } else if (Array.isArray(data.journey_list) && data.journey_list.length > 0) {
      journey_list = data.journey_list;
    } else {
      journey_list.push({
        origin: data.origin || '',
        destination: data.destination || '',
        departure_date: data.departure_date || '',
      });
      if (data.direction === 'RT' && data.return_date) {
        journey_list.push({
          origin: data.destination || '',
          destination: data.origin || '',
          departure_date: data.return_date,
        });
      }
    }

    for (const j of journey_list) {
      if (!j.origin || !j.destination || !j.departure_date) {
        return apiError('Data rute tidak lengkap (origin/destination/departure_date).', 400);
      }
    }

    console.log(
      `[FLIGHT SEARCH] Provider: ${providerToSearch} | ${journey_list.map(j => `${j.origin}→${j.destination}`).join(', ')} | dir: ${data.direction || 'OW'}`
    );

    const result = await flightAPI.search({
      provider: providerToSearch,
      journey_list,
      adult: Number(data.adult) || 1,
      child: Number(data.child) || 0,
      infant: Number(data.infant) || 0,
      cabin_class: data.cabin_class || 'Y',
      carrier_codes: data.carrier_codes || [],
      is_combo_price: data.is_combo_price ?? (data.direction === 'RT'),
      promo_codes: [],
    });

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    return handleOrbisError(error, 'FLIGHT SEARCH');
  }
}