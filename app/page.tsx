'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, Suspense, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { CalendarRangeField } from '@/components/common/CalendarField';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/flight/FlightSearchForm';
import TrainSearchForm from '@/components/train/TrainSearchForm';
import InsuranceSearchForm from '@/components/insurance/InsuranceSearchForm';
import HotelSearchForm from '@/components/hotel/HotelSearchForm';

/* ─────────────────────────────────────────────────────────────
   ANIMATION HELPERS
───────────────────────────────────────────────────────────── */

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HOTEL MINI FORM
───────────────────────────────────────────────────────────── */
const HOTEL_DESTINATIONS = [
  { id: 'SG7355', label: 'Singapura, SG', city: 'Singapore' },
  { id: 'ID339',  label: 'Jakarta, ID',   city: 'Jakarta' },
  { id: 'ID8731', label: 'Bali, ID',      city: 'Bali' },
  { id: 'ID8732', label: 'Surabaya, ID',  city: 'Surabaya' },
  { id: 'MY5411', label: 'Kuala Lumpur, MY', city: 'Kuala Lumpur' },
  { id: 'TH3299', label: 'Bangkok, TH',   city: 'Bangkok' },
  { id: 'ID8735', label: 'Yogyakarta, ID', city: 'Yogyakarta' },
  { id: 'ID8734', label: 'Bandung, ID',   city: 'Bandung' },
];

interface HotelSearchPayload {
  destination_id: string;
  destination_label: string;
  checkin_date: string;
  checkout_date: string;
  adult: number;
  child: number;
  room: number;
  nationality: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function HotelForm({ onSearch, lang }: { onSearch: (payload: HotelSearchPayload) => void; lang: 'ID' | 'EN' }) {
  const t = i18n.home[lang].hotel;
  const [today]    = useState(() => formatLocalDate(new Date()));
  const [tomorrow] = useState(() => addDaysToDateString(today, 1));

  const PROPERTY_TYPES = [
    { value: 'all', label: lang === 'EN' ? 'All' : 'Semua', icon: 'fa-solid fa-list' },
    { value: 'hotel', label: lang === 'EN' ? 'Hotel' : 'Hotel', icon: 'fa-solid fa-hotel' },
    { value: 'villa', label: lang === 'EN' ? 'Villa' : 'Villa', icon: 'fa-solid fa-house-chimney' },
    { value: 'apartment', label: lang === 'EN' ? 'Apartment' : 'Apartemen', icon: 'fa-solid fa-building' },
  ];

  const [selectedDest, setSelectedDest] = useState(HOTEL_DESTINATIONS[1]);
  const [destInput, setDestInput]       = useState(HOTEL_DESTINATIONS[1].label);
  const [showDrop, setShowDrop]         = useState(false);
  const [dateRange, setDateRange]       = useState<[Date | null, Date | null]>([new Date(), new Date(Date.now() + 86400000)]);
  const [rooms, setRooms]               = useState(1);
  const [guests, setGuests]             = useState(2);
  const [propertyType, setPropertyType] = useState('all');
  const [showPropertyDrop, setShowPropertyDrop] = useState(false);
  const destRef = useRef<HTMLDivElement>(null);
  const propertyRef = useRef<HTMLDivElement>(null);

  const filtered = HOTEL_DESTINATIONS.filter(d =>
    d.label.toLowerCase().includes(destInput.toLowerCase()) ||
    d.city.toLowerCase().includes(destInput.toLowerCase())
  );

  const handleSearch = () => {
    if (!dateRange[0] || !dateRange[1]) {
      alert(lang === 'EN' ? 'Please select check-in and check-out dates' : 'Mohon pilih tanggal check-in dan check-out');
      return;
    }
    onSearch({
      destination_id: selectedDest.id,
      destination_label: selectedDest.label,
      checkin_date: formatLocalDate(dateRange[0]),
      checkout_date: formatLocalDate(dateRange[1]),
      adult: guests,
      child: 0,
      room: rooms,
      nationality: 'ID',
    });
  };

  const calcDestPos = useCallback(() => {
    if (!destRef.current) return;
    const r = destRef.current.getBoundingClientRect();
    return { top: r.bottom + 4, left: r.left, width: r.width };
  }, []);

  const calcPropertyPos = useCallback(() => {
    if (!propertyRef.current) return;
    const r = propertyRef.current.getBoundingClientRect();
    return { top: r.bottom + 4, left: r.left, width: r.width };
  }, []);

  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
        {/* Property Type Filter */}
        <div className="lg:col-span-3 relative" ref={propertyRef}>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-0.5 block">{lang === 'EN' ? 'Property Type' : 'Tipe Properti'}</label>
          <div
            onClick={() => setShowPropertyDrop(!showPropertyDrop)}
            className="flex items-center gap-2 border border-white/30 rounded-lg px-3 py-2 bg-white/50 hover:border-orange-300/50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all duration-200 cursor-pointer"
          >
            <i className={`fa-solid ${PROPERTY_TYPES.find(p => p.value === propertyType)?.icon || 'fa-solid fa-list'} text-orange-500 text-xs shrink-0`} />
            <span className="flex-1 text-sm font-medium text-slate-800 truncate">{PROPERTY_TYPES.find(p => p.value === propertyType)?.label}</span>
            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showPropertyDrop ? 'rotate-180' : ''} text-slate-400`} />
          </div>
          {showPropertyDrop && (
            createPortal(
              <div className="fixed z-[9999] animate-fade-in shadow-2xl">
                <div
                  className="bg-white border border-white/40 rounded-xl overflow-hidden"
                  style={{
                    top: calcPropertyPos()?.top,
                    left: calcPropertyPos()?.left,
                    width: calcPropertyPos()?.width,
                    maxWidth: 280,
                  }}
                >
                  {PROPERTY_TYPES.map(p => (
                    <div
                      key={p.value}
                      onMouseDown={() => { setPropertyType(p.value); setShowPropertyDrop(false); }}
                      className={`px-3 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-2 ${propertyType === p.value ? 'bg-orange-50 text-orange-600' : 'hover:bg-orange-50'}`}
                    >
                      <i className={`${p.icon} text-xs ${propertyType === p.value ? 'text-orange-500' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium text-slate-700">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>,
              document.body
            )
          )}
        </div>

        {/* Destination */}
        <div className="lg:col-span-4 relative" ref={destRef}>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-0.5 block">{t.destination}</label>
          <div
            onClick={() => setShowDrop(true)}
            className="flex items-center gap-2 border border-white/30 rounded-lg px-3 py-2 bg-white/50 hover:border-orange-300/50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all duration-200 cursor-pointer"
          >
            <i className="fa-solid fa-location-dot text-orange-500 text-xs shrink-0" />
            <input
              value={destInput}
              readOnly
              onChange={e => { setDestInput(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              placeholder={t.searchPlaceholder}
              className="flex-1 outline-none bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 cursor-pointer"
            />
          </div>
          {showDrop && filtered.length > 0 && (
            createPortal(
              <div className="fixed z-[9999] animate-fade-in shadow-2xl">
                <div
                  className="bg-white border border-white/40 rounded-xl overflow-hidden"
                  style={{
                    top: calcDestPos()?.top,
                    left: calcDestPos()?.left,
                    width: calcDestPos()?.width,
                    maxWidth: 320,
                  }}
                >
                  {filtered.map(d => (
                    <div
                      key={d.id}
                      onMouseDown={() => { setSelectedDest(d); setDestInput(d.label); setShowDrop(false); }}
                      className="px-3 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-0"
                    >
                      <div className="font-medium text-sm text-slate-700">{d.city}</div>
                      <div className="text-xs text-slate-400">{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>,
              document.body
            )
          )}
        </div>

        {/* Date Range */}
        <div className="lg:col-span-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-0.5 block">Check-in - Check-out</label>
          <CalendarRangeField
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={(r) => setDateRange([r.from, r.to])}
            minDate={new Date()}
            defaultMonth={dateRange[0] ?? undefined}
          >
            <div className="flex items-center gap-2 border border-white/30 rounded-lg px-3 py-2 bg-white/50 hover:border-orange-300/50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all duration-200 cursor-pointer">
              <i className="fa-regular fa-calendar text-orange-500 text-xs shrink-0" />
              <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                {dateRange[0]
                  ? `${format(dateRange[0], 'dd MMM', { locale: dateFnsId })}${dateRange[1] ? ` – ${format(dateRange[1], 'dd MMM yyyy', { locale: dateFnsId })}` : ''}`
                  : (lang === 'EN' ? 'Select dates' : 'Pilih tanggal')}
              </span>
            </div>
          </CalendarRangeField>
        </div>

        {/* Rooms & Guests */}
        <div className="lg:col-span-2 flex gap-1.5">
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-0.5 block">{t.rooms}</label>
            <div className="flex items-center justify-between border border-white/30 rounded-lg px-2 py-2 bg-white/50 hover:border-orange-300/50 transition-all duration-200">
              <button type="button" onClick={() => setRooms(Math.max(1, rooms - 1))} className="w-8 h-8 rounded-full bg-white/60 text-xs font-bold text-slate-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex items-center justify-center">-</button>
              <span className="text-xs font-bold text-slate-800">{rooms}</span>
              <button type="button" onClick={() => setRooms(rooms + 1)} className="w-8 h-8 rounded-full bg-white/60 text-xs font-bold text-slate-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex items-center justify-center">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-0.5 block">{t.guests}</label>
            <div className="flex items-center justify-between border border-white/30 rounded-lg px-2 py-2 bg-white/50 hover:border-orange-300/50 transition-all duration-200">
              <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} className="w-8 h-8 rounded-full bg-white/60 text-xs font-bold text-slate-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex items-center justify-center">-</button>
              <span className="text-xs font-bold text-slate-800">{guests}</span>
              <button type="button" onClick={() => setGuests(guests + 1)} className="w-8 h-8 rounded-full bg-white/60 text-xs font-bold text-slate-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex items-center justify-center">+</button>
            </div>
          </div>
        </div>

        {/* Search Button */}
        <div className="lg:col-span-2">
          <button type="button" onClick={handleSearch} className="w-full h-[42px] rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-95">
            <i className="fa-solid fa-magnifying-glass text-xs" /> {t.searchBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DATA CONSTANTS
───────────────────────────────────────────────────────────── */

const PROMO_BANNERS_ID = {
  Pesawat: [
    { title: 'Jakarta – Yogyakarta',      subtitle: 'Rp 684.400',    img: '/images/domestik/yogyakarta.png', badge: 'Sekali Jalan', dest: 'JOG', airline: 'Batik Air',       airlineImg: '/images/airlines/batik.png',       date: '18 Okt 2026' },
    { title: 'Jakarta – Surabaya',        subtitle: 'Rp 876.800',    img: '/images/domestik/surabaya.png',  badge: 'Sekali Jalan', dest: 'SUB', airline: 'Garuda Indonesia', airlineImg: '/images/airlines/garuda.png',      date: '25 Okt 2026' },
    { title: 'Jakarta – Bali / Denpasar', subtitle: 'Rp 1.240.900',  img: '/images/domestik/bali.png',      badge: 'Sekali Jalan', dest: 'DPS', airline: 'Super Air Jet',   airlineImg: '/images/airlines/superairjet.png', date: '18 Okt 2026' },
    { title: 'Jakarta – Medan',           subtitle: 'Rp 1.294.400',  img: '/images/domestik/medan.png',     badge: 'Sekali Jalan', dest: 'KNO', airline: 'Citilink',        airlineImg: '/images/airlines/citilink.png',    date: '15 Nov 2026' },
    { title: 'Jakarta – Lombok',          subtitle: 'Rp 850.000',    img: '/images/domestik/lombok.png',    badge: 'Sekali Jalan', dest: 'LOP', airline: 'AirAsia',         airlineImg: '/images/airlines/airasia.png',     date: '2 Nov 2026' },
  ],
  Hotel: [
    { title: 'Hotel Bali Mewah',     subtitle: 'Rp 750.000/malam',   img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80', badge: 'Bintang 5', dest: 'ID8731', q: 'Bali', city: 'Bali', date: '18 Okt 2026' },
    { title: 'Resort Lombok',        subtitle: 'Rp 450.000/malam',   img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80', badge: 'Best Value', dest: 'ID8731', q: 'Bali', city: 'Lombok', date: '25 Okt 2026' },
    { title: 'Hotel Jakarta Pusat',  subtitle: 'Rp 380.000/malam',   img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80', badge: 'Flash Sale', dest: 'ID339', q: 'Jakarta', city: 'Jakarta', date: '2 Nov 2026' },
    { title: 'Villa Ubud',           subtitle: 'Rp 1.200.000/malam', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80', badge: 'Pilihan Editor', dest: 'ID8731', q: 'Bali', city: 'Ubud', date: '9 Nov 2026' },
  ],
  Kereta: [
    { title: 'Jakarta – Surabaya',      subtitle: 'Rp 180.000', img: '/images/domestik/surabaya.png', badge: 'Eksekutif', origin: 'GMR', destination: 'SGU', date: '18 Okt 2026' },
    { title: 'Bandung – Yogyakarta',    subtitle: 'Rp 120.000', img: '/images/domestik/yogyakarta.png', badge: 'Populer', origin: 'BD', destination: 'YK', date: '22 Okt 2026' },
    { title: 'Jakarta – Bandung',       subtitle: 'Rp 75.000',  img: '/images/domestik/bandung.png', badge: 'Harian', origin: 'GMR', destination: 'BD', date: '2 Nov 2026' },
  ],
};

const PROMO_BANNERS_EN = {
  Pesawat: [
    { title: 'Jakarta – Yogyakarta',      subtitle: 'Rp 684,400',   img: '/images/domestik/yogyakarta.png', badge: 'One Way', dest: 'JOG', airline: 'Batik Air',       airlineImg: '/images/airlines/batik.png',       date: '18 Oct 2026' },
    { title: 'Jakarta – Surabaya',        subtitle: 'Rp 876,800',   img: '/images/domestik/surabaya.png',  badge: 'One Way', dest: 'SUB', airline: 'Garuda Indonesia', airlineImg: '/images/airlines/garuda.png',      date: '25 Oct 2026' },
    { title: 'Jakarta – Bali / Denpasar', subtitle: 'Rp 1,240,900', img: '/images/domestik/bali.png',      badge: 'One Way', dest: 'DPS', airline: 'Super Air Jet',   airlineImg: '/images/airlines/superairjet.png', date: '18 Oct 2026' },
    { title: 'Jakarta – Medan',           subtitle: 'Rp 1,294,400', img: '/images/domestik/medan.png',     badge: 'One Way', dest: 'KNO', airline: 'Citilink',        airlineImg: '/images/airlines/citilink.png',    date: '15 Nov 2026' },
    { title: 'Jakarta – Lombok',          subtitle: 'Rp 850,000',   img: '/images/domestik/lombok.png',    badge: 'One Way', dest: 'LOP', airline: 'AirAsia',         airlineImg: '/images/airlines/airasia.png',     date: '2 Nov 2026' },
  ],
  Hotel: [
    { title: 'Luxury Bali Hotel',     subtitle: 'Rp 750,000/night',   img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80', badge: '5 Stars', dest: 'ID8731', q: 'Bali', city: 'Bali', date: '18 Oct 2026' },
    { title: 'Lombok Resort',         subtitle: 'Rp 450,000/night',   img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80', badge: 'Best Value', dest: 'ID8731', q: 'Bali', city: 'Lombok', date: '25 Oct 2026' },
    { title: 'Central Jakarta Hotel', subtitle: 'Rp 380,000/night',   img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80', badge: 'Flash Sale', dest: 'ID339', q: 'Jakarta', city: 'Jakarta', date: '2 Nov 2026' },
    { title: 'Ubud Villa',            subtitle: 'Rp 1,200,000/night', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80', badge: "Editor's Pick", dest: 'ID8731', q: 'Bali', city: 'Ubud', date: '9 Nov 2026' },
  ],
  Kereta: [
    { title: 'Jakarta – Surabaya',   subtitle: 'Rp 180,000', img: '/images/domestik/surabaya.png', badge: 'Executive', origin: 'GMR', destination: 'SGU', date: '18 Oct 2026' },
    { title: 'Bandung – Yogyakarta', subtitle: 'Rp 120,000', img: '/images/domestik/yogyakarta.png', badge: 'Popular', origin: 'BD', destination: 'YK', date: '22 Oct 2026' },
    { title: 'Jakarta – Bandung',    subtitle: 'Rp 75,000',  img: '/images/domestik/bandung.png', badge: 'Daily', origin: 'GMR', destination: 'BD', date: '2 Nov 2026' },
  ],
};

type SEO_LINK = { label: string; type: 'flight' | 'hotel'; origin?: string; dest: string };

const SEO_LINKS_ID: Record<string, SEO_LINK[]> = {
  'Penerbangan Populer': [
    { label: 'Jakarta – Bali', type: 'flight', origin: 'CGK', dest: 'DPS' },
    { label: 'Jakarta – Surabaya', type: 'flight', origin: 'CGK', dest: 'SUB' },
    { label: 'Jakarta – Yogyakarta', type: 'flight', origin: 'CGK', dest: 'JOG' },
    { label: 'Jakarta – Medan', type: 'flight', origin: 'CGK', dest: 'KNO' },
    { label: 'Surabaya – Bali', type: 'flight', origin: 'SUB', dest: 'DPS' },
    { label: 'Bandung – Bali', type: 'flight', origin: 'BDO', dest: 'DPS' },
    { label: 'Jakarta – Makassar', type: 'flight', origin: 'CGK', dest: 'UPG' },
    { label: 'Bali – Lombok', type: 'flight', origin: 'DPS', dest: 'LOP' },
    { label: 'Jakarta – Lombok', type: 'flight', origin: 'CGK', dest: 'LOP' },
    { label: 'Surabaya – Makassar', type: 'flight', origin: 'SUB', dest: 'UPG' },
  ],
  'Hotel Teratas': [
    { label: 'Hotel Bali', type: 'hotel', dest: 'ID8731' },
    { label: 'Hotel Jakarta', type: 'hotel', dest: 'ID339' },
    { label: 'Hotel Bandung', type: 'hotel', dest: 'ID8734' },
    { label: 'Hotel Yogyakarta', type: 'hotel', dest: 'ID8735' },
    { label: 'Hotel Surabaya', type: 'hotel', dest: 'ID8732' },
    { label: 'Hotel Lombok', type: 'hotel', dest: 'ID8731' },
    { label: 'Hotel Medan', type: 'hotel', dest: 'ID339' },
    { label: 'Hotel Makassar', type: 'hotel', dest: 'ID8732' },
    { label: 'Hotel Singapura', type: 'hotel', dest: 'SG7355' },
    { label: 'Hotel Kuala Lumpur', type: 'hotel', dest: 'MY5411' },
  ],
  'Aktivitas Populer': [
    { label: 'Wisata Bali', type: 'flight', origin: 'CGK', dest: 'DPS' },
    { label: 'Tour Yogyakarta', type: 'flight', origin: 'CGK', dest: 'JOG' },
    { label: 'Snorkeling Lombok', type: 'flight', origin: 'CGK', dest: 'LOP' },
    { label: 'Hiking Bromo', type: 'flight', origin: 'CGK', dest: 'SUB' },
    { label: 'City Tour Jakarta', type: 'hotel', dest: 'ID339' },
    { label: 'Rafting Citarik', type: 'flight', origin: 'CGK', dest: 'BDO' },
    { label: 'Sunset Komodo', type: 'flight', origin: 'CGK', dest: 'LBJ' },
    { label: 'Surfing Kuta', type: 'flight', origin: 'CGK', dest: 'DPS' },
    { label: 'Diving Bunaken', type: 'flight', origin: 'CGK', dest: 'MDC' },
    { label: 'Trekking Rinjani', type: 'flight', origin: 'CGK', dest: 'LOP' },
  ],
  'Destinasi Internasional': [
    { label: 'Wisata Singapura', type: 'flight', origin: 'CGK', dest: 'SIN' },
    { label: 'Tour Jepang', type: 'flight', origin: 'CGK', dest: 'NRT' },
    { label: 'Liburan Korea', type: 'flight', origin: 'CGK', dest: 'ICN' },
    { label: 'Wisata Thailand', type: 'flight', origin: 'CGK', dest: 'BKK' },
    { label: 'Tour Malaysia', type: 'flight', origin: 'CGK', dest: 'KUL' },
    { label: 'Wisata Hong Kong', type: 'flight', origin: 'CGK', dest: 'HKG' },
    { label: 'Tour Australia', type: 'flight', origin: 'CGK', dest: 'SYD' },
    { label: 'Wisata Dubai', type: 'flight', origin: 'CGK', dest: 'DXB' },
    { label: 'Tour Eropa', type: 'flight', origin: 'CGK', dest: 'CDG' },
    { label: 'Wisata Turki', type: 'flight', origin: 'CGK', dest: 'IST' },
  ],
};

const SEO_LINKS_EN: Record<string, SEO_LINK[]> = {
  'Popular Flights': [
    { label: 'Jakarta – Bali', type: 'flight', origin: 'CGK', dest: 'DPS' },
    { label: 'Jakarta – Surabaya', type: 'flight', origin: 'CGK', dest: 'SUB' },
    { label: 'Jakarta – Yogyakarta', type: 'flight', origin: 'CGK', dest: 'JOG' },
    { label: 'Jakarta – Medan', type: 'flight', origin: 'CGK', dest: 'KNO' },
    { label: 'Surabaya – Bali', type: 'flight', origin: 'SUB', dest: 'DPS' },
    { label: 'Bandung – Bali', type: 'flight', origin: 'BDO', dest: 'DPS' },
    { label: 'Jakarta – Makassar', type: 'flight', origin: 'CGK', dest: 'UPG' },
    { label: 'Bali – Lombok', type: 'flight', origin: 'DPS', dest: 'LOP' },
    { label: 'Jakarta – Lombok', type: 'flight', origin: 'CGK', dest: 'LOP' },
    { label: 'Surabaya – Makassar', type: 'flight', origin: 'SUB', dest: 'UPG' },
  ],
  'Top Hotels': [
    { label: 'Hotels in Bali', type: 'hotel', dest: 'ID8731' },
    { label: 'Hotels in Jakarta', type: 'hotel', dest: 'ID339' },
    { label: 'Hotels in Bandung', type: 'hotel', dest: 'ID8734' },
    { label: 'Hotels in Yogyakarta', type: 'hotel', dest: 'ID8735' },
    { label: 'Hotels in Surabaya', type: 'hotel', dest: 'ID8732' },
    { label: 'Hotels in Lombok', type: 'hotel', dest: 'ID8731' },
    { label: 'Hotels in Medan', type: 'hotel', dest: 'ID339' },
    { label: 'Hotels in Makassar', type: 'hotel', dest: 'ID8732' },
    { label: 'Hotels in Singapore', type: 'hotel', dest: 'SG7355' },
    { label: 'Hotels in Kuala Lumpur', type: 'hotel', dest: 'MY5411' },
  ],
  'Popular Activities': [
    { label: 'Bali Tourism', type: 'flight', origin: 'CGK', dest: 'DPS' },
    { label: 'Yogyakarta Tour', type: 'flight', origin: 'CGK', dest: 'JOG' },
    { label: 'Lombok Snorkeling', type: 'flight', origin: 'CGK', dest: 'LOP' },
    { label: 'Bromo Hiking', type: 'flight', origin: 'CGK', dest: 'SUB' },
    { label: 'Jakarta City Tour', type: 'hotel', dest: 'ID339' },
    { label: 'Citarik Rafting', type: 'flight', origin: 'CGK', dest: 'BDO' },
    { label: 'Komodo Sunset', type: 'flight', origin: 'CGK', dest: 'LBJ' },
    { label: 'Kuta Surfing', type: 'flight', origin: 'CGK', dest: 'DPS' },
    { label: 'Bunaken Diving', type: 'flight', origin: 'CGK', dest: 'MDC' },
    { label: 'Rinjani Trekking', type: 'flight', origin: 'CGK', dest: 'LOP' },
  ],
  'International Destinations': [
    { label: 'Singapore Tourism', type: 'flight', origin: 'CGK', dest: 'SIN' },
    { label: 'Japan Tour', type: 'flight', origin: 'CGK', dest: 'NRT' },
    { label: 'Korea Holiday', type: 'flight', origin: 'CGK', dest: 'ICN' },
    { label: 'Thailand Tourism', type: 'flight', origin: 'CGK', dest: 'BKK' },
    { label: 'Malaysia Tour', type: 'flight', origin: 'CGK', dest: 'KUL' },
    { label: 'Hong Kong Tourism', type: 'flight', origin: 'CGK', dest: 'HKG' },
    { label: 'Australia Tour', type: 'flight', origin: 'CGK', dest: 'SYD' },
    { label: 'Dubai Tourism', type: 'flight', origin: 'CGK', dest: 'DXB' },
    { label: 'Europe Tour', type: 'flight', origin: 'CGK', dest: 'CDG' },
    { label: 'Turkey Tourism', type: 'flight', origin: 'CGK', dest: 'IST' },
  ],
};

const MARQUEE_ID = [
  { icon: 'fa-plane', label: 'Pesawat' },
  { icon: 'fa-hotel', label: 'Hotel' },
  { icon: 'fa-train', label: 'Kereta' },
  { icon: 'fa-shield-halved', label: 'Asuransi' },
  { icon: 'fa-lock', label: 'Pembayaran Aman' },
  { icon: 'fa-headset', label: 'Support 24/7' },
  { icon: 'fa-globe', label: '100+ Destinasi' },
  { icon: 'fa-wallet', label: 'Banyak Metode Bayar' },
];
const MARQUEE_EN = [
  { icon: 'fa-plane', label: 'Flights' },
  { icon: 'fa-hotel', label: 'Hotels' },
  { icon: 'fa-train', label: 'Trains' },
  { icon: 'fa-shield-halved', label: 'Insurance' },
  { icon: 'fa-lock', label: 'Secure Payment' },
  { icon: 'fa-headset', label: '24/7 Support' },
  { icon: 'fa-globe', label: '100+ Destinations' },
  { icon: 'fa-wallet', label: 'Many Payment Options' },
];

// Baris kartu promo horizontal dengan panah bulat mengambang
function PromoScrollRow({ children, prevLabel, nextLabel }: { children: React.ReactNode; prevLabel: string; nextLabel: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const update = () => {
    const el = rowRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
    setOverflow(el.scrollWidth > el.clientWidth + 8);
  };
  useEffect(() => {
    update();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrollBy = (dir: 1 | -1) => rowRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  return (
    <div className="relative">
      <div ref={rowRef} onScroll={update} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 scroll-smooth snap-x snap-mandatory">
        {children}
      </div>
      {overflow && !atStart && (
        <button onClick={() => scrollBy(-1)} aria-label={prevLabel}
          className="hidden sm:flex absolute left-[-10px] top-[75px] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-brand-blue hover:border-brand-blue transition-all">
          <i className="fa-solid fa-chevron-left text-xs" />
        </button>
      )}
      {overflow && !atEnd && (
        <button onClick={() => scrollBy(1)} aria-label={nextLabel}
          className="hidden sm:flex absolute right-[-10px] top-[75px] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-brand-blue hover:border-brand-blue transition-all">
          <i className="fa-solid fa-chevron-right text-xs" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const { language } = useLanguage();
  const location = useLocation();

  usePageTitle(null);

  const t = i18n.home[language];
  const isEN = language === 'EN';

  // ─── Personalisasi konten sesuai lokasi user (hanya bagian "asal") ───
  // Dipasang setelah mount agar SSR & client-render pertama identik (anti hydration error).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const gpsAirport  = mounted ? location.nearestAirport : null;
  const gpsStation  = mounted ? location.nearestStation : null;
  const flightOrigin = gpsAirport?.code || 'CGK';
  const trainOrigin  = gpsStation?.code || 'GMR';
  const isIDUser     = !!gpsAirport && gpsAirport.country === 'ID';
  const originLabel  = gpsAirport?.city || gpsAirport?.code || 'Jakarta';
  // Origin pesawat yang aman utk kartu domestik (hindari asal == tujuan & hanya utk user di Indonesia)
  const flightFrom = (dest: string): string => (isIDUser && flightOrigin !== dest ? flightOrigin : 'CGK');
  // Link pesawat SEO ber-awal Jakarta → disesuaikan dgn lokasi user (hanya bagian "asal")
  const personalizeFlight = (origin?: string, dest?: string) =>
    isIDUser && (!origin || origin === 'CGK') && flightOrigin !== dest;
  const seoFlightLabel = (label: string, origin?: string, dest?: string) =>
    personalizeFlight(origin, dest) ? label.replace(/^Jakarta/, originLabel) : label;
  const seoFlightOrigin = (origin?: string, dest?: string) =>
    personalizeFlight(origin, dest) ? flightOrigin : (origin || 'CGK');

  // Personalisasi kartu kereta yang berangkat dari Jakarta (GMR)
  const STATION_CITY: Record<string, string> = {
    GMR: 'Jakarta', PSE: 'Jakarta', JAKK: 'Jakarta', JNG: 'Jakarta', BKS: 'Bekasi', CKR: 'Cikarang',
    DP: 'Depok', BOO: 'Bogor', BD: 'Bandung', CMI: 'Cimahi', YK: 'Yogyakarta', LPN: 'Yogyakarta',
    SLO: 'Solo', PWS: 'Solo', SMT: 'Semarang', SMC: 'Semarang', SGU: 'Surabaya', SBI: 'Surabaya',
    ML: 'Malang', PWT: 'Purwokerto', TGU: 'Medan',
  };
  const trainFromFor = (origin: string | undefined, dest: string | undefined) =>
    (origin === 'GMR' && trainOrigin && trainOrigin !== 'GMR' && trainOrigin !== dest)
      ? trainOrigin
      : (origin || 'GMR');
  const trainLabelFor = (origin: string | undefined, dest: string | undefined, title: string) =>
    origin === 'GMR' && trainOrigin && trainOrigin !== 'GMR' && trainOrigin !== dest
      ? title.replace(/^Jakarta/, STATION_CITY[trainOrigin] || trainOrigin)
      : title;

  // ISO date helpers untuk redirect pencarian otomatis
  const todayISO = formatLocalDate(new Date());
  const tomorrowISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  })();
  const weekAfterISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatLocalDate(d);
  })();

  const SEARCH_TABS = [
    { id: 'flights',   label: t.tabs.flights,   icon: 'fa-plane',          color: 'text-blue-400', activeColor: 'text-blue-500' },
    { id: 'hotels',    label: t.tabs.hotels,    icon: 'fa-bed',            color: 'text-amber-400', activeColor: 'text-amber-500' },
    { id: 'trains',    label: t.tabs.trains,    icon: 'fa-train',          color: 'text-emerald-400', activeColor: 'text-emerald-500' },
    { id: 'insurance', label: t.tabs.insurance, icon: 'fa-plane-circle-check',  color: 'text-violet-400', activeColor: 'text-violet-500' },
  ];

  const PROMO_BANNERS   = isEN ? PROMO_BANNERS_EN : PROMO_BANNERS_ID;

  const SEO_LINKS = isEN ? SEO_LINKS_EN : SEO_LINKS_ID;

  const [activeTab, setActiveTab]             = useState('flights');
  const [isSearching, setIsSearching]         = useState(false);

  useEffect(() => {
    setIsSearching(false);
  }, [pathname]);

  const isLoggedIn = status === 'authenticated';

  /* ── HANDLERS ── */
  const handleFlightSearch = (payload: any) => {
    setIsSearching(true);
    const params = new URLSearchParams();
    if (payload.direction === 'Multi') {
      params.set('direction', 'Multi');
      params.set('routes', JSON.stringify(payload.routes));
    } else {
      params.set('origin', payload.origin);
      params.set('destination', payload.destination);
      if (payload.departure_date) params.set('departure_date', payload.departure_date);
      if (payload.return_date)    params.set('return_date', payload.return_date);
      params.set('direction', payload.direction ?? 'OW');
    }
    params.set('adult',       String(payload.adult ?? 1));
    params.set('child',       String(payload.child ?? 0));
    params.set('infant',      String(payload.infant ?? 0));
    params.set('cabin_class', payload.cabin_class ?? 'Y');
    params.set('autoSearch',  '1');
    router.push(`/flight/search?${params.toString()}`);
  };

  const handleHotelSearch = (payload: any) => {
    setIsSearching(true);
    const params = new URLSearchParams({
      destination_id: payload.destination_id || '',
      q:              payload.q || '',
      checkin_date:   payload.checkin_date || '',
      checkout_date:  payload.checkout_date || '',
      adult:          String(payload.adult || 2),
      child:          String(payload.child || 0),
      room:           String(payload.room || 1),
      nationality:    payload.nationality || 'ID',
    });
    if (payload.child_ages?.length) params.set('child_ages', JSON.stringify(payload.child_ages));
    router.push(`/hotel/search?${params.toString()}`);
  };

  const handleTrainSearch = (payload: any) => {
    setIsSearching(true);
    const params = new URLSearchParams();
    params.set('direction', payload.direction);
    params.set('adult',     String(payload.adult));
    params.set('infant',    String(payload.infant));
    params.set('provider',  payload.provider);
    if (payload.journey_list?.length) {
      params.set('origin',      payload.journey_list[0].origin);
      params.set('destination', payload.journey_list[0].destination);
      params.set('departure_date', payload.journey_list[0].departure_date);
      params.set('depart',      payload.journey_list[0].departure_date);
      if (payload.direction === 'RT' && payload.journey_list[1])
        params.set('return_date', payload.journey_list[1].departure_date);
    }
    router.push(`/train/search?${params.toString()}`);
  };

  const handleInsuranceSearch = (payload: any) => {
    setIsSearching(true);
    const params = new URLSearchParams();
    params.set('provider',         payload.provider         ?? 'all');
    params.set('destination',      payload.destination      ?? '');
    params.set('destination_area', payload.destination_area ?? 'Asia');
    params.set('international',    String(payload.international ?? true));
    params.set('date_start',       payload.date_start       ?? '');
    params.set('date_end',         payload.date_end         ?? '');
    params.set('trip_type',        payload.trip_type        ?? 'single_trip');
    params.set('pax',              String(payload.pax       ?? 1));
    params.set('adult',            String(payload.adult     ?? payload.pax ?? 1));
    params.set('child',            String(payload.child     ?? 0));
    params.set('is_senior',        String(payload.is_senior ?? false));
    params.set('autoSearch',       '1');
    router.push(`/insurance/search?${params.toString()}`);
  };

  const quickFlight = (dest: string, origin: string = 'CGK') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
    const params = new URLSearchParams({ origin, destination: dest, departure_date: date, adult: '1', child: '0', infant: '0', cabin_class: 'Y', direction: 'OW', autoSearch: '1' });
    router.push(`/flight/search?${params.toString()}`);
  };

  const isFlightTab  = (tab: string) => tab === 'Pesawat' || tab === 'Flights';
  const isHotelTab   = (tab: string) => tab === 'Hotel'   || tab === 'Hotels';

  const handlePromoClick = (p: any, tab: string) => {
    if (isFlightTab(tab)) {
      quickFlight(p.dest || 'DPS', flightFrom(p.dest || 'DPS'));
    } else if (isHotelTab(tab)) {
      const params = new URLSearchParams({
        destination_id: p.dest || 'ID8731',
        q: p.q || '',
        checkin_date: todayISO,
        checkout_date: tomorrowISO,
        adult: '2', child: '0', room: '1', nationality: 'ID',
      });
      router.push(`/hotel/search?${params.toString()}`);
    } else {
      const params = new URLSearchParams({
        origin: trainFromFor(p.origin, p.destination),
        destination: p.destination || 'BD',
        depart: tomorrowISO,
        adult: '1', infant: '0', direction: 'OW', provider: 'kai',
      });
      router.push(`/train/search?${params.toString()}`);
    }
  };

  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const copyCoupon = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch {}
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  };

  const couponRowRef = useRef<HTMLDivElement>(null);
  const scrollCoupon = (dir: number) => {
    if (!couponRowRef.current) return;
    const scrollAmount = couponRowRef.current.offsetWidth * 0.75;
    couponRowRef.current.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
  };

  // Status scroll baris kupon — tombol "sebelumnya" hanya muncul setelah digeser
  const [couponAtStart, setCouponAtStart] = useState(true);
  const handleCouponScroll = () => {
    const el = couponRowRef.current;
    if (el) setCouponAtStart(el.scrollLeft <= 8);
  };

  const fallbackBg = '/images/background.jpg';

  // ─── Kupon dinamis dari database ───
  interface DbCoupon { id: number; code: string; name: string; description: string | null; type: string; value: number; category: string; minOrderAmount: number; maxDiscount: number | null; isFeatured: boolean; }
  const [dbCoupons, setDbCoupons] = useState<DbCoupon[]>([]);
  useEffect(() => {
    fetch('/api/coupons/active?limit=10')
      .then(r => r.json())
      .then(d => setDbCoupons(d.coupons || []))
      .catch(() => {});
  }, []);

  const couponCategoryLabel = (c: DbCoupon) => {
    const map: Record<string, Record<string, string>> = {
      ID: { flight: 'Pesawat', hotel: 'Hotel', train: 'Kereta', insurance: 'Asuransi', transfer: 'Transfer', activity: 'Aktivitas', all: 'Semua' },
      EN: { flight: 'Flights', hotel: 'Hotels', train: 'Trains', insurance: 'Insurance', transfer: 'Transfer', activity: 'Activities', all: 'All' },
    };
    return (map[language] || map.ID)[c.category] || c.category;
  };

  const couponLabel = (c: DbCoupon) => {
    if (c.type === 'percentage') return `${c.value}%`;
    return `Rp${c.value.toLocaleString('id-ID')}`;
  };

  // Ikon & warna lingkaran kategori kartu kupon (mengikuti gaya Traveloka)
  const couponCategoryStyle = (c: DbCoupon): { icon: string; bg: string } => {
    const map: Record<string, { icon: string; bg: string }> = {
      flight:    { icon: 'fa-plane',          bg: 'bg-blue-500' },
      hotel:     { icon: 'fa-hotel',          bg: 'bg-blue-600' },
      train:     { icon: 'fa-train',          bg: 'bg-indigo-500' },
      insurance: { icon: 'fa-shield-halved',  bg: 'bg-violet-500' },
      transfer:  { icon: 'fa-car',            bg: 'bg-teal-500' },
      activity:  { icon: 'fa-ticket',         bg: 'bg-rose-500' },
      all:       { icon: 'fa-percent',        bg: 'bg-slate-500' },
    };
    return map[c.category] || map.all;
  };

  // Baris kedua kartu: deskripsi kupon, fallback ke kondisi (min. belanja / kategori)
  const couponSubtitle = (c: DbCoupon) => {
    if (c.description) return c.description;
    if (c.minOrderAmount > 0) return isEN ? `Min. order Rp${c.minOrderAmount.toLocaleString('id-ID')}` : `Min. belanja Rp${c.minOrderAmount.toLocaleString('id-ID')}`;
    return isEN ? `Valid for ${couponCategoryLabel(c)} bookings` : `Berlaku untuk pemesanan ${couponCategoryLabel(c)}`;
  };

  // ─── Popup izin lokasi ───
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showLocationToast, setShowLocationToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('mafia_location_prompt_dismissed')) return;
    setShowLocationPrompt(true);
  }, []);

  useEffect(() => {
    if (location.status === 'granted' || location.status === 'denied' || location.status === 'unavailable') {
      setShowLocationPrompt(false);
      setShowLocationToast(true);
      const timer = setTimeout(() => setShowLocationToast(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.status]);

  const dismissLocationPrompt = () => {
    setShowLocationPrompt(false);
    try { sessionStorage.setItem('mafia_location_prompt_dismissed', '1'); } catch {}
  };

  const seoGo = (l: SEO_LINK) => {
    if (l.type === 'flight') {
      quickFlight(l.dest, seoFlightOrigin(l.origin, l.dest));
    } else {
      const params = new URLSearchParams({
        destination_id: l.dest,
        q: '',
        checkin_date: todayISO,
        checkout_date: tomorrowISO,
        adult: '2', child: '0', room: '1', nationality: 'ID',
      });
      router.push(`/hotel/search?${params.toString()}`);
    }
  };

  const loadingText = isEN ? 'Loading...' : 'Memuat form...';


  return (
    <main className="bg-brand-bgLight min-h-screen">
      <UnifiedNavbar user={session?.user || null} transparent />

      {/* ══════════════════════════════════════════════════════
          1. HERO SECTION
      ══════════════════════════════════════════════════════ */}
      <section className="relative z-10 pt-[120px] md:pt-[132px] pb-12 md:pb-16">
        {/* Full-bleed background image (membelakangi navbar) + overlay gelap */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <Image
            src={fallbackBg}
            alt="Hero background"
            fill
            priority
            quality={75}
            className="object-cover object-center animate-kenburns"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/45" />
        </div>

        {/* Headline — rata tengah, putih, di atas kartu search */}
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto text-center text-2xl sm:text-3xl lg:text-[30px] font-extrabold text-white leading-[1.12] tracking-tight lg:whitespace-nowrap"
          >
            {isEN
              ? 'Explore the World, Make Your Dream Trip Come True'
              : 'Jelajahi Dunia, Wujudkan Impian Perjalananmu'}
          </motion.h1>
        </div>

        {/* Search widget — di tengah, di atas foto */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-8 mt-8 md:mt-11"
        >
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-floating border border-slate-100/80 p-4 sm:p-6 transition-all">
            {/* Category tabs */}
            <div className="flex items-center gap-2 pb-5 border-b border-slate-100 overflow-x-auto scrollbar-hide">
              {SEARCH_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold shrink-0 transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-brand-neutral'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon} text-xs ${activeTab === tab.id ? '' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search forms */}
            <div className="pt-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {activeTab === 'flights' && (
                    <Suspense fallback={<div className="h-32 flex items-center justify-center text-slate-400 text-sm">{loadingText}</div>}>
                      <FlightSearchForm onSearch={handleFlightSearch} loading={isSearching} variant="light" />
                    </Suspense>
                  )}
                  {activeTab === 'hotels' && (
                    <Suspense fallback={<div className="h-32 flex items-center justify-center text-slate-400 text-sm">{loadingText}</div>}>
                      <HotelSearchForm onSearch={handleHotelSearch} loading={isSearching} variant="light" />
                    </Suspense>
                  )}
                  {activeTab === 'trains' && (
                    <Suspense fallback={<div className="h-32 flex items-center justify-center text-slate-400 text-sm">{loadingText}</div>}>
                      <TrainSearchForm onSearch={handleTrainSearch} loading={isSearching} variant="light" />
                    </Suspense>
                  )}
                  {activeTab === 'insurance' && (
                    <Suspense fallback={<div className="h-32 flex items-center justify-center text-slate-400 text-sm">{loadingText}</div>}>
                      <InsuranceSearchForm onSearch={handleInsuranceSearch} loading={isSearching} variant="light" />
                    </Suspense>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </section>


      {/* ══════════════════════════════════════════════════════
          2. KUPON PENGGUNA BARU
      ══════════════════════════════════════════════════════ */}
      {dbCoupons.length > 0 && (
      <section className="relative z-0 bg-brand-bgLight pt-6 md:pt-8 pb-6">
        <Reveal delay={0.08} className="max-w-[1280px] mx-auto px-4 md:px-8">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-brand-ink">
              {isEN ? 'New User Coupons' : 'Kupon Pengguna Baru'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isEN ? 'Available for your first booking' : 'Tersedia untuk pemesanan pertama Anda'}
            </p>
          </div>

          {/* Coupon strip */}
          <div className="relative">
            <div ref={couponRowRef} onScroll={handleCouponScroll} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory">
              {dbCoupons.map((c) => (
                <div key={c.id} onClick={() => copyCoupon(c.code)}
                  className="flex-none w-[calc((100%-1rem)/3)] min-w-[220px] snap-start bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(15,23,42,0.05)] cursor-pointer relative overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white ${couponCategoryStyle(c).bg}`}>
                        <i className={`fa-solid ${couponCategoryStyle(c).icon} text-xs`} />
                      </span>
                      <p className="flex-1 min-w-0 text-[13px] font-bold text-slate-800 truncate" title={`${couponLabel(c)} — ${c.name}`}>
                        {isEN ? `Discount ${couponLabel(c)} — ${c.name}` : `Diskon ${couponLabel(c)} — ${c.name}`}
                      </p>
                      <i className="fa-solid fa-circle-info text-slate-300 text-sm shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 pl-11 truncate">{couponSubtitle(c)}</p>
                  </div>

                  {/* Pemisah tiket (putus-putus) + lubang notch di kedua tepi */}
                  <div className="relative">
                    <div className="border-t border-dashed border-slate-200" />
                    <span className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-brand-bgLight" />
                    <span className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-full bg-brand-bgLight" />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <i className="fa-regular fa-copy" />
                      <code className="tracking-wider">{c.code}</code>
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">{couponCategoryLabel(c)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tombol carousel mengambang di tepi baris */}
            {dbCoupons.length > 3 && (
              <>
                {!couponAtStart && (
                  <button onClick={() => scrollCoupon(-1)} aria-label={isEN ? 'Previous coupons' : 'Kupon sebelumnya'}
                    className="hidden sm:flex absolute left-[-10px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-brand-blue hover:border-brand-blue transition-all">
                    <i className="fa-solid fa-chevron-left text-xs" />
                  </button>
                )}
                <button onClick={() => scrollCoupon(1)} aria-label={isEN ? 'Next coupons' : 'Kupon berikutnya'}
                  className="hidden sm:flex absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-brand-blue hover:border-brand-blue transition-all">
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
              </>
            )}
          </div>
        </Reveal>
      </section>
      )}

      {/* ══════════════════════════════════════════════════════
          4. PROMO TIKET PESAWAT (baris kartu + panah)
      ══════════════════════════════════════════════════════ */}
      <section id="promo" className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <Reveal className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
            {isEN ? 'Flight Promos' : 'Promo Tiket Pesawat'}
          </h2>
          <button type="button" onClick={() => router.push('/flight/search')} aria-label={isEN ? 'Search flights' : 'Cari tiket pesawat'}
            className="text-slate-400 hover:text-brand-blue transition-colors">
            <i className="fa-solid fa-chevron-right text-sm" />
          </button>
        </Reveal>

        <PromoScrollRow prevLabel={isEN ? 'Previous promos' : 'Promo sebelumnya'} nextLabel={isEN ? 'Next promos' : 'Promo berikutnya'}>
          {PROMO_BANNERS.Pesawat.map((p, i) => (
            <div
              key={i}
              onClick={() => handlePromoClick(p, 'Pesawat')}
              className="flex-none w-[240px] sm:w-[280px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer snap-start"
            >
              <div className="relative overflow-hidden h-[150px]">
                <img src={p.img} alt={p.title} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">{p.badge}</span>
              </div>
              <div className="px-3 pt-2.5 pb-3">
                <p className="text-sm font-bold text-slate-900 leading-snug truncate" title={p.title}>{p.title}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <img src={p.airlineImg} alt={p.airline} title={p.airline} className="w-4 h-4 object-contain shrink-0" />
                  <span className="text-xs text-slate-400 truncate">{p.date}</span>
                </div>
                <p className="text-brand-orange font-extrabold text-sm mt-1.5">{p.subtitle}</p>
              </div>
            </div>
          ))}
        </PromoScrollRow>
      </section>

      {/* ══════════════════════════════════════════════════════
          5. PROMO HOTEL
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <Reveal className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
            {isEN ? 'Hotel Promos' : 'Promo Hotel'}
          </h2>
          <button type="button" onClick={() => router.push('/hotel/search')} aria-label={isEN ? 'Search hotels' : 'Cari hotel'}
            className="text-slate-400 hover:text-brand-blue transition-colors">
            <i className="fa-solid fa-chevron-right text-sm" />
          </button>
        </Reveal>

        <PromoScrollRow prevLabel={isEN ? 'Previous promos' : 'Promo sebelumnya'} nextLabel={isEN ? 'Next promos' : 'Promo berikutnya'}>
          {PROMO_BANNERS.Hotel.map((p, i) => (
            <div
              key={i}
              onClick={() => handlePromoClick(p, 'Hotel')}
              className="flex-none w-[240px] sm:w-[280px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer snap-start"
            >
              <div className="relative overflow-hidden h-[150px]">
                <img src={p.img} alt={p.title} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <i className="fa-solid fa-location-dot text-[10px]" />
                  {p.city}
                </span>
              </div>
              <div className="px-3 pt-2.5 pb-3">
                <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2" title={p.title}>{p.title}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <i className="fa-solid fa-calendar-check text-[11px] text-slate-400" />
                  <span className="text-xs text-slate-400 truncate">{p.date}</span>
                </div>
                <p className="text-brand-orange font-extrabold text-sm mt-1.5">{p.subtitle}</p>
              </div>
            </div>
          ))}
        </PromoScrollRow>
      </section>

      {/* ══════════════════════════════════════════════════════
          6. PROMO TIKET KERETA
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <Reveal className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
            {isEN ? 'Train Promos' : 'Promo Tiket Kereta'}
          </h2>
          <button type="button" onClick={() => router.push('/train/search')} aria-label={isEN ? 'Search trains' : 'Cari tiket kereta'}
            className="text-slate-400 hover:text-brand-blue transition-colors">
            <i className="fa-solid fa-chevron-right text-sm" />
          </button>
        </Reveal>

        <PromoScrollRow prevLabel={isEN ? 'Previous promos' : 'Promo sebelumnya'} nextLabel={isEN ? 'Next promos' : 'Promo berikutnya'}>
          {PROMO_BANNERS.Kereta.map((p, i) => (
            <div
              key={i}
              onClick={() => handlePromoClick(p, 'Kereta')}
              className="flex-none w-[240px] sm:w-[280px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer snap-start"
            >
              <div className="relative overflow-hidden h-[150px]">
                <img src={p.img} alt={p.title} onError={(e) => { e.currentTarget.src = '/images/train.jpg'; }} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">{p.badge}</span>
              </div>
              <div className="px-3 pt-2.5 pb-3">
                <p className="text-sm font-bold text-slate-900 leading-snug truncate" title={trainLabelFor(p.origin, p.destination, p.title)}>{trainLabelFor(p.origin, p.destination, p.title)}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <i className="fa-solid fa-train text-[11px] text-slate-400" />
                  <span className="text-xs text-slate-400 truncate">{p.date}</span>
                </div>
                <p className="text-brand-orange font-extrabold text-sm mt-1.5">{p.subtitle}</p>
              </div>
            </div>
          ))}
        </PromoScrollRow>
      </section>

      {/* ══════════════════════════════════════════════════════
          7. SEO LINK FARM
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-100 py-10">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {Object.entries(SEO_LINKS).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-xs font-black text-brand-ink uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">{category}</h4>
                <ul className="space-y-1.5">
                  {(links as SEO_LINK[]).map(link => (
                    <li key={link.label}>
                      <button onClick={() => seoGo(link)} className="text-xs text-slate-500 hover:text-brand-orange transition-colors leading-relaxed text-left">
                        {link.type === 'flight' ? seoFlightLabel(link.label, link.origin, link.dest) : link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA REGISTER (if not logged in)
      ══════════════════════════════════════════════════════ */}
      {!isLoggedIn && (
        <Reveal className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80" alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-slate-900/90" />
          </div>
          <div className="relative max-w-[700px] mx-auto px-4 text-center py-16">
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
              {isEN ? 'Ready to Explore?' : 'Siap Jelajahi Dunia?'}
            </h2>
            <p className="text-white/70 text-sm mt-3 leading-relaxed max-w-lg mx-auto">
              {isEN
                ? 'Create a free account and get access to exclusive deals, discount coupons, and a seamless booking experience.'
                : 'Buat akun gratis dan dapatkan akses ke promo eksklusif, kupon diskon, dan pengalaman booking yang mudah.'}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-3.5 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-orange-700 transition-all shadow-lg shadow-brand-orange/30"
              >
                {isEN ? 'Search Tickets' : 'Cari Tiket'}
              </button>
              <Link href="/register" className="px-8 py-3.5 rounded-xl border border-white/25 text-white text-sm font-bold hover:bg-white/10 transition-all">
                {isEN ? 'Register Free' : 'Daftar Gratis'}
              </Link>
            </div>
          </div>
        </Reveal>
      )}

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <Footer />

      {/* ══════════════════════════════════════════════════════
          POPUP IZIN LOKASI
      ══════════════════════════════════════════════════════ */}
      {showLocationPrompt &&
        !location.nearestAirport &&
        !location.nearestStation &&
        (location.status === 'idle' || location.status === 'requesting') && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={dismissLocationPrompt} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 animate-fade-up">
            {location.status === 'requesting' ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <span className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></span>
                <div>
                  <h3 className="font-black text-brand-ink text-lg">{isEN ? 'Detecting location...' : 'Mendeteksi lokasi...'}</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {isEN ? 'This only takes a moment.' : 'Sebentar, cuma butuh beberapa detik.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
                  <i className="fa-solid fa-location-crosshairs text-orange-500 text-xl animate-pulse"></i>
                </div>
                <h3 className="font-black text-brand-ink text-lg leading-snug">
                  {isEN ? 'Allow location access?' : 'Izinkan akses lokasi?'}
                </h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  {isEN
                    ? 'We\'ll automatically fill in the nearest airport & train station as your departure point.'
                    : 'Kami akan mengisi otomatis bandara & stasiun terdekat sebagai titik keberangkatan Anda.'}
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={location.requestLocation}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-orange-600/25 transition-all active:scale-95"
                  >
                    {isEN ? 'Allow' : 'Izinkan'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissLocationPrompt}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-3 rounded-xl transition-all active:scale-95"
                  >
                    {isEN ? 'Not now' : 'Nanti'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast notifikasi hasil lokasi */}
      {showLocationToast && location.status === 'granted' && location.nearestAirport && (
        <div className="fixed bottom-6 right-6 z-[999] bg-white rounded-2xl shadow-2xl border border-emerald-200 p-4 pr-5 flex items-center gap-3 max-w-xs animate-fade-up">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-check text-emerald-600"></i>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-brand-ink">
              {isEN ? 'Departure detected' : 'Asal terdeteksi'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {location.nearestAirport.name} ({location.nearestAirport.code})
            </p>
          </div>
          <button type="button" aria-label="Tutup" onClick={() => setShowLocationToast(false)} className="text-slate-300 hover:text-slate-500 ml-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {showLocationToast && (location.status === 'denied' || location.status === 'unavailable') && (
        <div className="fixed bottom-6 right-6 z-[999] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 pr-5 flex items-center gap-3 max-w-xs animate-fade-up">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-location-crosshairs text-slate-400"></i>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-brand-ink">
              {isEN ? 'Location unavailable' : 'Lokasi tidak diizinkan'}
            </p>
            <p className="text-xs text-slate-500">
              {isEN ? 'You can still choose your departure manually.' : 'Asal tetap bisa Anda pilih manual.'}
            </p>
          </div>
          <button type="button" aria-label="Tutup" onClick={() => setShowLocationToast(false)} className="text-slate-300 hover:text-slate-500 ml-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          COPIED TOAST
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCopiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[900] bg-slate-800 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2"
          >
            <i className="fa-solid fa-check-circle text-emerald-400"></i>
            {isEN ? 'Coupon code copied!' : 'Kode kupon tersalin!'}
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}