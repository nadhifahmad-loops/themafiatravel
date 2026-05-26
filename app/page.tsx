'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import Image from 'next/image';

import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import FlightSearchForm from '@/components/flight/FlightSearchForm';
import TrainSearchForm from '@/components/train/TrainSearchForm';
import InsuranceSearchForm from '@/components/insurance/InsuranceSearchForm';

/* ─────────────────────────────────────────────────────────────
   HOTEL MINI FORM
───────────────────────────────────────────────────────────── */
function HotelForm({ onSearch }: { onSearch: () => void }) {
  const [city, setCity] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        {/* Kota */}
        <div className="lg:col-span-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
            Kota / Hotel
          </label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-2xl px-4 py-3 bg-white">
            <i className="fa-solid fa-location-dot text-orange-500 text-sm" />
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Jakarta, Bali..."
              className="flex-1 outline-none bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Checkin */}
        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
            Check-in
          </label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-2xl px-4 py-3 bg-white">
            <i className="fa-regular fa-calendar text-orange-500 text-sm" />
            <input
              type="date"
              value={checkin}
              min={today}
              onChange={e => setCheckin(e.target.value)}
              className="flex-1 outline-none bg-transparent text-sm font-semibold text-slate-800"
            />
          </div>
        </div>

        {/* Checkout */}
        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
            Check-out
          </label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-2xl px-4 py-3 bg-white">
            <i className="fa-regular fa-calendar text-orange-500 text-sm" />
            <input
              type="date"
              value={checkout}
              min={checkin || today}
              onChange={e => setCheckout(e.target.value)}
              className="flex-1 outline-none bg-transparent text-sm font-semibold text-slate-800"
            />
          </div>
        </div>

        {/* Room Guest */}
        <div className="lg:col-span-2 flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
              Kamar
            </label>
            <div className="flex items-center justify-between border border-slate-200 rounded-2xl px-3 py-3 bg-white">
              <button
                onClick={() => setRooms(Math.max(1, rooms - 1))}
                className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold"
              >
                -
              </button>
              <span className="text-sm font-black text-slate-800">{rooms}</span>
              <button
                onClick={() => setRooms(rooms + 1)}
                className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
              Tamu
            </label>
            <div className="flex items-center justify-between border border-slate-200 rounded-2xl px-3 py-3 bg-white">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold"
              >
                -
              </button>
              <span className="text-sm font-black text-slate-800">{guests}</span>
              <button
                onClick={() => setGuests(guests + 1)}
                className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Button */}
        <div className="lg:col-span-2">
          <button
            onClick={onSearch}
            className="w-full h-[50px] rounded-2xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-500/20"
          >
            Cari Hotel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

const DESTINATIONS = [
  {
    name: 'Bali',
    code: 'DPS',
    img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
    tagline: 'Island of the Gods',
    from: 'CGK',
  },
  {
    name: 'Tokyo',
    code: 'NRT',
    img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&q=80',
    tagline: 'Metropolitan',
    from: 'CGK',
  },
  {
    name: 'Singapore',
    code: 'SIN',
    img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80',
    tagline: 'Lion City',
    from: 'CGK',
  },
  {
    name: 'Yogyakarta',
    code: 'JOG',
    img: 'https://images.unsplash.com/photo-1580981568153-81e4a20bf7ec?w=600&q=80',
    tagline: 'Cultural City',
    from: 'CGK',
  },
];

const PROMOS = [
  {
    title: 'Flash Sale Citilink',
    subtitle: 'Diskon hingga 40%',
    label: 'Flash Sale',
    color: 'from-orange-500 to-red-500',
  },
  {
    title: 'Hotel Bintang 5',
    subtitle: 'Mulai Rp 500rb',
    label: 'Best Deal',
    color: 'from-blue-500 to-indigo-600',
  },
];

const TABS = [
  { id: 'flights', label: 'Pesawat', icon: 'fa-plane' },
  { id: 'hotels', label: 'Hotel', icon: 'fa-hotel' },
  { id: 'trains', label: 'Kereta', icon: 'fa-train' },
  { id: 'insurance', label: 'Asuransi', icon: 'fa-shield-halved' },
];

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('flights');
  const isLoggedIn = status === 'authenticated';

  const handleFlightSearch = (payload: any) => {
    const params = new URLSearchParams();

    if (payload.direction === 'Multi') {
      params.set('direction', 'Multi');
      params.set('routes', JSON.stringify(payload.routes));
    } else {
      params.set('origin', payload.origin);
      params.set('destination', payload.destination);

      if (payload.departure_date) {
        params.set('departure_date', payload.departure_date);
      }
      if (payload.return_date) {
        params.set('return_date', payload.return_date);
      }
      params.set('direction', payload.direction ?? 'OW');
    }

    params.set('adult', String(payload.adult ?? 1));
    params.set('child', String(payload.child ?? 0));
    params.set('infant', String(payload.infant ?? 0));
    params.set('cabin_class', payload.cabin_class ?? 'Y');
    params.set('autoSearch', '1');

    router.push(`/flight/search?${params.toString()}`);
  };

  const handleHotelSearch = (city: string) => {
    const params = new URLSearchParams();
    if (city) params.set('q', city);
    router.push(`/hotel/search?${params.toString()}`);
  };

  // Handler yang diubah untuk menerima payload dari TrainSearchForm
  const handleTrainSearch = (payload: any) => {
    const params = new URLSearchParams();

    params.set('direction', payload.direction);
    params.set('adult', String(payload.adult));
    params.set('infant', String(payload.infant));
    params.set('provider', payload.provider);

    if (payload.journey_list && payload.journey_list.length > 0) {
      params.set('origin', payload.journey_list[0].origin);
      params.set('destination', payload.journey_list[0].destination);
      params.set('depart', payload.journey_list[0].departure_date);
      
      // Jika Pulang Pergi (RT), set tanggal kepulangan
      if (payload.direction === 'RT' && payload.journey_list[1]) {
        params.set('return_date', payload.journey_list[1].departure_date);
      }
    }

    router.push(`/train/search?${params.toString()}`);
  };

  const handleInsuranceSearch = (payload: any) => {
    const params = new URLSearchParams();
    params.set('provider',         payload.provider        ?? 'all');
    params.set('destination_area', payload.destination_area ?? 'Asia');
    params.set('date_start',       payload.date_start      ?? '');
    params.set('date_end',         payload.date_end        ?? '');
    params.set('trip_type',        payload.trip_type       ?? 'single_trip');
    params.set('pax',              String(payload.pax      ?? 1));
    params.set('is_senior',        String(payload.is_senior ?? false));
    params.set('autoSearch',       '1');
    router.push(`/insurance/search?${params.toString()}`);
  };

  const quickFlight = (dest: string, origin: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];

    const params = new URLSearchParams({
      origin,
      destination: dest,
      departure_date: date,
      adult: '1',
      child: '0',
      infant: '0',
      cabin_class: 'Y',
      direction: 'OW',
      autoSearch: '1',
    });

    router.push(`/flight/search?${params.toString()}`);
  };

  return (
    <main className="bg-[#f5f7fb] min-h-screen overflow-x-hidden">
      <UnifiedNavbar user={session?.user || null} />

      {/* HERO */}
      <section className="relative pt-28 md:pt-36 pb-14 md:pb-20 overflow-visible">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1800&q=80"
            alt="Hero"
            fill
            priority
            quality={75}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-slate-900/50" />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-8">
          {/* Headline */}
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-[30px] sm:text-[42px] md:text-6xl leading-tight font-black text-white tracking-tight">
              Rencanakan
              <span className="text-orange-500"> Perjalanan </span>
              Impianmu
            </h1>
            <p className="text-white/85 text-sm sm:text-base md:text-lg mt-4 max-w-2xl mx-auto leading-relaxed px-2">
              Pesawat, hotel, kereta, dan asuransi dalam satu platform modern.
            </p>
          </div>

          {/* Search Card */}
          <div className="max-w-5xl mx-auto bg-white/15 backdrop-blur-2xl border border-white/20 rounded-[28px] md:rounded-[36px] shadow-2xl">
            {/* Tabs */}
            <div className="flex overflow-x-auto scrollbar-hide gap-2 p-3 border-b border-white/10">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon} text-xs`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── PEMBUNGKUS UTAMA SEARCH FORM (Z-INDEX 999) ─── */}
            <div className="relative z-[999] w-full p-2 sm:p-3">
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
                <div className="bg-white rounded-[26px] shadow-xl overflow-hidden">
                  <HotelForm onSearch={() => handleHotelSearch('')} />
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
                <Suspense
                  fallback={
                    <div className="h-32 flex items-center justify-center text-white">
                      Loading...
                    </div>
                  }
                >
                  <InsuranceSearchForm
                    onSearch={handleInsuranceSearch}
                    loading={false}
                  />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROMOS (Z-INDEX 0 AGAR TIDAK MENGHALANGI DROPDOWN) ─── */}
      <section className="relative z-0 isolation-auto max-w-[1280px] mx-auto px-4 md:px-8 py-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            Promo Terbaik
          </h2>
          <button className="text-orange-500 text-xs sm:text-sm font-bold">
            Lihat Semua
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROMOS.map((p, i) => (
            <div
              key={i}
              className={`relative z-0 overflow-hidden rounded-3xl bg-gradient-to-br ${p.color} p-5 sm:p-6 text-white shadow-lg`}
            >
              <span className="inline-flex px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-4">
                {p.label}
              </span>
              <h3 className="text-lg sm:text-xl font-black leading-tight">
                {p.title}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {p.subtitle}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 pb-14">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              Destinasi Populer
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Cari tiket lebih cepat
            </p>
          </div>
          <button className="text-orange-500 text-xs sm:text-sm font-bold">
            Semua
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DESTINATIONS.map(d => (
            <button
              key={d.code}
              onClick={() => quickFlight(d.code, d.from)}
              className="group relative overflow-hidden rounded-3xl aspect-[3/4] shadow-md"
            >
              <img
                src={d.img}
                alt={d.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-3 left-3 text-left">
                <div className="text-white font-black text-sm sm:text-base">
                  {d.name}
                </div>
                <div className="text-white/75 text-[10px] sm:text-xs">
                  {d.tagline}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* WHY US */}
      <section className="bg-white border-y border-slate-100 py-14">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <h2 className="text-xl sm:text-2xl font-black text-center text-slate-900 mb-10">
            Kenapa Pilih Kami?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: 'fa-bolt',
                title: 'Booking Cepat',
                desc: 'Konfirmasi instan dalam hitungan detik.',
              },
              {
                icon: 'fa-tag',
                title: 'Harga Terbaik',
                desc: 'Harga transparan tanpa biaya tersembunyi.',
              },
              {
                icon: 'fa-shield-check',
                title: 'Aman',
                desc: 'Data dan transaksi terenkripsi.',
              },
              {
                icon: 'fa-headset',
                title: 'Support 24/7',
                desc: 'Siap membantu kapan saja.',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-5 rounded-3xl hover:bg-orange-50 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
                  <i className={`fa-solid ${f.icon} text-orange-600`} />
                </div>
                <h3 className="font-black text-slate-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!isLoggedIn && (
        <section className="relative overflow-hidden bg-slate-900 py-16">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-orange-500 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-orange-600 rounded-full blur-[120px]" />
          </div>
          <div className="relative max-w-[900px] mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Bergabung dengan
              <span className="text-orange-400"> The Mafia Travel</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
              Nikmati harga eksklusif dan pengalaman booking modern.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
              <Link
                href="/register"
                className="px-7 py-4 rounded-2xl bg-orange-600 text-white text-sm font-black hover:bg-orange-700 transition-all"
              >
                Daftar Gratis
              </Link>
              <Link
                href="/flight/search"
                className="px-7 py-4 rounded-2xl border border-white/20 text-white text-sm font-bold hover:bg-white/10 transition-all"
              >
                Cari Tiket
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-10">
          <div className="flex flex-col lg:flex-row justify-between gap-10 pb-8 border-b border-slate-200">
            {/* Brand */}
            <div className="max-w-sm">
              <h2 className="text-2xl font-black text-slate-900">
                The <span className="text-orange-600">Mafia</span> Travel
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mt-3">
                Platform perjalanan modern untuk pengalaman booking yang cepat,
                aman, dan nyaman.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="font-black text-slate-900 mb-4">
                  Layanan
                </h4>
                <ul className="space-y-2 text-slate-500">
                  {['Pesawat', 'Hotel', 'Kereta', 'Asuransi'].map(s => (
                    <li key={s}>
                      <a href="#" className="hover:text-orange-500 transition-colors">
                        {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-4">
                  Perusahaan
                </h4>
                <ul className="space-y-2 text-slate-500">
                  {['Tentang', 'Karier', 'Partner', 'Press'].map(s => (
                    <li key={s}>
                      <a href="#" className="hover:text-orange-500 transition-colors">
                        {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-4">
                  Bantuan
                </h4>
                <ul className="space-y-2 text-slate-500">
                  {['Support', 'Refund', 'Privasi', 'S&K'].map(s => (
                    <li key={s}>
                      <a href="#" className="hover:text-orange-500 transition-colors">
                        {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
              © 2026 The Mafia Travel. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              {[
                'fa-facebook',
                'fa-instagram',
                'fa-twitter',
                'fa-tiktok',
              ].map(s => (
                <a
                  key={s}
                  href="#"
                  className="hover:text-orange-500 transition-colors"
                >
                  <i className={`fa-brands ${s}`} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}