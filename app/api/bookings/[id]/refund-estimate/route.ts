import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking || (booking.status !== 'issued' && booking.status !== 'paid')) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak memenuhi syarat refund.' }, { status: 400 });
    }

    const penaltyFee = Math.round(booking.totalAmount * 0.20); 
    const adminFee = 50000;
    const estimatedRefund = booking.totalAmount - penaltyFee - adminFee;

    return NextResponse.json({
      success: true,
      data: {
        penalty_fee: penaltyFee,
        admin_fee: adminFee,
        estimated_refund_amount: estimatedRefund > 0 ? estimatedRefund : 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}