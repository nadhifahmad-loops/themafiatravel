'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar, { type AdminNotification } from './Topbar';

interface AdminShellProps {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  initialNotifications?: AdminNotification[];
  initialUnreadCount?: number;
}

export default function AdminShell({ children, userName, userEmail, userImage, initialNotifications, initialUnreadCount }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userName={userName}
          userEmail={userEmail}
          userImage={userImage}
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}