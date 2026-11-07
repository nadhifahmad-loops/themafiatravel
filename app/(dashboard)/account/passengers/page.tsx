'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { usePageTitle } from '@/components/hooks/usePageTitle';
import { useToast } from '@/contexts/ToastContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DatePickerField from '@/components/checkout/DatePickerField';
import { COUNTRY_OPTIONS, countryLabel } from '@/lib/countries';
import {
  isValidBirthDate,
  isValidIdentityNumber,
  isValidName,
  isValidPassportExpiry,
} from '@/lib/checkout-utils';
import {
  maskIdentityNumber,
  toDateInput,
  type SavedPassengerIdentityType,
  type SavedPassengerRecord,
} from '@/lib/saved-passengers';

type SavedPassengerText = typeof i18n.savedPassengers[keyof typeof i18n.savedPassengers];

type PassengerFormState = {
  title: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  nationalityCode: string;
  identityType: SavedPassengerIdentityType;
  identityNumber: string;
  identityExpDate: string;
  identityCountryCode: string;
};

const EMPTY_FORM: PassengerFormState = {
  title: 'MR',
  firstName: '',
  lastName: '',
  birthDate: '',
  gender: '',
  nationalityCode: 'ID',
  identityType: 'ktp',
  identityNumber: '',
  identityExpDate: '',
  identityCountryCode: 'ID',
};

const TITLE_OPTIONS = ['MR', 'MRS', 'MS', 'MSTR', 'MISS'] as const;
const IDENTITY_TYPES: SavedPassengerIdentityType[] = ['ktp', 'passport', 'sim', 'other'];

function formatDate(value: string | null | undefined, language: 'ID' | 'EN'): string {
  const iso = toDateInput(value);
  if (!iso) return '-';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(language === 'EN' ? 'en-GB' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function identityLabel(type: string, t: SavedPassengerText): string {
  if (type === 'passport') return t.passport;
  if (type === 'sim') return t.sim;
  if (type === 'other') return t.other;
  return t.ktp;
}

type PassengerFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  form: PassengerFormState;
  errors: Record<string, string>;
  saving: boolean;
  onChange: (patch: Partial<PassengerFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function PassengerFormModal({
  open,
  mode,
  form,
  errors,
  saving,
  onChange,
  onClose,
  onSubmit,
}: PassengerFormModalProps) {
  const { language } = useLanguage();
  const t = i18n.savedPassengers[language];

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const fieldCls = (error?: string) =>
    `w-full px-4 py-2.5 bg-white border rounded-lg text-slate-800 text-sm outline-none transition-colors ${
      error ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-slate-400'
    }`;
  const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? t.addTitle : t.editTitle}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-black text-brand-ink">
              {mode === 'create' ? t.addTitle : t.editTitle}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={t.cancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {errors.form && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{t.titleLabel}</label>
              <select
                value={form.title}
                onChange={(event) => onChange({ title: event.target.value })}
                className={`${fieldCls()} cursor-pointer appearance-none`}
              >
                {TITLE_OPTIONS.map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t.gender}</label>
              <select
                value={form.gender}
                onChange={(event) => onChange({ gender: event.target.value })}
                className={`${fieldCls()} cursor-pointer appearance-none`}
              >
                <option value="">{t.chooseGender}</option>
                <option value="male">{t.male}</option>
                <option value="female">{t.female}</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>{t.firstName}</label>
              <input
                value={form.firstName}
                onChange={(event) => onChange({ firstName: event.target.value })}
                maxLength={80}
                className={fieldCls(errors.firstName)}
                placeholder="BUDI"
              />
              {errors.firstName && <p className="mt-1 text-[11px] text-red-600">{errors.firstName}</p>}
            </div>

            <div>
              <label className={labelCls}>{t.lastName}</label>
              <input
                value={form.lastName}
                onChange={(event) => onChange({ lastName: event.target.value })}
                maxLength={80}
                className={fieldCls(errors.lastName)}
                placeholder="SANTOSO"
              />
              {errors.lastName && <p className="mt-1 text-[11px] text-red-600">{errors.lastName}</p>}
            </div>

            <div>
              <label className={labelCls}>{t.birthDate}</label>
              <DatePickerField
                value={form.birthDate}
                onChange={(iso) => onChange({ birthDate: iso })}
                error={errors.birthDate}
                maxDate={new Date()}
                placeholder="Pilih tanggal lahir"
                defaultMonth={new Date(2000, 0, 1)}
              />
              {errors.birthDate && <p className="mt-1 text-[11px] text-red-600">{errors.birthDate}</p>}
            </div>

            <div>
              <label className={labelCls}>{t.nationality}</label>
              <select
                value={form.nationalityCode}
                onChange={(event) => onChange({ nationalityCode: event.target.value })}
                className={`${fieldCls()} cursor-pointer appearance-none`}
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>{country.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t.identityType}</label>
              <select
                value={form.identityType}
                onChange={(event) => onChange({
                  identityType: event.target.value as SavedPassengerIdentityType,
                  identityNumber: '',
                  identityExpDate: '',
                  identityCountryCode: 'ID',
                })}
                className={`${fieldCls()} cursor-pointer appearance-none`}
              >
                {IDENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>{identityLabel(type, t)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t.identityNumber}</label>
              <input
                value={form.identityNumber}
                onChange={(event) => onChange({
                  identityNumber: form.identityType === 'passport'
                    ? event.target.value.toUpperCase()
                    : event.target.value,
                })}
                maxLength={32}
                className={fieldCls(errors.identityNumber)}
                placeholder={form.identityType === 'passport' ? 'A1234567' : '1234567890123456'}
              />
              {errors.identityNumber && <p className="mt-1 text-[11px] text-red-600">{errors.identityNumber}</p>}
            </div>

            {form.identityType === 'passport' && (
              <>
                <div>
                  <label className={labelCls}>{t.identityExpiry}</label>
                  <DatePickerField
                    value={form.identityExpDate}
                    onChange={(iso) => onChange({ identityExpDate: iso })}
                    error={errors.identityExpDate}
                    minDate={new Date()}
                    endMonth={new Date(new Date().getFullYear() + 15, 11, 31)}
                    placeholder="Pilih tanggal kedaluwarsa"
                  />
                  {errors.identityExpDate && <p className="mt-1 text-[11px] text-red-600">{errors.identityExpDate}</p>}
                </div>
                <div>
                  <label className={labelCls}>{t.identityCountry}</label>
                  <select
                    value={form.identityCountryCode}
                    onChange={(event) => onChange({ identityCountryCode: event.target.value })}
                    className={`${fieldCls(errors.identityCountryCode)} cursor-pointer appearance-none`}
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                  {errors.identityCountryCode && <p className="mt-1 text-[11px] text-red-600">{errors.identityCountryCode}</p>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 px-5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-xs font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-70"
          >
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>}
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SavedPassengersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const t = i18n.savedPassengers[language];
  const { toast } = useToast();

  usePageTitle(t.title);

  const [passengers, setPassengers] = useState<SavedPassengerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PassengerFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedPassengerRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const loadPassengers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/user/passengers', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'load');
      setPassengers(Array.isArray(data?.passengers) ? data.passengers : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') loadPassengers();
  }, [status, loadPassengers]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (passenger: SavedPassengerRecord) => {
    const identityType = IDENTITY_TYPES.includes(passenger.identityType as SavedPassengerIdentityType)
      ? (passenger.identityType as SavedPassengerIdentityType)
      : 'ktp';

    setFormMode('edit');
    setEditingId(passenger.id);
    setForm({
      title: passenger.title || 'MR',
      firstName: passenger.firstName || '',
      lastName: passenger.lastName || '',
      birthDate: toDateInput(passenger.birthDate),
      gender: passenger.gender === 'male' || passenger.gender === 'female' ? passenger.gender : '',
      nationalityCode: passenger.nationalityCode || 'ID',
      identityType,
      identityNumber: passenger.identityNumber || '',
      identityExpDate: toDateInput(passenger.identityExpDate),
      identityCountryCode: passenger.identityCountryCode || 'ID',
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setErrors({});
  };

  const patchForm = (patch: Partial<PassengerFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    const nextErrors = { ...errors };
    Object.keys(patch).forEach((key) => delete nextErrors[key]);
    if (nextErrors.form) delete nextErrors.form;
    setErrors(nextErrors);
  };

  const validateForm = (): Record<string, string> => {
    const next: Record<string, string> = {};

    if (!isValidName(form.firstName)) next.firstName = t.invalidName;
    if (!isValidName(form.lastName)) next.lastName = t.invalidName;
    if (!isValidBirthDate(form.birthDate)) next.birthDate = t.invalidBirthDate;
    if (!isValidIdentityNumber(form.identityNumber, form.identityType)) {
      next.identityNumber = t.invalidIdentity;
    }

    if (form.identityType === 'passport') {
      if (!form.identityExpDate) {
        next.identityExpDate = t.passportExpiryRequired;
      } else if (!isValidPassportExpiry(form.identityExpDate)) {
        next.identityExpDate = t.passportExpired;
      }
      if (!form.identityCountryCode) next.identityCountryCode = t.passportCountryRequired;
    }

    return next;
  };

  const submitForm = async () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const payload = {
        ...form,
        gender: form.gender || null,
        identityExpDate: form.identityType === 'passport' ? form.identityExpDate : null,
        identityCountryCode: form.identityType === 'passport' ? form.identityCountryCode : null,
      };

      const res = await fetch(
        editingId ? `/api/user/passengers/${editingId}` : '/api/user/passengers',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t.saveError);

      if (editingId) {
        setPassengers((current) =>
          current.map((passenger) =>
            passenger.id === editingId ? (data.passenger as SavedPassengerRecord) : passenger
          )
        );
        toast(t.updated);
      } else {
        setPassengers((current) => [data.passenger as SavedPassengerRecord, ...current]);
        toast(t.created);
      }

      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t.saveError;
      setErrors({ form: message });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/passengers/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t.deleteError);
      setPassengers((current) => current.filter((passenger) => passenger.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast(t.deleted, { variant: 'info' });
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : t.deleteError, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bgLight">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bgLight">
      <div className="pt-[64px] pb-16 px-4 sm:px-6 lg:px-8 md:pt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:gap-8">
          <AccountSidebar />

          <div className="min-w-0 flex-1">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-brand-ink sm:text-2xl">{t.title}</h1>
                <p className="mt-1 max-w-2xl text-sm text-brand-neutral">{t.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={openCreate}
                disabled={passengers.length >= 40}
                title={passengers.length >= 40 ? t.limitReached : t.add}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-plus text-[10px]"></i>
                {t.add}
              </button>
            </div>

            {loading && (
              <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
                ))}
              </div>
            )}

            {!loading && loadError && (
              <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
                  <i className="fa-solid fa-triangle-exclamation text-lg text-red-400"></i>
                </div>
                <p className="text-sm font-bold text-slate-700">{t.loadError}</p>
                <button
                  type="button"
                  onClick={loadPassengers}
                  className="mt-4 inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300"
                >
                  {t.retry}
                </button>
              </div>
            )}

            {!loading && !loadError && passengers.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm md:p-16">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-100 bg-orange-50">
                  <i className="fa-solid fa-address-card text-3xl text-orange-300"></i>
                </div>
                <p className="text-lg font-black text-slate-800 md:text-xl">{t.emptyTitle}</p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400 md:text-base">
                  {t.emptyDesc}
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white transition-colors hover:bg-orange-600"
                >
                  <i className="fa-solid fa-plus text-[10px]"></i>
                  {t.add}
                </button>
              </div>
            )}

            {!loading && !loadError && passengers.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {passengers.map((passenger) => (
                  <article
                    key={passenger.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-brand-ink">
                          {passenger.firstName} {passenger.lastName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {passenger.title} · {countryLabel(passenger.nationalityCode)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">
                        {identityLabel(passenger.identityType, t)}
                      </span>
                    </div>

                    <dl className="mt-3 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-400">{t.birthDateLabel}</dt>
                        <dd className="font-semibold text-slate-600">{formatDate(passenger.birthDate, language)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-400">{t.identityLabel}</dt>
                        <dd className="font-semibold text-slate-600">{maskIdentityNumber(passenger.identityNumber)}</dd>
                      </div>
                      {passenger.identityType === 'passport' && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-400">{t.passportExpiryLabel}</dt>
                          <dd className="font-semibold text-slate-600">{formatDate(passenger.identityExpDate, language)}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEdit(passenger)}
                        className="h-8 rounded-lg bg-slate-50 px-3 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(passenger)}
                        className="h-8 rounded-lg bg-red-50 px-3 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-100"
                      >
                        {t.delete}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PassengerFormModal
        open={formOpen}
        mode={formMode}
        form={form}
        errors={errors}
        saving={saving}
        onChange={patchForm}
        onClose={closeForm}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t.deleteTitle}
        message={t.deleteDesc}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
