import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isSetupRequest(value: unknown): value is { email: string; password: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return typeof body.email === 'string' && typeof body.password === 'string';
}

export async function POST(req: NextRequest) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    return NextResponse.json({ error: 'Admin bootstrap is not configured' }, { status: 503 });
  }

  const rateLimit = await checkRateLimit(`admin-setup:${getClientIp(req)}`, 'auth');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many setup attempts' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 300) } }
    );
  }

  const body: unknown = await req.json().catch(() => null);
  if (!isSetupRequest(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const emailOk = safeEqual(body.email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = safeEqual(body.password, expectedPassword);
  if (!emailOk || !passwordOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true },
  });
  if (existingAdmin) {
    return NextResponse.json({ error: 'Admin bootstrap has already been completed' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(expectedPassword, 12);
  const adminName = process.env.ADMIN_NAME || 'Admin TMT';

  await prisma.user.upsert({
    where: { email: expectedEmail.trim().toLowerCase() },
    update: { role: 'admin', name: adminName, password: hashed },
    create: {
      email: expectedEmail.trim().toLowerCase(),
      name: adminName,
      password: hashed,
      role: 'admin',
    },
  });

  return NextResponse.json({ success: true, message: 'Admin user created/updated' });
}
