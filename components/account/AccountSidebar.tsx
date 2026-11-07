'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import LogoutConfirmButton from '@/components/auth/LogoutConfirmButton';
import { Ticket, RotateCcw, Heart, Users, User, LogOut, type LucideIcon } from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Sidebar akun yang bisa dipakai ulang di halaman member.
 * Desktop: kartu sticky di kolom kiri. Mobile: navigasi ringkas di atas konten.
 */
export default function AccountSidebar() {
  const { data: session } = useSession();
  const { language } = useLanguage();
  const t = i18n.accountSidebar[language];
  const pathname = usePathname();

  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'Member';
  const initial = displayName.charAt(0).toUpperCase();

  const items: NavItem[] = [
    { href: '/bookings', label: t.bookings, icon: Ticket },
    { href: '/refunds', label: t.refunds, icon: RotateCcw },
    { href: '/favorites', label: t.favorites, icon: Heart },
    { href: '/account/passengers', label: t.passengers, icon: Users },
    { href: '/account', label: t.profile, icon: User },
  ];

  const isActive = (href: string) => href === '/account'
    ? pathname === '/account'
    : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="lg:w-[248px] lg:shrink-0">
      {/* Mobile: ringkasan + nav horizontal */}
      <div className="lg:hidden mb-5">
        <div className="flex items-center gap-3 px-1">
          <div className="w-11 h-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-base font-bold text-brand-orange">{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-ink truncate">{displayName}</p>
            <p className="text-[11px] text-slate-400 truncate">{t.member}</p>
          </div>
        </div>

        <nav className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1" aria-label={t.menu}>
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-orange-50 border-orange-200 text-brand-orange'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop: kartu sidebar */}
      <div className="hidden lg:block sticky top-[124px]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-base font-bold text-brand-orange">{initial}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand-ink truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || t.member}</p>
              </div>
            </div>
          </div>

          <nav className="p-2" aria-label={t.menu}>
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-orange-50 text-brand-orange'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-brand-ink'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-2 border-t border-slate-100">
            <LogoutConfirmButton
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              title={t.logoutTitle}
              description={t.logoutDesc}
              confirmLabel={t.logoutConfirm}
              cancelLabel={t.cancel}
            >
              <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
              {t.logout}
            </LogoutConfirmButton>
          </div>
        </div>
      </div>
    </aside>
  );
}
