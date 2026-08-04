'use client';

import { useEffect, useState } from 'react';
import { Save, Percent, RotateCcw } from 'lucide-react';

interface MarkupSettings {
  flight: number;
  hotel: number;
  train: number;
  insurance: number;
}

const DEFAULTS: MarkupSettings = { flight: 50000, hotel: 10, train: 15000, insurance: 5 };

export default function SettingsPage() {
  const [markup, setMarkup] = useState<MarkupSettings>(DEFAULTS);
  const [original, setOriginal] = useState<MarkupSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    fetch('/api/admin/markup')
      .then((r) => r.json())
      .then((data) => {
        const loaded = { flight: data.flight, hotel: data.hotel, train: data.train, insurance: data.insurance };
        setMarkup(loaded);
        setOriginal(loaded);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const isChanged = JSON.stringify(markup) !== JSON.stringify(original);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setStatusType('');
    try {
      const res = await fetch('/api/admin/markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markup),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOriginal(markup);
        setStatusType('success');
        setStatusMessage('Pengaturan markup berhasil disimpan dan berlaku untuk semua booking berikutnya.');
      } else {
        setStatusType('error');
        setStatusMessage(data.error || 'Gagal menyimpan.');
      }
    } catch {
      setStatusType('error');
      setStatusMessage('Gagal menyimpan. Coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setMarkup(DEFAULTS);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pengaturan Markup</h1>
          <p className="text-slate-500 text-sm mt-0.5">Atur margin keuntungan dari harga dasar API mitra B2B Anda.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 mt-3">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pengaturan Markup</h1>
        <p className="text-slate-500 text-sm mt-0.5">Atur margin keuntungan dari harga dasar API mitra B2B Anda.</p>
        {statusMessage && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${statusType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
            {statusMessage}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-8">

        {/* Flight */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Pesawat (Flight)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Markup per Pax (Rp)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 font-semibold text-sm pointer-events-none">Rp</span>
                <input
                  type="number"
                  value={markup.flight}
                  onChange={(e) => setMarkup({ ...markup, flight: Number(e.target.value) })}
                  className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-slate-800"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Ditambahkan per pax (penumpang). Contoh: 50000 x 2 pax = +Rp100.000</p>
            </div>
          </div>
        </div>

        {/* Hotel */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Akomodasi (Hotel)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Markup Global (%)</label>
              <div className="relative">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="number"
                  value={markup.hotel}
                  onChange={(e) => setMarkup({ ...markup, hotel: Number(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-slate-800"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Dihitung dari total harga kamar / malam. Contoh: 10% x Rp500.000 = +Rp50.000</p>
            </div>
          </div>
        </div>

        {/* Train */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Kereta Api (Train)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Admin Fee KAI (Rp)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 font-semibold text-sm pointer-events-none">Rp</span>
                <input
                  type="number"
                  value={markup.train}
                  onChange={(e) => setMarkup({ ...markup, train: Number(e.target.value) })}
                  className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-slate-800"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Flat fee per tiket yang ditambahkan ke harga total.</p>
            </div>
          </div>
        </div>

        {/* Insurance */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Asuransi (Insurance)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Markup Asuransi (%)</label>
              <div className="relative">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="number"
                  value={markup.insurance}
                  onChange={(e) => setMarkup({ ...markup, insurance: Number(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-slate-800"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Markup persentase asuransi yang ditambahkan ke premi.</p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs font-bold text-slate-600 mb-3">Contoh Perhitungan</p>
          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500">
            <div>Flight: Rp1.000.000 x 2 pax</div>
            <div className="font-semibold text-slate-700">= Rp{(1000000 + markup.flight * 2).toLocaleString('id-ID')}</div>
            <div>Hotel: Rp500.000 / malam</div>
            <div className="font-semibold text-slate-700">= Rp{Math.round(500000 * (1 + markup.hotel / 100)).toLocaleString('id-ID')}</div>
            <div>Train: Rp350.000 / tiket</div>
            <div className="font-semibold text-slate-700">= Rp{(350000 + markup.train).toLocaleString('id-ID')}</div>
            <div>Insurance: Rp80.000 / polis</div>
            <div className="font-semibold text-slate-700">= Rp{Math.round(80000 * (1 + markup.insurance / 100)).toLocaleString('id-ID')}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-500 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset Default
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isChanged}
            className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Menyimpan...' : isChanged ? 'Simpan Perubahan' : 'Tidak Ada Perubahan'}
          </button>
        </div>

      </div>
    </div>
  );
}
