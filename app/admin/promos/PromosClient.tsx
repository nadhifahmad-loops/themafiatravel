'use client';

import { useEffect, useState, useCallback } from 'react';
import { Image as ImageIcon, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight, Search, ArrowUp, ArrowDown, Upload } from 'lucide-react';

interface Promo {
  id: number;
  service: string;
  titleId: string;
  titleEn: string | null;
  badgeId: string | null;
  badgeEn: string | null;
  image: string;
  priceFrom: number;
  validUntil: string | null;
  origin: string | null;
  destination: string | null;
  airline: string | null;
  airlineImg: string | null;
  destinationId: string | null;
  q: string | null;
  city: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PromoForm {
  service: string;
  titleId: string;
  titleEn: string;
  badgeId: string;
  badgeEn: string;
  image: string;
  priceFrom: number;
  validUntil: string; // YYYY-MM-DD (input type=date)
  origin: string;
  destination: string;
  airline: string;
  airlineImg: string;
  destinationId: string;
  q: string;
  city: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: PromoForm = {
  service: 'flight', titleId: '', titleEn: '', badgeId: '', badgeEn: '', image: '',
  priceFrom: 0, validUntil: '', origin: '', destination: '', airline: '', airlineImg: '',
  destinationId: '', q: '', city: '', sortOrder: 0, isActive: true,
};

const SERVICES = [
  { value: 'flight', label: 'Pesawat' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'train', label: 'Kereta' },
];

function fmtIDR(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }

/** ISO → value untuk input type=date (potongan tanggal saja, tanpa zona waktu). */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.length >= 10 ? iso.slice(0, 10) : '';
}

/**
 * Tanggal → ISO penuh. `YYYY-MM-DD` sudah 5/6 huruf → tambahkan akhir hari
 * supaya tanggal yang dikirim balik ke server tidak mundur sehari oleh zona waktu.
 */
function validUntilPayload(value: string): string {
  if (!value) return '';
  return value.length > 10 ? value : `${value}T23:59:59.999Z`;
}

/** Pesan error yang aman untuk `unknown` (tanpa `any`). */
function toErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function getStatus(p: Promo) {
  if (!p.isActive) return { label: 'Nonaktif', color: 'bg-slate-100 text-slate-600' };
  if (p.validUntil && new Date(p.validUntil) < new Date()) {
    return { label: 'Kedaluwarsa', color: 'bg-red-50 text-red-600' };
  }
  return { label: 'Tampil', color: 'bg-emerald-50 text-emerald-600' };
}

export default function PromosClient() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'success' });

  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Promo | null>(null);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage({ text: '', type: 'success' }), 5000);
  };

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat promo.');
      setPromos(data.promos || []);
    } catch (e) {
      showMessage(toErrorMessage(e, 'Gagal memuat promo.'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Diundur ke tick berikut (sama seperti LanguageContext) agar tidak memanggil
  // setState secara sinkron di dalam effect — aturan react-hooks/set-state-in-effect.
  useEffect(() => {
    const timer = window.setTimeout(() => { fetchPromos(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPromos]);

  /* ── Form helpers ── */
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, service: serviceFilter || 'flight' });
    setShowForm(true);
  };

  const openEdit = (p: Promo) => {
    setEditing(p);
    setForm({
      service: p.service,
      titleId: p.titleId,
      titleEn: p.titleEn || '',
      badgeId: p.badgeId || '',
      badgeEn: p.badgeEn || '',
      image: p.image,
      priceFrom: p.priceFrom,
      validUntil: toDateInput(p.validUntil),
      origin: p.origin || '',
      destination: p.destination || '',
      airline: p.airline || '',
      airlineImg: p.airlineImg || '',
      destinationId: p.destinationId || '',
      q: p.q || '',
      city: p.city || '',
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    });
    setShowForm(true);
  };

  /** Bentuk body lengkap untuk PUT (API menerima body penuh, bukan patch). */
  const payloadFromPromo = (p: Promo, patch: Partial<PromoForm> = {}) => ({
    service: p.service,
    titleId: p.titleId,
    titleEn: p.titleEn || '',
    badgeId: p.badgeId || '',
    badgeEn: p.badgeEn || '',
    image: p.image,
    priceFrom: p.priceFrom,
    validUntil: p.validUntil || '',
    origin: p.origin || '',
    destination: p.destination || '',
    airline: p.airline || '',
    airlineImg: p.airlineImg || '',
    destinationId: p.destinationId || '',
    q: p.q || '',
    city: p.city || '',
    sortOrder: p.sortOrder,
    isActive: p.isActive,
    ...patch,
  });

  const payloadFromForm = (f: PromoForm) => ({
    service: f.service,
    titleId: f.titleId,
    titleEn: f.titleEn,
    badgeId: f.badgeId,
    badgeEn: f.badgeEn,
    image: f.image,
    priceFrom: Number(f.priceFrom) || 0,
    validUntil: validUntilPayload(f.validUntil),
    origin: f.origin,
    destination: f.destination,
    airline: f.airline,
    airlineImg: f.airlineImg,
    destinationId: f.destinationId,
    q: f.q,
    city: f.city,
    sortOrder: Number(f.sortOrder) || 0,
    isActive: f.isActive,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/admin/promos/${editing.id}` : '/api/admin/promos';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromForm(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan promo.');
      setShowForm(false);
      showMessage(editing ? 'Promo berhasil diperbarui.' : 'Promo berhasil dibuat.');
      fetchPromos();
    } catch (e) {
      showMessage(toErrorMessage(e, 'Gagal menyimpan data promo.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/promos/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus promo.');
      setDeleting(null);
      showMessage('Promo berhasil dihapus.');
      fetchPromos();
    } catch (e) {
      showMessage(toErrorMessage(e, 'Gagal menyimpan data promo.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Promo) => {
    try {
      const res = await fetch(`/api/admin/promos/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromPromo(p, { isActive: !p.isActive })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status promo.');
      fetchPromos();
    } catch (e) {
      showMessage(toErrorMessage(e, 'Gagal menyimpan data promo.'), 'error');
    }
  };

  /** Tukar urutan dengan promo tetangga dalam layanan yang sama. */
  const handleMove = async (p: Promo, dir: -1 | 1) => {
    const siblings = promos.filter(x => x.service === p.service);
    const idx = siblings.findIndex(x => x.id === p.id);
    const target = siblings[idx + dir];
    if (!target) return;
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/admin/promos/${p.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadFromPromo(p, { sortOrder: target.sortOrder })),
        }),
        fetch(`/api/admin/promos/${target.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadFromPromo(target, { sortOrder: p.sortOrder })),
        }),
      ]);
      if (!a.ok || !b.ok) throw new Error('Gagal mengubah urutan promo.');
      fetchPromos();
    } catch (e) {
      showMessage(toErrorMessage(e, 'Gagal menyimpan data promo.'), 'error');
    }
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar.');
      setForm(prev => ({ ...prev, image: data.url }));
    } catch (e) {
      showMessage(toErrorMessage(e, 'Gagal menyimpan data promo.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  /* ── Filter (client-side; daftar promo selalu kecil) ── */
  const visible = promos.filter(p => {
    if (serviceFilter && p.service !== serviceFilter) return false;
    if (statusFilter === 'active' && !p.isActive) return false;
    if (statusFilter === 'inactive' && p.isActive) return false;
    if (statusFilter === 'expired') {
      if (!p.validUntil || new Date(p.validUntil) >= new Date()) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const haystack = [p.titleId, p.titleEn, p.badgeId, p.badgeEn, p.origin, p.destination, p.city]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const serviceLabel = (v: string) => SERVICES.find(s => s.value === v)?.label || v;
  const isHotel = form.service === 'hotel';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Manajemen Promo Homepage</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Kelola kartu promo pesawat, hotel, dan kereta yang tampil di halaman utama.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Buat Promo
        </button>
      </div>

      {message.text && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Cari judul, kota, atau rute..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
        </div>
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
          <option value="">Semua Layanan</option>
          {SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
          <option value="">Semua Status</option>
          <option value="active">Tampil</option>
          <option value="inactive">Nonaktif</option>
          <option value="expired">Kedaluwarsa</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400 mt-3">Memuat promo...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Belum ada promo {serviceFilter ? serviceLabel(serviceFilter) : ''}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Promo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Layanan</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Harga</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Berlaku s/d</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => {
                  const st = getStatus(p);
                  const prev = visible[i - 1];
                  const next = visible[i + 1];
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            {p.image && <img src={p.image} alt={p.titleId} className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate" title={p.titleId}>{p.titleId}</p>
                            <p className="text-[11px] text-slate-400 truncate">{p.titleEn || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{serviceLabel(p.service)}</span>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs font-semibold">{fmtIDR(p.priceFrom)}</span></td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">{toDateInput(p.validUntil) || 'Tanpa batas'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleMove(p, -1)} disabled={!prev || prev.service !== p.service}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-25 transition-colors" title="Naikkan urutan">
                            <ArrowUp className="w-4 h-4 text-slate-500" />
                          </button>
                          <button onClick={() => handleMove(p, 1)} disabled={!next || next.service !== p.service}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-25 transition-colors" title="Turunkan urutan">
                            <ArrowDown className="w-4 h-4 text-slate-500" />
                          </button>
                          <button onClick={() => handleToggle(p)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title={p.isActive ? 'Sembunyikan dari homepage' : 'Tampilkan di homepage'}>
                            {p.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                          </button>
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4 text-slate-500" />
                          </button>
                          <button onClick={() => setDeleting(p)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Hapus">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-brand-ink">{editing ? 'Edit Promo' : 'Buat Promo Baru'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Layanan *</label>
                  <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
                    {SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Urutan Tampil</label>
                  <input type="number" min={0} value={form.sortOrder || ''} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Judul (Indonesia) *</label>
                  <input type="text" value={form.titleId} onChange={e => setForm({ ...form, titleId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder={isHotel ? 'Hotel Bali Mewah' : 'Jakarta – Yogyakarta'} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Judul (English)</label>
                  <input type="text" value={form.titleEn} onChange={e => setForm({ ...form, titleEn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder="Luxury Bali Hotel" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Badge (Indonesia)</label>
                  <input type="text" value={form.badgeId} onChange={e => setForm({ ...form, badgeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder={isHotel ? 'Bintang 5' : 'Sekali Jalan'} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Badge (English)</label>
                  <input type="text" value={form.badgeEn} onChange={e => setForm({ ...form, badgeEn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder={isHotel ? '5 Stars' : 'One Way'} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Harga Tampil (Rp) *</label>
                  <input type="number" min={0} value={form.priceFrom || ''} onChange={e => setForm({ ...form, priceFrom: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder="684400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Berlaku s/d</label>
                  <input type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer" />
                  <p className="text-[11px] text-slate-400 mt-1">Kosongkan = tanpa batas. Promo lewat tanggal ini otomatis tidak tampil.</p>
                </div>
              </div>

              {/* Gambar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gambar Kartu *</label>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {form.image ? <img src={form.image} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
                  </div>
                  <div className="flex-1">
                    <input type="text" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      placeholder="/images/domestik/bali.png atau URL gambar" />
                    <label className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                      {uploading ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading ? 'Mengunggah...' : 'Unggah Gambar'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Field khusus layanan */}
              {isHotel ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kode Destinasi *</label>
                    <input type="text" value={form.destinationId} onChange={e => setForm({ ...form, destinationId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      placeholder="ID8731" />
                    <p className="text-[11px] text-slate-400 mt-1">Contoh: Bali ID8731, Jakarta ID339, Yogyakarta ID8735, Bandung ID8734, Surabaya ID8732</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Kunci</label>
                    <input type="text" value={form.q} onChange={e => setForm({ ...form, q: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      placeholder="Bali" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Label Kota</label>
                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      placeholder="Bali" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kode Asal *</label>
                      <input type="text" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        placeholder={form.service === 'train' ? 'GMR' : 'CGK'} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kode Tujuan *</label>
                      <input type="text" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        placeholder={form.service === 'train' ? 'SGU' : 'JOG'} />
                    </div>
                  </div>
                  {form.service === 'flight' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Maskapai</label>
                        <input type="text" value={form.airline} onChange={e => setForm({ ...form, airline: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="Batik Air" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logo Maskapai</label>
                        <input type="text" value={form.airlineImg} onChange={e => setForm({ ...form, airlineImg: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="/images/airlines/batik.png" />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-slate-700">Tampil di Homepage</span>
                  <p className="text-xs text-slate-400 mt-0.5">Promo aktif & belum lewat masa berlaku tampil di halaman utama</p>
                </div>
                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} type="button">
                  {form.isActive ? <ToggleRight className="w-7 h-7 text-emerald-500" /> : <ToggleLeft className="w-7 h-7 text-slate-400" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Promo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-brand-ink mb-2">Hapus Promo?</h3>
            <p className="text-sm text-slate-500 mb-6">Promo <strong>{deleting.titleId}</strong> akan dihapus permanen dan hilang dari homepage.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 px-4 py-2.5 text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">Batal</button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
