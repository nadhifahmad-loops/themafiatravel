'use client';

// components/account/ProfileEditModals.tsx
// Popup edit profil untuk halaman /account — menggantikan sub-halaman
// /account/edit/name dan /account/edit/phone yang dihapus.
// Semua popup di-portal ke <body> dengan z-[10000] agar selalu berada di atas
// navbar (1000), drawer (1200), dan toast (9999).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import DatePickerField from '@/components/checkout/DatePickerField';
import { CountryCodeSelect, PhoneVerifyModal } from '@/components/account/phone-verify';

// ─── Shell popup ──────────────────────────────────────────────────────────────
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  // Portal ke <body> agar z-[10000] selalu di atas navbar, drawer, dan toast
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <h2 className="text-base font-extrabold text-brand-ink">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
      </button>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
      <i className="fa-solid fa-circle-exclamation mt-0.5 text-[11px]" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

const primaryBtn =
  'flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const cancelBtn =
  'flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200';

// ─── Ubah Nama ────────────────────────────────────────────────────────────────
export function NameEditModal({ initialName, onClose, onSuccess }: {
  initialName: string;
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const { data: session, update } = useSession();
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const trimmed = name.trim();
  const canSave = trimmed.length >= 2 && trimmed !== initialName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui nama');
      try {
        await update({ ...session, user: { ...(session?.user ?? {}), name: trimmed } });
      } catch { /* sesi lokal tetap lanjut walau update gagal */ }
      onSuccess(trimmed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui nama');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={loading ? () => {} : onClose}>
      <ModalHeader title={ta.profile.namePopupTitle} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label htmlFor="edit-name-input" className="mb-1.5 block text-xs font-bold text-slate-500">
              {ta.profile.nameLabel}
            </label>
            <input
              id="edit-name-input"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              maxLength={80}
              required
              className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-brand-ink outline-none transition-colors focus:border-brand-orange focus:bg-white"
            />
          </div>
          <FormError message={error} />
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} disabled={loading} className={cancelBtn}>
            {i18n.common[language].cancel}
          </button>
          <button
            type="submit"
            disabled={!canSave || loading}
            className={`${primaryBtn} bg-brand-orange text-white hover:bg-orange-dark`}
          >
            {loading ? i18n.common[language].loading : i18n.common[language].save}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Ubah Tanggal Lahir ───────────────────────────────────────────────────────
export function BirthDateEditModal({ initialDate, onClose, onSuccess }: {
  initialDate: string; // 'YYYY-MM-DD' atau ''
  onClose: () => void;
  onSuccess: (iso: string) => void;
}) {
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const tc = i18n.common[language];
  const [date, setDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSave = date !== initialDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui tanggal lahir');
      onSuccess(date);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui tanggal lahir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={loading ? () => {} : onClose}>
      <ModalHeader title={ta.profile.birthDatePopupTitle} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label htmlFor="edit-birthdate-field" className="mb-1.5 block text-xs font-bold text-slate-500">
              {ta.profile.birthDateLabel}
            </label>
            <DatePickerField
              id="edit-birthdate-field"
              value={date}
              onChange={setDate}
              placeholder={ta.profile.notSet}
              maxDate={new Date()}
              minDate={new Date(1900, 0, 1)}
              // popover di-portal ke <body> — harus di atas overlay popup (10000)
              contentClassName="z-[10001]"
            />
          </div>
          <FormError message={error} />
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} disabled={loading} className={cancelBtn}>
            {tc.cancel}
          </button>
          <button
            type="submit"
            disabled={!canSave || loading}
            className={`${primaryBtn} bg-brand-orange text-white hover:bg-orange-dark`}
          >
            {loading ? tc.loading : tc.save}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Ubah Nomor Telepon (input + verifikasi OTP) ──────────────────────────────
export function PhoneEditModal({ initialPhone, initialPhoneCode, onClose, onSuccess }: {
  initialPhone: string;
  initialPhoneCode: string;
  onClose: () => void;
  onSuccess: (fullPhone: string) => void;
}) {
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const tc = i18n.common[language];
  const [phone, setPhone] = useState(initialPhone);
  const [phoneCode, setPhoneCode] = useState(initialPhoneCode);
  const [showVerify, setShowVerify] = useState(false);

  const isDirty = phone !== initialPhone || phoneCode !== initialPhoneCode;
  const digits = phone.replace(/\D/g, '');
  const canSave = isDirty && digits.length >= 6;

  return (
    <>
      <ModalShell onClose={showVerify ? () => {} : onClose}>
        <ModalHeader title={ta.profile.phonePopupTitle} onClose={onClose} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            setShowVerify(true);
          }}
        >
          <div className="flex flex-col gap-4 px-5 py-5">
            <div>
              <label htmlFor="edit-phone-input" className="mb-1.5 block text-xs font-bold text-slate-500">
                {ta.securityCard.phoneLabel}
              </label>
              <div className="flex items-center gap-2.5">
                <CountryCodeSelect value={phoneCode} onChange={setPhoneCode} dropdownId="cc-account-phone" />
                <input
                  id="edit-phone-input"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="8123456789"
                  className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-brand-ink outline-none transition-colors focus:border-brand-orange focus:bg-white"
                />
              </div>
              {isDirty && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                  <i className="fa-solid fa-circle-info text-[11px]" aria-hidden="true" />
                  {ta.profile.otpHint}
                </p>
              )}
            </div>
            <p className="text-xs font-medium leading-relaxed text-slate-400">{ta.profile.phonePopupSubtitle}</p>
          </div>
          <div className="flex gap-2.5 px-5 pb-5">
            <button type="button" onClick={onClose} disabled={showVerify} className={cancelBtn}>
              {tc.cancel}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={`${primaryBtn} bg-brand-orange text-white hover:bg-orange-dark`}
            >
              <i className="fa-solid fa-check mr-1.5 text-[12px]" aria-hidden="true" />
              {tc.save}
            </button>
          </div>
        </form>
      </ModalShell>

      {showVerify && (
        <PhoneVerifyModal
          phone={digits}
          phoneCode={phoneCode}
          onSuccess={() => {
            setShowVerify(false);
            onSuccess(`${phoneCode}${digits}`);
          }}
          onClose={() => setShowVerify(false)}
        />
      )}
    </>
  );
}
