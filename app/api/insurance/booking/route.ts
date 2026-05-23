import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bookingStore } from '@/lib/store';

// export async function GET(req: NextRequest) {
//   const session = await getServerSession(authOptions);
//   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   const userId = (session.user as any).id;
//   return NextResponse.json({ success: true, data: bookingStore.filter(b => b.userId === userId && b.bookingType === 'insurance') });
// }
