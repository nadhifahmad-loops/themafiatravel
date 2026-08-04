import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import { randomBytes } from 'node:crypto';

type JWTWithRole = JWT & { role?: string };

// Halaman khusus member (wajib login). Halaman search & checkout tetap publik.
const MEMBER_PATHS = ['/account', '/bookings', '/refunds', '/insurance/bookings'];

export async function middleware(req: NextRequest) {
  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })) as JWTWithRole | null;
  const { pathname } = req.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin');
  const isMemberRoute = MEMBER_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  let response: NextResponse;

  if (isAdminRoute || isMemberRoute) {
    const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);
    const loginUrl = new URL(`/login?callbackUrl=${callbackUrl}`, req.url);

    // Admin: wajib login + role admin
    if (isAdminRoute) {
      if (!token) return NextResponse.redirect(loginUrl);
      if (token.role !== 'admin') return NextResponse.redirect(loginUrl);
    } else if (!token) {
      return NextResponse.redirect(loginUrl);
    }
    response = NextResponse.next();
  } else {
    response = NextResponse.next();
  }

  // Nonce CSP per-request: dipakai root layout untuk meta Content-Security-Policy.
  const nonce = randomBytes(16).toString('base64');
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
