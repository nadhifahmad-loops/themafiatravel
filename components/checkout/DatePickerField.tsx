'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker, type Matcher } from 'react-day-picker';
import { id as rdpLocaleId } from 'react-day-picker/locale/id';
import { format } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import 'react-day-picker/style.css';
import { parseLocalISODate, toLocalISODate } from '@/lib/checkout-utils';

interface DatePickerFieldProps {
  /** Nilai dalam format 'YYYY-MM-DD' (string kosong = belum diisi). */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  placeholder?: string;
  /** Pesan error validasi (opsional). */
  error?: string;
  /** Tanggal paling awal yang boleh dipilih. */
  minDate?: Date;
  /** Tanggal paling akhir yang boleh dipilih. */
  maxDate?: Date;
  /** Month dropdown start (opsional, override minDate). */
  startMonth?: Date;
  /** Month dropdown end (opsional, override maxDate). */
  endMonth?: Date;
  /** Bulan yang ditampilkan saat nilai masih kosong. */
  defaultMonth?: Date;
  disabled?: boolean;
  className?: string;
  /** Class tambahan untuk panel popover (mis. z-index saat di dalam modal). */
  contentClassName?: string;
}

export default function DatePickerField({
  value,
  onChange,
  id,
  placeholder = 'Pilih tanggal',
  error,
  minDate,
  maxDate,
  startMonth,
  endMonth,
  defaultMonth,
  disabled,
  className,
  contentClassName,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalISODate(value);

  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  const resolvedStartMonth = startMonth ?? minDate;
  const resolvedEndMonth = endMonth ?? maxDate;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-sm outline-none transition-colors ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          } ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-slate-400'} ${className || ''}`}
        >
          <i className="fa-regular fa-calendar shrink-0 text-[13px] text-slate-400" aria-hidden="true" />
          <span className={`flex-1 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
            {selected ? format(selected, 'dd MMM yyyy', { locale: dateFnsId }) : placeholder}
          </span>
          <i
            className={`fa-solid fa-chevron-down shrink-0 text-[9px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={`z-[999] rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 ${contentClassName || ''}`}
        >
          <DayPicker
            mode="single"
            selected={selected ?? undefined}
            onSelect={(d) => {
              onChange(d ? toLocalISODate(d) : '');
              setOpen(false);
            }}
            locale={rdpLocaleId}
            captionLayout="dropdown"
            defaultMonth={selected ?? defaultMonth}
            startMonth={resolvedStartMonth}
            endMonth={resolvedEndMonth}
            disabled={disabledDays}
            showOutsideDays
            fixedWeeks
            className="[--rdp-accent-color:#1e293b] [--rdp-accent-background-color:#f1f5f9] [--rdp-day-width:38px] [--rdp-day-height:38px] [--rdp-day_button-width:36px] [--rdp-day_button-height:36px] [--rdp-day_button-border-radius:0.6rem] text-sm text-slate-700"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
