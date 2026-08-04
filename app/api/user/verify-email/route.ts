import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/account?email_verified=invalid', req.url));
  }

  try {
    const record = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.redirect(new URL('/account?email_verified=invalid', req.url));
    }

    if (record.verified) {
      return NextResponse.redirect(new URL('/account?email_verified=already', req.url));
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.redirect(new URL('/account?email_verified=expired', req.url));
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: record.newEmail },
    });
    if (existingUser && existingUser.id !== record.userId) {
      return NextResponse.redirect(new URL('/account?email_verified=taken', req.url));
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: { email: record.newEmail },
    });

    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    return NextResponse.redirect(new URL('/account?email_verified=success', req.url));
  } catch (e: any) {
    console.error('[Verify Email]', e.message);
    return NextResponse.redirect(new URL('/account?email_verified=error', req.url));
  }
}
