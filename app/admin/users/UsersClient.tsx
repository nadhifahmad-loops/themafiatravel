'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, ShieldCheck, User as UserIcon, Mail, Phone, MoreVertical, ArrowUpDown, Trash2, X } from 'lucide-react';
import Pagination from '@/components/admin/Pagination';
import Image from 'next/image';

const PAGE_SIZE = 10;

interface AdminUser {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  createdAt: string | Date;
  image?: string | null;
}

export default function UsersClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers || []);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredUsers = users.filter((u) =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.phone || '').includes(searchQuery)
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleToggleRole(user: AdminUser) {
    if (!user.id) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const label = newRole === 'admin' ? 'menjadikan admin' : 'menurunkan ke user';
    if (!confirm(`Yakin ingin ${label} ${user.name || user.email}?`)) return;

    setLoadingId(user.id);
    setMenuOpenId(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        setMessageType('success');
        setMessage(`Role ${user.name || user.email} berhasil diubah menjadi ${newRole}.`);
      } else {
        setMessageType('error');
        setMessage(json.message || 'Gagal mengubah role.');
      }
    } catch {
      setMessageType('error');
      setMessage('Gagal menghubungi server.');
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!user.id) return;
    setLoadingId(user.id);
    setMenuOpenId(null);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setMessageType('success');
        setMessage(json.message || `User ${user.email} berhasil dihapus.`);
      } else {
        setMessageType('error');
        setMessage(json.message || 'Gagal menghapus user.');
      }
    } catch {
      setMessageType('error');
      setMessage('Gagal menghubungi server.');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Manajemen User</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola data pelanggan dan hak akses admin.</p>
        </div>
        <div className="text-sm text-slate-500">
          Total: <span className="font-bold text-slate-800">{users.length}</span> user
        </div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, atau HP..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
        </div>

        {message && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${messageType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
            {message}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Pengguna</th>
                <th className="px-5 py-4">Kontak</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Tgl. Terdaftar</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Tidak ada user ditemukan.</td></tr>
              ) : (
                visible.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0 overflow-hidden">
                          {user.image ? <Image src={user.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" /> : (user.name?.charAt(0) || 'U')}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{user.name || 'Guest'}</p>
                          <p className="text-[11px] text-slate-400">ID: {user.id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> <span className="text-xs">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> <span className="text-xs">{user.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                          <UserIcon className="w-3.5 h-3.5" /> User
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {format(new Date(user.createdAt), 'dd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="relative inline-block" ref={menuOpenId === user.id ? menuRef : undefined}>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === user.id ? null : user.id)}
                          disabled={loadingId === user.id}
                          className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {loadingId === user.id ? (
                            <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <MoreVertical className="w-4 h-4" />
                          )}
                        </button>

                        {menuOpenId === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aksi untuk</p>
                              <p className="text-xs font-bold text-slate-700 truncate">{user.email}</p>
                            </div>
                            <button
                              onClick={() => handleToggleRole(user)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors text-left"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                              {user.role === 'admin' ? 'Turunkan ke User' : 'Jadikan Admin'}
                            </button>
                            <button
                              onClick={() => { setMenuOpenId(null); setConfirmDelete(user); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                              <Trash2 className="w-4 h-4" />
                              Hapus User
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={PAGE_SIZE}
          itemLabel="user"
          onPageChange={setPage}
        />
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1200] flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-lg">Hapus User</h3>
              <button onClick={() => setConfirmDelete(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Yakin ingin menghapus user berikut?
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="font-bold text-slate-800">{confirmDelete.name || 'Guest'}</p>
              <p className="text-xs text-slate-500">{confirmDelete.email}</p>
              <p className="text-xs text-slate-400 mt-1">Role: {confirmDelete.role}</p>
            </div>
            <p className="text-xs text-red-500 mb-4">Tindakan ini tidak dapat dibatalkan. Semua data dan riwayat pesanan user akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={loadingId === confirmDelete.id}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {loadingId === confirmDelete.id ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
