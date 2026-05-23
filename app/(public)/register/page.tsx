'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (form.password !== form.confirm) { 
      setError('Password dan Konfirmasi Password tidak cocok'); 
      return; 
    }
    if (form.password.length < 6) { 
      setError('Password minimal 6 karakter'); 
      return; 
    }
    
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) { 
        setError(data.error || 'Terjadi kesalahan saat mendaftar'); 
        setLoading(false); 
        return; 
      }
      
      // Auto login setelah register manual berhasil
      const signInResult = await signIn('credentials', { 
        email: form.email, 
        password: form.password, 
        redirect: false 
      });

      if (signInResult?.error) {
        setError('Gagal masuk otomatis, silakan login manual.');
        setLoading(false);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Terjadi kesalahan pada server.');
      setLoading(false);
    }
  };

  const handleChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen font-sans text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      
      {/* ── MAIN CONTENT ── */}
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-[1100px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[700px]">
          
          {/* ── LEFT SIDE: BRANDING VISUAL ── */}
          <div className="hidden lg:flex lg:w-1/2 relative bg-orange-600 p-12 flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 z-0 bg-black/20 mix-blend-multiply"></div>
            <img 
              src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80" 
              alt="Premium Travel" 
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
            />
            
            <div className="relative z-10">
              <Link href="/" className="inline-block mb-4 hover:scale-105 transition-transform">
                <h1 className="font-black text-white text-4xl font-display tracking-tight leading-tight">
                  The Mafia<br/>Travel
                </h1>
              </Link>
              <p className="text-white/90 text-lg max-w-sm leading-relaxed">
                Experience unstoppable movement with premium travel planning designed for the decisive explorer.
              </p>
            </div>
            
            <div className="relative z-10">
              <div className="flex gap-4 items-center">
                <div className="h-1 w-12 bg-white rounded-full"></div>
                <span className="font-bold text-white text-xs uppercase tracking-widest">Premium Member Access</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT SIDE: FORM REGISTRASI ── */}
          <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">
            
            {/* Mobile Logo Only */}
            <div className="lg:hidden mb-8">
              <Link href="/" className="font-black text-2xl font-display text-slate-900">
                The <span className="text-orange-600">Mafia</span> Travel
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 mb-2 font-display tracking-tight">Buat Akun Baru</h2>
              <p className="text-slate-500 text-sm">Daftar sekarang untuk menikmati fitur eksklusif perjalananmu.</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6 animate-fade-in">
                <i className="fa-solid fa-circle-exclamation text-red-500"></i>
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* 🔥 GOOGLE LOGIN (SUDAH AKTIF) 🔥 */}
            <div className="mb-6">
              <button 
                type="button" 
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Daftar dengan Google
              </button>
            </div>

            <div className="relative flex items-center mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white">Atau daftar dengan Email</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="text"
                    id="name"
                    value={form.name}
                    onChange={handleChange('name')}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="name" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    Nama Lengkap
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="tel"
                    id="phone"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="phone" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    Nomor WhatsApp
                  </label>
                </div>
              </div>

              <div className="relative">
                <input
                  type="email"
                  id="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                  disabled={loading}
                  className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                  placeholder=" "
                />
                <label htmlFor="email" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                  Alamat Email
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="password" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    Password
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="password"
                    id="confirm"
                    value={form.confirm}
                    onChange={handleChange('confirm')}
                    required
                    disabled={loading}
                    className="peer w-full h-14 px-4 pt-4 pb-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium text-slate-900 bg-transparent disabled:bg-slate-50"
                    placeholder=" "
                  />
                  <label htmlFor="confirm" className="absolute left-4 top-4 text-slate-400 text-sm font-medium pointer-events-none transition-all duration-200 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-orange-600 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-not-placeholder-shown:-translate-y-2.5 peer-not-placeholder-shown:scale-75 origin-left">
                    Konfirmasi Password
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 mt-4 bg-orange-600 text-white font-bold rounded-lg shadow-lg shadow-orange-600/20 hover:bg-orange-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Memproses...
                  </>
                ) : (
                  <>
                    Daftar Sekarang
                    <i className="fa-solid fa-arrow-right"></i>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Sudah punya akun?{' '}
                <Link href="/login" className="text-orange-600 font-bold hover:underline underline-offset-4">
                  Masuk di sini
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── TRUST BADGES ── */}
      <div className="max-w-[1280px] mx-auto w-full px-6 pb-12">
        <div className="flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <i className="fa-solid fa-shield-halved text-orange-600"></i>
            <span className="font-bold text-slate-700 text-xs">Secure 256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <i className="fa-solid fa-user-check text-orange-600"></i>
            <span className="font-bold text-slate-700 text-xs">Identity Verified Partners</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <i className="fa-solid fa-headset text-orange-600"></i>
            <span className="font-bold text-slate-700 text-xs">24/7 Global Concierge</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t bg-slate-50 border-slate-200 mt-auto">
        <div className="max-w-[1280px] mx-auto py-8 px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="text-lg font-black text-slate-900 font-display">The Mafia Travel</span>
            <p className="text-xs text-slate-500 font-medium">© 2026 The Mafia Travel. Unstoppable Movement.</p>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">About Us</a>
            <a href="#" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}