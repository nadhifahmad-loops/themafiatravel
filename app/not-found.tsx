import Link from 'next/link';

// FIX (Bug #9): sebelumnya tidak ada not-found.tsx, jadi akses ke path yang
// tidak ada akan menampilkan halaman 404 default Next.js, bukan desain milik
// platform ini.
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-light px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-5xl font-extrabold text-orange mb-2">404</p>
        <h1 className="text-xl font-bold text-dark mb-2">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm text-gray mb-6">
          Halaman yang kamu cari mungkin sudah dipindahkan atau tidak pernah ada.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-lg bg-orange text-white text-sm font-semibold hover:bg-orange-dark transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
