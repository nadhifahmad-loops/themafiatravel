'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Notification {
  key: string;
  type: 'payment' | 'booking' | 'reminder' | 'expired';
  title: string;
  msg: string;
  time: string;
  unread: boolean;
  href: string;
}

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  payment: { icon: 'fa-solid fa-credit-card', color: 'text-emerald-600 bg-emerald-100' },
  booking: { icon: 'fa-solid fa-ticket', color: 'text-blue-600 bg-blue-100' },
  reminder: { icon: 'fa-solid fa-bell', color: 'text-amber-600 bg-amber-100' },
  expired: { icon: 'fa-solid fa-circle-xmark', color: 'text-red-600 bg-red-100' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export default function NotificationBell({ isTransparent = false }: { isTransparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setNotifs(data.data?.items || []);
        setUnreadCount(data.data?.unreadCount || 0);
      }
    } catch { /* keep state */ }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 30000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const markRead = useCallback((keys: string[]) => {
    if (!keys.length) return;
    const keySet = new Set(keys);
    const next = notifs.map(n => (keySet.has(n.key) ? { ...n, unread: false } : n));
    setNotifs(next);
    setUnreadCount(next.filter(n => n.unread).length);
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    }).catch(() => {});
  }, [notifs]);

  const markAllRead = useCallback(() => {
    markRead(notifs.filter(n => n.unread).map(n => n.key));
  }, [notifs, markRead]);

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadNotifications(); }}
        className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors ${isTransparent ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
        aria-label="Notifikasi"
      >
        <i className={`fa-solid fa-bell text-sm transition-colors ${isTransparent ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}></i>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800">Notifikasi</p>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors">
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center">
                <i className="fa-solid fa-bell-slash text-slate-300 text-2xl mb-2"></i>
                <p className="text-sm text-slate-400">Belum ada notifikasi</p>
              </div>
            ) : (
              notifs.map(n => {
                const iconCfg = NOTIF_ICONS[n.type] || NOTIF_ICONS.booking;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    onClick={() => { if (n.unread) markRead([n.key]); setOpen(false); }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${n.unread ? 'bg-orange-50/30' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconCfg.color}`}>
                      <i className={`${iconCfg.icon} text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                        {n.unread && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{n.msg}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.time)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <Link href="/bookings" onClick={() => setOpen(false)} className="text-center block text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Lihat Semua Pesanan
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
