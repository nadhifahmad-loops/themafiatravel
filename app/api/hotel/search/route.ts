import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    
    // ========================================================
    // 🔥 DATA TESTING AMAN (BYPASS INPUT FRONTEND SEMENTARA)
    // ========================================================
    // Kita paksa cari Hotel di Bali untuk 1 bulan ke depan. 
    // Sandbox biasanya cuma merespons rute turis populer dan tanggal jauh.
    const today = new Date();
    const checkin = new Date(today.setMonth(today.getMonth() + 1)).toISOString().split('T')[0];
    const checkout = new Date(today.setDate(today.getDate() + 2)).toISOString().split('T')[0];

    const payload = {
      checkin_date: checkin,
      checkout_date: checkout,
      // Pastikan format destination_id benar. Biasanya "ID-BALI" atau kode dari get_destination
      destination_id: body.destination_id || 'ID-BALI', 
      adult: 1,
      child: 0,
      child_ages: [],
      room: 1,
      nationality: 'ID',
    };

    console.log("[HOTEL SEARCH PAYLOAD KE ORBIS]:", payload);

    const data = await hotelAPI.search(payload);

    return NextResponse.json({ success: true, data });
  } catch (e: any) {

    console.error("=== ERROR LENGKAP DI BACKEND ===");
    console.error("Pesan Error:", e.message);
    console.error("================================");
    
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}