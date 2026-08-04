'use client';

import { useEffect } from 'react';

// FIX (Bug #9): `error.tsx` tidak menangkap error yang terjadi di root layout
// itu sendiri (mis. Providers gagal render). `global-error.tsx` menangani kasus
// itu — karena menggantikan root layout, file ini WAJIB punya tag <html>/<body>
// sendiri (tidak bisa mewarisi dari app/layout.tsx).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ fontFamily: 'sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: '#F9FAFB',
          }}
        >
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
              Terjadi kesalahan pada aplikasi
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.5rem' }}>
              Maaf, aplikasi mengalami masalah saat memuat. Silakan muat ulang halaman.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '0.5rem',
                background: '#F97316',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Muat Ulang
            </button>
            {error.digest && (
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
                Kode error: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
