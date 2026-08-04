'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Users, CreditCard, SlidersHorizontal, ChevronLeft, ChevronRight, X, PieChart, ArrowRightLeft, ScrollText } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Manajemen Pesanan', href: '/admin/bookings', icon: ClipboardList },
  { label: 'Antrian Refund', href: '/admin/refund-queue', icon: ArrowRightLeft },
  { label: 'Manajemen User', href: '/admin/users', icon: Users },
  { label: 'Log Pembayaran', href: '/admin/payments', icon: CreditCard },
  { label: 'Laporan Keuangan', href: '/admin/finance', icon: PieChart },
  { label: 'Audit Log', href: '/admin/audit-logs', icon: ScrollText },
  { label: 'Pengaturan Markup', href: '/admin/settings', icon: SlidersHorizontal },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    onMobileClose();
  }, [pathname]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-slate-900 border-r border-slate-800
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`flex items-center h-16 px-4 border-b border-slate-800 shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Image 
                  src="/images/logo.png" 
                  alt="Logo The Mafia Travel" 
                  width={32} 
                  height={32} 
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none tracking-wide">THE MAFIA</p>
                <p className="text-orange-400 text-[10px] font-semibold tracking-widest uppercase">Travel Admin</p>
              </div>
            </div>
          )}
          {collapsed && (
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Image 
                  src="/images/logo.png" 
                  alt="Logo The Mafia Travel" 
                  width={32} 
                  height={32} 
                  className="object-contain"
                />
              </div>
          )}
          <button
            onClick={onMobileClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          {!collapsed && (
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest px-4 mb-2">Menu</p>
          )}
          <ul className="space-y-0.5 px-2">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`
                      group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                      text-sm font-medium transition-all duration-150
                      ${isActive
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-r-full" />
                    )}
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
                    {!collapsed && <span>{label}</span>}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-2 py-1 bg-slate-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-slate-600">
                        {label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden lg:flex p-3 border-t border-slate-800">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all text-sm ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className={`hidden lg:block shrink-0 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`} />
    </>
  );
}