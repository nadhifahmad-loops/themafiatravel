'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, Bell, ChevronDown, LogOut, User, Settings, ChevronRight, ChevronsLeft, ChevronsRight, CreditCard, Package } from 'lucide-react';
import Image from 'next/image';
import LogoutConfirmButton from '@/components/auth/LogoutConfirmButton';

interface TopbarProps {
  onMenuClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  initialNotifications?: AdminNotification[];
  initialUnreadCount?: number;
}

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  '/admin/dashboard': { label: 'Dashboard' },
  '/admin/bookings': { label: 'Manajemen Pesanan', parent: 'Dashboard' },
  '/admin/users': { label: 'Manajemen User', parent: 'Dashboard' },
  '/admin/payments': { label: 'Log Pembayaran', parent: 'Dashboard' },
  '/admin/settings': { label: 'Pengaturan Sistem', parent: 'Dashboard' },
  '/admin/profile': { label: 'Profil Saya', parent: 'Dashboard' },
};

export interface AdminNotification {
  key: string;
  type: string;
  title: string;
  msg: string;
  time: string;
  unread: boolean;
  href: string;
}

const NOTIF_ICONS: Record<string, typeof CreditCard> = {
  payment: CreditCard,
  booking: Package,
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

export default function Topbar({ onMenuClick, collapsed, onToggleCollapse, userName, userEmail, userImage, initialNotifications, initialUnreadCount }: TopbarProps) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifs, setNotifs] = useState<AdminNotification[]>(initialNotifications ?? []);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setNotifs(data.data?.items || []);
        setUnreadCount(data.data?.unreadCount || 0);
      }
    } catch {
      // Biarkan state lama jika fetch gagal (dev server restart, dsb.)
    }
  }, []);

  useEffect(() => {
    const id = setInterval(loadNotifications, 30000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  const markRead = useCallback(
    (keys: string[]) => {
      if (!keys.length) return;
      const keySet = new Set(keys);
      const next = notifs.map(n => (keySet.has(n.key) ? { ...n, unread: false } : n));
      setNotifs(next);
      setUnreadCount(next.filter(n => n.unread).length);
      fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      }).catch(() => {});
    },
    [notifs],
  );

  const markAllRead = useCallback(() => {
    markRead(notifs.filter(n => n.unread).map(n => n.key));
  }, [markRead, notifs]);

  const current = BREADCRUMB_MAP[pathname] || { label: 'Admin' };

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  const toggleNotif = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setProfileOpen(false);
    if (next) loadNotifications();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        {/* Desktop collapse toggle — icon only */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        >
          {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
        </button>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400 hidden sm:block">Admin</span>
          {current.parent && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
              <span className="text-slate-400 hidden sm:block">{current.parent}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
          <span className="text-slate-700 font-semibold">{current.label}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={toggleNotif} className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="font-semibold text-slate-800 text-sm">Notifikasi</p>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors">
                        Tandai semua dibaca
                      </button>
                    )}
                    {unreadCount > 0 && <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">{unreadCount} baru</span>}
                  </div>
                </div>
                {notifs.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Tidak ada notifikasi baru</p>
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {notifs.map(n => {
                      const Icon = NOTIF_ICONS[n.type] || Bell;
                      return (
                        <li key={n.key} className="border-b border-slate-50 last:border-0">
                          <Link
                            href={n.href}
                            onClick={() => { markRead([n.key]); setNotifOpen(false); }}
                            className={`flex items-start gap-2.5 px-4 py-3 hover:bg-slate-50 transition-colors ${n.unread ? 'bg-orange-50/50' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.unread ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-slate-800 text-xs font-semibold">{n.title}</p>
                              <p className="text-slate-500 text-xs mt-0.5 truncate">{n.msg}</p>
                              <p className="text-slate-400 text-[11px] mt-1">{timeAgo(n.time)}</p>
                            </div>
                            {n.unread && <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 shrink-0" />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="px-4 py-2.5 text-center border-t border-slate-100">
                  <Link href="/admin/dashboard" onClick={() => setNotifOpen(false)} className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors">
                    Lihat Semua
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button aria-label="Menu profil admin" onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {userImage ? <Image src={userImage} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover" /> : initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-slate-700 text-xs font-semibold leading-none">{userName || 'Admin'}</p>
              <p className="text-slate-400 text-[11px] leading-none mt-0.5">{userEmail || 'admin@mafia.travel'}</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''} hidden sm:block`} />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5 overflow-hidden animate-fade-in origin-top-right">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-slate-800 text-xs font-semibold truncate">{userName || 'Admin'}</p>
                  <p className="text-slate-400 text-[11px] mt-0.5 truncate">{userEmail || 'admin@mafia.travel'}</p>
                </div>
                <Link
                  href="/admin/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  <User className="w-4 h-4" /> Profil
                </Link>
                <Link
                  href="/admin/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Pengaturan
                </Link>
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <LogoutConfirmButton
                    callbackUrl="/login"
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Keluar
                  </LogoutConfirmButton>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
