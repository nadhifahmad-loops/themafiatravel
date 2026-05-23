import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  // Hanya lindungi halaman yang benar-benar butuh login
  // Flight, train, hotel, insurance TIDAK diproteksi — user guest boleh akses
  matcher: ['/dashboard/:path*', '/bookings/:path*'],
};