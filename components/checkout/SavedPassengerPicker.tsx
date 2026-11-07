'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { countryLabel } from '@/lib/countries';
import {
  getSavedPassengerIssue,
  maskIdentityNumber,
  toDateInput,
  type SavedPassengerCheckContext,
  type SavedPassengerField,
  type SavedPassengerIssue,
  type SavedPassengerRecord,
} from '@/lib/saved-passengers';

type PickerProps = {
  passengers: SavedPassengerRecord[];
  context: SavedPassengerCheckContext;
  onSelect: (passenger: SavedPassengerRecord) => void;
};

export default function SavedPassengerPicker({ passengers, context, onSelect }: PickerProps) {
  const { language } = useLanguage();
  const t = i18n.savedPassengers[language];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (passengers.length === 0) return null;

  const fieldLabel = (field: SavedPassengerField) => {
    switch (field) {
      case 'title': return t.fieldTitle;
      case 'firstName': return t.fieldFirstName;
      case 'lastName': return t.fieldLastName;
      case 'birthDate': return t.fieldBirthDate;
      case 'nationalityCode': return t.fieldNationality;
      case 'identityType': return t.fieldIdentityType;
      case 'identityNumber': return t.fieldIdentityNumber;
      case 'identityExpDate': return t.fieldIdentityExpiry;
      case 'identityCountryCode': return t.fieldIdentityCountry;
      default: return field;
    }
  };

  const describeIssue = (issue: SavedPassengerIssue): string => {
    switch (issue.code) {
      case 'missing_field':
        return t.pickerReasonMissing.replace('{field}', fieldLabel(issue.field));
      case 'invalid_field':
        return t.pickerReasonInvalidField.replace('{field}', fieldLabel(issue.field));
      case 'invalid_birth_date':
        return t.pickerReasonBirth;
      case 'invalid_identity_number':
        return t.pickerReasonIdentity;
      case 'unsupported_identity':
        return t.pickerReasonUnsupported.replace(
          '{mode}',
          context.mode === 'flight' ? t.pickerModeFlight : t.pickerModeTrain
        );
      case 'passport_required':
        return t.pickerReasonPassportRequired;
      case 'passport_expired':
        return t.pickerReasonPassportExpired;
      default:
        return t.pickerReasonInvalidField.replace('{field}', t.fieldIdentityNumber);
    }
  };

  const isIncompleteIssue = (issue: SavedPassengerIssue) =>
    issue.code === 'missing_field'
    || issue.code === 'invalid_field'
    || issue.code === 'invalid_birth_date'
    || issue.code === 'invalid_identity_number';

  const formatDate = (value: string | null | undefined) => {
    const iso = toDateInput(value);
    if (!iso) return '-';
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(language === 'EN' ? 'en-GB' : 'id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div ref={rootRef} className="mb-4 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-600">{t.pickerTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-300"
        >
          {t.pickerChoose}
          <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}></i>
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
            {passengers.map((passenger) => {
              const issue = getSavedPassengerIssue(passenger, context);
              const incomplete = issue ? isIncompleteIssue(issue) : false;
              const identityType = passenger.identityType?.toLowerCase();
              const identityLabel = identityType === 'passport'
                ? t.passport
                : identityType === 'sim'
                  ? t.sim
                  : identityType === 'other'
                    ? t.other
                    : t.ktp;

              return (
                <div
                  key={passenger.id}
                  className={`rounded-lg border bg-white p-3 ${issue ? 'border-slate-200' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-slate-800">
                        {passenger.firstName} {passenger.lastName}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatDate(passenger.birthDate)}
                        <span className="mx-1 text-slate-300">·</span>
                        {passenger.nationalityCode ? countryLabel(passenger.nationalityCode) : '-'}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {identityLabel} · {maskIdentityNumber(passenger.identityNumber)}
                      </p>
                      {identityType === 'passport' && passenger.identityExpDate && (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {t.passportExpiryLabel}: {formatDate(passenger.identityExpDate)}
                        </p>
                      )}
                    </div>

                    {issue ? (
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${incomplete ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                        {incomplete ? t.incomplete : t.notSuitable}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(passenger);
                          setOpen(false);
                        }}
                        className="h-8 shrink-0 rounded-lg bg-orange-50 px-3 text-[11px] font-bold text-orange-600 transition-colors hover:bg-orange-100"
                      >
                        {t.pickerChoose}
                      </button>
                    )}
                  </div>

                  {issue && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <p className="text-[10px] leading-relaxed text-slate-500">{describeIssue(issue)}</p>
                      <Link
                        href="/account/passengers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[10px] font-bold text-orange-600 hover:underline"
                      >
                        {t.pickerComplete}
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href="/account/passengers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-orange-600"
          >
            <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
            {t.pickerManage}
          </Link>
        </div>
      )}
    </div>
  );
}

type NoticeProps = {
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
};

export function SavedPassengerNotice({ loading, error, onRetry }: NoticeProps) {
  const { language } = useLanguage();
  const t = i18n.savedPassengers[language];

  if (loading) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-700">
          {error ? t.pickerLoadError : t.pickerEmpty}
        </p>
        {!error && <p className="mt-0.5 text-[11px] text-slate-400">{t.pickerEmptyDesc}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-300"
          >
            {t.retry}
          </button>
        )}
        <Link
          href="/account/passengers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-orange-50 px-3 text-[11px] font-bold text-orange-600 transition-colors hover:bg-orange-100"
        >
          <i className="fa-solid fa-plus text-[9px]"></i>
          {t.pickerManage}
        </Link>
      </div>
    </div>
  );
}
