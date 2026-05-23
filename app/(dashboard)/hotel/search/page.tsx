'use client';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import HotelCard from '@/components/hotel/HotelCard';
import HotelSearchForm from '@/components/hotel/HotelSearchForm';

// Komponen utama yang dibungkus Suspense
export default function HotelSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Memuat Halaman Pencarian...</div>}>
      <HotelSearchContent />
    </Suspense>
  );
}

function HotelSearchContent() {
  const searchParamsHook = useSearchParams(); // Mengambil query string dari URL
  
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'rating'>('price_asc');
  
  // State untuk Filter
  const [priceRange, setPriceRange] = useState({ min: 0, max: 5000000 });
  const [starFilters, setStarFilters] = useState<number[]>([]);
  
  // State untuk Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [hasAutoSearched, setHasAutoSearched] = useState(false); // Mencegah loop

  const handleSearch = async (params: any) => {
    setLoading(true); 
    setError(''); 
    setResults(null); 
    setCurrentPage(1);
    setSearchParams(params);
    try {
      const res = await fetch('/api/hotel/search', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mencari hotel');
      setResults(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── OTOMATIS SEARCH DARI PARAMETER URL ───
  useEffect(() => {
    const destination_id = searchParamsHook.get('destination_id');
    if (destination_id && !hasAutoSearched) {
      const params = {
        destination_id: destination_id,
        checkin_date: searchParamsHook.get('checkin_date') || '',
        checkout_date: searchParamsHook.get('checkout_date') || '',
        adult: parseInt(searchParamsHook.get('adult') || '2'),
        child: parseInt(searchParamsHook.get('child') || '0'),
        room: parseInt(searchParamsHook.get('room') || '1'),
        nationality: searchParamsHook.get('nationality') || 'ID',
        child_ages: []
      };
      setSearchParams(params);
      handleSearch(params);
      setHasAutoSearched(true);
    }
  }, [searchParamsHook, hasAutoSearched]);

  const getLowestPrice = (prices: any) => {
    if (!prices) return 0;
    return Math.min(...Object.values(prices).map((p: any) => p?.price || Infinity).filter(p => p !== Infinity));
  };

  const handleStarFilterChange = (star: number) => {
    setCurrentPage(1);
    setStarFilters(prev => prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]);
  };

  const clearFilters = () => {
    setPriceRange({ min: 0, max: 5000000 });
    setStarFilters([]);
    setCurrentPage(1);
  };

  const filteredAndSortedHotels = useMemo(() => {
    let hotels = results?.hotel_ids || [];
    if (hotels.length > 0) {
      hotels = hotels.filter((hotel: any) => {
        const price = getLowestPrice(hotel.prices);
        const rating = parseInt(hotel.rating) || 0;
        const isWithinPrice = price >= priceRange.min && (priceRange.max >= 5000000 ? true : price <= priceRange.max);
        const isMatchingStar = starFilters.length === 0 || starFilters.includes(rating);
        return isWithinPrice && isMatchingStar;
      });
    }
    if (hotels.length > 0) {
      hotels = [...hotels].sort((a: any, b: any) => {
        if (sortBy === 'price_asc') return getLowestPrice(a.prices) - getLowestPrice(b.prices);
        if (sortBy === 'price_desc') return getLowestPrice(b.prices) - getLowestPrice(a.prices);
        if (sortBy === 'rating') return (parseInt(b.rating) || 0) - (parseInt(a.rating) || 0);
        return 0;
      });
    }
    return hotels;
  }, [results, priceRange, starFilters, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedHotels.length / itemsPerPage);
  const currentHotels = filteredAndSortedHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const nights = searchParams?.checkout_date && searchParams?.checkin_date ? Math.max(1, Math.round(
    (new Date(searchParams.checkout_date).getTime() - new Date(searchParams.checkin_date).getTime()) / 86400000
  )) : 1;

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-slate-900 font-sans pb-20">
      {/* ── HEADER & SEARCH CONTEXT ── */}
      <section className="bg-white border-b border-slate-200 pt-8 pb-12 shadow-sm relative z-20">
        <div className="max-w-[1280px] mx-auto px-6 md:px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 font-display tracking-tight">
                {searchParams ? `Hotel di ${searchParams.q || 'Destinasi Pilihan'}` : 'Eksplorasi Penginapan'}
              </h1>
              <p className="text-slate-500 text-sm md:text-base">
                {results 
                  ? `Menampilkan ${filteredAndSortedHotels.length} properti • ${searchParams?.checkin_date} hingga ${searchParams?.checkout_date} • ${searchParams?.adult} Dewasa` 
                  : 'Temukan hotel, vila, dan resort terbaik dengan harga eksklusif.'}
              </p>
            </div>
            
            <HotelSearchForm onSearch={handleSearch} loading={loading} initialParams={searchParams} />
          </div>
        </div>
      </section>

      {/* ── MAIN RESULTS GRID ── */}
      <main className="max-w-[1280px] mx-auto px-6 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ── SIDEBAR FILTERS (KIRI) ── */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-8">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6 sticky top-28">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Filters</h3>
              {(starFilters.length > 0 || priceRange.max < 5000000) && (
                <button onClick={clearFilters} className="text-orange-600 text-sm font-bold hover:underline">Clear all</button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <span className="font-bold text-sm text-slate-900">Price Range (per night)</span>
              <div className="space-y-4 px-1">
                <input 
                  type="range" 
                  min="0" 
                  max="5000000" 
                  step="500000"
                  value={priceRange.max} 
                  onChange={(e) => {
                    setPriceRange({ min: 0, max: parseInt(e.target.value) });
                    setCurrentPage(1);
                  }}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>IDR 0</span>
                  <span>{priceRange.max >= 5000000 ? 'IDR 5M+' : `IDR ${(priceRange.max / 1000000).toFixed(1)}M`}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
              <span className="font-bold text-sm text-slate-900">Star Rating</span>
              <div className="flex flex-col gap-3">
                {[5, 4, 3, 2, 1].map(star => (
                  <label key={star} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={starFilters.includes(star)}
                      onChange={() => handleStarFilterChange(star)}
                      className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-600" 
                    />
                    <span className="text-sm text-slate-700 flex items-center gap-1 font-medium">
                      {star} Stars <i className="fa-solid fa-star text-orange-400 text-[10px]"></i>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── HASIL PENCARIAN (KANAN) ── */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-600 text-sm font-medium shadow-sm">
              <i className="fa-solid fa-triangle-exclamation"></i> {error}
            </div>
          )}

          {results && !loading && (
            <div className="flex items-center justify-between mb-2 bg-transparent">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-medium">Sort by:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }} 
                  className="font-bold text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 cursor-pointer shadow-sm"
                >
                  <option value="price_asc">Harga Terendah</option>
                  <option value="price_desc">Harga Tertinggi</option>
                  <option value="rating">Rating Tertinggi</option>
                </select>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-auto md:h-[240px]">
                  <div className="md:w-1/3 bg-slate-200 animate-pulse h-[200px] md:h-full shrink-0"></div>
                  <div className="md:w-2/3 p-6 flex flex-col justify-between w-full">
                    <div>
                      <div className="h-6 w-3/4 bg-slate-200 animate-pulse rounded mb-3"></div>
                      <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded"></div>
                    </div>
                    <div className="flex justify-end mt-6">
                      <div className="h-10 w-32 bg-slate-200 animate-pulse rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && currentHotels.length > 0 && (
            <div className="flex flex-col gap-6">
              {currentHotels.map((hotel: any, i: number) => (
                <HotelCard key={i} hotel={hotel} nights={nights} searchParams={searchParams} />
              ))}
            </div>
          )}

          {!loading && results && currentHotels.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 text-slate-300">
                <i className="fa-solid fa-filter-circle-xmark"></i>
              </div>
              <h3 className="font-black text-slate-900 text-xl mb-2">Hotel tidak ditemukan</h3>
              <p className="text-slate-500 text-sm">Coba sesuaikan filter atau ubah pencarianmu.</p>
              {(starFilters.length > 0 || priceRange.max < 5000000) && (
                <button onClick={clearFilters} className="mt-6 px-6 py-2.5 bg-orange-100 text-orange-600 font-bold rounded-lg hover:bg-orange-200 transition-colors text-sm">
                  Hapus Semua Filter
                </button>
              )}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>

              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                  return (
                    <button 
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center font-bold text-sm transition-all ${
                        currentPage === pageNum 
                          ? 'bg-orange-600 border-orange-600 text-white shadow-md' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={i} className="px-2 text-slate-400">...</span>;
                }
                return null;
              })}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}