'use client';
import { useState } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { type FormVariant, vItem, vSub, vValue } from '@/lib/formVariants';

export type NearMePick = { code: string; name: string; city?: string };

type Props = {
  /** Mana yang dicari: bandara (pesawat) atau stasiun (kereta). */
  target: 'airport' | 'station';
  /** Dipanggil saat hasil terdekat sudah siap dipakai sebagai nilai field. */
  onPick: (item: NearMePick) => void;
  variant?: FormVariant;
};

const ROW = 'px-4 py-2.5 flex items-center gap-2.5';
const TITLE = 'text-[13px] font-medium truncate';

/**
 * Baris "Dekat Saya" di paling atas panel dropdown asal.
 * GPS HANYA dipanggil saat baris ini ditekan — tidak pernah saat halaman dimuat.
 */
export default function NearMeRow({ target, onPick, variant = 'dark' }: Props) {
  const { language } = useLanguage();
  const t = i18n.searchForm[language].nearMe;
  const { status, nearestAirport, nearestStation, requestLocation } = useLocation();
  const [busy, setBusy] = useState(false);

  const nearest = target === 'airport' ? nearestAirport : nearestStation;
  const pending = busy || status === 'requesting';
  const supported = typeof navigator !== 'undefined' && !!navigator.geolocation;

  const failed =
    !supported ||
    (!pending && (status === 'denied' || status === 'unavailable'));

  const errorText = !supported
    ? t.unsupported
    : status === 'denied'
      ? t.denied
      : t.unavailable;

  const detect = async () => {
    if (pending || !supported) return;
    setBusy(true);
    try {
      const res = await requestLocation();
      const picked = target === 'airport' ? res?.airport : res?.station;
      if (picked?.code) {
        onPick({ code: picked.code, name: picked.name, city: picked.city });
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  if (pending) {
    return (
      <div className={ROW} aria-live="polite">
        <span
          className="w-3.5 h-3.5 shrink-0 border-2 border-sky-600/30 border-t-sky-600 rounded-full animate-spin"
          aria-hidden="true"
        />
        <span className={`${TITLE} ${vSub(variant)}`}>{t.title}</span>
      </div>
    );
  }

  if (nearest?.code) {
    return (
      <div
        className={`${ROW} cursor-pointer ${vItem(variant)}`}
        role="button"
        tabIndex={0}
        onClick={() => onPick({ code: nearest.code, name: nearest.name, city: nearest.city })}
        onKeyDown={(e) =>
          onKeyDown(e, () => onPick({ code: nearest.code, name: nearest.name, city: nearest.city }))
        }
      >
        <i className="fa-solid fa-location-crosshairs text-sky-600 text-[11px] shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] ${vSub(variant)}`}>{t.title}</div>
          <div className={`${TITLE} ${vValue(variant)}`}>
            {nearest.name} ({nearest.code})
          </div>
          {failed && <div className="text-[11px] text-red-400 mt-0.5">{errorText}</div>}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void detect();
          }}
          aria-label={t.refresh}
          title={t.refresh}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-sky-600 hover:bg-sky-600/10 transition-colors"
        >
          <i className="fa-solid fa-arrows-rotate text-[12px]" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Belum ada hasil terdekat: baris ajakan mendeteksi (atau laporan gagal).
  return (
    <div
      className={`${ROW} ${supported ? `cursor-pointer ${vItem(variant)}` : ''}`}
      role="button"
      tabIndex={supported ? 0 : -1}
      aria-disabled={!supported}
      onClick={() => void detect()}
      onKeyDown={(e) => onKeyDown(e, () => void detect())}
    >
      <i
        className={`fa-solid fa-location-crosshairs text-[11px] shrink-0 ${
          failed ? 'text-red-400' : 'text-sky-600'
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className={`${TITLE} ${vValue(variant)}`}>{t.title}</div>
        {failed && <div className="text-[11px] text-red-400 mt-0.5">{errorText}</div>}
      </div>
      {failed && supported && (
        <span
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-sky-600"
          title={t.retry}
          aria-hidden="true"
        >
          <i className="fa-solid fa-arrows-rotate text-[12px]" />
        </span>
      )}
    </div>
  );
}
