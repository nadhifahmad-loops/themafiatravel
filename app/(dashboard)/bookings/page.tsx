'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── KAMUS MULTI-BAHASA ──────────────────────────────────────────────────────
const dict = {
  ID: {
    title: 'Pesanan Saya',
    subtitle: 'Kelola dan pantau pengalaman perjalanan masa lalu dan mendatangmu dengan mudah.',
    tabs: { 
      all: 'Semua Pesanan', 
      pending_payment: 'Menunggu Pembayaran', 
      paid: 'Aktif & Selesai', 
      cancelled: 'Dibatalkan' 
    },
    services: {
      all: 'Semua Layanan'
    },
    status: { 
      pending_payment: 'Menunggu Bayar', 
      paid: 'Terkonfirmasi', 
      payment_failed: 'Gagal', 
      cancelled: 'Dibatalkan' 
    },
    bookingId: 'ID Pesanan:',
    checkin: 'Tanggal Check-in',
    departure: 'Keberangkatan',
    checkout: 'Check-out',
    viewDetails: 'Lihat Detail',
    payNow: 'Bayar Sekarang',
    empty: 'Belum ada pesanan',
    emptySub: 'Yuk, mulai rencanakan perjalanan impianmu hari ini!',
    searchBtn: 'Cari Destinasi',
    night: 'malam',
    room: 'Kamar',
    pax: 'Penumpang',
    hotel: 'Hotel',
    flight: 'Pesawat',
    train: 'Kereta', 
    insurance: 'Asuransi', // 🔥 Tambahan Asuransi
    startsFrom: 'Total Harga'
  },
  EN: {
    title: 'My Bookings',
    subtitle: 'Manage and track your upcoming and past travel experiences with ease.',
    tabs: { 
      all: 'All Bookings', 
      pending_payment: 'Pending Payment', 
      paid: 'Active & Completed', 
      cancelled: 'Cancelled' 
    },
    services: {
      all: 'All Services'
    },
    status: { 
      pending_payment: 'Pending', 
      paid: 'Confirmed', 
      payment_failed: 'Failed', 
      cancelled: 'Cancelled' 
    },
    bookingId: 'Booking ID:',
    checkin: 'Check-in Date',
    departure: 'Departure Date',
    checkout: 'Check-out',
    viewDetails: 'View Details',
    payNow: 'Pay Now',
    empty: 'No bookings found',
    emptySub: 'Start planning your journey today!',
    searchBtn: 'Search Destination',
    night: 'night(s)',
    room: 'Room(s)',
    pax: 'Passenger(s)',
    hotel: 'Hotel',
    flight: 'Flight',
    train: 'Train', 
    insurance: 'Insurance', // 🔥 Tambahan Asuransi
    startsFrom: 'Total Price'
  }
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🔥 STATE UNTUK DUA FILTER
  const [filter, setFilter] = useState('all'); // Filter Status Pembayaran
  const [serviceFilter, setServiceFilter] = useState('all'); // Filter Jenis Layanan
  
  const [language, setLanguage] = useState('ID');
  const router = useRouter();

  useEffect(() => {
    setLanguage(localStorage.getItem('app_lang') || 'ID');

    const handleStateChange = () => {
      setLanguage(localStorage.getItem('app_lang') || 'ID');
    };
    window.addEventListener('appStateChange', handleStateChange);

    const fetchAllBookings = async () => {
      try {
        // 🔥 Tambah Asuransi ke Promise.all
        const [hotelRes, flightRes, trainRes, insuranceRes] = await Promise.all([
          fetch('/api/hotel/booking').catch(() => null),
          fetch('/api/flight/booking').catch(() => null),
          fetch('/api/train/booking').catch(() => null),
          fetch('/api/insurance/booking').catch(() => null)
        ]);

        let allBookings: any[] = [];

        if (hotelRes?.ok) {
          const hotelData = await hotelRes.json();
          if (hotelData.success) {
            const formattedHotels = (hotelData.data || []).map((b: any) => ({ ...b, serviceType: 'hotel' }));
            allBookings = [...allBookings, ...formattedHotels];
          }
        }

        if (flightRes?.ok) {
          const flightData = await flightRes.json();
          if (flightData.success) {
            const formattedFlights = (flightData.data || []).map((b: any) => ({ ...b, serviceType: 'flight' }));
            allBookings = [...allBookings, ...formattedFlights];
          }
        }

        if (trainRes?.ok) {
          const trainData = await trainRes.json();
          if (trainData.success) {
            const formattedTrains = (trainData.data || []).map((b: any) => ({ ...b, serviceType: 'train' }));
            allBookings = [...allBookings, ...formattedTrains];
          }
        }

        // 🔥 Parsing Data Asuransi
        if (insuranceRes?.ok) {
          const insuranceData = await insuranceRes.json();
          if (insuranceData.success) {
            const formattedInsurance = (insuranceData.data || []).map((b: any) => ({ ...b, serviceType: 'insurance' }));
            allBookings = [...allBookings, ...formattedInsurance];
          }
        }

        // 🔥 SOLUSI DOUBLE CARD: Filter ID yang kembar
        const uniqueBookings = Array.from(
          new Map(allBookings.map(item => [item.id || item.orderNumber, item])).values()
        );

        // Urutkan berdasarkan yang paling baru
        uniqueBookings.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setBookings(uniqueBookings);
      } catch (error) {
        console.error("Gagal mengambil data pesanan", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllBookings();

    return () => window.removeEventListener('appStateChange', handleStateChange);
  }, []);

  const t = dict[language as keyof typeof dict] || dict.ID;

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString.replace(' ', 'T'));
    return date.toLocaleDateString(language === 'ID' ? 'id-ID' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const STATUS_STYLES: Record<string, string> = {
    'pending_payment': 'bg-orange-100 text-orange-700',
    'paid': 'bg-green-100 text-green-700',
    'issued': 'bg-green-100 text-green-700', 
    'payment_failed': 'bg-red-100 text-red-700',
    'cancelled': 'bg-slate-100 text-slate-600',
  };

  // 🔥 LOGIKA UNTUK 2 FILTER SEKALIGUS (Status & Tipe Layanan)
  const filtered = bookings.filter(b => {
    // 1. Cek Status
    let matchStatus = false;
    if (filter === 'all') matchStatus = true;
    else if (filter === 'paid') matchStatus = (b.status === 'paid' || b.status === 'issued');
    else matchStatus = (b.status === filter);

    // 2. Cek Jenis Layanan
    let matchService = false;
    const sType = b.serviceType || b.bookingType; 
    if (serviceFilter === 'all') matchService = true;
    else if (serviceFilter === 'hotel' && (!sType || sType === 'hotel')) matchService = true; // Fallback jika DB gak nyimpen tipe
    else matchService = (sType === serviceFilter);

    return matchStatus && matchService;
  });

  const tabOptions = [
    { key: 'all', label: t.tabs.all },
    { key: 'pending_payment', label: t.tabs.pending_payment },
    { key: 'paid', label: t.tabs.paid },
    { key: 'cancelled', label: t.tabs.cancelled },
  ];

  // 🔥 Opsi Filter Layanan
  const serviceTabOptions = [
    { key: 'all', label: t.services.all, icon: 'fa-layer-group' },
    { key: 'flight', label: t.flight, icon: 'fa-plane' },
    { key: 'hotel', label: t.hotel, icon: 'fa-hotel' },
    { key: 'train', label: t.train, icon: 'fa-train' },
    { key: 'insurance', label: t.insurance, icon: 'fa-shield-halved' },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9ff] gap-4">
      <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 text-sm font-medium">Memuat data...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-slate-900 font-sans pb-24">
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 space-y-8">
        
        {/* ── PAGE HEADER ── */}
        <div className="animate-fade-in">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-orange-600 text-xs font-bold uppercase tracking-widest mb-4 transition-colors">
            <i className="fa-solid fa-arrow-left"></i> Dashboard
          </Link>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-3 font-display tracking-tight">{t.title}</h1>
          <p className="text-slate-500 text-base">{t.subtitle}</p>
        </div>

        {/* ── FITUR BARU: FILTER LAYANAN ── */}
        <div className="flex gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide py-2">
          {serviceTabOptions.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setServiceFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 border ${
                serviceFilter === tab.key
                  ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB SYSTEM STATUS ── */}
        <div className="flex items-center border-b border-slate-200 mb-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {tabOptions.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-6 py-4 font-bold text-sm transition-colors relative ${
                filter === tab.key 
                  ? 'text-orange-600' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {filter === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600 rounded-t-md"></div>
              )}
            </button>
          ))}
        </div>

        {/* ── BOOKINGS GRID ── */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 text-center shadow-sm animate-fade-up">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 text-slate-300">
              <i className="fa-solid fa-suitcase-rolling"></i>
            </div>
            <h2 className="font-black text-slate-900 text-2xl mb-2 font-display">{t.empty}</h2>
            <p className="text-slate-500 text-sm mb-8">{t.emptySub}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-600/20 active:scale-95"
            >
              <i className="fa-solid fa-magnifying-glass mr-2"></i> {t.searchBtn}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filtered.map((b: any, index: number) => {
              const sType = b.serviceType || b.bookingType;
              const isFlight = sType === 'flight';
              const isTrain = sType === 'train';
              const isInsurance = sType === 'insurance'; // 🔥 Tambahan
              const isHotel = !isFlight && !isTrain && !isInsurance;

              let statusLabel = t.status[b.status as keyof typeof t.status];
              if (b.status === 'issued') statusLabel = t.status.paid; 
              if (!statusLabel) statusLabel = t.status.pending_payment;
              
              const statusStyle = STATUS_STYLES[b.status] || STATUS_STYLES['pending_payment'];
              
              let imageSrc = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80';
              let badgeBg = 'bg-slate-900/90';
              let badgeIcon = 'fa-hotel';
              let badgeLabel = t.hotel;

              if (isFlight) {
                imageSrc = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&q=80';
                badgeBg = 'bg-blue-900/90';
                badgeIcon = 'fa-plane';
                badgeLabel = t.flight;
              } else if (isTrain) {
                imageSrc = '/images/train.jpg'; 
                badgeBg = 'bg-emerald-700/90';
                badgeIcon = 'fa-train';
                badgeLabel = t.train;
              } else if (isInsurance) {
                imageSrc = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=500&q=80';
                badgeBg = 'bg-purple-700/90';
                badgeIcon = 'fa-shield-halved';
                badgeLabel = t.insurance;
              }

              const nights = (isHotel && b.checkinDate && b.checkoutDate)
                ? Math.max(1, Math.round((new Date(b.checkoutDate).getTime() - new Date(b.checkinDate).getTime()) / 86400000))
                : 1;

              // 🔥 AREA RAWAN 404 - LIHAT PENJELASAN DI BAWAH KODE
              const detailUrl = `/bookings/${b.id || b.orderNumber}`;

              return (
                <div 
                  key={`${b.id || b.orderNumber}-${index}`} 
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:shadow-xl hover:border-orange-200 group animate-fade-up"
                >
                  {/* Left Side: Image */}
                  <div className="md:w-1/4 relative min-h-[200px] bg-slate-100 overflow-hidden">
                    <img 
                      src={imageSrc} 
                      alt={badgeLabel} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm ${badgeBg}`}>
                        <i className={`fa-solid ${badgeIcon} text-[10px]`}></i> 
                        {badgeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Right Side: Details */}
                  <div className="p-6 md:p-8 flex-grow flex flex-col justify-between">
                    
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-black text-xl text-slate-900 font-display leading-tight">
                            {isFlight || isTrain || isInsurance
                              ? (b.hotelName || b.routeLabel || b.packageName || `${b.origin || 'Asal'} ➔ ${b.destination || 'Tujuan'}`) 
                              : (b.hotelName || 'Pesanan Hotel')
                            }
                          </h3>
                          <span className={`px-3 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">
                          {t.bookingId} <span className="text-slate-900 font-bold uppercase">{b.orderNumber || b.id?.slice(0, 8)}</span>
                        </p>
                      </div>
                      
                      <div className="text-left md:text-right shrink-0 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                          {isFlight || isTrain ? t.departure : t.checkin}
                        </p>
                        <p className="font-black text-slate-900 text-lg">
                          {formatDate(b.departureDate || b.checkinDate || b.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row / Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-6 border-t border-slate-100 gap-4">
                      
                      <div className="flex gap-4 flex-wrap">
                        {isFlight ? (
                          <>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-plane-departure text-slate-400"></i>
                              <span className="text-sm font-medium">{b.carrierName || 'Maskapai'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-users text-slate-400"></i>
                              <span className="text-sm font-medium">{b.adult || 1} {t.pax}</span>
                            </div>
                          </>
                        ) : isTrain ? (
                          <>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-train text-slate-400"></i>
                              <span className="text-sm font-medium">Kereta Api (KAI)</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-users text-slate-400"></i>
                              <span className="text-sm font-medium">{b.adult || 1} {t.pax}</span>
                            </div>
                          </>
                        ) : isInsurance ? (
                          <>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-file-contract text-slate-400"></i>
                              <span className="text-sm font-medium">Polis Asuransi</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-user-shield text-slate-400"></i>
                              <span className="text-sm font-medium">{b.insuredCount || 1} {t.pax}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-moon text-slate-400"></i>
                              <span className="text-sm font-medium">{nights} {t.night}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <i className="fa-solid fa-door-open text-slate-400"></i>
                              <span className="text-sm font-medium">1 {t.room}</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="text-right mr-2 hidden sm:block">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t.startsFrom}</p>
                          <p className="font-black text-orange-600 text-lg leading-none">
                            {b.currency || 'IDR'} {b.totalAmount?.toLocaleString('id-ID')}
                          </p>
                        </div>

                        {b.status === 'pending_payment' && (b.snapToken || b.snapRedirectUrl) ? (
                          <button 
                            onClick={() => window.open(b.snapRedirectUrl, '_blank')}
                            className="flex-1 sm:flex-none px-6 py-3 bg-orange-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 active:scale-95 transition-all text-center"
                          >
                            <i className="fa-solid fa-credit-card mr-1.5"></i> {t.payNow}
                          </button>
                        ) : (
                          <button 
                            onClick={() => router.push(detailUrl)}
                            className="flex-1 sm:flex-none px-6 py-3 border-2 border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-center"
                          >
                            {t.viewDetails}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}