import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { registerSchema, validateBody, apiError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`register:${ip}`, 'auth');
  if (!rateLimit.allowed) {
    return apiError('Terlalu banyak percobaan. Silakan coba lagi nanti.', 429, { retryAfter: rateLimit.retryAfter });
  }

  try {
    const body = await req.json();
    const validation = validateBody(registerSchema, body);
    if (!validation.success) return validation.response;

    const { name, email, password, phone } = validation.data;
    const user = await registerUser(name, email, password, phone);
    return NextResponse.json({ success: true, user });
  } catch (e: any) {
    return apiError(e.message || 'Gagal mendaftar', 400);
  }
}
