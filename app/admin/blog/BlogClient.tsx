'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Pen, Plus, Pencil, Trash2, X, Upload, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, Eye, EyeOff, Image } from 'lucide-react';
import ImageNext from 'next/image';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  author: string;
  category: string;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  createdAt: string;
}

interface BlogForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  category: string;
  isPublished: boolean;
  sortOrder: number;
}

const EMPTY_FORM: BlogForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  author: 'Admin',
  category: 'Travel Tips',
  isPublished: false,
  sortOrder: 0,
};

const CATEGORIES = ['Travel Tips', 'Promo', 'Berita', 'Panduan', 'Inspirasi', 'Lainnya'];

export default function BlogClient() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState<BlogForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BlogPost | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' as 'success' | 'error' | '' });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/blog');
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {} finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (p: BlogPost) => {
    setEditing(p);
    setForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      coverImage: p.coverImage || '',
      author: p.author,
      category: p.category,
      isPublished: p.isPublished,
      sortOrder: p.sortOrder,
    });
    setShowForm(true);
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal upload gambar.');
      setForm(prev => ({ ...prev, coverImage: data.url }));
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setUploading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showMessage('Judul artikel wajib diisi.', 'error'); return; }
    if (!form.content.trim()) { showMessage('Konten artikel wajib diisi.', 'error'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/blog/${editing.id}` : '/api/admin/blog';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan artikel.');
      setShowForm(false);
      showMessage(editing ? 'Artikel berhasil diperbarui.' : 'Artikel berhasil dibuat.', 'success');
      fetchPosts();
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/blog/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus artikel.');
      setDeleting(null);
      showMessage('Artikel berhasil dihapus.', 'success');
      fetchPosts();
    } catch (e: any) { showMessage(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleTogglePublish = async (p: BlogPost) => {
    try {
      await fetch(`/api/admin/blog/${p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, isPublished: !p.isPublished }),
      });
      fetchPosts();
    } catch {}
  };

  const handleMove = async (p: BlogPost, direction: 'up' | 'down') => {
    const idx = posts.findIndex(x => x.id === p.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= posts.length) return;
    const swap = posts[swapIdx];
    try {
      await Promise.all([
        fetch(`/api/admin/blog/${p.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...p, sortOrder: swap.sortOrder }),
        }),
        fetch(`/api/admin/blog/${swap.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...swap, sortOrder: p.sortOrder }),
        }),
      ]);
      fetchPosts();
    } catch {}
  };

  const autoSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Manajemen Blog</h1>
          <p className="text-brand-neutral text-sm mt-0.5">Kelola artikel blog yang ditampilkan di halaman blog</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Tambah Artikel
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
        ) : posts.length === 0 ? (
          <div className="p-12 text-center">
            <Pen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada artikel</p>
            <p className="text-slate-400 text-sm mt-1">Klik &quot;Tambah Artikel&quot; untuk membuat artikel pertama</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-12"></th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Artikel</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Kategori</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Penulis</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMove(p, 'up')} disabled={i === 0} className="text-slate-400 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleMove(p, 'down')} disabled={i === posts.length - 1} className="text-slate-400 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.coverImage ? (
                          <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            <ImageNext src={p.coverImage} alt={p.title} width={64} height={40} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Image className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.title}</p>
                          <p className="text-xs text-slate-400 truncate">{p.excerpt || 'Tanpa ringkasan'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.author}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleTogglePublish(p)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${p.isPublished ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                        {p.isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {p.isPublished ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleting(p)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
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
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-brand-ink">{editing ? 'Edit Artikel' : 'Tambah Artikel'}</h2>
              <button onClick={() => setShowForm(false)} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Judul */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Judul Artikel *</label>
                <input type="text" value={form.title} onChange={e => {
                  const v = e.target.value;
                  setForm(prev => ({ ...prev, title: v, slug: editing ? prev.slug : autoSlug(v) }));
                }} placeholder="Tips Liburan Hemat ke Bali" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Slug <span className="text-slate-400 font-normal">(URL-friendly)</span></label>
                <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="tips-liburan-hemat-ke-bali" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-mono text-xs" />
              </div>

              {/* Kategori & Penulis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Kategori</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all bg-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Penulis</label>
                  <input type="text" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
                </div>
              </div>

              {/* Ringkasan */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Ringkasan</label>
                <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={2} placeholder="Ringkasan singkat artikel..." className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all resize-none" />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Gambar Sampul <span className="text-slate-400 font-normal">(opsional)</span></label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${dragActive ? 'border-orange-400 bg-orange-50' : form.coverImage ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                  {uploading ? (
                    <div className="py-4">
                      <div className="w-8 h-8 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Mengupload...</p>
                    </div>
                  ) : form.coverImage ? (
                    <div className="space-y-2">
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-100">
                        <ImageNext src={form.coverImage} alt="Preview" width={400} height={128} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-emerald-600 font-medium">Gambar berhasil diupload. Klik untuk mengganti.</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-sm text-slate-600 font-medium">Klik atau seret gambar ke sini</p>
                      <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, atau WebP. Maks 5MB.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Konten */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Konten Artikel * <span className="text-slate-400 font-normal">(Markdown)</span></label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={12} placeholder="# Judul&#10;&#10;Isi artikel Anda di sini..." className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all resize-none font-mono text-xs leading-relaxed" />
              </div>

              {/* Urutan */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Urutan Tampil</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
              </div>

              {/* Publish */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Status Publish</p>
                  <p className="text-xs text-slate-500">{form.isPublished ? 'Artikel akan tampil di halaman blog' : 'Artikel masih draft, belum terlihat publik'}</p>
                </div>
                <button type="button" onClick={() => setForm({ ...form, isPublished: !form.isPublished })} className={`relative w-11 h-6 rounded-full transition-colors ${form.isPublished ? 'bg-orange-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.isPublished ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2.5 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} disabled={saving} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors disabled:opacity-60">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving || uploading} className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-70 flex items-center gap-2">
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
            <h2 className="text-base font-bold text-brand-ink">Hapus Artikel?</h2>
            <p className="text-sm text-slate-500 mt-1.5">Artikel &quot;{deleting.title}&quot; akan dihapus permanen beserta gambarnya.</p>
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
