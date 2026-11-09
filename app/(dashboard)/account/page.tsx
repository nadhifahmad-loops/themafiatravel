'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { useToast } from '@/contexts/ToastContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import { NameEditModal, BirthDateEditModal, PhoneEditModal } from '@/components/account/ProfileEditModals';
import { parsePhoneWithCode } from '@/components/account/phone-verify';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatBirthDate(iso: string, locale: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Potongan UI bersama (pola halaman bookings/favorites) ────────────────────
const editBtnClass =
  'shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-orange-300 hover:text-brand-orange';

function CardHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50">
        <i className={`fa-solid ${icon} text-sm text-brand-orange`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h2 className="text-[15px] font-extrabold text-brand-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function InfoRow({ label, value, muted, action }: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <p className={`mt-0.5 break-words text-sm font-bold ${muted ? 'text-slate-400' : 'text-brand-ink'}`}>{value}</p>
      </div>
      {action}
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────
function DeleteAccountModal({ onClose, onConfirm, loading, userEmail, isGoogleLogin }: {
  onClose: () => void; onConfirm: (password: string) => void; loading: boolean; userEmail: string; isGoogleLogin: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const required = ta.danger.modal.confirmRequired;
  const isMatch = confirmText === required && (isGoogleLogin || password.length >= 8);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  if (!mounted) return null;

  // Portal ke <body> agar z-index 10000 selalu di atas navbar, drawer, dan toast
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35)', animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: '#dc2626', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: 'white', fontSize: '22px' }}></i>
          </div>
          <div>
            <h2 style={{ fontWeight: 900, color: 'white', fontSize: '18px', margin: 0, lineHeight: 1.2 }}>{ta.danger.modal.title}</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '2px 0 0', fontWeight: 500 }}>{ta.danger.modal.warning}</p>
          </div>
        </div>
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ta.danger.modal.bullets.map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#991b1b' }}>
                <i className="fa-solid fa-circle-minus" style={{ color: '#fca5a5', fontSize: '10px', marginTop: '4px', flexShrink: 0 }}></i>
                <span style={{ fontWeight: 500, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, margin: '0 0 8px' }}>Akun: <span style={{ fontWeight: 800, color: '#1F1D16' }}>{userEmail}</span></p>
            <p style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
              {ta.danger.modal.confirmLabel} <span style={{ color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>{required}</span> {ta.danger.modal.confirmHelper}:
            </p>
            <input ref={inputRef} type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={required}
              style={{ width: '100%', padding: '14px 16px', border: `2px solid ${isMatch ? '#ef4444' : '#f1f5f9'}`, borderRadius: '12px', fontSize: '14px', fontWeight: 700, outline: 'none', background: isMatch ? '#fef2f2' : '#F5FAFC', color: isMatch ? '#991b1b' : '#334155', transition: 'all 0.2s', boxSizing: 'border-box' }} />
          </div>
          {!isGoogleLogin && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Konfirmasi Password <span style={{ color: '#dc2626' }}>*</span>
              </p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password akun"
                autoComplete="current-password"
                style={{ width: '100%', padding: '14px 16px', border: `2px solid ${password.length >= 8 ? '#ef4444' : '#f1f5f9'}`, borderRadius: '12px', fontSize: '14px', outline: 'none', background: password.length >= 8 ? '#fef2f2' : '#F5FAFC', color: '#334155', transition: 'all 0.2s', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 0', fontWeight: 500 }}>Wajib diisi (min. 8 karakter) untuk menghapus akun — melindungi dari penghapusan oleh orang lain yang menguasai sesi.</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#475569', fontWeight: 700, borderRadius: '14px', border: 'none', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>{ta.danger.modal.cancelBtn}</button>
            <button onClick={() => onConfirm(password)} disabled={!isMatch || loading}
              style={{ flex: 1, padding: '14px', background: isMatch && !loading ? '#dc2626' : '#fca5a5', color: 'white', fontWeight: 800, borderRadius: '14px', border: 'none', fontSize: '14px', cursor: isMatch && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
              {loading ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> : <><i className="fa-solid fa-trash" style={{ fontSize: '13px' }}></i> {ta.danger.modal.confirmBtn}</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── 2FA Section ──────────────────────────────────────────────────────────────
async function fetchTwoFactorStatus(): Promise<{ enabled: boolean; configured: boolean }> {
  const res = await fetch('/api/user/two-factor');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memuat status 2FA');
  return {
    enabled: Boolean(data.data?.enabled),
    configured: Boolean(data.data?.configured),
  };
}

function TwoFactorSection({ onNotify }: { onNotify: (t: { type: 'success' | 'error'; text: string }) => void }) {
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState('');
  const [codesSaved, setCodesSaved] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await fetchTwoFactorStatus();
      setEnabled(status.enabled);
      setConfigured(status.configured);
      setStatusError(false);
    } catch (err) {
      setStatusError(true);
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memuat status 2FA' });
    } finally {
      setStatusLoading(false);
    }
  }, [onNotify]);

  function retryLoadStatus() {
    setStatusLoading(true);
    setStatusError(false);
    void loadStatus();
  }

  useEffect(() => {
    let active = true;
    fetchTwoFactorStatus().then((status) => {
      if (!active) return;
      setEnabled(status.enabled);
      setConfigured(status.configured);
    }).catch((err: unknown) => {
      if (!active) return;
      setStatusError(true);
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memuat status 2FA' });
    }).finally(() => {
      if (active) setStatusLoading(false);
    });
    return () => { active = false; };
  }, [onNotify]);

  async function startSetup() {
    setLoading(true);
    setSetupData(null);
    setCode('');
    setCodesSaved(false);
    try {
      const res = await fetch('/api/user/two-factor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan 2FA');
      setSetupData(data.data);
      setConfigured(true);
      setExpanded(true);
      onNotify({ type: 'success', text: 'Kode QR 2FA siap. Verifikasi dengan aplikasi authenticator.' });
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyiapkan 2FA' });
    } finally {
      setLoading(false);
    }
  }

  async function copyBackupCodes() {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      onNotify({ type: 'success', text: 'Backup code disalin. Simpan di tempat aman, lalu centang konfirmasi.' });
    } catch {
      onNotify({ type: 'error', text: 'Tidak dapat menyalin backup code. Salin secara manual sebelum mengaktifkan 2FA.' });
    }
  }

  async function enable2FA() {
    if (!setupData || !codesSaved || !/^\d{6}$/.test(code.trim())) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/two-factor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enable', code }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengaktifkan 2FA');
      setEnabled(true);
      setConfigured(true);
      setSetupData(null);
      setCode('');
      setCodesSaved(false);
      onNotify({ type: 'success', text: data.message || '2FA berhasil diaktifkan' });
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengaktifkan 2FA' });
    } finally {
      setLoading(false);
    }
  }

  async function disable2FA() {
    const normalizedCode = code.replace(/\s/g, '');
    if (!/^(?:\d{6}|\d{8})$/.test(normalizedCode)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/two-factor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable', code: normalizedCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menonaktifkan 2FA');
      setEnabled(false);
      setConfigured(false);
      setSetupData(null);
      setCode('');
      onNotify({ type: 'success', text: data.message || '2FA berhasil dinonaktifkan' });
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menonaktifkan 2FA' });
    } finally {
      setLoading(false);
    }
  }

  const statusText = statusLoading
    ? ta.securityCard.statusLoading
    : statusError
      ? ta.securityCard.statusUnavailable
      : enabled
        ? ta.securityCard.statusActive
        : ta.securityCard.statusOptional;

  return (
    <div>
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{ta.securityCard.twoFactorLabel}</p>
          <p className={`mt-0.5 text-sm font-bold ${statusError ? 'text-red-500' : enabled ? 'text-emerald-600' : 'text-brand-ink'}`}>
            {statusText}
          </p>
        </div>
        <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} shrink-0 text-[11px] text-slate-400`} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-5 sm:px-5">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
              2FA menambahkan kode authenticator setelah kata sandi saat login dengan email dan kata sandi. Login Google tidak meminta kode ini.
            </p>

            {statusError && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px', background: '#fef2f2', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                <span>Status 2FA gagal dimuat.</span>
                <button onClick={retryLoadStatus} disabled={statusLoading} style={{ border: 0, background: 'transparent', color: '#991b1b', fontWeight: 700, cursor: 'pointer' }}>Coba lagi</button>
              </div>
            )}

            {!statusLoading && !statusError && !enabled && !setupData && (
              <>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <p style={{ margin: '0 0 8px', color: '#1f2937', fontSize: '13px', fontWeight: 700 }}>Sebelum mulai</p>
                  <ol style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px', lineHeight: 1.8 }}>
                    <li>Pasang aplikasi authenticator seperti Google Authenticator, Microsoft Authenticator, atau 1Password.</li>
                    <li>Pindai QR dan simpan backup code di tempat aman yang terpisah dari ponsel.</li>
                    <li>Masukkan kode dari aplikasi untuk mengaktifkan 2FA.</li>
                  </ol>
                </div>
                {configured && (
                  <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', borderRadius: '8px', padding: '12px', fontSize: '13px', lineHeight: 1.5 }}>
                    Setup sebelumnya belum selesai. Membuat QR baru akan mengganti secret dan backup code lama.
                  </p>
                )}
                <button onClick={startSetup} disabled={loading} style={{ alignSelf: 'flex-start', padding: '11px 16px', background: '#1f2937', color: 'white', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: loading ? 'wait' : 'pointer' }}>
                  {loading ? 'Menyiapkan…' : configured ? 'Ulangi setup' : 'Siapkan 2FA'}
                </button>
              </>
            )}

            {setupData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <div>
                  <p style={{ margin: '0 0 6px', color: '#1f2937', fontSize: '13px', fontWeight: 700 }}>1. Tambahkan authenticator</p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>Pindai QR ini dari aplikasi authenticator. Jika tidak bisa memindai, masukkan secret secara manual.</p>
                </div>
                <Image src={setupData.qrCodeDataUrl} width={200} height={200} unoptimized alt="QR untuk menambahkan akun ke aplikasi authenticator" style={{ maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                <details>
                  <summary style={{ color: '#475569', fontSize: '13px', cursor: 'pointer' }}>Tampilkan secret manual</summary>
                  <code style={{ display: 'block', marginTop: '8px', padding: '10px', overflowWrap: 'anywhere', background: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>{setupData.secret}</code>
                </details>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <p style={{ margin: '0 0 6px', color: '#1f2937', fontSize: '13px', fontWeight: 700 }}>2. Simpan backup code</p>
                  <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>Gunakan satu kode jika ponsel atau aplikasi authenticator tidak tersedia. Setiap kode hanya bisa dipakai sekali.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    {setupData.backupCodes.map((backupCode) => <code key={backupCode} style={{ color: '#1f2937', fontSize: '13px' }}>{backupCode}</code>)}
                  </div>
                  <button onClick={() => void copyBackupCodes()} type="button" style={{ marginTop: '10px', padding: '9px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '7px', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Salin backup code
                  </button>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <label htmlFor="two-factor-setup-code" style={{ display: 'block', marginBottom: '8px', color: '#1f2937', fontSize: '13px', fontWeight: 700 }}>3. Verifikasi authenticator</label>
                  <input id="two-factor-setup-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Kode 6 digit" inputMode="numeric" autoComplete="one-time-code" style={{ width: '100%', maxWidth: '320px', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }} />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', color: '#475569', fontSize: '13px', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={codesSaved} onChange={(e) => setCodesSaved(e.target.checked)} style={{ marginTop: '3px' }} />
                  Saya sudah menyimpan backup code di tempat aman.
                </label>
                <button onClick={enable2FA} disabled={loading || code.length !== 6 || !codesSaved} style={{ alignSelf: 'flex-start', padding: '11px 16px', background: loading || code.length !== 6 || !codesSaved ? '#e2e8f0' : '#1f2937', color: loading || code.length !== 6 || !codesSaved ? '#64748b' : 'white', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: loading || code.length !== 6 || !codesSaved ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Memverifikasi…' : 'Aktifkan 2FA'}
                </button>
              </div>
            )}

            {enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <p style={{ margin: 0, color: '#166534', fontSize: '13px', fontWeight: 700 }}>2FA aktif. Login dengan kata sandi akan meminta kode authenticator.</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>Untuk menonaktifkan, masukkan kode authenticator atau satu backup code yang belum pernah dipakai. Ponsel hilang? Gunakan backup code.</p>
                <label htmlFor="two-factor-disable-code" style={{ color: '#1f2937', fontSize: '13px', fontWeight: 700 }}>Kode verifikasi</label>
                <input id="two-factor-disable-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="6 digit authenticator atau 8 digit backup code" inputMode="numeric" autoComplete="one-time-code" style={{ width: '100%', maxWidth: '360px', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }} />
                <button onClick={disable2FA} disabled={loading || !/^(?:\d{6}|\d{8})$/.test(code)} style={{ alignSelf: 'flex-start', padding: '11px 16px', background: loading || !/^(?:\d{6}|\d{8})$/.test(code) ? '#e2e8f0' : '#1f2937', color: loading || !/^(?:\d{6}|\d{8})$/.test(code) ? '#64748b' : 'white', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: loading || !/^(?:\d{6}|\d{8})$/.test(code) ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Memproses…' : 'Nonaktifkan 2FA'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Change Password Section ──────────────────────────────────────────────────
function ChangePasswordSection({ onNotify }: { onNotify: (t: { type: 'success' | 'error'; text: string }) => void }) {
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const strength = (p: string) => { if (!p) return 0; let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return s; };
  const s = strength(form.newPass);
  const sLabel = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'][s];
  const sColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#338CB2'][s];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.current || !form.newPass || form.newPass !== form.confirm) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPass }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui password');
      onNotify({ type: 'success', text: data.message || ta.security.successMsg });
      setForm({ current: '', newPass: '', confirm: '' });
      setShowFields(false);
    } catch (err: unknown) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memperbarui password' });
    } finally { setLoading(false); }
  };

  return (
    <div>
      <button
        aria-expanded={showFields}
        aria-label={ta.security.title}
        onClick={() => setShowFields((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{ta.securityCard.passwordLabel}</p>
          <p className="mt-0.5 text-sm font-bold tracking-widest text-brand-ink">••••••••</p>
        </div>
        <i className={`fa-solid ${showFields ? 'fa-chevron-up' : 'fa-chevron-down'} shrink-0 text-[11px] text-slate-400`} aria-hidden="true" />
      </button>

      {showFields && (
        <div className="border-t border-slate-100 px-4 py-5 sm:px-5">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>{ta.security.currentLabel}</label>
              <div style={{ position: 'relative' }}>
                <input type={showCurrent ? 'text' : 'password'} value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} placeholder="••••••••" required
                  style={{ width: '100%', padding: '14px 44px 14px 16px', background: '#F5FAFC', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#1F1D16', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}>
                  <i className={`fa-solid ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '14px' }}></i>
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>{ta.security.newLabel}</label>
              <div style={{ position: 'relative' }}>
                <input type={showNew ? 'text' : 'password'} value={form.newPass} onChange={e => setForm({ ...form, newPass: e.target.value })} placeholder="Min. 8 karakter" required
                  style={{ width: '100%', padding: '14px 44px 14px 16px', background: '#F5FAFC', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#1F1D16', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}>
                  <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '14px' }}></i>
                </button>
              </div>
              {form.newPass && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                    {[1,2,3,4].map(i => <div key={i} style={{ height: '4px', flex: 1, borderRadius: '2px', background: i <= s ? sColor : '#f1f5f9', transition: 'all 0.3s' }}></div>)}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: sColor }}>{sLabel}</span>
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>{ta.security.confirmLabel}</label>
              <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="Ulangi password baru" required
                style={{ width: '100%', padding: '14px 16px', border: `2px solid ${form.confirm ? (form.confirm === form.newPass ? '#338CB2' : '#ef4444') : '#f1f5f9'}`, borderRadius: '12px', fontSize: '14px', fontWeight: 600, background: form.confirm ? (form.confirm === form.newPass ? '#EFF9FC' : '#fef2f2') : '#F5FAFC', color: '#1F1D16', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading || form.newPass !== form.confirm || !form.current || !form.newPass}
              style={{ width: '100%', padding: '14px', background: (!loading && form.newPass === form.confirm && form.current && form.newPass) ? 'linear-gradient(135deg, #F27717, #D9650E)' : '#f1f5f9', color: (!loading && form.newPass === form.confirm && form.current && form.newPass) ? 'white' : '#94a3b8', fontWeight: 800, borderRadius: '14px', border: 'none', fontSize: '14px', cursor: (!loading && form.newPass === form.confirm && form.current && form.newPass) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: (!loading && form.newPass === form.confirm && form.current && form.newPass) ? '0 4px 12px rgba(242,119,23,0.3)' : 'none' }}>
              {loading ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> : <><i className="fa-solid fa-key" style={{ fontSize: '13px' }}></i> {ta.security.saveBtn}</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const { toast } = useToast();

  usePageTitle('Akun Saya');

  const [form, setForm] = useState({ name: '', email: '', phone: '', phoneCode: '62', birthDate: '' });
  const [provider, setProvider] = useState<'google' | 'credentials' | 'unknown'>('unknown');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [showBirthEdit, setShowBirthEdit] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);

  // Notifikasi selalu lewat toast global (kanan-bawah) agar konsisten dgn halaman lain
  const notify = useCallback((t: { type: 'success' | 'error'; text: string }) => {
    toast(t.text, { variant: t.type });
  }, [toast]);

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return; }
  }, [status, router]);

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      if (status !== 'authenticated' || !session?.user?.email) return;
      try {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const { code, number } = parsePhoneWithCode(data.user.phone || '');
        setForm({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: number,
          phoneCode: code,
          birthDate: data.user.birthDate || '',
        });
        setProvider(data.user.provider === 'google' ? 'google' : 'credentials');
        if (data.user.createdAt) setUserCreatedAt(data.user.createdAt);
      } catch (error) { console.error('[Load Profile]', error); }
    }
    loadProfile();
  }, [status, session?.user?.email]);

  const handleDeleteAccount = async (password: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await signOut({ callbackUrl: '/' });
    } catch (err: unknown) {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      toast(err instanceof Error ? err.message : 'Gagal menghapus akun', { variant: 'error' });
    }
  };

  const handleNameUpdated = useCallback((name: string) => {
    setShowNameEdit(false);
    setForm((f) => ({ ...f, name }));
    toast(ta.profile.successMsg, { variant: 'success' });
  }, [toast, ta]);

  const handleBirthDateUpdated = useCallback((iso: string) => {
    setShowBirthEdit(false);
    setForm((f) => ({ ...f, birthDate: iso }));
    toast(ta.profile.successMsg, { variant: 'success' });
  }, [toast, ta]);

  const handlePhoneUpdated = useCallback(async (fullPhone: string) => {
    setShowPhoneEdit(false);
    const { code, number } = parsePhoneWithCode(fullPhone);
    setForm((f) => ({ ...f, phone: number, phoneCode: code }));
    try {
      await update({ ...session, user: { ...(session?.user ?? {}), phone: fullPhone } });
    } catch { /* perubahan lokal tetap diterapkan */ }
    toast(ta.profile.successMsg, { variant: 'success' });
  }, [session, update, toast, ta]);

  if (status === 'loading') return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bgLight">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-orange" />
    </div>
  );

  const displayPhone = form.phone ? `+${form.phoneCode} ${form.phone}` : '';
  const isGoogleLogin = provider === 'google';
  const birthDateLocale = language === 'ID' ? 'id-ID' : 'en-GB';
  const displayBirthDate = form.birthDate
    ? formatBirthDate(form.birthDate, birthDateLocale)
    : ta.profile.notSet;

  const memberSince = userCreatedAt
    ? new Date(userCreatedAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : session?.user ? new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-brand-bgLight pt-[64px] md:pt-20">
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteAccount} loading={deleteLoading} userEmail={form.email} isGoogleLogin={isGoogleLogin} />}
      {showNameEdit && <NameEditModal initialName={form.name} onClose={() => setShowNameEdit(false)} onSuccess={handleNameUpdated} />}
      {showBirthEdit && <BirthDateEditModal initialDate={form.birthDate} onClose={() => setShowBirthEdit(false)} onSuccess={handleBirthDateUpdated} />}
      {showPhoneEdit && (
        <PhoneEditModal
          initialPhone={form.phone}
          initialPhoneCode={form.phoneCode}
          onClose={() => setShowPhoneEdit(false)}
          onSuccess={handlePhoneUpdated}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <AccountSidebar />

          <div className="flex-1 min-w-0">
            {/* ══ PAGE HEADER ══ */}
            <div className="mb-5 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-extrabold text-brand-ink tracking-tight">{ta.title}</h1>
              <p className="mt-1 text-sm text-brand-neutral">{ta.subtitle}</p>
            </div>

            {/* ══ PROFILE HERO CARD ══ */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card sm:mb-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#F27717] to-[#D9650E] p-6 sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full bg-orange-300/20 blur-3xl" />
                <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-xl font-black text-white shadow-[0_4px_20px_rgba(242,119,23,0.35)]">
                    {session?.user?.image ? (
                      <Image src={session.user.image} alt="Profile" width={60} height={60} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(form.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black text-white sm:text-xl">{form.name || 'Pengguna'}</h2>
                    <p className="mt-1 truncate text-sm text-white/85">{form.email}</p>
                    {displayPhone && <p className="mt-0.5 truncate text-[13px] text-white/70">{displayPhone}</p>}
                    <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white/90">
                      <i className="fa-regular fa-calendar text-[10px]" aria-hidden="true"></i>
                      Member sejak {memberSince}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ KARTU: INFORMASI PROFIL ══ */}
            <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card sm:mb-6">
              <CardHeader icon="fa-user" title={ta.profile.title} subtitle={ta.profile.subtitle} />
              <div className="divide-y divide-slate-100">
                <InfoRow
                  label={ta.profile.nameLabel}
                  value={form.name || '—'}
                  action={
                    <button type="button" onClick={() => setShowNameEdit(true)} className={editBtnClass}>
                      <i className="fa-solid fa-pen text-[10px]" aria-hidden="true"></i>
                      {ta.profile.editBtn}
                    </button>
                  }
                />
                <InfoRow
                  label={ta.profile.birthDateLabel}
                  value={displayBirthDate}
                  muted={!form.birthDate}
                  action={
                    <button type="button" onClick={() => setShowBirthEdit(true)} className={editBtnClass}>
                      <i className="fa-solid fa-pen text-[10px]" aria-hidden="true"></i>
                      {form.birthDate ? ta.profile.editBtn : ta.profile.addBtn}
                    </button>
                  }
                />
                {/* Email read-only — tanpa aksi tambah/ubah email */}
                <InfoRow label={ta.profile.emailLabel} value={form.email || '—'} />
              </div>
            </section>

            {/* ══ KARTU: KEAMANAN AKUN ══ */}
            <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card sm:mb-6">
              <CardHeader icon="fa-shield-halved" title={ta.securityCard.title} subtitle={ta.securityCard.subtitle} />
              <div className="divide-y divide-slate-100">
                {isGoogleLogin ? (
                  <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-500">{ta.securityCard.passwordLabel}</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-400">{ta.securityCard.passwordGoogle}</p>
                    </div>
                    <i className="fa-solid fa-lock shrink-0 text-slate-300" aria-hidden="true"></i>
                  </div>
                ) : (
                  <ChangePasswordSection onNotify={notify} />
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">{ta.securityCard.phoneLabel}</p>
                    <p className={`mt-0.5 break-words text-sm font-bold ${displayPhone ? 'text-brand-ink' : 'text-slate-400'}`}>
                      {displayPhone || ta.securityCard.phoneNotSet}
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowPhoneEdit(true)} className={editBtnClass}>
                    <i className={`fa-solid ${displayPhone ? 'fa-pen' : 'fa-plus'} text-[10px]`} aria-hidden="true"></i>
                    {displayPhone ? ta.profile.editBtn : ta.profile.addBtn}
                  </button>
                </div>

                {!isGoogleLogin && <TwoFactorSection onNotify={notify} />}
              </div>
            </section>

            {/* ══ DELETE ACCOUNT ══ */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-card sm:mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                    <i className="fa-solid fa-triangle-exclamation text-base text-red-500" aria-hidden="true"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-brand-ink">{ta.danger.title}</p>
                    <p className="mt-0.5 text-[13px] text-slate-400">{ta.danger.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="shrink-0 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-bold text-red-600 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
                >
                  {ta.danger.deleteBtn}
                </button>
              </div>
            </div>

            {/* ══ FOOTER ══ */}
            <p className="pb-2 text-center text-xs font-semibold text-slate-400">The Mafia Travel &middot; {memberSince}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
