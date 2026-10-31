import { NextRequest, NextResponse } from 'next/server';
import { getActivePromos, isPromoService } from '@/lib/promos';

/**
 * GET /api/promos/active?service=flight|hotel|train&limit=10
 * Promo aktif yang belum lewat masa berlaku. Hanya baca; aman untuk cache CDN.
 * Tanpa `service`, seluruh promo aktif dikirim (jumlahnya kecil).
 */
/** Memperkirakan apakah klien memang mengirim parameter limit. */
function hasExplicitLimit(sp: URLSearchParams) {
  return sp.has('limit');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const service = searchParams.get('service');
  const filter = isPromoService(service) ? service : null;
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

  const all = await getActivePromos();
  const matched = filter ? all.filter((p) => p.service === filter) : all;
  // Tanpa filter layanan → kirim semua promo aktif (jumlahnya kecil),
  // kecuali klien memang meminta limit tertentu.
  const promos = filter || hasExplicitLimit(searchParams) ? matched.slice(0, limit) : matched;

  return NextResponse.json(
    { promos },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
