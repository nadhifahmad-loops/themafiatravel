import type { NextConfig } from 'next';


const nextConfig: NextConfig = {
  // =========================
  // 🌐 NGROK DEV
  // =========================
  allowedDevOrigins: [
    'sultrier-favoredly-kenneth.ngrok-free.dev',
  ],

  // =========================
  // ⚡ NEXT PERFORMANCE
  // =========================
  reactStrictMode: false,

  compress: true,

  poweredByHeader: false,

  experimental: {
    optimizePackageImports: [
      'framer-motion',
      '@heroicons/react',
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
        hostname: '**',
      },

      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },

      {
        protocol: 'https',
        hostname: 'cf.bstatic.com',
      },
    ],
  },
};

export default nextConfig;