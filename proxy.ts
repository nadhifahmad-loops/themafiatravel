import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import { buildCsp, generateNonce } from '@/lib/csp';

type JWTWithRole = JWT & { role?: string };

// Halaman khusus member (wajib login). Halaman search & checkout tetap publik.
const MEMBER_PATHS = ['/account', '/bookings', '/refunds', '/insurance/bookings', '/favorites'];

export async function proxy(req: NextRequest) {
  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })) as JWTWithRole | null;
  const { pathname } = req.nextUrl;

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminLogin = pathname === '/admin/login';
  const isGuestBookingReview = /^\/bookings\/[^/]+\/review\/?$/.test(pathname);
  const isMemberRoute = MEMBER_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  ) && !isGuestBookingReview;

  if (!isAdminLogin && (isAdminRoute || isMemberRoute)) {
    const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);

    // Admin: wajib login + role admin — arahkan ke halaman login admin terpisah.
    if (isAdminRoute) {
      const adminLoginUrl = new URL(`/admin/login?callbackUrl=${callbackUrl}`, req.url);
      if (!token) {
        return NextResponse.redirect(adminLoginUrl);
      }
      if (token.role !== 'admin') {
        adminLoginUrl.searchParams.set('error', 'Unauthorized');
        return NextResponse.redirect(adminLoginUrl);
      }
    } else if (!token) {
      const loginUrl = new URL(`/login?callbackUrl=${callbackUrl}`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Nonce CSP per-request. Dikirim sebagai header CSP (request & response) agar
  // Next.js bisa membaca nonce dan otomatis menempelkannya ke semua inline
  // script yang dihasilkannya (bootstrap hydration, dll). Layout tetap
  // memakai nonce via headers() untuk meta CSP.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('x-nonce', nonce);
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
