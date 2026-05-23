import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';

// export async function POST(req: NextRequest) {
//   const session = await getServerSession(authOptions);
//   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   try {
//     const body = await req.json();
//     const data = await insuranceAPI.sellInsurance(body);
//     return NextResponse.json({ success: true, data });
//   } catch (e: any) {
//     return NextResponse.json({ error: e.message }, { status: 500 });
//   }
// }
