'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { i18n } from '@/lib/i18n';

import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import FlightSearchForm from '@/components/flight/FlightSearchForm';
import TrainSearchForm from '@/components/train/TrainSearchForm';
import InsuranceSearchForm from '@/components/insurance/InsuranceSearchForm';
import HotelSearchForm from '@/components/hotel/HotelSearchForm';

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

function HotelForm({ onSearch, lang }: { onSearch: (payload: HotelSearchPayload) => void; lang: 'ID' | 'EN' }) {
  const t = i18n.home[lang].hotel;
  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [selectedDest, setSelectedDest] = useState(HOTEL_DESTINATIONS[1]);
  const [destInput, setDestInput]       = useState(HOTEL_DESTINATIONS[1].label);
  const [showDrop, setShowDrop]         = useState(false);
  const [checkin, setCheckin]           = useState(today);
  const [checkout, setCheckout]         = useState(tomorrow);
  const [rooms, setRooms]               = useState(1);
  const [guests, setGuests]             = useState(2);

  const filtered = HOTEL_DESTINATIONS.filter(d =>
    d.label.toLowerCase().includes(destInput.toLowerCase()) ||
    d.city.toLowerCase().includes(destInput.toLowerCase())
  );

  const handleSearch = () => {
    if (!checkin || !checkout) {
      alert(lang === 'EN' ? 'Please select check-in and check-out dates' : 'Mohon pilih tanggal check-in dan check-out');
      return;
    }
    onSearch({
      destination_id: selectedDest.id,
      destination_label: selectedDest.label,
      checkin_date: checkin,
      checkout_date: checkout,
      adult: guests,
      child: 0,
      room: rooms,
      nationality: 'ID',
    });
  };

  return (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-4 relative">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">{t.destination}</label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white relative">
            <i className="fa-solid fa-location-dot text-orange-500 text-sm shrink-0" />
            <input
              value={destInput}
              onChange={e => { setDestInput(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder={t.searchPlaceholder}
              className="flex-1 outline-none bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400"
            />
          </div>
          {showDrop && filtered.length > 0 && (
            <div className="absolute top-full mt-1 left-0 w-full bg-white border border-slate-100 rounded-xl shadow-2xl z-50 overflow-hidden">
              {filtered.map(d => (
                <div
                  key={d.id}
                  onMouseDown={() => { setSelectedDest(d); setDestInput(d.label); setShowDrop(false); }}
                  className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <div className="font-bold text-sm text-slate-800">{d.city}</div>
                  <div className="text-xs text-slate-400">{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">{t.checkin}</label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
            <i className="fa-regular fa-calendar text-orange-500 text-sm shrink-0" />
            <input type="date" value={checkin} min={today} onChange={e => { setCheckin(e.target.value); if (e.target.value >= checkout) setCheckout(''); }} className="flex-1 outline-none bg-transparent text-sm font-semibold text-slate-800" />
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">{t.checkout}</label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
            <i className="fa-regular fa-calendar text-orange-500 text-sm shrink-0" />
            <input type="date" value={checkout} min={checkin ? new Date(new Date(checkin).getTime() + 86400000).toISOString().split('T')[0] : today} onChange={e => setCheckout(e.target.value)} className="flex-1 outline-none bg-transparent text-sm font-semibold text-slate-800" />
          </div>
        </div>
        <div className="lg:col-span-2 flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">{t.rooms}</label>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-3 bg-white">
              <button type="button" onClick={() => setRooms(Math.max(1, rooms - 1))} className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold hover:bg-orange-100">-</button>
              <span className="text-sm font-black text-slate-800">{rooms}</span>
              <button type="button" onClick={() => setRooms(rooms + 1)} className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold hover:bg-orange-100">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">{t.guests}</label>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-3 bg-white">
              <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold hover:bg-orange-100">-</button>
              <span className="text-sm font-black text-slate-800">{guests}</span>
              <button type="button" onClick={() => setGuests(guests + 1)} className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold hover:bg-orange-100">+</button>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <button type="button" onClick={handleSearch} className="w-full h-[50px] rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
            <i className="fa-solid fa-magnifying-glass" /> {t.searchBtn}
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
  { name: 'Singapura',    nameEN: 'Singapore',     code: 'SIN', flag: '🇸🇬', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80', price: 'ab Rp 1,1 jt',  priceEN: 'from Rp 1.1M' },
  { name: 'Malaysia',     nameEN: 'Malaysia',       code: 'KUL', flag: '🇲🇾', img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&q=80', price: 'ab Rp 899 rb', priceEN: 'from Rp 899K' },
  { name: 'Thailand',     nameEN: 'Thailand',       code: 'BKK', flag: '🇹🇭', img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80', price: 'ab Rp 1,3 jt',  priceEN: 'from Rp 1.3M' },
  { name: 'Korea Selatan',nameEN: 'South Korea',    code: 'ICN', flag: '🇰🇷', img: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=600&q=80', price: 'ab Rp 2,4 jt',  priceEN: 'from Rp 2.4M' },
  { name: 'Jepang',       nameEN: 'Japan',          code: 'NRT', flag: '🇯🇵', img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&q=80', price: 'ab Rp 3,1 jt',  priceEN: 'from Rp 3.1M' },
  { name: 'Hong Kong',    nameEN: 'Hong Kong',      code: 'HKG', flag: '🇭🇰', img: 'https://images.unsplash.com/photo-1506970845246-18f21d533b20?w=600&q=80', price: 'ab Rp 1,8 jt',  priceEN: 'from Rp 1.8M' },
];

const DOMESTIC_CITIES = ['Bali', 'Medan', 'Surabaya', 'Yogyakarta', 'Palembang', 'Lombok', 'Balikpapan', 'Jakarta'];

const DOMESTIC_FLIGHTS: Record<string, { route: string; routeEN: string; dest: string; origin?: string; price: string; img: string }[]> = {
  Bali: [
    { route: 'Jakarta – Bali / Denpasar', routeEN: 'Jakarta – Bali / Denpasar', dest: 'DPS', price: 'Rp 1.239.200', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=75' },
    { route: 'Jakarta – Bali / Denpasar', routeEN: 'Jakarta – Bali / Denpasar', dest: 'DPS', price: 'Rp 1.331.000', img: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=75' },
    { route: 'Jakarta – Bali / Denpasar', routeEN: 'Jakarta – Bali / Denpasar', dest: 'DPS', price: 'Rp 1.378.900', img: 'https://images.unsplash.com/photo-1573790387438-4da905039392?w=400&q=75' },
    { route: 'Jakarta – Bali / Denpasar', routeEN: 'Jakarta – Bali / Denpasar', dest: 'DPS', price: 'Rp 1.360.600', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=75' },
  ],
  Medan: [
    { route: 'Jakarta – Medan / Kualanamu', routeEN: 'Jakarta – Medan / Kualanamu', dest: 'KNO', price: 'Rp 989.000',   img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=75' },
    { route: 'Jakarta – Medan / Kualanamu', routeEN: 'Jakarta – Medan / Kualanamu', dest: 'KNO', price: 'Rp 1.050.000', img: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=400&q=75' },
    { route: 'Jakarta – Medan / Kualanamu', routeEN: 'Jakarta – Medan / Kualanamu', dest: 'KNO', price: 'Rp 1.100.500', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=75' },
  ],
  Surabaya: [
    { route: 'Jakarta – Surabaya / Juanda', routeEN: 'Jakarta – Surabaya / Juanda', dest: 'SUB', price: 'Rp 550.000', img: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&q=75' },
    { route: 'Jakarta – Surabaya / Juanda', routeEN: 'Jakarta – Surabaya / Juanda', dest: 'SUB', price: 'Rp 610.000', img: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=400&q=75' },
    { route: 'Jakarta – Surabaya / Juanda', routeEN: 'Jakarta – Surabaya / Juanda', dest: 'SUB', price: 'Rp 670.000', img: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=400&q=75' },
  ],
  Yogyakarta: [
    { route: 'Jakarta – Yogyakarta / Adisutjipto', routeEN: 'Jakarta – Yogyakarta / Adisutjipto', dest: 'JOG', price: 'Rp 480.000', img: 'https://images.unsplash.com/photo-1580981568153-81e4a20bf7ec?w=400&q=75' },
    { route: 'Jakarta – Yogyakarta / Adisutjipto', routeEN: 'Jakarta – Yogyakarta / Adisutjipto', dest: 'JOG', price: 'Rp 520.000', img: 'https://images.unsplash.com/photo-1558618047-f4e5f8e9c8c0?w=400&q=75' },
    { route: 'Jakarta – Yogyakarta / Adisutjipto', routeEN: 'Jakarta – Yogyakarta / Adisutjipto', dest: 'JOG', price: 'Rp 560.000', img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=75' },
  ],
  Palembang: [
    { route: 'Jakarta – Palembang / SMB II', routeEN: 'Jakarta – Palembang / SMB II', dest: 'PLM', price: 'Rp 430.000', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=75' },
    { route: 'Jakarta – Palembang / SMB II', routeEN: 'Jakarta – Palembang / SMB II', dest: 'PLM', price: 'Rp 480.000', img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=75' },
  ],
  Lombok: [
    { route: 'Jakarta – Lombok / Praya', routeEN: 'Jakarta – Lombok / Praya', dest: 'LOP', price: 'Rp 850.000', img: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=75' },
    { route: 'Jakarta – Lombok / Praya', routeEN: 'Jakarta – Lombok / Praya', dest: 'LOP', price: 'Rp 920.000', img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=75' },
  ],
  Balikpapan: [
    { route: 'Jakarta – Balikpapan / SAMS', routeEN: 'Jakarta – Balikpapan / SAMS', dest: 'BPN', price: 'Rp 750.000', img: 'https://images.unsplash.com/photo-1440778303588-435521a3e3f0?w=400&q=75' },
    { route: 'Jakarta – Balikpapan / SAMS', routeEN: 'Jakarta – Balikpapan / SAMS', dest: 'BPN', price: 'Rp 830.000', img: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=400&q=75' },
  ],
  Jakarta: [
    { route: 'Bali – Jakarta / Soetta',     routeEN: 'Bali – Jakarta / Soetta',     dest: 'CGK', origin: 'DPS', price: 'Rp 620.000', img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=75' },
    { route: 'Surabaya – Jakarta / Soetta', routeEN: 'Surabaya – Jakarta / Soetta', dest: 'CGK', origin: 'SUB', price: 'Rp 540.000', img: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400&q=75' },
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

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const { language } = useLanguage();
  const location = useLocation();

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
  const todayISO = new Date().toISOString().split('T')[0];
  const tomorrowISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();
  const weekAfterISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  })();

  const SEARCH_TABS = [
    { id: 'flights',   label: t.tabs.flights,   icon: 'fa-plane' },
    { id: 'hotels',    label: t.tabs.hotels,    icon: 'fa-hotel' },
    { id: 'trains',    label: t.tabs.trains,    icon: 'fa-train' },
    { id: 'insurance', label: t.tabs.insurance, icon: 'fa-shield-halved' },
  ];

  const QUICK_SHORTCUTS = [
    {
      label: isEN ? 'Travel Insurance' : 'Asuransi Perjalanan',
      desc:  isEN ? 'Travel safer'     : 'Perjalanan lebih aman',
      icon: 'fa-shield-halved',
      color: 'from-blue-600 to-blue-800',
      img: 'https://images.unsplash.com/photo-1606868306217-dbf5046868d2?w=600&q=80',
      href: `/insurance/search?autoSearch=1&provider=all&destination_area=Asia&date_start=${todayISO}&date_end=${weekAfterISO}&trip_type=single_trip&pax=1`,
    },
    {
      label: isEN ? 'Train Tickets'  : 'Tiket Kereta',
      desc:  isEN ? 'Comfortable & affordable' : 'Nyaman & terjangkau',
      icon: 'fa-train',
      color: 'from-emerald-600 to-teal-700',
      img: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&q=80',
      href: `/train/search?origin=${trainOrigin}&destination=BD&depart=${tomorrowISO}&adult=1&infant=0&direction=OW&provider=kai`,
    },
    {
      label: isEN ? 'Hotel Deals'    : 'Hotel Promo',
      desc:  isEN ? 'Best price today' : 'Harga terbaik hari ini',
      icon: 'fa-hotel',
      color: 'from-purple-600 to-violet-800',
      img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
      href: `/hotel/search?destination_id=ID8731&q=&checkin_date=${todayISO}&checkout_date=${tomorrowISO}&adult=2&child=0&room=1&nationality=ID`,
    },
    {
      label: isEN ? 'Flight Deals'   : 'Pesawat Promo',
      desc:  isEN ? 'Flash sale every Friday' : 'Flash sale setiap Jumat',
      icon: 'fa-plane',
      color: 'from-orange-500 to-red-600',
      img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
      href: `/flight/search?origin=${flightOrigin}&destination=DPS&departure_date=${tomorrowISO}&adult=1&child=0&infant=0&cabin_class=Y&direction=OW`,
    },
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
    const date = tomorrow.toISOString().split('T')[0];
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

  const handleCouponClick = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('hotel')) {
      const params = new URLSearchParams({ destination_id: 'ID8731', q: '', checkin_date: todayISO, checkout_date: tomorrowISO, adult: '2', child: '0', room: '1', nationality: 'ID' });
      router.push(`/hotel/search?${params.toString()}`);
    } else if (t.includes('asuransi') || t.includes('insurance')) {
      router.push(`/insurance/search?autoSearch=1&provider=all&destination_area=Asia&date_start=${todayISO}&date_end=${weekAfterISO}&trip_type=single_trip&pax=1`);
    } else {
      quickFlight('DPS');
    }
  };

  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const copyCoupon = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch {}
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 1500);
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

  return (
    <main className="bg-[#f0f4f8] min-h-screen overflow-x-hidden">
      <UnifiedNavbar user={session?.user || null} />

      {/* ══════════════════════════════════════════════════════
          1. HERO SECTION
      ══════════════════════════════════════════════════════ */}
      <section className="relative pt-28 md:pt-36 pb-14 md:pb-20 overflow-visible">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1800&q=80"
            alt="Hero background"
            fill
            priority
            quality={75}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-slate-900/50" />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="text-center mb-8 md:mb-10">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">{t.hero.badge}</p>
            <h1 className="text-[28px] sm:text-[42px] md:text-6xl leading-tight font-black text-white tracking-tight">
              {isEN ? (
                <>Top Choice for{' '}<span className="text-orange-400">Explore the World</span></>
              ) : (
                <>Pilihan Utama untuk{' '}<span className="text-orange-400">Jelajahi Dunia</span></>
              )}
            </h1>
            <p className="text-white/80 text-sm sm:text-base mt-4 max-w-2xl mx-auto leading-relaxed px-2">
              {t.hero.subtitle}
            </p>
          </div>

          {/* Search Card */}
          <div className="max-w-5xl mx-auto bg-white/15 backdrop-blur-2xl border border-white/20 rounded-[28px] md:rounded-[36px] shadow-2xl overflow-visible">
            {/* Tabs */}
            <div className="flex overflow-x-auto scrollbar-hide gap-2 p-3 border-b border-white/10">
              {SEARCH_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon} text-xs`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Forms */}
            <div className="relative z-[999] w-full p-2 sm:p-3">
              {activeTab === 'flights' && (
                <Suspense fallback={<div className="h-32 flex items-center justify-center text-white/70 text-sm">{loadingText}</div>}>
                  <FlightSearchForm onSearch={handleFlightSearch} loading={isSearching} />
                </Suspense>
              )}
              {activeTab === 'hotels' && (
                <Suspense fallback={<div className="h-32 flex items-center justify-center text-white/70 text-sm">{loadingText}</div>}>
                  <HotelSearchForm onSearch={handleHotelSearch} loading={isSearching} />
                </Suspense>
              )}
              {activeTab === 'trains' && (
                <Suspense fallback={<div className="h-32 flex items-center justify-center text-white/70 text-sm">{loadingText}</div>}>
                  <TrainSearchForm onSearch={handleTrainSearch} loading={isSearching} />
                </Suspense>
              )}
              {activeTab === 'insurance' && (
                <Suspense fallback={<div className="h-32 flex items-center justify-center text-white/70 text-sm">{loadingText}</div>}>
                  <InsuranceSearchForm onSearch={handleInsuranceSearch} loading={isSearching} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          2. BANNER & KUPON EKSTRA
      ══════════════════════════════════════════════════════ */}
      <section className="relative z-0 bg-[#f0f4f8] pt-4 pb-6">
        {/* Full-width promo banner */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 mb-5">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-800 via-blue-700 to-orange-600 p-6 md:p-8 flex items-center justify-between gap-4">
            <div className="absolute -left-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-orange-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <span className="inline-block bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">WOW Weekend</span>
              <p className="text-white/80 text-sm mb-1">{isEN ? 'Special Discount Every Friday – Sunday' : 'Diskon Spesial Setiap Jumat – Minggu'}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-lg font-semibold">{isEN ? 'Cashback Coupon' : 'Kupon Cashback'}</span>
                <span className="text-4xl md:text-5xl font-black text-white">700rb</span>
              </div>
            </div>
            <div className="relative z-10 hidden sm:flex flex-col items-end gap-3">
              <button
                onClick={() => router.push('/flight/search')}
                className="bg-white text-orange-600 font-black text-sm px-6 py-3 rounded-xl hover:bg-orange-50 transition-all shadow-lg"
              >
                {isEN ? 'Claim Now' : 'Klaim Sekarang'}
              </button>
              <p className="text-white/60 text-xs">{isEN ? '*For registered users only' : '*Berlaku untuk pengguna terdaftar'}</p>
            </div>
          </div>
        </div>

        {/* Coupon strip */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-ticket text-orange-500 text-sm" />
            <h3 className="text-sm font-black text-slate-800">
              {isEN ? '12% Discount Coupons for New Users' : 'Kupon Diskon 12% untuk Pengguna Baru'}
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {(isEN ? [
              { label: 'Save 12% on First Hotel Booking', code: 'HOTELBARU12', type: 'Hotel' },
              { label: 'Save 10% on Xperience Activities', code: 'XPER10',     type: 'Activity' },
              { label: '12% Off Airport Transfer',         code: 'TRANSFER12', type: 'Transfer' },
              { label: '15% Cashback on First Flight',     code: 'FLYAWAY15',  type: 'Flights' },
              { label: '10% Off Travel Insurance',         code: 'AMAN10',     type: 'Insurance' },
            ] : [
              { label: 'Hemat 12% Pemesanan Hotel Pertama', code: 'HOTELBARU12', type: 'Hotel' },
              { label: 'Hemat 10% Pemesanan Xperience Pa...', code: 'XPER10',    type: 'Aktivitas' },
              { label: 'Diskon 12% Antar Jemput Bandara',   code: 'TRANSFER12', type: 'Transfer' },
              { label: 'Cashback 15% Tiket Pesawat Perdana', code: 'FLYAWAY15', type: 'Pesawat' },
              { label: 'Diskon 10% Asuransi Perjalanan',    code: 'AMAN10',     type: 'Asuransi' },
            ]            ).map((c, i) => (
              <div key={i} onClick={() => handleCouponClick(c.type)} className="flex-none w-[220px] bg-white border border-dashed border-orange-300 rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-orange-500 hover:shadow-md transition-all group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-orange-50 rounded-bl-full" />
                <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded-full">{c.type}</span>
                <p className="text-xs font-semibold text-slate-700 mt-2 mb-3 leading-snug">{c.label}</p>
                <div className="flex items-center justify-between">
                  <code className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{c.code}</code>
                  <button
                    onClick={e => { e.stopPropagation(); copyCoupon(c.code); }}
                    className="text-orange-500 text-[10px] font-black uppercase hover:text-orange-700 transition"
                  >
                    {copiedCoupon === c.code ? (isEN ? 'Copied!' : 'Tersalin!') : (isEN ? 'Copy' : 'Salin')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          3. QUICK SHORTCUTS
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4">
          {isEN ? 'Maximize Your Plans' : 'Maksimalkan Rencanamu'}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {QUICK_SHORTCUTS.map((s, i) => (
            <button
              key={i}
              onClick={() => router.push(s.href)}
              className="group relative overflow-hidden rounded-2xl aspect-[5/3] shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <img src={s.img} alt={s.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-75 group-hover:opacity-85 transition-opacity`} />
              <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-4">
                <i className={`fa-solid ${s.icon} text-white/70 text-base mb-1`} />
                <span className="text-white font-black text-xs sm:text-sm leading-tight">{s.label}</span>
                <span className="text-white/70 text-[10px] mt-0.5">{s.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          4. PROMO TERBAIK
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            {isEN ? 'Best Promos for This Holiday!' : 'Promo Terbaik buat Liburan Ini!'}
          </h2>
          <button onClick={() => router.push('/flight/search')} className="text-orange-500 text-xs sm:text-sm font-bold hover:underline">
            {isEN ? 'See All Promos →' : 'Lihat Semua Promo →'}
          </button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {PROMO_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActivePromoTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                activePromoTab === tab
                  ? 'bg-blue-800 text-white border-blue-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {((PROMO_BANNERS as any)[activePromoTab] || []).map((p: any, i: number) => (
            <div
              key={i}
              onClick={() => handlePromoClick(p, activePromoTab)}
              className="flex-none w-[200px] sm:w-[230px] bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="relative overflow-hidden h-[120px]">
                <img src={p.img} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <span className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full">{p.badge}</span>
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
      </section>

      {/* ══════════════════════════════════════════════════════
          5. DESTINASI INTERNASIONAL
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              {isEN ? 'Discover What You Love Across Asia and Beyond' : 'Temukan yang kamu suka di Asia hingga dunia'}
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              {isEN ? `Click a destination to search flights from ${originLabel}` : `Klik destinasi untuk langsung cari tiket dari ${originLabel}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {ASIA_DESTINATIONS.map(d => (
            <button
              key={d.code}
              onClick={() => quickFlight(d.code, flightOrigin)}
              className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="aspect-[4/3] sm:aspect-[3/2] relative">
                <img src={d.img} alt={isEN ? d.nameEN : d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 text-left">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-base">{d.flag}</span>
                    <span className="text-white font-black text-xs sm:text-sm leading-tight">{isEN ? d.nameEN : d.name}</span>
                  </div>
                  <span className="text-orange-300 text-[10px] sm:text-xs font-semibold">{isEN ? d.priceEN : d.price}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          6. PROMO TIKET DOMESTIK
      ══════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <div className="flex items-center gap-2 mb-4">
          <i className="fa-solid fa-plane text-orange-500" />
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            {isEN ? 'Cheap Domestic Flight Promos' : 'Promo Tiket Pesawat Domestik Murah'}
          </h2>
          <span className="text-slate-400">✈️</span>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
          {DOMESTIC_CITIES.map(city => (
            <button
              key={city}
              onClick={() => setActiveDomesticCity(city)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
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
              <button
                key={i}
                onClick={() => quickFlight(f.dest, cardOrigin)}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 text-left"
              >
                <div className="relative overflow-hidden h-28">
                  <img src={f.img} alt={f.route} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute top-2 left-2 bg-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    {isEN ? 'FROM' : 'MULAI'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-slate-500 font-medium leading-snug mb-1">{isEN ? routeEN : routeID}</p>
                  <p className="text-[10px] text-slate-400 mb-2">{tomorrowLabel}</p>
                  <p className="text-orange-600 font-black text-sm">{f.price}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          8. SEO LINK FARM
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-100 py-10">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {Object.entries(SEO_LINKS).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">{category}</h4>
                <ul className="space-y-1.5">
                  {(links as SEO_LINK[]).map(link => (
                    <li key={link.label}>
                      <button onClick={() => seoGo(link)} className="text-xs text-slate-500 hover:text-orange-500 transition-colors leading-relaxed text-left">
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
        <section className="relative overflow-hidden bg-[#003580] py-14">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-orange-500 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-blue-400 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-[900px] mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              {isEN ? 'Join ' : 'Bergabung dengan '}{' '}
              <span className="text-orange-400">The Mafia Travel</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base mt-4 leading-relaxed">
              {isEN
                ? 'Enjoy exclusive pricing, discount coupons, and the most modern booking experience in Indonesia.'
                : 'Nikmati harga eksklusif, kupon diskon, dan pengalaman booking paling modern di Indonesia.'}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
              <Link href="/register" className="px-8 py-4 rounded-xl bg-orange-600 text-white text-sm font-black hover:bg-orange-700 transition-all shadow-lg shadow-orange-500/30">
                {isEN ? 'Register Free' : 'Daftar Gratis'}
              </Link>
              <Link href="/flight/search" className="px-8 py-4 rounded-xl border border-white/25 text-white text-sm font-bold hover:bg-white/10 transition-all">
                {isEN ? 'Search Tickets →' : 'Cari Tiket →'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-10">
          <div className="flex flex-col lg:flex-row justify-between gap-10 pb-8 border-b border-slate-200">
            <div className="max-w-sm">
              <h2 className="text-2xl font-black text-slate-900">
                The <span className="text-orange-600">Mafia</span> Travel
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mt-3">
                {isEN
                  ? 'A modern travel platform for a fast, secure, and comfortable booking experience.'
                  : 'Platform perjalanan modern untuk pengalaman booking yang cepat, aman, dan nyaman.'}
              </p>
              <div className="flex items-center gap-3 mt-5">
                {['fa-facebook', 'fa-instagram', 'fa-twitter', 'fa-tiktok'].map(s => (
                  <a key={s} href="#" className="w-9 h-9 bg-slate-100 hover:bg-orange-100 hover:text-orange-500 text-slate-500 rounded-xl flex items-center justify-center transition-all">
                    <i className={`fa-brands ${s} text-sm`} />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="font-black text-slate-900 mb-4">{t.footer.services}</h4>
                <ul className="space-y-2 text-slate-500">
                  {(isEN
                    ? ['Flights', 'Hotels', 'Trains', 'Insurance', 'Airport Transfer']
                    : ['Pesawat', 'Hotel', 'Kereta', 'Asuransi', 'Transfer Bandara']
                  ).map(s => (
                    <li key={s}><Link href="#" className="hover:text-orange-500 transition-colors">{s}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-black text-slate-900 mb-4">{t.footer.company}</h4>
                <ul className="space-y-2 text-slate-500">
                  {[t.footer.about, t.footer.career, t.footer.partner, 'Blog', t.footer.press].map(s => (
                    <li key={s}><Link href="#" className="hover:text-orange-500 transition-colors">{s}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-black text-slate-900 mb-4">{t.footer.help}</h4>
                <ul className="space-y-2 text-slate-500">
                  {(isEN
                    ? ['Help Center', 'Refund & Reschedule', 'Privacy Policy', 'Terms & Conditions', 'Contact Us']
                    : ['Pusat Bantuan', 'Refund & Reschedule', 'Kebijakan Privasi', 'Syarat & Ketentuan', 'Hubungi Kami']
                  ).map(s => (
                    <li key={s}><Link href="#" className="hover:text-orange-500 transition-colors">{s}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
              {t.footer.copyright}
            </p>
            <div className="flex items-center gap-3 text-slate-400 text-xs">
              <span>🇮🇩 Indonesia</span>
              <span>|</span>
              <span>IDR</span>
              <span>|</span>
              <span>{isEN ? 'English' : 'Bahasa Indonesia'}</span>
            </div>
          </div>
        </div>
      </footer>

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
                  <h3 className="font-black text-slate-900 text-lg">{isEN ? 'Detecting location...' : 'Mendeteksi lokasi...'}</h3>
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
                <h3 className="font-black text-slate-900 text-lg leading-snug">
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
            <p className="text-xs font-bold text-slate-900">
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
            <p className="text-xs font-bold text-slate-900">
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
    </main>
  );
}