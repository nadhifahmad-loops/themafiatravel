'use client';

import { useEffect, useState } from 'react';
import { Save, RotateCcw, Info } from 'lucide-react';

interface MarkupField {
  key: string;
  label: string;
  icon: string;
  type: 'flat' | 'percent';
  value: number;
}

interface MarkupData {
  flight: MarkupField;
  hotel: MarkupField;
  train: MarkupField;
  insurance: MarkupField;
}

const DEFAULT_FIELDS: MarkupField[] = [
  { key: 'flight', label: 'Pesawat', icon: 'fa-plane', type: 'flat', value: 50000 },
  { key: 'hotel', label: 'Hotel', icon: 'fa-hotel', type: 'percent', value: 10 },
  { key: 'train', label: 'Kereta', icon: 'fa-train', type: 'flat', value: 15000 },
  { key: 'insurance', label: 'Asuransi', icon: 'fa-shield-halved', type: 'percent', value: 5 },
];

function toMarkupData(raw: any): MarkupData {
  const fields = DEFAULT_FIELDS.map(f => ({
    ...f,
    type: raw[`${f.key}_type`] ?? f.type,
    value: raw[f.key] ?? f.value,
  }));
  const result: any = {};
  for (const f of fields) result[f.key] = f;
  return result as MarkupData;
}

function toRaw(data: MarkupData) {
  const raw: Record<string, any> = {};
  const keys = ['flight', 'hotel', 'train', 'insurance'] as const;
  for (const key of keys) {
    raw[key] = data[key].value;
    raw[`${key}_type`] = data[key].type;
  }
  return raw;
}

export default function SettingsPage() {
  const buildDefault = (): MarkupData => {
    const result: any = {};
    for (const f of DEFAULT_FIELDS) result[f.key] = { ...f };
    return result as MarkupData;
  };

  const [markup, setMarkup] = useState<MarkupData>(buildDefault);
  const [original, setOriginal] = useState<MarkupData>(markup);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    fetch('/api/markup')
      .then(r => r.json())
      .then(data => {
        const parsed = toMarkupData(data);
        setMarkup(parsed);
        setOriginal(parsed);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const isChanged = JSON.stringify(toRaw(markup)) !== JSON.stringify(toRaw(original));

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setStatusType('');
    try {
      const res = await fetch('/api/markup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toRaw(markup)),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOriginal(structuredClone(markup));
        setStatusType('success');
        setStatusMessage('Markup berhasil disimpan.');
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
    setMarkup(structuredClone(original));
    setStatusMessage('');
    setStatusType('');
  };

  const handleResetDefaults = () => {
    setMarkup(buildDefault());
    setStatusMessage('');
    setStatusType('');
  };

  const updateValue = (key: string, value: string) => {
    const num = parseFloat(value);
    setMarkup(prev => {
      const next = { ...prev };
      (next as any)[key] = { ...(next as any)[key], value: isNaN(num) ? 0 : num };
      return next;
    });
  };

  const toggleType = (key: string) => {
    setMarkup(prev => {
      const field = (prev as any)[key] as MarkupField;
      const next = { ...prev };
      (next as any)[key] = {
        ...field,
        type: field.type === 'flat' ? 'percent' : 'flat',
        value: field.type === 'flat'
          ? parseFloat((field.value / 100).toFixed(1)) || 1
          : field.value * 100 || 1000,
      };
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Pengaturan Markup</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Atur laba markup dari setiap penjualan tiket.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 mt-3">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  const fields = Object.values(markup);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">Pengaturan Markup</h1>
        <p className="text-brand-neutral text-sm mt-0.5">Atur laba markup dari setiap penjualan tiket.</p>
        {statusMessage && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${statusType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Grid 2 kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {fields.map(field => (
          <div key={field.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <i className={`fa-solid ${field.icon} text-orange-500`}></i>
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-ink">{field.label}</h3>
                <p className="text-[11px] text-slate-400">
                  {field.type === 'flat' ? 'Markup flat per unit' : 'Markup persentase dari harga'}
                </p>
              </div>
            </div>

            {/* Input + Toggle Type */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleType(field.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  field.type === 'flat'
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {field.type === 'flat' ? 'Rp' : '%'}
              </button>
              <input
                type="number"
                min="0"
                step={field.type === 'flat' ? '1000' : '0.5'}
                value={field.value}
                onChange={e => updateValue(field.key, e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-bold text-slate-800 text-right"
              />
              <span className="text-xs font-semibold text-slate-400 w-8 text-center">
                {field.type === 'flat' ? '/pax' : '%'}
              </span>
            </div>

            {/* Preview */}
            <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2 text-[11px] text-slate-500">
              {field.type === 'flat' ? (
                <>Contoh: Rp {field.value.toLocaleString('id-ID')} × 2 penumpang = <span className="font-bold text-slate-700">Rp {(field.value * 2).toLocaleString('id-ID')}</span></>
              ) : (
                <>Contoh: Harga Rp 1.000.000 × {field.value}% = <span className="font-bold text-slate-700">Rp {(1000000 * field.value / 100).toLocaleString('id-ID')}</span></>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-[12px] text-blue-700 leading-relaxed">
          Klik tombol <strong>Rp</strong> / <strong>%</strong> untuk mengganti tipe markup.
          <strong> Rp</strong> = markup tetap per unit. <strong> %</strong> = persentase dari harga jual.
          Markup ditambahkan ke harga dasar sebelum ditampilkan ke pelanggan.
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 text-xs font-semibold rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Default
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={!isChanged}
            className="flex items-center gap-2 px-4 py-2 text-slate-500 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Batal
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
