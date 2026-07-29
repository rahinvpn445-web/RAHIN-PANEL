import React, { useState } from 'react';
import { 
  UserPlus, 
  Search, 
  Copy, 
  Check, 
  Edit, 
  Trash2, 
  RotateCcw, 
  Power, 
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
  HardDrive
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { User } from '../types';
import { UserEditModal } from './UserEditModal';

interface UsersPageProps {
  lang: Language;
  users: User[];
  onAddUser: (userData: Partial<User>) => void;
  onUpdateUser: (userId: string, userData: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
  onToggleUser: (userId: string) => void;
  onResetTraffic: (userId: string) => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  lang,
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUser,
  onResetTraffic,
}) => {
  const t = translations[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.tag || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q) ||
      (u.notes || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filterStatus === 'active') return u.enabled !== false && (!u.expiry || Date.now() <= Date.parse(u.expiry));
    if (filterStatus === 'disabled') return u.enabled === false;
    if (filterStatus === 'expired') return u.expiry && Date.now() > Date.parse(u.expiry);
    if (filterStatus === 'quota') return u.quotaBytes > 0 && (u.usage?.totalBytes || 0) >= u.quotaBytes;

    return true;
  });

  const getStatusBadge = (u: User) => {
    const usageTotal = u.usage?.totalBytes || 0;
    const isExpired = u.expiry ? Date.now() > Date.parse(u.expiry) : false;

    if (u.enabled === false) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
          {t.users.disabled}
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {t.users.expired}
        </span>
      );
    }
    if (u.quotaBytes > 0 && usageTotal >= u.quotaBytes) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {t.users.quotaExceeded}
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        {t.users.active}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Controls: Search & Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 rtl:right-3.5 rtl:left-auto" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.users.searchPlaceholder}
            className="w-full py-2.5 pl-10 pr-4 rtl:pr-10 rtl:pl-4 glass-input text-xs"
          />
        </div>

        {/* Add User Action Button */}
        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.users.addUser}</span>
        </button>
      </div>

      {/* Filter Status Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: t.users.filterAll, count: users.length },
          { id: 'active', label: t.users.filterActive, count: users.filter(u => u.enabled !== false && (!u.expiry || Date.now() <= Date.parse(u.expiry))).length },
          { id: 'disabled', label: t.users.filterDisabled, count: users.filter(u => u.enabled === false).length },
          { id: 'expired', label: t.users.filterExpired, count: users.filter(u => u.expiry && Date.now() > Date.parse(u.expiry)).length },
          { id: 'quota', label: t.users.filterQuota, count: users.filter(u => u.quotaBytes > 0 && (u.usage?.totalBytes || 0) >= u.quotaBytes).length },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setFilterStatus(chip.id)}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              filterStatus === chip.id
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold'
                : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <span>{chip.label}</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/10">{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/5">
                <th className="py-3.5 px-4 font-bold">{t.users.colName}</th>
                <th className="py-3.5 px-4 font-bold">{t.users.colStatus}</th>
                <th className="py-3.5 px-4 font-bold">{t.users.colUsage}</th>
                <th className="py-3.5 px-4 font-bold">{t.users.colExpiry}</th>
                <th className="py-3.5 px-4 font-bold text-center">{t.users.colOnline}</th>
                <th className="py-3.5 px-4 font-bold">{t.users.colSub}</th>
                <th className="py-3.5 px-4 font-bold text-right rtl:text-left">{t.users.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => {
                const totalUsed = u.usage?.totalBytes || 0;
                const quota = u.quotaBytes || 0;
                const pct = quota > 0 ? Math.min(100, Math.round((totalUsed / quota) * 100)) : 0;

                return (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                    {/* User Name / ID / Username */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{u.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-blue-400">{u.username || u.tag || u.id.slice(0, 10)}</span>
                        {u.proxyIpGeo && (
                          <span title={u.proxyIpGeo.country} className="text-xs">
                            {u.proxyIpGeo.flag}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">{getStatusBadge(u)}</td>

                    {/* Usage / Quota Bar */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">
                        {formatBytes(totalUsed)}{' '}
                        <span className="text-slate-400 font-normal">
                          / {quota > 0 ? formatBytes(quota) : t.users.unlimited}
                        </span>
                      </div>
                      {quota > 0 && (
                        <div className="w-28 h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-all ${
                              pct > 90 ? 'bg-amber-400' : 'bg-blue-400'
                            }`}
                          />
                        </div>
                      )}
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {u.expiry ? u.expiry : <span className="text-slate-500">{t.users.never}</span>}
                    </td>

                    {/* Online IP Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                        {u.onlineCount ?? 0}
                      </span>
                    </td>

                    {/* Subscription Link Copy */}
                    <td className="py-3.5 px-4">
                      {u.subscriptionUrl ? (
                        <button
                          onClick={() => copyToClipboard(u.subscriptionUrl!, u.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-blue-300 transition-all font-mono text-[11px]"
                        >
                          {copiedId === u.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* User Action Buttons */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Status */}
                        <button
                          onClick={() => onToggleUser(u.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.enabled === false
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          }`}
                          title={t.users.toggleStatus}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Traffic */}
                        <button
                          onClick={() => {
                            if (window.confirm(t.users.confirmReset)) {
                              onResetTraffic(u.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 transition-colors"
                          title={t.users.resetTraffic}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit User */}
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete User */}
                        <button
                          onClick={() => {
                            if (window.confirm(t.users.confirmDelete)) {
                              onDeleteUser(u.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400 transition-colors"
                          title={t.users.deleteUser}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No users matching search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create / Edit Modal */}
      <UserEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
        lang={lang}
        onSave={(userData) => {
          if (editingUser) {
            onUpdateUser(editingUser.id, userData);
          } else {
            onAddUser(userData);
          }
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};
