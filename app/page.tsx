'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import Image from 'next/image';

import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import FlightSearchForm from '@/components/flight/FlightSearchForm';
import TrainSearchForm from '@/components/train/TrainSearchForm';

/* ─────────────────────────────────────────────────────────────
   HOTEL FORM
───────────────────────────────────────────────────────────── */

function HotelForm({ onSearch }: { onSearch: () => void }) {
  const [city, setCity] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
            Kota / Hotel
          </label>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <i className="fa-solid fa-location-dot text-orange-500" />

            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Jakarta, Bali, Surabaya..."
              className="flex-1 bg-transparent outline-none text-sm font-semibold"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
            Check-in
          </label>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <i className="fa-regular fa-calendar text-orange-500" />

            <input
              type="date"
              value={checkin}
              min={today}
              onChange={e => setCheckin(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm font-semibold"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
            Check-out
          </label>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <i className="fa-regular fa-calendar text-orange-500" />

            <input
              type="date"
              value={checkout}
              min={checkin || today}
              onChange={e => setCheckout(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm font-semibold"
            />
          </div>
        </div>

        <div className="lg:col-span-2 flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
              Kamar
            </label>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-4">
              <button
                onClick={() => setRooms(Math.max(1, rooms - 1))}
                className="w-7 h-7 rounded-full bg-slate-100 text-xs font-black"
              >
                -
              </button>

              <span className="text-sm font-black">{rooms}</span>

              <button
                onClick={() => setRooms(rooms + 1)}
                className="w-7 h-7 rounded-full bg-slate-100 text-xs font-black"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
              Tamu
            </label>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-4">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-7 h-7 rounded-full bg-slate-100 text-xs font-black"
              >
                -
              </button>

              <span className="text-sm font-black">{guests}</span>

              <button
                onClick={() => setGuests(guests + 1)}
                className="w-7 h-7 rounded-full bg-slate-100 text-xs font-black"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <button
            onClick={onSearch}
            className="w-full h-[56px] rounded-2xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 transition-all"
          >
            Cari Hotel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

const TABS = [
  {
    id: 'flights',
    label: 'Pesawat',
    icon: 'fa-plane',
  },
  {
    id: 'hotels',
    label: 'Hotel',
    icon: 'fa-hotel',
  },
  {
    id: 'trains',
    label: 'Kereta',
    icon: 'fa-train',
  },
  {
    id: 'insurance',
    label: 'Asuransi',
    icon: 'fa-shield-halved',
  },
];

const QUICK_MENU = [
  {
    title: 'Pesawat',
    icon: 'fa-plane',
    color: 'bg-blue-100 text-blue-600',
    tab: 'flights',
  },
  {
    title: 'Hotel',
    icon: 'fa-hotel',
    color: 'bg-orange-100 text-orange-600',
    tab: 'hotels',
  },
  {
    title: 'Kereta',
    icon: 'fa-train',
    color: 'bg-emerald-100 text-emerald-600',
    tab: 'trains',
  },
  {
    title: 'Asuransi',
    icon: 'fa-shield-halved',
    color: 'bg-purple-100 text-purple-600',
    tab: 'insurance',
  },
  {
    title: 'Promo',
    icon: 'fa-tags',
    color: 'bg-pink-100 text-pink-600',
    href: '/promo',
  },
  {
    title: 'Riwayat',
    icon: 'fa-clock-rotate-left',
    color: 'bg-slate-100 text-slate-700',
    href: '/orders',
  },
  {
    title: 'Refund',
    icon: 'fa-money-bill-wave',
    color: 'bg-cyan-100 text-cyan-600',
    href: '/refund',
  },
  {
    title: 'Bantuan',
    icon: 'fa-headset',
    color: 'bg-yellow-100 text-yellow-700',
    href: '/help',
  },
];

const PROMOS = [
  {
    title: 'Flash Sale Citilink',
    desc: 'Diskon hingga 40%',
    image:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80',
  },
  {
    title: 'Hotel Luxury',
    desc: 'Mulai Rp 499rb',
    image:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
  },
];

const DESTINATIONS = [
  {
    city: 'Bali',
    image:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
  },
  {
    city: 'Tokyo',
    image:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  },
  {
    city: 'Singapore',
    image:
      'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80',
  },
  {
    city: 'Yogyakarta',
    image:
      'https://images.unsplash.com/photo-1580974852861-c381510bc98f?w=800&q=80',
  },
];

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { data: session, status } = useSession();

  const router = useRouter();

  const isLoggedIn = status === 'authenticated';

  const [activeTab, setActiveTab] = useState('flights');

  const handleFlightSearch = (payload: any) => {
    const params = new URLSearchParams();

    if (payload.origin) params.set('origin', payload.origin);
    if (payload.destination)
      params.set('destination', payload.destination);

    if (payload.departure_date)
      params.set('departure_date', payload.departure_date);

    if (payload.return_date)
      params.set('return_date', payload.return_date);

    params.set('adult', String(payload.adult ?? 1));

    router.push(`/flight/search?${params.toString()}`);
  };

  const handleTrainSearch = (payload: any) => {
    const params = new URLSearchParams();

    if (payload.journey_list?.[0]) {
      params.set('origin', payload.journey_list[0].origin);
      params.set('destination', payload.journey_list[0].destination);
    }

    router.push(`/train/search?${params.toString()}`);
  };

  const handleHotelSearch = () => {
    router.push('/hotel/search');
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] overflow-x-hidden">
      <UnifiedNavbar user={session?.user || null} />

      {/* HERO */}
      <section className="relative overflow-visible pt-28 md:pt-36 pb-24">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1800&q=80"
            alt="hero"
            fill
            priority
            className="object-cover"
          />

          <div className="absolute inset-0 bg-slate-900/60" />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-8">
          {/* TOP BADGE */}
          <div className="flex justify-center mb-5">
            <div className="px-5 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-xl text-white text-xs sm:text-sm font-semibold">
              ✈️ Smart Journey Solution
            </div>
          </div>

          {/* HEADING */}
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-white text-4xl md:text-6xl font-black leading-tight">
              Jelajahi Dunia
              <span className="text-orange-400"> Lebih Mudah </span>
              & Modern
            </h1>

            <p className="text-white/80 mt-5 text-sm md:text-lg leading-relaxed">
              Pesawat, hotel, kereta, asuransi, dan promo perjalanan
              terbaik dalam satu platform modern.
            </p>
          </div>

          {/* USER CTA */}
          {isLoggedIn ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button className="px-5 py-3 rounded-2xl bg-white text-slate-900 font-bold text-sm">
                👋 Halo, {session?.user?.name}
              </button>

              <Link
                href="/orders"
                className="px-5 py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm"
              >
                Pesanan Saya
              </Link>

              <Link
                href="/wishlist"
                className="px-5 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm"
              >
                Wishlist
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="px-6 py-3 rounded-2xl bg-orange-500 text-white font-black text-sm"
              >
                Daftar Gratis
              </Link>

              <Link
                href="/login"
                className="px-6 py-3 rounded-2xl border border-white/20 bg-white/10 text-white font-bold text-sm"
              >
                Login
              </Link>
            </div>
          )}

          {/* QUICK MENU */}
          <div className="mt-12 grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {QUICK_MENU.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  if (item.tab) {
                    setActiveTab(item.tab);
                  }

                  if (item.href) {
                    router.push(item.href);
                  }
                }}
                className="group bg-white rounded-3xl p-4 hover:-translate-y-1 transition-all shadow-lg"
              >
                <div
                  className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center ${item.color}`}
                >
                  <i className={`fa-solid ${item.icon}`} />
                </div>

                <div className="mt-3 text-[11px] sm:text-xs font-black text-slate-800">
                  {item.title}
                </div>
              </button>
            ))}
          </div>

          {/* SEARCH */}
          <div className="mt-10 max-w-6xl mx-auto rounded-[36px] border border-white/20 bg-white/15 backdrop-blur-2xl shadow-2xl overflow-visible">
            {/* TABS */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide p-4 border-b border-white/10">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white shadow-lg'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* FORM */}
            <div className="relative z-[999] p-3">
              {activeTab === 'flights' && (
                <Suspense
                  fallback={
                    <div className="h-32 flex items-center justify-center text-white">
                      Loading...
                    </div>
                  }
                >
                  <FlightSearchForm
                    onSearch={handleFlightSearch}
                    loading={false}
                  />
                </Suspense>
              )}

              {activeTab === 'hotels' && (
                <div className="rounded-[30px] bg-white shadow-xl overflow-hidden">
                  <HotelForm onSearch={handleHotelSearch} />
                </div>
              )}

              {activeTab === 'trains' && (
                <Suspense
                  fallback={
                    <div className="h-32 flex items-center justify-center text-white">
                      Loading...
                    </div>
                  }
                >
                  <TrainSearchForm
                    onSearch={handleTrainSearch}
                    loading={false}
                  />
                </Suspense>
              )}

              {activeTab === 'insurance' && (
                <div className="rounded-[30px] bg-white p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="flex gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                        <i className="fa-solid fa-shield-halved text-orange-500 text-xl" />
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          Proteksi Perjalanan
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
                          Lindungi perjalananmu dari risiko tak terduga.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push('/insurance')}
                      className="px-6 py-4 rounded-2xl bg-orange-500 text-white text-sm font-black"
                    >
                      Lihat Paket
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PROMO */}
      <section className="relative z-0 max-w-[1280px] mx-auto px-4 md:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-slate-900">
            Promo Terbaik
          </h2>

          <button className="text-orange-500 font-bold text-sm">
            Lihat Semua
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PROMOS.map((promo, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-[32px] h-[240px] group"
            >
              <img
                src={promo.image}
                alt={promo.title}
                className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/20" />

              <div className="absolute left-6 bottom-6 text-white">
                <div className="text-3xl font-black">
                  {promo.title}
                </div>

                <div className="text-white/80 mt-1">
                  {promo.desc}
                </div>

                <button className="mt-4 px-5 py-3 rounded-2xl bg-orange-500 text-sm font-black">
                  Lihat Promo
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DESTINATION */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 pb-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Destinasi Populer
            </h2>

            <p className="text-slate-500 text-sm mt-1">
              Inspirasi perjalanan terbaik untukmu
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {DESTINATIONS.map((item, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-[28px] aspect-[3/4] cursor-pointer"
            >
              <img
                src={item.image}
                alt={item.city}
                className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

              <div className="absolute bottom-5 left-5 text-white">
                <div className="text-xl font-black">
                  {item.city}
                </div>

                <div className="text-sm text-white/80">
                  Explore Now
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA GUEST */}
      {!isLoggedIn && (
        <section className="relative overflow-hidden bg-slate-900 py-20">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full bg-orange-500 blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-orange-500 blur-[120px]" />
          </div>

          <div className="relative max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-black text-white leading-tight">
              Mulai perjalananmu bersama
              <span className="text-orange-400">
                {' '}
                The Mafia Travel
              </span>
            </h2>

            <p className="mt-5 text-slate-400">
              Dapatkan promo eksklusif dan pengalaman booking yang modern.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <Link
                href="/register"
                className="px-7 py-4 rounded-2xl bg-orange-500 text-white font-black"
              >
                Daftar Sekarang
              </Link>

              <Link
                href="/login"
                className="px-7 py-4 rounded-2xl border border-white/20 text-white font-bold"
              >
                Login
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-12">
          <div className="flex flex-col lg:flex-row justify-between gap-10">
            <div className="max-w-sm">
              <h2 className="text-3xl font-black text-slate-900">
                The <span className="text-orange-500">Mafia</span> Travel
              </h2>

              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Platform perjalanan modern untuk booking tiket pesawat,
                hotel, kereta, dan kebutuhan traveling lainnya.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="font-black text-slate-900 mb-4">
                  Layanan
                </h4>

                <ul className="space-y-2 text-slate-500">
                  <li>Pesawat</li>
                  <li>Hotel</li>
                  <li>Kereta</li>
                  <li>Asuransi</li>
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-4">
                  Perusahaan
                </h4>

                <ul className="space-y-2 text-slate-500">
                  <li>Tentang</li>
                  <li>Karier</li>
                  <li>Partner</li>
                  <li>Press</li>
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-4">
                  Bantuan
                </h4>

                <ul className="space-y-2 text-slate-500">
                  <li>Support</li>
                  <li>Refund</li>
                  <li>Privasi</li>
                  <li>S&K</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
            <p className="text-sm text-slate-400">
              © 2026 The Mafia Travel. All rights reserved.
            </p>

            <div className="flex gap-4 text-slate-400">
              <i className="fa-brands fa-facebook" />
              <i className="fa-brands fa-instagram" />
              <i className="fa-brands fa-twitter" />
              <i className="fa-brands fa-tiktok" />
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}