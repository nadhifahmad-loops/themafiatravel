import type { NextConfig } from 'next';


const nextConfig: NextConfig = {
  output: 'standalone',

  allowedDevOrigins: [
    'sultrier-favoredly-kenneth.ngrok-free.dev',
  ],

  reactStrictMode: true,

  compress: true,

  poweredByHeader: false,

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