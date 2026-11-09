'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

export const COUNTRY_CODES = [
  { code: '62', label: 'ID', name: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: '1',  label: 'US', name: 'Amerika Serikat', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: '44', label: 'GB', name: 'Inggris', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: '60', label: 'MY', name: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: '65', label: 'SG', name: 'Singapura', flag: '\u{1F1F8}\u{1F1EC}' },
  { code: '66', label: 'TH', name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: '63', label: 'PH', name: 'Filipina', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: '84', label: 'VN', name: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}' },
  { code: '91', label: 'IN', name: 'India', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: '86', label: 'CN', name: 'Tiongkok', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: '81', label: 'JP', name: 'Jepang', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: '82', label: 'KR', name: 'Korea Selatan', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: '61', label: 'AU', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: '64', label: 'NZ', name: 'Selandia Baru', flag: '\u{1F1F3}\u{1F1FF}' },
  { code: '971', label: 'AE', name: 'Uni Emirat Arab', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: '966', label: 'SA', name: 'Arab Saudi', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: '49', label: 'DE', name: 'Jerman', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: '33', label: 'FR', name: 'Prancis', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: '39', label: 'IT', name: 'Italia', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: '34', label: 'ES', name: 'Spanyol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: '7',  label: 'RU', name: 'Rusia', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: '55', label: 'BR', name: 'Brasil', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: '52', label: 'MX', name: 'Meksiko', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: '234', label: 'NG', name: 'Nigeria', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: '27', label: 'ZA', name: 'Afrika Selatan', flag: '\u{1F1FF}\u{1F1E6}' },
  { code: '90', label: 'TR', name: 'Turki', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: '20', label: 'EG', name: 'Mesir', flag: '\u{1F1EA}\u{1F1EC}' },
  { code: '886', label: 'TW', name: 'Taiwan', flag: '\u{1F1F9}\u{1F1FC}' },
  { code: '852', label: 'HK', name: 'Hong Kong', flag: '\u{1F1ED}\u{1F1F0}' },
  { code: '92', label: 'PK', name: 'Pakistan', flag: '\u{1F1F5}\u{1F1F0}' },
  { code: '94', label: 'LK', name: 'Sri Lanka', flag: '\u{1F1F1}\u{1F1F3}' },
];

type OtpApiResponse = { success?: boolean; error?: string; phone?: string };

async function readOtpResponse(response: Response): Promise<OtpApiResponse> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    if (response.status === 404) {
      throw new Error('Endpoint OTP tidak ditemukan (404). Restart server Next.js lalu coba lagi.');
    }
    throw new Error(`Server mengirim respons yang tidak valid (HTTP ${response.status})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Respons server tidak valid. Silakan coba lagi.');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Respons server tidak valid. Silakan coba lagi.');
  }

  return {
    success: 'success' in payload && typeof payload.success === 'boolean' ? payload.success : undefined,
    error: 'error' in payload && typeof payload.error === 'string' ? payload.error : undefined,
    phone: 'phone' in payload && typeof payload.phone === 'string' ? payload.phone : undefined,
  };
}

export function parsePhoneWithCode(raw: string): { code: string; number: string } {
  if (!raw) return { code: '62', number: '' };
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (raw.startsWith(c.code) && raw.length > c.code.length) {
      return { code: c.code, number: raw.slice(c.code.length) };
    }
  }
  if (raw.startsWith('0')) return { code: '62', number: raw.slice(1) };
  return { code: '62', number: raw };
}

export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  const { language } = useLanguage();
  const ta = i18n.account[language];
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div style={{ position: 'fixed', top: '96px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, animation: 'fadeInDown 0.3s ease' }}>
      <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.2)', borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px', minWidth: '320px', maxWidth: '420px', border: '1px solid #e2e8f0' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: type === 'success' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fa-solid ${type === 'success' ? 'fa-check' : 'fa-xmark'}`} style={{ color: 'white', fontSize: '16px' }}></i>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px', margin: 0 }}>{type === 'success' ? ta.toast.success : ta.toast.error}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0', fontWeight: 500 }}>{message}</p>
        </div>
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
          <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }}></i>
        </button>
      </div>
    </div>
  );
}

export function CountryCodeSelect({ value, onChange, dropdownId }: { value: string; onChange: (code: string) => void; dropdownId?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ddId = dropdownId || 'cc-dropdown';

  const selected = COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0];
  const filtered = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search)
  );

  const updatePos = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
    }
  };

  useEffect(() => {
    if (open) { updatePos(); setSearch(''); setTimeout(() => searchRef.current?.focus(), 50); }
    else { setPos(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePos();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      const dropdown = document.getElementById(ddId);
      if (dropdown?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, ddId]);

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '13px 12px', background: '#f8fafc', borderWidth: '2px', borderStyle: 'solid', borderColor: open ? '#ea580c' : '#e2e8f0', borderRadius: '12px', cursor: 'pointer', outline: 'none', transition: 'border-color 0.2s', minWidth: '120px', fontSize: '14px', fontWeight: 600, color: '#0f172a', flexShrink: 0 }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{selected.flag}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>+{selected.code}</span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: '9px', color: '#94a3b8' }}></i>
      </button>
      {open && pos && createPortal(
        <div id={ddId} style={{ position: 'absolute', top: pos.top, left: pos.left, width: '280px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25)', zIndex: 99999, overflow: 'hidden', animation: 'popIn 0.2s ease' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', borderRadius: '10px', padding: '8px 12px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '12px', color: '#94a3b8' }}></i>
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari negara..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontWeight: 500, color: '#0f172a', width: '100%' }} />
            </div>
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Negara tidak ditemukan</div>
            ) : filtered.map(c => (
              <button key={c.code} type="button"
                onClick={() => { onChange(c.code); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px', background: c.code === value ? '#fff7ed' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s', fontSize: '14px' }}
                onMouseEnter={e => { if (c.code !== value) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (c.code !== value) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: '20px', lineHeight: 1, width: '28px', textAlign: 'center' }}>{c.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</span>
                </div>
                <span style={{ fontWeight: 700, color: c.code === value ? '#ea580c' : '#64748b', fontSize: '13px' }}>+{c.code}</span>
                {c.code === value && <i className="fa-solid fa-check" style={{ fontSize: '11px', color: '#ea580c' }}></i>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function PhoneVerifyModal({ phone, phoneCode, onSuccess, onClose }: {
  phone: string; phoneCode: string; onSuccess: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullPhone = `${phoneCode}${phone}`;
  const countryInfo = COUNTRY_CODES.find(c => c.code === phoneCode) || COUNTRY_CODES[0];

  useEffect(() => {
    if (step !== 'verify' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, step]);

  const handleSendOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/phone/verify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await readOtpResponse(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim OTP');
      setMaskedPhone(data.phone || `+${phoneCode} ${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 4))}`);
      setStep('verify');
      setCountdown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim OTP');
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
      setOtp(newOtp);
      inputRefs.current[newOtp.findIndex(c => !c) === -1 ? 5 : newOtp.findIndex(c => !c)]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Masukkan kode OTP 6 digit'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/phone/verify-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code }),
      });
      const data = await readOtpResponse(res);
      if (!res.ok) throw new Error(data.error || 'Verifikasi gagal');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally { setLoading(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35)', animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(234,88,12,0.1)', filter: 'blur(30px)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(234,88,12,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-mobile-screen" style={{ color: '#ea580c', fontSize: '20px' }}></i>
              </div>
              <div>
                <h2 style={{ fontWeight: 900, color: 'white', fontSize: '17px', margin: 0, lineHeight: 1.2 }}>Verifikasi Nomor HP</h2>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '3px 0 0', fontWeight: 500 }}>{step === 'send' ? 'Kirim kode OTP ke nomor kamu' : 'Masukkan kode yang dikirim'}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
              <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }}></i>
            </button>
          </div>
        </div>

        <div style={{ padding: '28px' }}>
          {step === 'send' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-phone" style={{ color: '#3b82f6', fontSize: '16px' }}></i>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0 }}>Nomor Tujuan</p>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>{countryInfo.flag} +{phoneCode} {phone}</p>
                </div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#f59e0b', fontSize: '14px', marginTop: '1px', flexShrink: 0 }}></i>
                <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                  Kode verifikasi akan dikirim via <strong>WhatsApp</strong> ke nomor di atas. Pastikan nomor aktif.
                </p>
              </div>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444', fontSize: '14px', flexShrink: 0 }}></i>
                  <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>{error}</p>
                </div>
              )}
              <button onClick={handleSendOTP} disabled={loading}
                style={{ width: '100%', padding: '14px', background: loading ? '#e2e8f0' : '#ea580c', color: loading ? '#94a3b8' : 'white', fontWeight: 800, borderRadius: '14px', border: 'none', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 14px rgba(234,88,12,0.25)' }}>
                {loading ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> : <><i className="fa-solid fa-paper-plane" style={{ fontSize: '13px' }}></i> Kirim Kode OTP</>}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Kode verifikasi 6 digit telah dikirim ke<br />
                <strong style={{ color: '#0f172a' }}>{maskedPhone}</strong>
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} onPaste={i === 0 ? handlePaste : undefined}
                    style={{ width: '48px', height: '56px', textAlign: 'center', fontSize: '22px', fontWeight: 800, color: '#0f172a', background: digit ? '#f0fdf4' : '#f8fafc', border: `2px solid ${digit ? '#10b981' : '#e2e8f0'}`, borderRadius: '14px', outline: 'none', transition: 'all 0.2s', caretColor: '#ea580c' }} />
                ))}
              </div>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444', fontSize: '14px', flexShrink: 0 }}></i>
                  <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>{error}</p>
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
                {countdown > 0 ? (
                  <span>Kirim ulang dalam <strong style={{ color: '#ea580c' }}>{countdown}s</strong></span>
                ) : (
                  <button onClick={() => { setOtp(['', '', '', '', '', '']); setError(''); handleSendOTP(); }} style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: '13px', padding: 0 }}>Kirim Ulang Kode</button>
                )}
              </div>
              <button onClick={handleVerify} disabled={loading || otp.join('').length !== 6}
                style={{ width: '100%', padding: '14px', background: (loading || otp.join('').length !== 6) ? '#e2e8f0' : '#10b981', color: (loading || otp.join('').length !== 6) ? '#94a3b8' : 'white', fontWeight: 800, borderRadius: '14px', border: 'none', fontSize: '14px', cursor: (loading || otp.join('').length !== 6) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: (loading || otp.join('').length !== 6) ? 'none' : '0 4px 14px rgba(16,185,129,0.25)' }}>
                {loading ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> : <><i className="fa-solid fa-check" style={{ fontSize: '13px' }}></i> Verifikasi & Simpan</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
