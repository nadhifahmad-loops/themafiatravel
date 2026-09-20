'use client';

import { useEffect, useState, useCallback } from 'react';
import { Ticket, Plus, Pencil, Trash2, X, Copy, Check, ToggleLeft, ToggleRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Coupon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  category: string;
  minOrderAmount: number;
  maxDiscount: number | null;
  maxUsage: number | null;
  usedCount: number;
  isActive: boolean;
  isFeatured: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface CouponForm {
  code: string;
  name: string;
  description: string;
  type: string;
  value: number;
  category: string;
  minOrderAmount: number;
  maxDiscount: number;
  maxUsage: number;
  isActive: boolean;
  isFeatured: boolean;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: CouponForm = {
  code: '', name: '', description: '', type: 'percentage', value: 0,
  category: 'all', minOrderAmount: 0, maxDiscount: 0, maxUsage: 0,
  isActive: true, isFeatured: false, startDate: '', endDate: '',
};

const CATEGORIES = [
  { value: 'all', label: 'Semua' },
  { value: 'flight', label: 'Pesawat' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'train', label: 'Kereta' },
  { value: 'insurance', label: 'Asuransi' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'activity', label: 'Aktivitas' },
];

function fmtIDR(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }

function getStatus(c: Coupon) {
  const now = new Date();
  if (!c.isActive) return { label: 'Nonaktif', color: 'bg-slate-100 text-slate-600' };
  if (c.endDate && new Date(c.endDate) < now) return { label: 'Kedaluwarsa', color: 'bg-red-100 text-red-600' };
  if (c.maxUsage !== null && c.usedCount >= c.maxUsage) return { label: 'Habis', color: 'bg-amber-100 text-amber-600' };
  return { label: 'Aktif', color: 'bg-emerald-100 text-emerald-700' };
}

function getCategoryLabel(c: string) {
  return CATEGORIES.find(cat => cat.value === c)?.label || c;
}

export default function CouponsClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' as 'success' | 'error' | '' });
  const [copied, setCopied] = useState<number | null>(null);

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/coupons?${params}`);
      const data = await res.json();
      setCoupons(data.coupons || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {} finally { setIsLoading(false); }
  }, [page, search, categoryFilter, statusFilter]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code, name: c.name, description: c.description || '',
      type: c.type, value: c.value, category: c.category,
      minOrderAmount: c.minOrderAmount, maxDiscount: c.maxDiscount || 0,
      maxUsage: c.maxUsage || 0, isActive: c.isActive, isFeatured: c.isFeatured,
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { showMessage('Kode dan nama wajib diisi.', 'error'); return; }
    if (form.value <= 0) { showMessage('Nilai diskon harus lebih dari 0.', 'error'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/coupons/${editing.id}` : '/api/admin/coupons';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          maxDiscount: form.type === 'percentage' ? form.maxDiscount || null : null,
          maxUsage: form.maxUsage || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan kupon.');
      setShowForm(false);
      showMessage(editing ? 'Kupon berhasil diperbarui.' : 'Kupon berhasil dibuat.', 'success');
      fetchCoupons();
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/coupons/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus kupon.');
      setDeleting(null);
      showMessage('Kupon berhasil dihapus.', 'success');
      fetchCoupons();
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleToggle = async (c: Coupon) => {
    try {
      await fetch(`/api/admin/coupons/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, isActive: !c.isActive, maxUsage: c.maxUsage || null, maxDiscount: c.maxDiscount || null, startDate: c.startDate, endDate: c.endDate }),
      });
      fetchCoupons();
    } catch {}
  };

  const handleToggleFeatured = async (c: Coupon) => {
    try {
      await fetch(`/api/admin/coupons/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, isFeatured: !c.isFeatured, maxUsage: c.maxUsage || null, maxDiscount: c.maxDiscount || null, startDate: c.startDate, endDate: c.endDate }),
      });
      fetchCoupons();
    } catch {}
  };

  const copyCode = async (code: string, id: number) => {
    try { await navigator.clipboard.writeText(code); } catch {}
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Manajemen Kupon</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Buat, edit, dan kelola kupon diskon untuk pengguna.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Buat Kupon
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
          <input type="text" placeholder="Cari kode atau nama..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="expired">Kedaluwarsa</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400 mt-3">Memuat kupon...</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-10 text-center">
            <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Belum ada kupon.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Kupon</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Tipe</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Kategori</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Pemakaian</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const st = getStatus(c);
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                            <Ticket className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{c.code}</code>
                              {c.isFeatured && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full uppercase">Banner</span>}
                              <button onClick={() => copyCode(c.code, c.id)} className="text-slate-400 hover:text-orange-500 transition-colors">
                                {copied === c.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{c.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold">
                          {c.type === 'percentage' ? `${c.value}%` : fmtIDR(c.value)}
                        </span>
                        {c.type === 'percentage' && c.maxDiscount && <span className="text-[10px] text-slate-400 block">Max {fmtIDR(c.maxDiscount)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{getCategoryLabel(c.category)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-700">{c.usedCount}{c.maxUsage !== null ? ` / ${c.maxUsage}` : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleToggleFeatured(c)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title={c.isFeatured ? 'Hapus dari Banner' : 'Tampilkan di Banner'}>
                            {c.isFeatured ? <ToggleRight className="w-5 h-5 text-blue-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                          </button>
                          <button onClick={() => handleToggle(c)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title={c.isActive ? 'Nonaktifkan' : 'Aktifkan'}>
                            {c.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4 text-slate-500" />
                          </button>
                          <button onClick={() => setDeleting(c)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Hapus">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Total {total} kupon</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-600">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-brand-ink">{editing ? 'Edit Kupon' : 'Buat Kupon Baru'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kode Kupon *</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="DISKON12" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Kupon *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="Diskon 12% untuk Hotel" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deskripsi</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none" placeholder="Deskripsi singkat kupon..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipe Diskon *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
                    <option value="percentage">Persentase (%)</option>
                    <option value="fixed">Nominal Tetap (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nilai Diskon *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm pointer-events-none">{form.type === 'percentage' ? '%' : 'Rp'}</span>
                    <input type="number" value={form.value || ''} onChange={e => setForm({ ...form, value: Number(e.target.value) })} min={0} max={form.type === 'percentage' ? 100 : undefined}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="0" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kategori</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Min. Belanja (Rp)</label>
                  <input type="number" value={form.minOrderAmount || ''} onChange={e => setForm({ ...form, minOrderAmount: Number(e.target.value) })} min={0}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.type === 'percentage' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Maks. Diskon (Rp)</label>
                    <input type="number" value={form.maxDiscount || ''} onChange={e => setForm({ ...form, maxDiscount: Number(e.target.value) })} min={0}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="Tidak dibatasi" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Batas Pemakaian</label>
                  <input type="number" value={form.maxUsage || ''} onChange={e => setForm({ ...form, maxUsage: Number(e.target.value) })} min={0}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" placeholder="Unlimited" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Mulai</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Berakhir</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer" />
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Kupon Aktif</span>
                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} type="button">
                  {form.isActive ? <ToggleRight className="w-7 h-7 text-emerald-500" /> : <ToggleLeft className="w-7 h-7 text-slate-400" />}
                </button>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-slate-700">Tampilkan di Banner</span>
                  <p className="text-xs text-slate-400 mt-0.5">Kupon akan tampil di banner utama homepage</p>
                </div>
                <button onClick={() => setForm({ ...form, isFeatured: !form.isFeatured })} type="button">
                  {form.isFeatured ? <ToggleRight className="w-7 h-7 text-blue-500" /> : <ToggleLeft className="w-7 h-7 text-slate-400" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Kupon'}
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
            <h3 className="text-lg font-bold text-brand-ink mb-2">Hapus Kupon?</h3>
            <p className="text-sm text-slate-500 mb-6">Kupon <strong>{deleting.code}</strong> akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.</p>
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
