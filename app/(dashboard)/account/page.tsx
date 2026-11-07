'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import AccountSidebar from '@/components/account/AccountSidebar';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  const { language } = useLanguage();
  const ta = i18n.account[language];
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div style={{ position: 'fixed', top: '96px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, animation: 'fadeInDown 0.3s ease' }}>
      <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', boxShadow: '0 20px 50px -12px rgba(31,29,22,0.12)', borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px', minWidth: '320px', maxWidth: '420px', border: '1px solid #e2e8f0' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: type === 'success' ? '#338CB2' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fa-solid ${type === 'success' ? 'fa-check' : 'fa-xmark'}`} style={{ color: 'white', fontSize: '16px' }}></i>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, color: '#1F1D16', fontSize: '13px', margin: 0 }}>{type === 'success' ? ta.toast.success : ta.toast.error}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0', fontWeight: 500 }}>{message}</p>
        </div>
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
          <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }}></i>
        </button>
      </div>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────
function DeleteAccountModal({ onClose, onConfirm, loading, userEmail, isGoogleLogin }: {
  onClose: () => void; onConfirm: (password: string) => void; loading: boolean; userEmail: string; isGoogleLogin: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const required = ta.danger.modal.confirmRequired;
  const isMatch = confirmText === required && (isGoogleLogin || password.length >= 8);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
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
    </div>
  );
}

// ─── Change Password Section ──────────────────────────────────────────────────
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

  return (
    <div>
      <button aria-expanded={expanded} onClick={() => setExpanded((prev) => !prev)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontWeight: 700, color: '#1F1D16', fontSize: '14px', margin: 0 }}>Autentikasi 2 Langkah</p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>
              {statusLoading ? 'Memuat status…' : statusError ? 'Status tidak tersedia' : enabled ? 'Aktif' : 'Opsional'}
            </p>
          </div>
        </div>
        <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true" style={{ color: '#64748b', fontSize: '12px' }} />
      </button>

      {expanded && (
        <div style={{ marginTop: '10px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white' }}>
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
      {!showFields ? (
        <button aria-label={ta.security.title} onClick={() => setShowFields(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#F5FAFC', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF9FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-lock" style={{ color: '#338CB2', fontSize: '14px' }}></i>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: 700, color: '#1F1D16', fontSize: '14px', margin: 0 }}>{ta.security.title}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>{ta.security.subtitle}</p>
            </div>
          </div>
          <i className="fa-solid fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '12px' }}></i>
        </button>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#F5FAFC', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-lock" style={{ color: '#64748b', fontSize: '13px' }}></i>
              <span style={{ fontWeight: 700, color: '#334155', fontSize: '14px' }}>{ta.security.title}</span>
            </div>
            <button aria-label="Tutup keamanan akun" onClick={() => { setShowFields(false); setForm({ current: '', newPass: '', confirm: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
              <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }}></i>
            </button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
  const { data: session, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const ta = i18n.account[language];

  usePageTitle('Akun Saya');

  const [form, setForm] = useState({ name: '', email: '', phone: '', phoneCode: '62' });
  const [provider, setProvider] = useState<'google' | 'credentials' | 'unknown'>('unknown');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

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
        const rawPhone = data.user.phone || '';
        // Simple parse: if starts with country code, split
        let phoneCode = '62';
        let phone = rawPhone;
        if (rawPhone.startsWith('62') && rawPhone.length > 2) { phoneCode = '62'; phone = rawPhone.slice(2); }
        else if (rawPhone.startsWith('0')) { phoneCode = '62'; phone = rawPhone.slice(1); }
        setForm({ name: data.user.name || '', email: data.user.email || '', phone, phoneCode });
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
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menghapus akun' });
    }
  };

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#F5FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#F27717', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const displayPhone = form.phone ? `+${form.phoneCode} ${form.phone}` : '';
  const isGoogleLogin = provider === 'google';

  const memberSince = userCreatedAt
    ? new Date(userCreatedAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : session?.user ? new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-brand-bgLight">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .acct-card { animation: slideUp 0.45s ease forwards; opacity: 0; }
        .acct-card:nth-child(1) { animation-delay: 0s; }
        .acct-card:nth-child(2) { animation-delay: 0.07s; }
        .acct-card:nth-child(3) { animation-delay: 0.14s; }
        .acct-card:nth-child(4) { animation-delay: 0.21s; }
        .acct-card:nth-child(5) { animation-delay: 0.28s; }
        .acct-card:nth-child(6) { animation-delay: 0.35s; }
        @media (max-width: 640px) {
          .profile-hero { flex-direction: column !important; text-align: center !important; }
          .profile-hero .avatar { margin: 0 auto !important; }
          .profile-hero-actions { justify-content: center !important; }
          .info-row { flex-direction: column !important; align-items: flex-start !important; gap: 4px !important; }
          .info-row > div:last-child { text-align: left !important; }
          .delete-row { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}} />

      {toast && <Toast key={`${toast.type}-${toast.text}`} message={toast.text} type={toast.type} onClose={() => setToast(null)} />}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteAccount} loading={deleteLoading} userEmail={form.email} isGoogleLogin={isGoogleLogin} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-[64px] md:pt-20">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <AccountSidebar />
          <div className="flex-1 min-w-0">

        {/* ══ PAGE HEADER ══ */}
        <div className="acct-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1F1D16', margin: 0, letterSpacing: '-0.02em' }}>{ta.title}</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0', fontWeight: 500 }}>{ta.subtitle}</p>
        </div>

        {/* ══ PROFILE HERO CARD ══ */}
        <div className="acct-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 10px 30px -5px rgba(31,29,22,0.06)', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #F27717, #D9650E)', padding: '32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(234,88,12,0.15)', filter: 'blur(30px)' }} />
            <div className="profile-hero" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
              <div className="avatar" style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'linear-gradient(135deg, #F27717, #D9650E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 900, color: 'white', flexShrink: 0, boxShadow: '0 4px 20px rgba(242,119,23,0.35)', overflow: 'hidden' }}>
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="Profile" width={60} height={60} className="w-full h-full object-cover" />
                ) : (
                  getInitials(form.name)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontWeight: 900, fontSize: '22px', color: 'white', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.name || 'Pengguna'}</h2>
                <p style={{ color: '#cbd5e1', fontSize: '14px', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.email}</p>
                {displayPhone && <p style={{ color: '#94a3b8', fontSize: '13px', margin: '3px 0 0' }}>{displayPhone}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>
                    <i className="fa-regular fa-calendar" style={{ fontSize: '10px' }}></i>
                    Member sejak {memberSince}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ NAVIGATION CARD ══ */}
        <div className="acct-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 10px 30px -5px rgba(31,29,22,0.06)', marginBottom: '24px' }}>
          <Link href="/account/detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-user" style={{ color: '#338CB2', fontSize: '16px' }}></i>
              </div>
              <span style={{ fontWeight: 700, color: '#1F1D16', fontSize: '14px' }}>Informasi Akun</span>
            </div>
            <i className="fa-solid fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '12px' }}></i>
          </Link>
          <div style={{ height: '1px', background: '#f1f5f9', margin: '0 32px' }} />
          <Link href="/account/passengers" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EFF9FC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-address-card" style={{ color: '#338CB2', fontSize: '16px' }}></i>
              </div>
              <span style={{ fontWeight: 700, color: '#1F1D16', fontSize: '14px' }}>{i18n.savedPassengers[language].title}</span>
            </div>
            <i className="fa-solid fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '12px' }}></i>
          </Link>
        </div>


        {/* ══ SECURITY CARD ══ */}
        {!isGoogleLogin && (
          <div className="acct-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 10px 30px -5px rgba(31,29,22,0.06)', marginBottom: '24px' }}>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF9FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-shield-halved" style={{ color: '#338CB2', fontSize: '14px' }}></i>
              </div>
              <span style={{ fontWeight: 800, color: '#1F1D16', fontSize: '15px' }}>{ta.tabs.security}</span>
            </div>
            <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TwoFactorSection onNotify={setToast} />
              <ChangePasswordSection onNotify={setToast} />
            </div>
          </div>
        )}

        {/* ══ DELETE ACCOUNT ══ */}
        <div className="acct-card" style={{ marginBottom: '24px' }}>
          <div className="delete-row" style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: 'white', borderRadius: '24px', border: '1px solid #fecaca', boxShadow: '0 10px 30px -5px rgba(31,29,22,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', fontSize: '16px' }}></i>
              </div>
              <div>
                <p style={{ fontWeight: 800, color: '#1F1D16', fontSize: '14px', margin: 0 }}>{ta.danger.title}</p>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '3px 0 0' }}>{ta.danger.subtitle}</p>
              </div>
            </div>
            <button onClick={() => setShowDeleteModal(true)} style={{ padding: '10px 20px', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '13px', borderRadius: '12px', border: '2px solid #fecaca', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}>{ta.danger.deleteBtn}</button>
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div className="acct-card" style={{ textAlign: 'center', padding: '16px 0 0' }}>
          <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, fontWeight: 600 }}>The Mafia Travel &middot; {memberSince}</p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
