import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email } = body;

  const user = await prisma.user.findUnique({
    where: { email: email?.toLowerCase?.() ?? email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      role: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    return NextResponse.json({ found: false, message: 'User tidak ditemukan' });
  }

  const testPassword = 'AdminMafia2026!';
  const valid = user.password ? await bcrypt.compare(testPassword, user.password) : false;

  return NextResponse.json({
    found: true,
    email: user.email,
    role: user.role,
    twoFactorEnabled: user.twoFactorEnabled,
    hasPassword: !!user.password,
    passwordMatch: valid,
    message: valid ? 'Password cocok!' : 'Password TIDAK cocok',
  });
}
