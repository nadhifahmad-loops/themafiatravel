'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import InsuranceSearchForm from '@/components/insurance/InsuranceSearchForm';

export interface InsuranceSearchMeta {
  provider?: string;
  destination?: string;
  destination_area?: string;
  international?: boolean;
  date_start?: string;
  date_end?: string;
  trip_type?: string;
  pax?: number;
  adult?: number;
  child?: number;
  is_senior?: boolean;
  nights?: number;
}

interface Props {
  searchMeta: InsuranceSearchMeta;
  onSearch: (payload: unknown) => void;
  loading: boolean;
}

function formatRange(start?: string, end?: string, locale = 'id-ID') {
  if (!start || !end) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const from = new Date(start).toLocaleDateString(locale, opts);
  const to = new Date(end).toLocaleDateString(locale, opts);
  return `${from} - ${to}`;
}

/**
 * Ringkasan pencarian di atas daftar plan (rute + tanggal + "Change Search"),
 * mengikuti layout Traveloka. Tombol membuka form pencarian yang sudah terisi.
 */
export default function InsuranceSearchSummary({ searchMeta, onSearch, loading }: Props) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const [open, setOpen] = useState(false);

  const locale = language === 'EN' ? 'en-GB' : 'id-ID';
  // Asal selalu Indonesia (lihat form), tujuan dari parameter pencarian.
  const destination = searchMeta.destination
    || searchMeta.destination_area
    || (language === 'EN' ? 'All Areas' : 'Semua Area');
  const dateRange = formatRange(searchMeta.date_start, searchMeta.date_end, locale);

  if (open) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">{t.changeSearch}</h3>
          <button
            onClick={() => setOpen(false)}
            aria-label={language === 'EN' ? 'Close' : 'Tutup'}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <InsuranceSearchForm
          initialData={searchMeta}
          onSearch={(payload) => { onSearch(payload); setOpen(false); }}
          loading={loading}
          variant="light"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm truncate">
          Indonesia <i className="fa-solid fa-arrow-right-arrow-left text-slate-400 text-xs mx-1" aria-hidden="true"></i> {destination}
        </p>
        {dateRange && <p className="text-xs text-slate-500 mt-0.5">{dateRange}</p>}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-sm transition-colors"
      >
        {t.changeSearch}
      </button>
    </div>
  );
}
