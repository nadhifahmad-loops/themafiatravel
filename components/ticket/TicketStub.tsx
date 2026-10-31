'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Download, Loader2, ShieldCheck, ArrowUpRight } from 'lucide-react';

type Props = {
  orderNumber: string;
  documentLabel: string;
  statusLabel: string;
  title: string;
  subtitle?: string | null;
  dateText: string;
  dateLabel: string;
  pnr?: string | null;
  verifyCode: string;
  verifyHref: string;
  verifyLabel: string;
  verifyHint: string;
  downloadLabel: string;
  downloadingLabel: string;
  downloading: boolean;
  onDownload: () => void;
  downloadable: boolean;
  unavailableLabel: string;
};

/**
 * Representasi visual dokumen di halaman detail.
 * Bukan pengganti PDF — hanya ringkasan agar pengguna tahu dokumen apa yang dimiliki.
 */
export default function TicketStub({
  orderNumber,
  documentLabel,
  statusLabel,
  title,
  subtitle,
  dateText,
  dateLabel,
  pnr,
  verifyCode,
  verifyHref,
  verifyLabel,
  verifyHint,
  downloadLabel,
  downloadingLabel,
  downloading,
  onDownload,
  downloadable,
  unavailableLabel,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Image src="/images/logo.png" alt="The Mafia Travel" width={22} height={22} className="object-contain shrink-0" />
          <span className="text-[11px] font-extrabold tracking-[0.14em] text-brand-ink truncate">
            THE MAFIA TRAVEL
          </span>
        </div>
        <span className="text-[9px] font-bold tracking-[0.14em] text-brand-orange uppercase shrink-0">
          {documentLabel}
        </span>
      </div>

      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{orderNumber}</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {statusLabel}
          </span>
        </div>

        <p className="mt-2.5 text-[15px] font-extrabold text-brand-ink leading-snug">{title}</p>
        {subtitle ? <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p> : null}

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{dateLabel}</p>
            <p className="text-sm font-bold text-brand-ink mt-0.5">{dateText}</p>
          </div>
          {pnr ? (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">PNR</p>
              <p className="text-sm font-bold font-mono text-brand-ink mt-0.5">{pnr}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Perforasi */}
      <div className="relative h-px bg-slate-200">
        <span className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-brand-bgLight" />
        <span className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-brand-bgLight" />
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            {verifyLabel}
          </span>
          <span className="font-mono text-[11px] font-bold text-brand-ink">{verifyCode}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{verifyHint}</p>
        <Link
          href={verifyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:text-brand-orange transition-colors"
        >
          {verifyLabel}
          <ArrowUpRight className="w-3 h-3" />
        </Link>

        {downloadable ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-orange hover:bg-orange-dark disabled:opacity-60 text-white text-sm font-bold transition-colors"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {downloadingLabel}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {downloadLabel}
              </>
            )}
          </button>
        ) : (
          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
            {unavailableLabel}
          </p>
        )}
      </div>
    </div>
  );
}
