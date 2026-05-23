'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load data dari session saat komponen dimuat
  useEffect(() => {
    if (session?.user) {
      setForm({
        name: session.user.name || '',
        email: session.user.email || '',
        phone: (session.user as any).phone || '',
      });
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui profil');

      // Update session client-side agar nama di Navbar langsung berubah
      await update({ ...session, user: { ...session?.user, name: form.name } });
      
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui, Bos!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header Profil */}
          <div className="bg-slate-900 px-8 py-10 text-white relative">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-orange-500/20 uppercase">
                {form.name.charAt(0) || 'M'}
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">Data Akun</h1>
                <p className="text-slate-400 text-sm font-semibold">Kelola informasi profil kamu di sini.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {message.text && (
              <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {/* Nama Lengkap */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-slate-800 font-bold focus:border-orange-500 focus:bg-white outline-none transition-all"
                  placeholder="Contoh: Vito Corleone"
                  required
                />
              </div>

              {/* Email (Read Only - Biasanya Email jadi ID unik) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Alamat Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full px-5 py-4 bg-gray-100 border-2 border-gray-100 rounded-2xl text-slate-400 font-bold cursor-not-allowed outline-none"
                />
                <p className="text-[10px] text-slate-400 italic ml-1">* Email tidak dapat diubah demi keamanan akun.</p>
              </div>

              {/* Nomor Handphone */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nomor Handphone</label>
                <div className="flex gap-2">
                  <div className="px-5 py-4 bg-gray-100 border-2 border-gray-100 rounded-2xl text-slate-500 font-bold">
                    +62
                  </div>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                    className="flex-1 px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-slate-800 font-bold focus:border-orange-500 focus:bg-white outline-none transition-all"
                    placeholder="8123456789"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-2xl shadow-xl shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <i className="fa-solid fa-save"></i>
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}