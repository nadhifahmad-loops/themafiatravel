'use client';

import { useState } from 'react';
import { User, Mail, Phone, Lock, Save, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

interface ProfileClientProps {
  user: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    image?: string | null;
  } | null;
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  // Mengisi form dengan data dari session (jika ada)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });

  async function handleSaveProfile() {
    setIsSaving(true);
    setStatusMessage('');
    setStatusType('');

    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setStatusType('success');
        setStatusMessage('Profil berhasil diperbarui.');
      } else {
        setStatusType('error');
        setStatusMessage(json.error || 'Gagal memperbarui profil.');
      }
    } catch (error) {
      console.error(error);
      setStatusType('error');
      setStatusMessage('Terjadi kesalahan server. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Profil Admin</h1>
        <p className="text-slate-500 text-sm mt-0.5">Kelola informasi data diri dan keamanan akun Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Kolom Kiri: Kartu Profil */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-4xl font-bold mb-4 shadow-inner">
              {user?.image ? (
                <Image src={user?.image ?? ''} alt="Profile" width={96} height={96} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || 'A'
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-800">{user?.name || 'Administrator'}</h2>
            <p className="text-sm text-slate-500 mb-4">{user?.email || 'admin@mafia.travel'}</p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" /> Hak Akses: Administrator
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Form Edit Profil & Keamanan */}
        <div className="md:col-span-2 space-y-6">
          {statusMessage ? (
            <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${statusType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
              {statusMessage}
            </div>
          ) : null}
          
          {/* Form Informasi Dasar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Informasi Dasar</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Alamat Email (Read-only)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="email" 
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Email tidak dapat diubah karena terikat dengan sistem autentikasi.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Nomor Handphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="Contoh: 08123456789"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>
            
            {/* Tombol Simpan Profil */}
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end">
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-70"
              >
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </div>

          {/* Form Keamanan / Ganti Password */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Keamanan</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Password Baru</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="password" 
                    placeholder="Kosongkan jika tidak ingin mengubah password"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end">
              <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95">
                Perbarui Password
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}