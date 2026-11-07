'use client';

import { useEffect, useRef } from 'react';

type Props = {
  onClose: () => void;
  closeDisabled?: boolean;
  label: string;
  maxWidth?: string;
  children: React.ReactNode;
};

// Shell modal auth: overlay, scroll lock, ESC, klik luar, dan focus trap.
export default function AuthModalShell({
  onClose,
  closeDisabled = false,
  label,
  maxWidth = 'max-w-md',
  children,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap + kembalikan fokus ke elemen pemicu saat modal ditutup.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const card = cardRef.current;

    const getFocusable = () =>
      Array.from(
        card?.querySelectorAll<HTMLElement>(
          'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const preferred = card?.querySelector<HTMLElement>('[data-autofocus]');
    const firstField = card?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    (preferred ?? firstField ?? getFocusable()[0])?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !card) return;
      const items = getFocusable();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDisabled, onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!closeDisabled) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto animate-[popIn_0.25s_ease-out]`}
      >
        {children}
      </div>
    </div>
  );
}
