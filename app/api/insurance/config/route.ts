import { NextResponse } from 'next/server';
import { getInsuranceConfig } from '@/lib/insurance-providers';

// Master data asuransi (get_config) dinormalisasi untuk dipakai form:
// tipe perjalanan (master_trip), product_type, dan dukungan senior per provider.
export async function GET() {
  try {
    const config = await getInsuranceConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('[INSURANCE CONFIG] Gagal mengembalikan config:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat konfigurasi asuransi.' }, { status: 500 });
  }
}
