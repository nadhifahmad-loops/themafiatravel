'use client';

import { useEffect, useState, useCallback } from 'react';
import { Briefcase, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, ArrowUp, ArrowDown } from 'lucide-react';

interface Career {
  id: string;
  title: string;
  department: string;
  type: string;
  location: string;
  description: string;
  requirements: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface CareerForm {
  title: string;
  department: string;
  type: string;
  location: string;
  description: string;
  requirements: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: CareerForm = {
  title: '',
  department: '',
  type: 'full-time',
  location: '',
  description: '',
  requirements: '',
  sortOrder: 0,
  isActive: true,
};

const DEPARTMENTS = ['Engineering', 'Marketing', 'Operations', 'Finance', 'HR', 'Design', 'Customer Service', 'Lainnya'];
const TYPES = ['full-time', 'part-time', 'freelance', 'internship'];

export default function CareersClient() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Career | null>(null);
  const [form, setForm] = useState<CareerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Career | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' as 'success' | 'error' | '' });

  const fetchCareers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/careers');
      const data = await res.json();
      setCareers(data.careers || []);
    } catch {} finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchCareers(); }, [fetchCareers]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (c: Career) => {
    setEditing(c);
    setForm({
      title: c.title,
      department: c.department,
      type: c.type,
      location: c.location,
      description: c.description,
      requirements: c.requirements,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showMessage('Judul posisi wajib diisi.', 'error'); return; }
    if (!form.department) { showMessage('Divisi wajib dipilih.', 'error'); return; }
    if (!form.location.trim()) { showMessage('Lokasi wajib diisi.', 'error'); return; }
    if (!form.description.trim()) { showMessage('Deskripsi wajib diisi.', 'error'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/careers/${editing.id}` : '/api/admin/careers';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan lowongan.');
      setShowForm(false);
      showMessage(editing ? 'Lowongan berhasil diperbarui.' : 'Lowongan berhasil dibuat.', 'success');
      fetchCareers();
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/careers/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus lowongan.');
      setDeleting(null);
      showMessage('Lowongan berhasil dihapus.', 'success');
      fetchCareers();
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleToggle = async (c: Career) => {
    try {
      await fetch(`/api/admin/careers/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, isActive: !c.isActive }),
      });
      fetchCareers();
    } catch {}
  };

  const handleMove = async (c: Career, direction: 'up' | 'down') => {
    const idx = careers.findIndex(x => x.id === c.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= careers.length) return;
    const swap = careers[swapIdx];
    try {
      await Promise.all([
        fetch(`/api/admin/careers/${c.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...c, sortOrder: swap.sortOrder }),
        }),
        fetch(`/api/admin/careers/${swap.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...swap, sortOrder: c.sortOrder }),
        }),
      ]);
      fetchCareers();
    } catch {}
  };

  const typeBadge = (t: string) => {
    const map: Record<string, string> = {
      'full-time': 'bg-blue-100 text-blue-700',
      'part-time': 'bg-purple-100 text-purple-700',
      'freelance': 'bg-amber-100 text-amber-700',
      'internship': 'bg-teal-100 text-teal-700',
    };
    return map[t] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Manajemen Karier</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Kelola lowongan pekerjaan yang ditampilkan di halaman karier</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Tambah Lowongan
        </button>
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`fixed top-4 right-4 z-[1300] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data...</div>
        ) : careers.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada lowongan</p>
            <p className="text-slate-400 text-sm mt-1">Klik &quot;Tambah Lowongan&quot; untuk membuat lowongan pertama</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-12"></th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Posisi</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Divisi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Tipe</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Lokasi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {careers.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMove(c, 'up')} disabled={i === 0} className="text-slate-400 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleMove(c, 'down')} disabled={i === careers.length - 1} className="text-slate-400 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{c.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.department}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${typeBadge(c.type)}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.location}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(c)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${c.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {c.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {c.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleting(c)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-brand-ink">{editing ? 'Edit Lowongan' : 'Tambah Lowongan'}</h2>
              <button onClick={() => setShowForm(false)} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Judul Posisi */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Judul Posisi *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Frontend Developer" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
              </div>

              {/* Divisi & Tipe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Divisi *</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all bg-white">
                    <option value="">Pilih divisi</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Tipe Kerja</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all bg-white">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Lokasi */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Lokasi *</label>
                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Jakarta, Indonesia" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Deskripsi Pekerjaan *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Jelaskan tanggung jawab dan lingkup pekerjaan..." className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all resize-none" />
              </div>

              {/* Persyaratan */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Persyaratan <span className="text-slate-400 font-normal">(satu poin per baris)</span></label>
                <textarea value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} rows={4} placeholder="Minimal 2 tahun pengalaman&#10;Menguasai React/Next.js&#10;Komunikasi yang baik" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all resize-none" />
              </div>

              {/* Urutan */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Urutan Tampil</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
                <p className="text-xs text-slate-400 mt-1">Angka lebih kecil tampil lebih dulu</p>
              </div>

              {/* Aktif */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Status Aktif</p>
                  <p className="text-xs text-slate-500">Lowongan ditampilkan di halaman karier</p>
                </div>
                <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-orange-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2.5 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} disabled={saving} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors disabled:opacity-60">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-70 flex items-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editing ? 'Simpan' : 'Buat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm" onClick={() => !saving && setDeleting(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-base font-bold text-brand-ink">Hapus Lowongan?</h2>
            <p className="text-sm text-slate-500 mt-1.5">Lowongan &quot;{deleting.title}&quot; akan dihapus permanen.</p>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setDeleting(null)} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors disabled:opacity-60">
                Batal
              </button>
              <button onClick={handleDelete} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
