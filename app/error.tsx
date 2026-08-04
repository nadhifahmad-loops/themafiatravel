'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// FIX (Bug #9): sebelumnya tidak ada error boundary sama sekali di App Router,
// jadi error runtime yang tidak tertangkap di komponen manapun akan jatuh ke
// error screen default Next.js (bukan tampilan branded milik platform ini).
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-light px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-light">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-orange" />
        </div>
        <h1 className="text-xl font-bold text-dark mb-2">
          Terjadi kesalahan
        </h1>
        <p className="text-sm text-gray mb-6">
          Maaf, ada yang tidak berjalan sesuai rencana di halaman ini. Tim kami
          sudah dicatat mengenai error ini. Silakan coba lagi.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-lg bg-orange text-white text-sm font-semibold hover:bg-orange-dark transition-colors"
          >
            Coba Lagi
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-dark text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">Kode error: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
