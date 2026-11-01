export type AppLanguage = 'ID' | 'EN';

export type PageMetadata = {
  title: string;
  description: string;
};

const APP_NAME = 'The Mafia Travel';

const ROUTES: Array<{
  matches: (pathname: string) => boolean;
  metadata: Record<AppLanguage, PageMetadata>;
}> = [
  {
    matches: (path) => path === '/',
    metadata: {
      ID: { title: 'The Mafia Travel — Perjalanan Terbaik', description: 'Pesan tiket pesawat, hotel, kereta, dan asuransi perjalanan dengan mudah bersama The Mafia Travel.' },
      EN: { title: 'The Mafia Travel — Better Journeys', description: 'Book flights, hotels, trains, and travel insurance easily with The Mafia Travel.' },
    },
  },
  {
    matches: (path) => path === '/flight/search',
    metadata: {
      ID: { title: 'Cari Tiket Pesawat', description: 'Cari dan bandingkan jadwal serta harga tiket pesawat untuk perjalanan Anda.' },
      EN: { title: 'Search Flights', description: 'Search and compare flight schedules and fares for your trip.' },
    },
  },
  {
    matches: (path) => path === '/flight/checkout',
    metadata: {
      ID: { title: 'Data Pemesanan Pesawat', description: 'Lengkapi data penumpang dan penerbangan sebelum mengirim pesanan.' },
      EN: { title: 'Flight Booking Details', description: 'Enter passenger and flight details before submitting your booking.' },
    },
  },
  {
    matches: (path) => path === '/flight/confirmation',
    metadata: {
      ID: { title: 'Konfirmasi Penerbangan', description: 'Lihat status dan detail konfirmasi pesanan penerbangan Anda.' },
      EN: { title: 'Flight Confirmation', description: 'View the status and confirmation details for your flight booking.' },
    },
  },
  {
    matches: (path) => path === '/hotel/search',
    metadata: {
      ID: { title: 'Cari Hotel', description: 'Temukan dan bandingkan hotel sesuai tujuan dan tanggal perjalanan Anda.' },
      EN: { title: 'Search Hotels', description: 'Find and compare hotels for your destination and travel dates.' },
    },
  },
  {
    matches: (path) => path === '/hotel/checkout',
    metadata: {
      ID: { title: 'Data Pemesanan Hotel', description: 'Periksa detail kamar dan lengkapi data tamu sebelum memesan hotel.' },
      EN: { title: 'Hotel Booking Details', description: 'Review your room details and enter guest information before booking.' },
    },
  },
  {
    matches: (path) => path === '/hotel/confirmation',
    metadata: {
      ID: { title: 'Konfirmasi Hotel', description: 'Lihat status dan detail konfirmasi pemesanan hotel Anda.' },
      EN: { title: 'Hotel Confirmation', description: 'View the status and confirmation details for your hotel booking.' },
    },
  },
  {
    matches: (path) => path === '/hotel' || /^\/hotel\/[^/]+$/.test(path),
    metadata: {
      ID: { title: 'Detail Hotel', description: 'Lihat fasilitas, informasi kamar, dan pilihan harga hotel.' },
      EN: { title: 'Hotel Details', description: 'Explore hotel amenities, room information, and available rates.' },
    },
  },
  {
    matches: (path) => path === '/train/search',
    metadata: {
      ID: { title: 'Cari Tiket Kereta', description: 'Cari jadwal kereta dan bandingkan pilihan perjalanan antarkota.' },
      EN: { title: 'Search Trains', description: 'Search train schedules and compare intercity travel options.' },
    },
  },
  {
    matches: (path) => path === '/train/checkout',
    metadata: {
      ID: { title: 'Data Pemesanan Kereta', description: 'Periksa jadwal dan lengkapi data penumpang sebelum memesan tiket kereta.' },
      EN: { title: 'Train Booking Details', description: 'Review the schedule and enter passenger details before booking your train.' },
    },
  },
  {
    matches: (path) => path === '/train/confirmation',
    metadata: {
      ID: { title: 'Konfirmasi Kereta', description: 'Lihat status dan detail konfirmasi pesanan kereta Anda.' },
      EN: { title: 'Train Confirmation', description: 'View the status and confirmation details for your train booking.' },
    },
  },
  {
    matches: (path) => path === '/insurance' || path === '/insurance/search',
    metadata: {
      ID: { title: 'Asuransi Perjalanan', description: 'Bandingkan perlindungan perjalanan dan pilih paket yang sesuai.' },
      EN: { title: 'Travel Insurance', description: 'Compare travel coverage and choose a plan that suits your trip.' },
    },
  },
  {
    matches: (path) => path === '/insurance/checkout',
    metadata: {
      ID: { title: 'Data Asuransi Perjalanan', description: 'Periksa periode perlindungan dan data peserta sebelum memesan asuransi.' },
      EN: { title: 'Travel Insurance Details', description: 'Review the coverage period and traveler details before purchasing insurance.' },
    },
  },
  {
    matches: (path) => path === '/insurance/confirmation',
    metadata: {
      ID: { title: 'Konfirmasi Asuransi', description: 'Lihat status dan detail konfirmasi asuransi perjalanan Anda.' },
      EN: { title: 'Insurance Confirmation', description: 'View the status and confirmation details for your travel insurance.' },
    },
  },
  {
    matches: (path) => path === '/insurance/detail',
    metadata: {
      ID: { title: 'Detail Asuransi', description: 'Pelajari manfaat, ketentuan, dan detail paket asuransi perjalanan.' },
      EN: { title: 'Insurance Plan Details', description: 'Review the benefits, terms, and details of a travel insurance plan.' },
    },
  },
  {
    matches: (path) => path.startsWith('/insurance/bookings/'),
    metadata: {
      ID: { title: 'Detail Pesanan Asuransi', description: 'Lihat detail dan status pesanan asuransi perjalanan Anda.' },
      EN: { title: 'Insurance Booking Details', description: 'View the details and status of your travel insurance booking.' },
    },
  },
  {
    matches: (path) => path === '/bookings',
    metadata: {
      ID: { title: 'Pesanan Saya', description: 'Lihat dan kelola riwayat pesanan perjalanan Anda.' },
      EN: { title: 'My Bookings', description: 'View and manage your travel booking history.' },
    },
  },
  {
    matches: (path) => /^\/bookings\/[^/]+\/review\/?$/.test(path),
    metadata: {
      ID: { title: 'Review Pesanan', description: 'Periksa detail perjalanan, data penumpang, dan total tagihan sebelum pembayaran.' },
      EN: { title: 'Review Your Booking', description: 'Check your trip details, passenger information, and total before payment.' },
    },
  },
  {
    matches: (path) => /^\/bookings\/[^/]+\/cancel\/?$/.test(path),
    metadata: {
      ID: { title: 'Refund dan Reschedule', description: 'Periksa pilihan refund atau perubahan jadwal untuk pesanan perjalanan Anda.' },
      EN: { title: 'Refund and Reschedule', description: 'Review refund or schedule-change options for your travel booking.' },
    },
  },
  {
    matches: (path) => /^\/bookings\/[^/]+\/?$/.test(path),
    metadata: {
      ID: { title: 'Detail Pesanan', description: 'Lihat status dan detail pesanan perjalanan Anda.' },
      EN: { title: 'Booking Details', description: 'View the status and details of your travel booking.' },
    },
  },
  {
    matches: (path) => path === '/payment/pending',
    metadata: {
      ID: { title: 'Pembayaran Menunggu', description: 'Periksa status pembayaran pesanan perjalanan Anda.' },
      EN: { title: 'Payment Pending', description: 'Check the payment status of your travel booking.' },
    },
  },
  {
    matches: (path) => path === '/payment/finish',
    metadata: {
      ID: { title: 'Pembayaran Selesai', description: 'Lihat hasil pembayaran dan status pesanan perjalanan Anda.' },
      EN: { title: 'Payment Complete', description: 'View your payment result and travel booking status.' },
    },
  },
  {
    matches: (path) => path === '/payment/error',
    metadata: {
      ID: { title: 'Pembayaran Gagal', description: 'Periksa status pembayaran dan opsi untuk melanjutkan pesanan Anda.' },
      EN: { title: 'Payment Failed', description: 'Check your payment status and options to continue your booking.' },
    },
  },
  {
    matches: (path) => /^\/payment\/[^/]+\/?$/.test(path),
    metadata: {
      ID: { title: 'Pembayaran Pesanan', description: 'Selesaikan pembayaran pesanan perjalanan Anda dengan aman.' },
      EN: { title: 'Booking Payment', description: 'Complete your travel booking payment securely.' },
    },
  },
  {
    matches: (path) => path === '/refunds' || path === '/refund',
    metadata: {
      ID: { title: 'Refund dan Reschedule', description: 'Pelajari informasi pembatalan, refund, dan perubahan jadwal pesanan.' },
      EN: { title: 'Refund and Reschedule', description: 'Learn about booking cancellations, refunds, and schedule changes.' },
    },
  },
  {
    matches: (path) => path === '/find-booking' || path.startsWith('/find-booking/'),
    metadata: {
      ID: { title: 'Cari Pesanan', description: 'Temukan detail pesanan menggunakan nomor pesanan dan email atau nomor telepon pemesan.' },
      EN: { title: 'Find a Booking', description: 'Find your booking with the order number and the booker’s email or phone.' },
    },
  },
  {
    matches: (path) => path === '/account',
    metadata: {
      ID: { title: 'Akun Saya', description: 'Kelola profil, preferensi, dan pengaturan akun Anda.' },
      EN: { title: 'My Account', description: 'Manage your profile, preferences, and account settings.' },
    },
  },
  {
    matches: (path) => path.startsWith('/account/edit/name'),
    metadata: {
      ID: { title: 'Ubah Nama', description: 'Perbarui nama pada profil akun Anda.' },
      EN: { title: 'Edit Name', description: 'Update the name on your account profile.' },
    },
  },
  {
    matches: (path) => path.startsWith('/account/edit/phone'),
    metadata: {
      ID: { title: 'Ubah Nomor Telepon', description: 'Perbarui nomor telepon pada profil akun Anda.' },
      EN: { title: 'Edit Phone Number', description: 'Update the phone number on your account profile.' },
    },
  },
  {
    matches: (path) => path.startsWith('/account/language'),
    metadata: {
      ID: { title: 'Bahasa dan Preferensi', description: 'Atur bahasa dan preferensi aplikasi Anda.' },
      EN: { title: 'Language and Preferences', description: 'Set your application language and preferences.' },
    },
  },
  {
    matches: (path) => path.startsWith('/account/detail'),
    metadata: {
      ID: { title: 'Detail Akun', description: 'Lihat informasi dan detail profil akun Anda.' },
      EN: { title: 'Account Details', description: 'View your account information and profile details.' },
    },
  },
  {
    matches: (path) => path === '/favorites' || path.startsWith('/favorites/collections/'),
    metadata: {
      ID: { title: 'Favorit Saya', description: 'Lihat dan kelola koleksi favorit perjalanan Anda.' },
      EN: { title: 'My Favorites', description: 'View and manage your favorite travel collections.' },
    },
  },
  {
    matches: (path) => path === '/discount',
    metadata: {
      ID: { title: 'Promo dan Diskon', description: 'Temukan promo dan kupon untuk pesanan perjalanan Anda.' },
      EN: { title: 'Deals and Discounts', description: 'Discover deals and coupons for your travel bookings.' },
    },
  },
  {
    matches: (path) => path === '/about',
    metadata: {
      ID: { title: 'Tentang Kami', description: 'Kenali The Mafia Travel dan layanan perjalanan kami.' },
      EN: { title: 'About Us', description: 'Learn about The Mafia Travel and our travel services.' },
    },
  },
  {
    matches: (path) => path === '/help',
    metadata: {
      ID: { title: 'Pusat Bantuan', description: 'Temukan panduan dan bantuan untuk pemesanan perjalanan Anda.' },
      EN: { title: 'Help Center', description: 'Find guidance and support for your travel bookings.' },
    },
  },
  {
    matches: (path) => path === '/partner',
    metadata: {
      ID: { title: 'Mitra Kami', description: 'Informasi kemitraan dan peluang bekerja sama dengan The Mafia Travel.' },
      EN: { title: 'Our Partners', description: 'Partnership information and opportunities with The Mafia Travel.' },
    },
  },
  {
    matches: (path) => path === '/career',
    metadata: {
      ID: { title: 'Karier', description: 'Jelajahi kesempatan berkarier bersama The Mafia Travel.' },
      EN: { title: 'Careers', description: 'Explore career opportunities at The Mafia Travel.' },
    },
  },
  {
    matches: (path) => path === '/blog',
    metadata: {
      ID: { title: 'Artikel Perjalanan', description: 'Baca artikel, inspirasi, dan informasi seputar perjalanan.' },
      EN: { title: 'Travel Stories', description: 'Read travel articles, inspiration, and useful travel information.' },
    },
  },
  {
    matches: (path) => path.startsWith('/blog/'),
    metadata: {
      ID: { title: 'Artikel Perjalanan', description: 'Baca artikel perjalanan dan temukan inspirasi untuk perjalanan berikutnya.' },
      EN: { title: 'Travel Article', description: 'Read travel stories and find inspiration for your next trip.' },
    },
  },
  {
    matches: (path) => path === '/terms',
    metadata: {
      ID: { title: 'Syarat dan Ketentuan', description: 'Baca syarat dan ketentuan penggunaan layanan The Mafia Travel.' },
      EN: { title: 'Terms and Conditions', description: 'Read the terms and conditions for using The Mafia Travel.' },
    },
  },
  {
    matches: (path) => path === '/privacy',
    metadata: {
      ID: { title: 'Kebijakan Privasi', description: 'Pelajari cara The Mafia Travel mengelola dan melindungi data pribadi Anda.' },
      EN: { title: 'Privacy Policy', description: 'Learn how The Mafia Travel handles and protects your personal data.' },
    },
  },
  {
    matches: (path) => path === '/login',
    metadata: {
      ID: { title: 'Masuk', description: 'Masuk ke akun The Mafia Travel untuk mengelola pesanan dan profil Anda.' },
      EN: { title: 'Sign In', description: 'Sign in to your The Mafia Travel account to manage bookings and your profile.' },
    },
  },
  {
    matches: (path) => path === '/register',
    metadata: {
      ID: { title: 'Buat Akun', description: 'Daftar akun The Mafia Travel untuk mengelola perjalanan Anda.' },
      EN: { title: 'Create an Account', description: 'Create a The Mafia Travel account to manage your trips.' },
    },
  },
  {
    matches: (path) => path === '/forgot-password' || path === '/reset-password',
    metadata: {
      ID: { title: 'Atur Ulang Kata Sandi', description: 'Pulihkan akses dan atur ulang kata sandi akun Anda.' },
      EN: { title: 'Reset Password', description: 'Recover access to your account and reset your password.' },
    },
  },
  {
    matches: (path) => path.startsWith('/verify/'),
    metadata: {
      ID: { title: 'Verifikasi Pesanan', description: 'Periksa keaslian dokumen dan informasi pesanan perjalanan.' },
      EN: { title: 'Booking Verification', description: 'Verify the authenticity of your travel document and booking details.' },
    },
  },
  {
    matches: (path) => path === '/admin/dashboard',
    metadata: {
      ID: { title: 'Dashboard Admin', description: 'Ringkasan aktivitas dan performa The Mafia Travel.' },
      EN: { title: 'Admin Dashboard', description: 'Overview of The Mafia Travel activity and performance.' },
    },
  },
  {
    matches: (path) => path === '/admin/bookings',
    metadata: {
      ID: { title: 'Manajemen Pesanan', description: 'Cari dan kelola pesanan pelanggan.' },
      EN: { title: 'Booking Management', description: 'Search and manage customer bookings.' },
    },
  },
  {
    matches: (path) => path.startsWith('/admin/bookings/'),
    metadata: {
      ID: { title: 'Detail Pesanan Admin', description: 'Periksa detail dan status pesanan pelanggan.' },
      EN: { title: 'Admin Booking Details', description: 'Review customer booking details and status.' },
    },
  },
  {
    matches: (path) => path === '/admin/refund-queue',
    metadata: {
      ID: { title: 'Antrean Refund', description: 'Tinjau dan proses permintaan refund pelanggan.' },
      EN: { title: 'Refund Queue', description: 'Review and process customer refund requests.' },
    },
  },
  {
    matches: (path) => path === '/admin/payments',
    metadata: {
      ID: { title: 'Log Pembayaran', description: 'Tinjau catatan pembayaran dan status transaksi.' },
      EN: { title: 'Payment Logs', description: 'Review payment records and transaction statuses.' },
    },
  },
  {
    matches: (path) => path === '/admin/finance',
    metadata: {
      ID: { title: 'Laporan Keuangan', description: 'Pantau laporan dan ringkasan keuangan.' },
      EN: { title: 'Financial Reports', description: 'Review financial reports and summaries.' },
    },
  },
  {
    matches: (path) => path === '/admin/users',
    metadata: {
      ID: { title: 'Manajemen Pengguna', description: 'Kelola akun dan akses pengguna.' },
      EN: { title: 'User Management', description: 'Manage user accounts and access.' },
    },
  },
  {
    matches: (path) => path === '/admin/audit-logs',
    metadata: {
      ID: { title: 'Log Audit', description: 'Tinjau aktivitas admin dan catatan perubahan sistem.' },
      EN: { title: 'Audit Logs', description: 'Review admin activity and system change records.' },
    },
  },
  {
    matches: (path) => path === '/admin/coupons',
    metadata: {
      ID: { title: 'Manajemen Kupon', description: 'Buat dan kelola kupon diskon.' },
      EN: { title: 'Coupon Management', description: 'Create and manage discount coupons.' },
    },
  },
  {
    matches: (path) => path === '/admin/promos',
    metadata: {
      ID: { title: 'Manajemen Promo', description: 'Kelola promosi yang ditampilkan kepada pelanggan.' },
      EN: { title: 'Promotion Management', description: 'Manage promotions shown to customers.' },
    },
  },
  {
    matches: (path) => path === '/admin/blog',
    metadata: {
      ID: { title: 'Manajemen Artikel', description: 'Buat dan kelola artikel perjalanan.' },
      EN: { title: 'Article Management', description: 'Create and manage travel articles.' },
    },
  },
  {
    matches: (path) => path === '/admin/careers',
    metadata: {
      ID: { title: 'Manajemen Karier', description: 'Kelola informasi lowongan dan karier.' },
      EN: { title: 'Career Management', description: 'Manage career and job listing information.' },
    },
  },
  {
    matches: (path) => path === '/admin/settings',
    metadata: {
      ID: { title: 'Pengaturan Admin', description: 'Kelola pengaturan aplikasi The Mafia Travel.' },
      EN: { title: 'Admin Settings', description: 'Manage The Mafia Travel application settings.' },
    },
  },
  {
    matches: (path) => path === '/admin/profile',
    metadata: {
      ID: { title: 'Profil Admin', description: 'Lihat dan kelola profil administrator.' },
      EN: { title: 'Admin Profile', description: 'View and manage the administrator profile.' },
    },
  },
  {
    matches: (path) => path.startsWith('/admin'),
    metadata: {
      ID: { title: 'Panel Admin', description: 'Kelola pesanan, pembayaran, pengguna, dan konten The Mafia Travel.' },
      EN: { title: 'Admin Dashboard', description: 'Manage The Mafia Travel bookings, payments, users, and content.' },
    },
  },
];

const TITLE_TRANSLATIONS: Record<string, string> = {
  'Pembayaran': 'Payment',
  'Pembayaran Pesawat': 'Flight Checkout',
  'Pembayaran Hotel': 'Hotel Checkout',
  'Pembayaran Kereta': 'Train Checkout',
  'Pembayaran Asuransi': 'Insurance Checkout',
  'Pencarian Hotel': 'Hotel Search',
  'Cari Hotel': 'Search Hotels',
  'Asuransi Perjalanan': 'Travel Insurance',
  'Konfirmasi Penerbangan': 'Flight Confirmation',
  'Konfirmasi Kereta': 'Train Confirmation',
  'Konfirmasi Hotel': 'Hotel Confirmation',
  'Konfirmasi Asuransi': 'Insurance Confirmation',
  'Menunggu Pembayaran': 'Payment Pending',
  'Pembayaran Gagal': 'Payment Failed',
  'Detail Pesanan': 'Booking Details',
  'Akun Saya': 'My Account',
  'Pusat Bantuan': 'Help Center',
  'Kebijakan Privasi': 'Privacy Policy',
  'Syarat & Ketentuan': 'Terms and Conditions',
  'Syarat dan Ketentuan': 'Terms and Conditions',
  'Review Pesanan': 'Review Your Booking',
  'Refund & Reschedule': 'Refund and Reschedule',
  'Refund dan Reschedule': 'Refund and Reschedule',
  'Detail Hotel': 'Hotel Details',
  'Detail Plan Asuransi': 'Insurance Plan Details',
  'Pesanan Saya': 'My Bookings',
  'Akun': 'Account',
};

export function getPageMetadata(pathname: string, language: AppLanguage): PageMetadata {
  const route = ROUTES.find(({ matches }) => matches(pathname));
  if (route) return route.metadata[language];

  const fallbackTitle = language === 'ID' ? 'The Mafia Travel' : 'The Mafia Travel';
  return {
    title: fallbackTitle,
    description: language === 'ID'
      ? 'Pesan tiket pesawat, hotel, kereta, dan asuransi perjalanan bersama The Mafia Travel.'
      : 'Book flights, hotels, trains, and travel insurance with The Mafia Travel.',
  };
}

export function localizePageTitle(title: string, language: AppLanguage): string {
  if (language === 'ID') return title;

  const trimmed = title.trim();
  const exact = TITLE_TRANSLATIONS[trimmed];
  if (exact) return exact;

  const dynamicPrefixes: Array<[string, string]> = [
    ['Pembayaran Asuransi:', 'Insurance Checkout:'],
    ['Pembayaran Kereta:', 'Train Checkout:'],
    ['Pembayaran Hotel:', 'Hotel Checkout:'],
    ['Pembayaran Pesawat:', 'Flight Checkout:'],
    ['Pencarian Hotel:', 'Hotel Search:'],
    ['Asuransi Perjalanan:', 'Travel Insurance:'],
    ['Konfirmasi Hotel:', 'Hotel Confirmation:'],
    ['Detail Pesanan:', 'Booking Details:'],
  ];
  for (const [prefix, translated] of dynamicPrefixes) {
    if (trimmed.startsWith(prefix)) return `${translated}${trimmed.slice(prefix.length)}`;
  }

  return trimmed;
}

export function formatDocumentTitle(title: string): string {
  return title === APP_NAME || title.startsWith(`${APP_NAME} —`)
    ? title
    : `${title} | ${APP_NAME}`;
}
