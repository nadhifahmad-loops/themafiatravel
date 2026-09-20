'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Users, CreditCard, SlidersHorizontal, X, PieChart, ArrowRightLeft, ScrollText, Ticket, Briefcase, Pen } from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Menu Utama',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Pesanan & Transaksi',
    items: [
      { label: 'Manajemen Pesanan', href: '/admin/bookings', icon: ClipboardList },
      { label: 'Antrian Refund', href: '/admin/refund-queue', icon: ArrowRightLeft },
      { label: 'Log Pembayaran', href: '/admin/payments', icon: CreditCard },
      { label: 'Laporan Keuangan', href: '/admin/finance', icon: PieChart },
    ],
  },
  {
    label: 'Pengguna',
    items: [
      { label: 'Manajemen User', href: '/admin/users', icon: Users },
    ],
  },
  {
    label: 'Promosi & Konten',
    items: [
      { label: 'Manajemen Kupon', href: '/admin/coupons', icon: Ticket },
      { label: 'Manajemen Karier', href: '/admin/careers', icon: Briefcase },
      { label: 'Manajemen Blog', href: '/admin/blog', icon: Pen },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { label: 'Pengaturan Markup', href: '/admin/settings', icon: SlidersHorizontal },
      { label: 'Audit Log', href: '/admin/audit-logs', icon: ScrollText },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  animate: boolean;
}

export default function Sidebar({ mobileOpen, onMobileClose, collapsed, animate }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const widthClass = collapsed ? 'w-[72px]' : 'w-64';
  const transitionClass = animate ? 'transition-[width] duration-200 ease-in-out' : '';

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      <aside
        suppressHydrationWarning
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-slate-900 border-r border-slate-800
          ${transitionClass}
          ${widthClass}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div suppressHydrationWarning className={`flex items-center h-16 px-4 border-b border-slate-800 shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
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

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-0.5 px-2">
            {NAV_GROUPS.flatMap((group, gi) => {
              const items: React.ReactNode[] = [];

              if (!collapsed) {
                items.push(
                  <li key={`label-${gi}`} className={gi === 0 ? 'mb-2' : 'mt-5 mb-2'}>
                    <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest px-4">{group.label}</p>
                  </li>
                );
              } else if (gi > 0) {
                items.push(
                  <li key={`sep-${gi}`}>
                    <div className="my-3 border-t border-slate-800 mx-3" />
                  </li>
                );
              }

              for (const { label, href, icon: Icon } of group.items) {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                items.push(
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
              }

              return items;
            })}
          </ul>
        </nav>
      </aside>

      <div suppressHydrationWarning className={`hidden lg:block shrink-0 ${transitionClass} ${widthClass}`} />
    </>
  );
}
