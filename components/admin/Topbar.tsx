'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, ChevronDown, LogOut, User, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Image from 'next/image';
import LogoutConfirmButton from '@/components/auth/LogoutConfirmButton';

interface TopbarProps {
  onMenuClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
}

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  '/admin/dashboard': { label: 'Dashboard' },
  '/admin/bookings': { label: 'Manajemen Pesanan', parent: 'Dashboard' },
  '/admin/users': { label: 'Manajemen User', parent: 'Dashboard' },
  '/admin/payments': { label: 'Log Pembayaran', parent: 'Dashboard' },
  '/admin/settings': { label: 'Pengaturan Sistem', parent: 'Dashboard' },
  '/admin/profile': { label: 'Profil Saya', parent: 'Dashboard' },
};

export default function Topbar({ onMenuClick, collapsed, onToggleCollapse, userName, userEmail, userImage }: TopbarProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

  const current = BREADCRUMB_MAP[pathname] || { label: 'Admin' };

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

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
          <button aria-label="Menu profil admin" onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
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
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <LogoutConfirmButton
                    callbackUrl="/"
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
