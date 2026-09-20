'use client';

import { Fragment, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, RefreshCw, UserCog, UserX, SlidersHorizontal, ListChecks, ChevronDown, ChevronUp, History, ShieldCheck, type LucideIcon } from 'lucide-react';
import Pagination from '@/components/admin/Pagination';

interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ip?: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

const ACTION_META: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  'user.role.update': { label: 'Ubah Role User', cls: 'bg-orange-100 text-orange-700', icon: UserCog },
  'user.delete': { label: 'Hapus User', cls: 'bg-red-100 text-red-700', icon: UserX },
  'markup.update': { label: 'Ubah Markup', cls: 'bg-blue-100 text-blue-700', icon: SlidersHorizontal },
  'booking.status.update': { label: 'Ubah Status Pesanan', cls: 'bg-purple-100 text-purple-700', icon: ListChecks },
};

function renderJson(value: unknown) {
  if (value === undefined || value === null) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditLogClient({
  initialLogs,
  actionOptions,
}: {
  initialLogs: AuditLogEntry[];
  actionOptions: string[];
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (!term) return true;
      const haystack = [log.adminEmail, log.entityId, log.entityType, log.ip]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [logs, searchQuery, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function refresh() {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/audit-logs?page=1&pageSize=200');
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setPage(1);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  }

  const options = useMemo(() => {
    const all = new Set<string>(['', ...actionOptions]);
    logs.forEach((log) => all.add(log.action));
    return [...all];
  }, [actionOptions, logs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-brand-ink">Audit Log</h1>
        <p className="text-brand-neutral text-sm">Jejak aksi admin (ubah role, hapus user, ubah markup, status pesanan) untuk akuntabilitas tim.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <History className="w-4 h-4 text-orange-500" />
            <span>Menampilkan {filtered.length} catatan aksi.</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }}
                placeholder="Cari email admin, target, IP..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(event) => { setActionFilter(event.target.value); setPage(1); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            >
              {options.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? ACTION_META[option]?.label || option : 'Semua Aksi'}
                </option>
              ))}
            </select>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Waktu</th>
                <th className="px-5 py-4">Admin</th>
                <th className="px-5 py-4">Aksi</th>
                <th className="px-5 py-4">Target</th>
                <th className="px-5 py-4">IP</th>
                <th className="px-5 py-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">Belum ada catatan audit. Aksi admin yang berhasil akan tercatat di sini.</td>
                </tr>
              ) : (
                visible.map((log) => {
                  const meta = ACTION_META[log.action] || { label: log.action, cls: 'bg-slate-100 text-slate-700', icon: ShieldCheck };
                  const ActionIcon = meta.icon;
                  const isExpanded = expandedId === log.id;
                  const targetLabel = log.entityId || log.entityType;
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-700">{format(new Date(log.createdAt), 'dd MMM yyyy', { locale: localeId })}</div>
                          <div className="text-[11px] text-slate-500">{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-700">{log.adminEmail}</div>
                          <div className="text-[11px] text-slate-500">#{log.adminId}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${meta.cls}`}>
                            <ActionIcon className="w-3.5 h-3.5" />{meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-medium text-slate-700">{log.entityType}</div>
                          <div className="text-[11px] text-slate-500">{targetLabel}</div>
                        </td>
                        <td className="px-5 py-4 text-[11px] text-slate-500">{log.ip || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-all"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {isExpanded ? 'Tutup' : 'Lihat'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-5 py-4 bg-slate-50/60 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sebelum</p>
                                <pre className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{renderJson(log.before)}</pre>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sesudah</p>
                                <pre className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{renderJson(log.after)}</pre>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Metadata</p>
                                <pre className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{renderJson(log.metadata)}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} itemLabel="catatan audit" onPageChange={setPage} />
      </div>
    </div>
  );
}
