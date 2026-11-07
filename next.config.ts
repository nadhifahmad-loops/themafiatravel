import type { NextConfig } from 'next';


const nextConfig: NextConfig = {
  output: 'standalone',

  // Hanya dev: domain tunnel (mis. ngrok) yang boleh mengakses dev server,
  // isi lewat env ALLOWED_DEV_ORIGINS=host1,host2
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),

  reactStrictMode: true,

  compress: true,

  poweredByHeader: false,

  // Aset logo dibaca langsung dari disk saat membuat PDF tiket (unduhan,
  // lampiran email, dan verifikasi). Pastikan file ikut ter-trace di build
  // standalone/serverless.
  outputFileTracingIncludes: {
    '/api/bookings/*/pdf': ['./public/images/logo.png'],
    '/api/bookings/*/check-payment': ['./public/images/logo.png'],
    '/api/booking/guest-check-payment': ['./public/images/logo.png'],
    '/api/payment/notification': ['./public/images/logo.png'],
  },

  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        // Content-Security-Policy (nonce per-request) dikirim via <meta> di app/layout.tsx.
      ],
    },
  ],

  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
    ],
  },

  // =========================
  // 🖼️ IMAGE OPTIMIZATION
  // =========================
  images: {
    formats: ['image/avif', 'image/webp'],

    minimumCacheTTL: 60 * 60 * 24 * 7,

    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'www.sunhotels.net',
      },

      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },

      {
        protocol: 'https',
        hostname: 'cf.bstatic.com',
      },

      {
        protocol: 'https',
        hostname: 'www.svgrepo.com',
      },

      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },

      {
        protocol: 'https',
        hostname: 'placehold.co',
      },

      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;