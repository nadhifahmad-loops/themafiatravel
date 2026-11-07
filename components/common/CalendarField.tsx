'use client';

// ============================================================
// Kalender bersama (single & range) — tampilan identik dengan
// components/checkout/DatePickerField agar konsisten di seluruh
// form search (pesawat, kereta, hotel, asuransi) dan checkout.
//
// Cara pakai: bungkus kotak field yang sudah ada sebagai `children`,
// Radix akan menjadikannya pemicu popover (tanpa tombol tambahan).
// ============================================================

import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker, type Matcher } from 'react-day-picker';
import { id as rdpLocaleId } from 'react-day-picker/locale/id';
import { enUS as rdpLocaleEnUS } from 'react-day-picker/locale/en-US';
import { useLanguage } from '@/contexts/LanguageContext';
import 'react-day-picker/style.css';

const CALENDAR_CLASS =
  '[--rdp-accent-color:#1e293b] [--rdp-accent-background-color:#f1f5f9] [--rdp-day-width:38px] [--rdp-day-height:38px] [--rdp-day_button-width:36px] [--rdp-day_button-height:36px] [--rdp-day_button-border-radius:0.6rem] text-sm text-slate-700';

const CONTENT_CLASS =
  'z-[9999] rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

interface BaseProps {
  /** Tanggal paling awal yang boleh dipilih. */
  minDate?: Date;
  /** Tanggal paling akhir yang boleh dipilih. */
  maxDate?: Date;
  /** Bulan yang ditampilkan saat nilai masih kosong. */
  defaultMonth?: Date;
  /** Jumlah bulan yang ditampilkan sekaligus. */
  numberOfMonths?: number;
  disabled?: boolean;
  /** Elemen pemicu (kotak field yang sudah ada). */
  children: ReactNode;
  /** Dipanggil saat popover kalender dibuka/ditutup. */
  onOpenChange?: (open: boolean) => void;
}

interface CalendarFieldProps extends BaseProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
}

interface CalendarRangeFieldProps extends BaseProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: { from: Date | null; to: Date | null }) => void;
}

function buildDisabledDays(minDate?: Date, maxDate?: Date): Matcher[] {
  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });
  return disabledDays;
}

/** Pilih satu tanggal (mode single). */
export function CalendarField({
  value,
  onChange,
  minDate,
  maxDate,
  defaultMonth,
  numberOfMonths = 1,
  disabled,
  onOpenChange,
  children,
}: CalendarFieldProps) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const disabledDays = buildDisabledDays(minDate, maxDate);

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); onOpenChange?.(o); }}>
      <Popover.Trigger asChild disabled={disabled}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} collisionPadding={8} className={CONTENT_CLASS}>
          <DayPicker
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => {
              onChange(d ?? null);
              setOpen(false);
            }}
            locale={language === 'EN' ? rdpLocaleEnUS : rdpLocaleId}
            captionLayout="dropdown"
            defaultMonth={value ?? defaultMonth}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={disabledDays}
            showOutsideDays
            fixedWeeks
            numberOfMonths={numberOfMonths}
            className={CALENDAR_CLASS}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Pilih rentang tanggal (mode range). */
export function CalendarRangeField({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  defaultMonth,
  numberOfMonths = 1,
  disabled,
  onOpenChange,
  children,
}: CalendarRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const disabledDays = buildDisabledDays(minDate, maxDate);

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); onOpenChange?.(o); }}>
      <Popover.Trigger asChild disabled={disabled}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} collisionPadding={8} className={CONTENT_CLASS}>
          <DayPicker
            mode="range"
            selected={startDate ? { from: startDate, to: endDate ?? undefined } : undefined}
            onSelect={(range) => {
              onChange({ from: range?.from ?? null, to: range?.to ?? null });
              if (range?.from && range?.to) setOpen(false);
            }}
            locale={language === 'EN' ? rdpLocaleEnUS : rdpLocaleId}
            captionLayout="dropdown"
            defaultMonth={startDate ?? defaultMonth}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={disabledDays}
            showOutsideDays
            fixedWeeks
            numberOfMonths={numberOfMonths}
            className={CALENDAR_CLASS}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
