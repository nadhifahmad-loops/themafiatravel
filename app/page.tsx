'use client';

import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, Suspense, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import { id as localeId } from 'date-fns/locale';
registerLocale('id', localeId);
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';

import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import Footer from '@/components/layout/Footer';
import SupportWidget from '@/components/layout/SupportWidget';
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
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-0.5 block">{lang === 'EN' ? 'Check-in - Check-out' : 'Check-in - Check-out'}</label>
          <div className="flex items-center gap-2 border border-white/30 rounded-lg px-3 py-2 bg-white/50 hover:border-orange-300/50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all duration-200">
            <i className="fa-regular fa-calendar text-orange-500 text-xs shrink-0" />
            <DatePicker
              selectsRange
              startDate={dateRange[0]}
              endDate={dateRange[1]}
              onChange={setDateRange}
              minDate={new Date()}
              className="flex-1 outline-none bg-transparent text-sm font-medium text-slate-800"
              dateFormat="dd MMM yyyy"
              placeholderText={lang === 'EN' ? 'Select dates' : 'Pilih tanggal'}
              locale={lang === 'EN' ? undefined : localeId}
            />
          </div>
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
    { title: 'Travel to South Korea', subtitle: 'Mulai Rp 2.499.000', img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=500&q=80', badge: 'Hemat 35%', dest: 'ICN' },
    { title: 'Travel to Malaysia',    subtitle: 'Mulai Rp 899.000',   img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=500&q=80', badge: 'Promo Spesial', dest: 'KUL' },
    { title: 'Travel to Singapore',   subtitle: 'Mulai Rp 1.199.000', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=500&q=80', badge: 'Terlaris', dest: 'SIN' },
    { title: 'Travel to Bali',        subtitle: 'Mulai Rp 599.000',   img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80', badge: 'Domestik', dest: 'DPS' },
    { title: 'Travel to New Zealand', subtitle: 'Mulai Rp 6.799.000', img: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=500&q=80', badge: 'Impian', dest: 'AKL' },
  ],
  Hotel: [
    { title: 'Hotel Bali Mewah',     subtitle: 'Mulai Rp 750.000/malam',   img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80', badge: 'Bintang 5', dest: 'ID8731', q: 'Bali' },
    { title: 'Resort Lombok',        subtitle: 'Mulai Rp 450.000/malam',   img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80', badge: 'Best Value', dest: 'ID8731', q: 'Bali' },
    { title: 'Hotel Jakarta Pusat',  subtitle: 'Mulai Rp 380.000/malam',   img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80', badge: 'Flash Sale', dest: 'ID339', q: 'Jakarta' },
    { title: 'Villa Ubud',           subtitle: 'Mulai Rp 1.200.000/malam', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80', badge: 'Pilihan Editor', dest: 'ID8731', q: 'Bali' },
  ],
  Kereta: [
    { title: 'Jakarta – Surabaya',      subtitle: 'Mulai Rp 180.000', img: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=500&q=80', badge: 'Eksekutif', origin: 'GMR', destination: 'SGU' },
    { title: 'Bandung – Yogyakarta',    subtitle: 'Mulai Rp 120.000', img: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=500&q=80', badge: 'Populer', origin: 'BD', destination: 'YK' },
    { title: 'Jakarta – Bandung',       subtitle: 'Mulai Rp 75.000',  img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&q=80', badge: 'Harian', origin: 'GMR', destination: 'BD' },
  ],
};

const PROMO_BANNERS_EN = {
  Flights: [
    { title: 'Travel to South Korea', subtitle: 'From Rp 2,499,000', img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=500&q=80', badge: 'Save 35%', dest: 'ICN' },
    { title: 'Travel to Malaysia',    subtitle: 'From Rp 899,000',   img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=500&q=80', badge: 'Special Promo', dest: 'KUL' },
    { title: 'Travel to Singapore',   subtitle: 'From Rp 1,199,000', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=500&q=80', badge: 'Best Seller', dest: 'SIN' },
    { title: 'Travel to Bali',        subtitle: 'From Rp 599,000',   img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80', badge: 'Domestic', dest: 'DPS' },
    { title: 'Travel to New Zealand', subtitle: 'From Rp 6,799,000', img: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=500&q=80', badge: 'Dream Trip', dest: 'AKL' },
  ],
  Hotels: [
    { title: 'Luxury Bali Hotel',     subtitle: 'From Rp 750,000/night',   img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80', badge: '5 Stars', dest: 'ID8731', q: 'Bali' },
    { title: 'Lombok Resort',         subtitle: 'From Rp 450,000/night',   img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80', badge: 'Best Value', dest: 'ID8731', q: 'Bali' },
    { title: 'Central Jakarta Hotel', subtitle: 'From Rp 380,000/night',   img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80', badge: 'Flash Sale', dest: 'ID339', q: 'Jakarta' },
    { title: 'Ubud Villa',            subtitle: 'From Rp 1,200,000/night', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80', badge: "Editor's Pick", dest: 'ID8731', q: 'Bali' },
  ],
  Trains: [
    { title: 'Jakarta – Surabaya',   subtitle: 'From Rp 180,000', img: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=500&q=80', badge: 'Executive', origin: 'GMR', destination: 'SGU' },
    { title: 'Bandung – Yogyakarta', subtitle: 'From Rp 120,000', img: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=500&q=80', badge: 'Popular', origin: 'BD', destination: 'YK' },
    { title: 'Jakarta – Bandung',    subtitle: 'From Rp 75,000',  img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&q=80', badge: 'Daily', origin: 'GMR', destination: 'BD' },
  ],
};

const ASIA_DESTINATIONS = [
  { name: 'Singapura',    nameEN: 'Singapore',     code: 'SIN', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80', price: 'Rp 1.100.000',  priceEN: 'Rp 1.100.000' },
  { name: 'Malaysia',     nameEN: 'Malaysia',       code: 'KUL', img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&q=80', price: 'Rp 899.000', priceEN: 'Rp 899.000' },
  { name: 'Thailand',     nameEN: 'Thailand',       code: 'BKK', img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80', price: 'Rp 1.300.000',  priceEN: 'Rp 1.300.000' },
  { name: 'Korea Selatan',nameEN: 'South Korea',    code: 'ICN', img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=600&q=80', price: 'Rp 2.400.000',  priceEN: 'Rp 2.400.000' },
  { name: 'Jepang',       nameEN: 'Japan',          code: 'NRT', img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&q=80', price: 'Rp 3.100.000',  priceEN: 'Rp 3.100.000' },
  { name: 'Hong Kong',    nameEN: 'Hong Kong',      code: 'HKG', img: 'https://images.unsplash.com/photo-1506970845246-18f21d533b20?w=600&q=80', price: 'Rp 1.800.000',  priceEN: 'Rp 1.800.000' },
];

const ASIA_DESTINATIONS_BADGES_ID = ['Favorit Wisatawan', 'Termurah', 'Eksotis', 'Top Rated', 'Best Seller', 'City Trip'];
const ASIA_DESTINATIONS_BADGES_EN = ['Top Pick', 'Best Value', 'Exotic', 'Top Rated', 'Best Seller', 'City Trip'];
const ASIA_DESTINATIONS_BADGE_CLASS = [
  'bg-white/90 text-brand-ink',
  'bg-brand-forest text-white',
  'bg-brand-cream text-brand-ink',
  'bg-brand-blue text-white',
  'bg-white/90 text-brand-ink',
  'bg-brand-orange text-white',
];

const DOMESTIC_CITIES = ['Bali', 'Medan', 'Surabaya', 'Yogyakarta', 'Palembang', 'Lombok', 'Balikpapan', 'Jakarta'];

const DOMESTIC_BADGE: Record<string, { id: string; en: string; color: string }> = {
  Bali:         { id: 'HEMAT', en: 'SAVE', color: 'bg-brand-orange' },
  Medan:        { id: 'PROMO', en: 'PROMO', color: 'bg-brand-blue' },
  Surabaya:     { id: 'PROMO', en: 'PROMO', color: 'bg-brand-blue' },
  Yogyakarta:   { id: 'HEMAT', en: 'SAVE', color: 'bg-brand-orange' },
  Palembang:    { id: 'HEMAT', en: 'SAVE', color: 'bg-brand-orange' },
  Lombok:       { id: 'HEMAT', en: 'SAVE', color: 'bg-brand-orange' },
  Balikpapan:   { id: 'PROMO', en: 'PROMO', color: 'bg-brand-blue' },
  Jakarta:      { id: 'PROMO', en: 'PROMO', color: 'bg-brand-blue' },
};

const DOMESTIC_FLIGHTS: Record<string, { route: string; routeEN: string; dest: string; origin?: string; price: string; img: string }[]> = {
  Bali: [
    { route: 'Jakarta – Bali / Denpasar', routeEN: 'Jakarta – Bali / Denpasar', dest: 'DPS', origin: 'CGK', price: 'Rp 1.239.200', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=75' },
    { route: 'Surabaya – Bali / Denpasar', routeEN: 'Surabaya – Bali / Denpasar', dest: 'DPS', origin: 'SUB', price: 'Rp 890.000', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=75' },
    { route: 'Yogyakarta – Bali / Denpasar', routeEN: 'Yogyakarta – Bali / Denpasar', dest: 'DPS', origin: 'JOG', price: 'Rp 950.000', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=75' },
    { route: 'Bandung – Bali / Denpasar', routeEN: 'Bandung – Bali / Denpasar', dest: 'DPS', origin: 'BDG', price: 'Rp 1.100.000', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=75' },
  ],
  Medan: [
    { route: 'Jakarta – Medan / Kualanamu', routeEN: 'Jakarta – Medan / Kualanamu', dest: 'KNO', origin: 'CGK', price: 'Rp 989.000', img: '/images/domestik/medan.png' },
    { route: 'Surabaya – Medan / Kualanamu', routeEN: 'Surabaya – Medan / Kualanamu', dest: 'KNO', origin: 'SUB', price: 'Rp 1.050.000', img: '/images/domestik/medan.png' },
    { route: 'Yogyakarta – Medan / Kualanamu', routeEN: 'Yogyakarta – Medan / Kualanamu', dest: 'KNO', origin: 'JOG', price: 'Rp 980.000', img: '/images/domestik/medan.png' },
  ],
  Surabaya: [
    { route: 'Jakarta – Surabaya / Juanda', routeEN: 'Jakarta – Surabaya / Juanda', dest: 'SUB', origin: 'CGK', price: 'Rp 550.000', img: '/images/domestik/surabaya.png' },
    { route: 'Bandung – Surabaya / Juanda', routeEN: 'Bandung – Surabaya / Juanda', dest: 'SUB', origin: 'BDG', price: 'Rp 580.000', img: '/images/domestik/surabaya.png' },
    { route: 'Yogyakarta – Surabaya / Juanda', routeEN: 'Yogyakarta – Surabaya / Juanda', dest: 'SUB', origin: 'JOG', price: 'Rp 420.000', img: '/images/domestik/surabaya.png' },
  ],
  Yogyakarta: [
    { route: 'Jakarta – Yogyakarta / Adisutjipto', routeEN: 'Jakarta – Yogyakarta / Adisutjipto', dest: 'JOG', origin: 'CGK', price: 'Rp 480.000', img: '/images/domestik/yogyakarta.png' },
    { route: 'Surabaya – Yogyakarta / Adisutjipto', routeEN: 'Surabaya – Yogyakarta / Adisutjipto', dest: 'JOG', origin: 'SUB', price: 'Rp 350.000', img: '/images/domestik/yogyakarta.png' },
    { route: 'Bandung – Yogyakarta / Adisutjipto', routeEN: 'Bandung – Yogyakarta / Adisutjipto', dest: 'JOG', origin: 'BDG', price: 'Rp 520.000', img: '/images/domestik/yogyakarta.png' },
  ],
  Palembang: [
    { route: 'Jakarta – Palembang / SMB II', routeEN: 'Jakarta – Palembang / SMB II', dest: 'PLM', origin: 'CGK', price: 'Rp 430.000', img: '/images/domestik/palembang.png' },
    { route: 'Surabaya – Palembang / SMB II', routeEN: 'Surabaya – Palembang / SMB II', dest: 'PLM', origin: 'SUB', price: 'Rp 490.000', img: '/images/domestik/palembang.png' },
  ],
  Lombok: [
    { route: 'Jakarta – Lombok / Praya', routeEN: 'Jakarta – Lombok / Praya', dest: 'LOP', origin: 'CGK', price: 'Rp 850.000', img: '/images/domestik/lombok.png' },
    { route: 'Surabaya – Lombok / Praya', routeEN: 'Surabaya – Lombok / Praya', dest: 'LOP', origin: 'SUB', price: 'Rp 650.000', img: '/images/domestik/lombok.png' },
    { route: 'Yogyakarta – Lombok / Praya', routeEN: 'Yogyakarta – Lombok / Praya', dest: 'LOP', origin: 'JOG', price: 'Rp 720.000', img: '/images/domestik/lombok.png' },
  ],
  Balikpapan: [
    { route: 'Jakarta – Balikpapan / SAMS', routeEN: 'Jakarta – Balikpapan / SAMS', dest: 'BPN', origin: 'CGK', price: 'Rp 750.000', img: '/images/domestik/balikpapan.png' },
    { route: 'Surabaya – Balikpapan / SAMS', routeEN: 'Surabaya – Balikpapan / SAMS', dest: 'BPN', origin: 'SUB', price: 'Rp 780.000', img: '/images/domestik/balikpapan.png' },
  ],
  Jakarta: [
    { route: 'Bali – Jakarta / Soetta',     routeEN: 'Bali – Jakarta / Soetta',     dest: 'CGK', origin: 'DPS', price: 'Rp 620.000', img: '/images/domestik/jakarta.png' },
    { route: 'Surabaya – Jakarta / Soetta', routeEN: 'Surabaya – Jakarta / Soetta', dest: 'CGK', origin: 'SUB', price: 'Rp 540.000', img: '/images/domestik/jakarta.png' },
    { route: 'Yogyakarta – Jakarta / Soetta', routeEN: 'Yogyakarta – Jakarta / Soetta', dest: 'CGK', origin: 'JOG', price: 'Rp 380.000', img: '/images/domestik/jakarta.png' },
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

const FEATURES = [
  { icon: 'fa-bolt', color: 'bg-brand-orange/10 text-brand-orange', ring: 'group-hover:bg-orange-500' },
  { icon: 'fa-tags', color: 'bg-brand-blue/10 text-brand-blue', ring: 'group-hover:bg-blue-500' },
  { icon: 'fa-shield-halved', color: 'bg-brand-forest/10 text-brand-forest', ring: 'group-hover:bg-emerald-500' },
  { icon: 'fa-headset', color: 'bg-brand-blue/10 text-brand-blue', ring: 'group-hover:bg-blue-500' },
];

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

  const PROMO_TABS_ID   = ['Pesawat', 'Hotel', 'Kereta'];
  const PROMO_TABS_EN   = ['Flights', 'Hotels', 'Trains'];
  const PROMO_TABS      = isEN ? PROMO_TABS_EN : PROMO_TABS_ID;
  const PROMO_BANNERS   = isEN ? PROMO_BANNERS_EN : PROMO_BANNERS_ID;

  const SEO_LINKS = isEN ? SEO_LINKS_EN : SEO_LINKS_ID;

  const [activeTab, setActiveTab]             = useState('flights');
  const [isSearching, setIsSearching]         = useState(false);
  const [activePromoTab, setActivePromoTab]   = useState(PROMO_TABS[0]);
  const [activeDomesticCity, setActiveDomesticCity] = useState('Bali');

  // Reset promo tab when language changes
  useEffect(() => {
    setActivePromoTab(PROMO_TABS[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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
    params.set('destination_area', payload.destination_area ?? 'Asia');
    params.set('date_start',       payload.date_start       ?? '');
    params.set('date_end',         payload.date_end         ?? '');
    params.set('trip_type',        payload.trip_type        ?? 'single_trip');
    params.set('pax',              String(payload.pax       ?? 1));
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

  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const copyCoupon = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch {}
    setCopiedCoupon(code);
    setShowCopiedToast(true);
    setTimeout(() => { setCopiedCoupon(null); setShowCopiedToast(false); }, 2000);
  };

  const couponRowRef = useRef<HTMLDivElement>(null);
  const scrollCoupon = (dir: number) => {
    if (!couponRowRef.current) return;
    const scrollAmount = couponRowRef.current.offsetWidth * 0.75;
    couponRowRef.current.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
  };

  const fallbackBg = '/images/background.jpg';
  const [favIds, setFavIds] = useState<string[]>([]);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const toggleFav = (code: string) => {
    if (!session) {
      setShowLoginPopup(true);
      return;
    }
    setFavIds(prev => (prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]));
  };

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

  const tomorrowLabel = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(isEN ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  const loadingText = isEN ? 'Loading...' : 'Memuat form...';

  // ─── Carousel & back-to-top ───
  const promoRowRef = useRef<HTMLDivElement>(null);
  const scrollPromo = (dir: 1 | -1) => {
    promoRowRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };


  return (
    <main className="bg-brand-bgLight min-h-screen">
      <UnifiedNavbar user={session?.user || null} />

      {/* ══════════════════════════════════════════════════════
          1. HERO SECTION
      ══════════════════════════════════════════════════════ */}
      <section className="relative z-10 pt-[120px] md:pt-[132px] pb-16 md:pb-20 overflow-visible">
        {/* Hero card */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="relative rounded-3xl md:rounded-[36px] overflow-hidden min-h-[400px] md:min-h-[520px] flex flex-col justify-between p-6 sm:p-10 lg:p-14 shadow-floating bg-slate-900">
            {/* Background cover image & overlay */}
            <div className="absolute inset-0 z-0">
              <Image
                src={fallbackBg}
                alt="Hero background"
                fill
                priority
                quality={75}
                className="object-cover object-center animate-kenburns"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent lg:max-w-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent" />
            </div>

            {/* Headline */}
            <div className="relative z-10 max-w-2xl pt-4">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/25 mb-4 backdrop-blur-sm"
              >
                <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-brand-blue">
                  {isEN ? 'Explore Indonesia & the World' : 'Jelajahi Indonesia & Dunia'}
                </span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-3xl sm:text-4xl lg:text-[48px] font-extrabold text-brand-ink leading-[1.12] tracking-tight"
              >
                {isEN ? (
                  <>Explore the World, Make Your <span className="text-brand-orange">Dream Trip</span> Come True</>
                ) : (
                  <>Jelajahi Dunia, Wujudkan <span className="text-brand-orange">Impian Perjalananmu</span></>
                )}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-4 text-base sm:text-lg text-brand-neutral max-w-xl font-medium leading-relaxed"
              >
                {isEN
                  ? 'Flights, hotels, trains & insurance — transparent best prices, instant booking & friendly 24/7 support.'
                  : 'Pesawat, hotel, kereta & asuransi — harga transparan terbaik, reservasi instan & dukungan ramah 24/7.'}
              </motion.p>
            </div>
            <div className="hidden lg:block h-20"></div>
          </div>
        </div>

        {/* Floating search widget */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="max-w-[1280px] mx-auto px-4 md:px-8 -mt-10 md:-mt-20 relative z-20"
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

        {/* Trust badges */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 mt-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-card">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-bolt text-brand-blue text-lg"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-ink">{isEN ? 'Fast & Easy Booking' : 'Booking Cepat & Mudah'}</h4>
                <p className="text-xs text-brand-neutral mt-0.5">{isEN ? 'Instant ticket & hotel voucher confirmation' : 'Konfirmasi instan tiket & voucher hotel'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-card">
              <div className="w-12 h-12 rounded-xl bg-brand-forest/10 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-shield-halved text-brand-forest text-lg"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-ink">{isEN ? '100% Secure Transactions' : 'Transaksi 100% Aman'}</h4>
                <p className="text-xs text-brand-neutral mt-0.5">{isEN ? 'Trusted encryption & refund guarantee' : 'Enkripsi terpercaya & garansi refund'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-card">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-tags text-brand-orange text-lg"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-ink">{isEN ? 'Best Price Guarantee' : 'Jaminan Harga Terbaik'}</h4>
                <p className="text-xs text-brand-neutral mt-0.5">{isEN ? 'Exclusive promos with no hidden fees' : 'Promo eksklusif tanpa biaya tersembunyi'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          2. KUPON EKSTRA
      ══════════════════════════════════════════════════════ */}
      <section className="relative z-0 bg-brand-bgLight pt-0 pb-6">
        {/* Coupon strip */}
        {dbCoupons.length > 0 && (
        <Reveal delay={0.08} className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-ticket text-brand-orange text-sm" />
              <h3 className="text-sm font-black text-brand-ink">
                {isEN ? 'Active Discount Coupons' : 'Kupon Diskon Aktif'}
              </h3>
            </div>
            {dbCoupons.length > 3 && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => scrollCoupon(-1)} className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all">
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <button onClick={() => scrollCoupon(1)} className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all">
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
              </div>
            )}
          </div>
          <div ref={couponRowRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory">
            {dbCoupons.map((c) => (
              <div key={c.id} onClick={() => copyCoupon(c.code)} className="flex-none w-[calc((100%-1rem)/3)] min-w-[180px] snap-start bg-white border border-dashed border-orange-300 rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-orange-500 hover:shadow-md transition-all group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-orange-50 rounded-bl-full group-hover:scale-125 transition-transform" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded-full">{couponCategoryLabel(c)}</span>
                  <span className="text-[11px] font-black text-orange-700">{couponLabel(c)}</span>
                </div>
                <p className="text-xs font-semibold text-slate-700 mt-2 mb-3 leading-snug">{c.name}</p>
                <div className="flex items-center justify-between">
                  <code className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{c.code}</code>
                  <span className="text-orange-500 text-[11px] font-black uppercase">
                    {copiedCoupon === c.code ? (isEN ? 'Copied!' : 'Tersalin!') : (isEN ? 'Copy' : 'Salin')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        )}

      </section>

      {/* ══════════════════════════════════════════════════════
          4. PROMO TERBAIK (carousel + arrow)
      ══════════════════════════════════════════════════════ */}
      <section id="promo" className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <Reveal className="mb-4">
          <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
            {isEN ? 'Best Promos for This Holiday!' : 'Promo Terbaik buat Liburan Ini!'}
          </h2>
        </Reveal>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {PROMO_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActivePromoTab(tab)}
              className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                activePromoTab === tab
                  ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <div ref={promoRowRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 scroll-smooth snap-x snap-mandatory">
            {((PROMO_BANNERS as any)[activePromoTab] || []).map((p: any, i: number) => (
              <div
                key={i}
                onClick={() => handlePromoClick(p, activePromoTab)}
                className="flex-none w-[200px] sm:w-[230px] bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group snap-start"
              >
                <div className="relative overflow-hidden h-[120px]">
                  <img src={p.img} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <span className="absolute top-2 left-2 bg-orange-500 text-white text-[11px] font-black px-2 py-1 rounded-full">{p.badge}</span>
                </div>
                <div className="p-3">
                  <p className="font-black text-slate-800 text-sm leading-snug">
                    {isFlightTab(activePromoTab) || isHotelTab(activePromoTab)
                      ? p.title
                      : trainLabelFor(p.origin, p.destination, p.title)}
                </p>
                <p className="text-orange-600 font-bold text-xs mt-1">{p.subtitle}</p>
              </div>
            </div>
          ))}
          </div>
          {/* Thin arrows — mobile only */}
          <button
            onClick={() => promoRowRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-orange-500 sm:hidden transition-colors"
          >
            <i className="fa-solid fa-chevron-left text-lg" />
          </button>
          <button
            onClick={() => promoRowRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-orange-500 sm:hidden transition-colors"
          >
            <i className="fa-solid fa-chevron-right text-lg" />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          5. DESTINASI INTERNASIONAL
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <Reveal className="flex items-center justify-between mb-6">
          <div>
            <span className="text-xs font-bold text-brand-blue uppercase tracking-widest block mb-1">
              {isEN ? 'Explore Destinations' : 'Eksplor Destinasi'}
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
              {isEN ? 'Discover What You Love Across Asia and Beyond' : 'Temukan yang kamu suka di Asia hingga dunia'}
            </h2>
            <p className="text-brand-neutral text-xs sm:text-sm mt-1">
              {isEN ? `Click a destination to search flights from ${originLabel}` : `Klik destinasi untuk langsung cari tiket dari ${originLabel}`}
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {ASIA_DESTINATIONS.map((d, i) => (
            <Reveal key={d.code} delay={i * 0.06}>
              <div
                onClick={() => quickFlight(d.code, flightOrigin)}
                className="group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 w-full text-left cursor-pointer flex flex-col"
                aria-label={isEN ? d.nameEN : d.name}
              >
                <div className="relative h-52 sm:h-56 overflow-hidden">
                  <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className={`absolute top-3.5 left-3.5 ${ASIA_DESTINATIONS_BADGE_CLASS[i]} text-xs font-bold px-3 py-1 rounded-full shadow-sm`}>
                    {isEN ? ASIA_DESTINATIONS_BADGES_EN[i] : ASIA_DESTINATIONS_BADGES_ID[i]}
                  </span>
                  <button
                    type="button"
                    aria-label={isEN ? 'Save to favorites' : 'Simpan ke favorit'}
                    onClick={(e) => { e.stopPropagation(); toggleFav(d.code); }}
                    className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-slate-700 flex items-center justify-center transition-colors shadow-sm"
                  >
                    <i className={`fa-solid fa-heart text-sm ${favIds.includes(d.code) ? 'text-rose-500' : 'text-slate-400'}`}></i>
                  </button>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-brand-ink group-hover:text-brand-blue transition-colors leading-tight">
                      {isEN ? d.nameEN : d.name}
                    </h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{isEN ? 'From' : 'Mulai'}</span>
                    <span className="font-extrabold text-base text-brand-orange">{isEN ? d.priceEN : d.price}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          6. PROMO TIKET DOMESTIK
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <Reveal className="flex items-center gap-2 mb-4">
          <i className="fa-solid fa-plane text-brand-orange" />
          <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
            {isEN ? 'Cheap Domestic Flight Promos' : 'Promo Tiket Pesawat Domestik Murah'}
          </h2>
          <span className="text-slate-400">✈️</span>
        </Reveal>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
          {DOMESTIC_CITIES.map(city => (
            <button
              key={city}
              onClick={() => setActiveDomesticCity(city)}
              className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                activeDomesticCity === city
                  ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {(DOMESTIC_FLIGHTS[activeDomesticCity] || []).map((f, i) => {
            const personalize = !(f.origin && f.origin !== 'CGK') && flightFrom(f.dest) !== 'CGK';
            const cardOrigin  = personalize ? flightFrom(f.dest) : (f.origin || 'CGK');
            const routeID     = personalize ? f.route.replace(/^Jakarta/, originLabel) : f.route;
            const routeEN     = personalize ? f.routeEN.replace(/^Jakarta/, originLabel) : f.routeEN;
            return (
              <Reveal key={i} delay={i * 0.05}>
                <button
                  onClick={() => quickFlight(f.dest, cardOrigin)}
                  className="group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left w-full flex flex-col"
                >
                  <div className="relative overflow-hidden h-40">
                    <img src={f.img} alt={f.route} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    <span className={`absolute top-3 left-3 ${DOMESTIC_BADGE[activeDomesticCity]?.color || 'bg-brand-orange'} text-white text-[11px] font-black px-3 py-1 rounded-full uppercase shadow-sm`}>
                      {DOMESTIC_BADGE[activeDomesticCity] ? (isEN ? DOMESTIC_BADGE[activeDomesticCity].en : DOMESTIC_BADGE[activeDomesticCity].id) : (isEN ? 'PROMO' : 'PROMO')}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] text-brand-neutral font-medium leading-snug mb-1">{isEN ? routeEN : routeID}</p>
                    <p className="text-[11px] text-slate-400 mb-0">{tomorrowLabel}</p>
                  </div>
                  <div className="mt-auto px-4 pt-4 pb-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{isEN ? 'From' : 'Mulai'}</span>
                    <p className="text-brand-orange font-extrabold text-sm">{f.price}</p>
                  </div>
                </button>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          KENAPA MAFIA TRAVEL?
      ══════════════════════════════════════════════════════ */}
      <section id="tentang" className="max-w-[1280px] mx-auto px-4 md:px-8 py-10">
        <Reveal className="text-center mb-8">
          <h2 className="text-lg sm:text-2xl font-black text-brand-ink">
            {t.features.title}
          </h2>
          <p className="text-brand-neutral text-xs sm:text-sm mt-2 max-w-xl mx-auto">
            {t.features.subtitle}
          </p>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {[
            { title: t.features.fast, desc: t.features.fastDesc },
            { title: t.features.price, desc: t.features.priceDesc },
            { title: t.features.secure, desc: t.features.secureDesc },
            { title: t.features.support, desc: t.features.supportDesc },
          ].map((f, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="group h-full bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className={`w-11 h-11 rounded-xl ${FEATURES[i].color} flex items-center justify-center mb-4 transition-colors duration-300`}>
                  <i className={`fa-solid ${FEATURES[i].icon} text-sm`} />
                </div>
                <h3 className="font-black text-brand-ink text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-brand-neutral leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
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

      {/* ══════════════════════════════════════════════════════
          LOGIN POPUP (untuk favorit)
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showLoginPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center px-4"
            onClick={() => { setShowLoginPopup(false); setLoginError(''); setLoginEmail(''); setLoginPassword(''); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            >
              {/* Close button */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-800">
                  {isEN ? 'Sign In' : 'Masuk'}
                </h3>
                <button
                  onClick={() => { setShowLoginPopup(false); setLoginError(''); setLoginEmail(''); setLoginPassword(''); }}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-slate-400 text-sm" />
                </button>
              </div>

              {/* Error Alert */}
              {loginError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                  <i className="fa-solid fa-circle-exclamation text-red-500 text-xs" />
                  <p className="text-red-600 text-xs font-medium">{loginError}</p>
                </div>
              )}

              {/* Google Login */}
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('mt_welcome_pending', '1');
                  signIn('google', { callbackUrl: '/' });
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-95 mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isEN ? 'Continue with Google' : 'Lanjutkan dengan Google'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-grow border-t border-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isEN ? 'or sign in with email' : 'atau masuk dengan email'}
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* Email/Password Form */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoginLoading(true);
                setLoginError('');
                try {
                  const res = await Promise.race([
                    signIn('credentials', { email: loginEmail, password: loginPassword, redirect: false }),
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000)),
                  ]);
                  if (res?.error) {
                    setLoginError(isEN ? 'Incorrect email or password.' : 'Email atau password salah.');
                    setLoginLoading(false);
                  } else {
                    sessionStorage.setItem('mt_welcome_pending', '1');
                    window.location.reload();
                  }
                } catch (err) {
                  setLoginError(err instanceof Error && err.message === 'timeout'
                    ? (isEN ? 'Connection timed out.' : 'Koneksi timeout.')
                    : (isEN ? 'Server error.' : 'Kesalahan server.'));
                  setLoginLoading(false);
                }
              }} className="space-y-3">
                {/* Email */}
                <div className="relative">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    disabled={loginLoading}
                    className="peer w-full h-11 px-3 pt-3 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label className="absolute left-3 top-3 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2 peer-not-placeholder-shown:scale-75 origin-left">
                    {isEN ? 'Email Address' : 'Alamat Email'}
                  </label>
                </div>

                {/* Password */}
                <div className="relative">
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                    disabled={loginLoading}
                    className="peer w-full h-11 px-3 pt-3 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-brand-ink bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label className="absolute left-3 top-3 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2 peer-not-placeholder-shown:scale-75 origin-left">
                    {isEN ? 'Password' : 'Password'}
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full h-11 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                >
                  {loginLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isEN ? 'Checking...' : 'Memeriksa...'}
                    </>
                  ) : (
                    <>
                      {isEN ? 'Sign In Now' : 'Masuk Sekarang'}
                      <i className="fa-solid fa-arrow-right text-xs" />
                    </>
                  )}
                </button>
              </form>

              {/* Register Link */}
              <p className="mt-4 text-center text-xs text-slate-500 font-medium">
                {isEN ? "Don't have an account?" : 'Belum punya akun?'}{' '}
                <a href="/register" className="text-orange-600 font-bold hover:underline underline-offset-4">
                  {isEN ? 'Register here' : 'Daftar di sini'}
                </a>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SupportWidget />
    </main>
  );
}