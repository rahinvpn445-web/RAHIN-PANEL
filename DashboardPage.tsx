import React from 'react';
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Activity, 
  ShieldCheck, 
  Clock, 
  Server, 
  Layers, 
  Radio, 
  GitBranch, 
  AlertTriangle,
  Zap,
  Power,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { SystemStats, ActivityLogItem, AuditLogItem } from '../types';

interface DashboardPageProps {
  lang: Language;
  stats: SystemStats | null;
  activityLogs: ActivityLogItem[];
  auditLogs: AuditLogItem[];
  isPaused: boolean;
  onTogglePause: () => void;
  onRefresh: () => void;
  relayEnabled: boolean;
  backendEnabled: boolean;
  mirrorEnabled: boolean;
  linkedPanelsCount: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  lang,
  stats,
  activityLogs,
  auditLogs,
  isPaused,
  onTogglePause,
  onRefresh,
  relayEnabled,
  backendEnabled,
  mirrorEnabled,
  linkedPanelsCount,
}) => {
  const t = translations[lang];

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number): string => {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Mock trend data points for chart
  const mockTrend = [
    { day: 'Sun', bytes: 14.2 },
    { day: 'Mon', bytes: 22.8 },
    { day: 'Tue', bytes: 19.5 },
    { day: 'Wed', bytes: 31.0 },
    { day: 'Thu', bytes: 28.4 },
    { day: 'Fri', bytes: 42.1 },
    { day: 'Sat', bytes: 38.6 },
  ];

  const maxTrend = Math.max(...mockTrend.map(d => d.bytes));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Alert if Paused */}
      {isPaused && (
        <div className="glass-card border-amber-500/30 bg-amber-500/10 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-300 text-sm">{t.dashboard.statusPaused}</h4>
              <p className="text-xs text-amber-200/80">
                All proxy tunnels and subscription output requests return HTTP 503. Admin panel remains live.
              </p>
            </div>
          </div>
          <button
            onClick={onTogglePause}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shrink-0"
          >
            {t.dashboard.quickResume}
          </button>
        </div>
      )}

      {/* Primary Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users Metric Card */}
        <div className="glass-card p-6 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
              {t.dashboard.totalUsers}
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#3B82F6]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#AEEBFF] tracking-tight">
              {stats?.users.total ?? 0}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span>{stats?.users.active ?? 0} Active</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span>Expired: {stats?.users.expired ?? 0}</span>
            <span>Disabled: {stats?.users.disabled ?? 0}</span>
          </div>
        </div>

        {/* Traffic Today Metric Card */}
        <div className="glass-card p-6 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
              {t.dashboard.todayTraffic}
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#AEEBFF]">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {stats ? formatBytes(stats.traffic.dailyBytes) : '0 GB'}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-[#60A5FA] font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              <span>{stats ? formatBytes(stats.system.todayUsage.up) : '0 B'}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-[#3B82F6]" />
              {stats ? formatBytes(stats.system.todayUsage.down) : '0 B'}
            </span>
            <span>Total: {stats ? formatBytes(stats.traffic.totalBytes) : '0 GB'}</span>
          </div>
        </div>

        {/* Worker Uptime Card */}
        <div className="glass-card p-6 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
              {t.dashboard.uptime}
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#3B82F6]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {stats ? formatUptime(stats.system.uptimeSeconds) : '0m'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-[#AEEBFF] border border-white/10">
              Live Edge
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span>Tunnel Status</span>
            <span className={`font-bold ${isPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
        </div>

        {/* System Health / Core Modules Card */}
        <div className="glass-card p-6 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
              Modules Status
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#AEEBFF]">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5">
              <Radio className={`w-3.5 h-3.5 ${relayEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-slate-300 font-medium">Relay</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5">
              <Layers className={`w-3.5 h-3.5 ${backendEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-slate-300 font-medium">Backend</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5">
              <GitBranch className={`w-3.5 h-3.5 ${mirrorEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-slate-300 font-medium">Mirror</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="text-slate-300 font-medium">{linkedPanelsCount} Hubs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Trend Visualizer Chart */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              {t.dashboard.trafficTrend}
            </h3>
            <p className="text-xs text-slate-400">Weekly bandwidth distribution across active worker routes</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-300">Download</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-300" />
              <span className="text-slate-300">Upload</span>
            </div>
          </div>
        </div>

        {/* SVG/CSS Soft Gradient Chart */}
        <div className="h-44 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-white/10">
          {mockTrend.map((pt, idx) => {
            const heightPct = Math.round((pt.bytes / maxTrend) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pt.bytes} GB
                </div>
                <div 
                  style={{ height: `${heightPct}%` }}
                  className="w-full max-w-[48px] rounded-t-xl bg-gradient-to-t from-blue-600 via-blue-400 to-cyan-300 transition-all duration-300 group-hover:brightness-125 shadow-lg shadow-blue-500/10"
                />
                <span className="text-xs font-semibold text-slate-400">{pt.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Logs & Audit Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Traffic Activity */}
        <div className="glass-card p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              {t.dashboard.recentLogs}
            </h3>
            <span className="text-xs text-slate-400">{activityLogs.length} Entries</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="pb-2 font-semibold">{t.dashboard.colType}</th>
                  <th className="pb-2 font-semibold">{t.dashboard.colIp}</th>
                  <th className="pb-2 font-semibold">{t.dashboard.colLocation}</th>
                  <th className="pb-2 font-semibold">{t.dashboard.colTime}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activityLogs.slice(0, 5).map((log, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 font-bold text-blue-300">{log.TYPE}</td>
                    <td className="py-2.5 font-mono text-slate-300">{log.IP}</td>
                    <td className="py-2.5 text-slate-400">{log.CC}</td>
                    <td className="py-2.5 text-slate-500 font-mono">
                      {new Date(log.TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {activityLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      {t.dashboard.noLogs}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Audit Log */}
        <div className="glass-card p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              {t.dashboard.recentAudit}
            </h3>
            <span className="text-xs text-slate-400">{auditLogs.length} Events</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="pb-2 font-semibold">{t.dashboard.colActor}</th>
                  <th className="pb-2 font-semibold">{t.dashboard.colAction}</th>
                  <th className="pb-2 font-semibold">{t.dashboard.colDetail}</th>
                  <th className="pb-2 font-semibold">{t.dashboard.colTime}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.slice(0, 5).map((audit, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 font-bold text-slate-200">{audit.ACTOR}</td>
                    <td className="py-2.5 font-semibold text-cyan-300">{audit.ACTION}</td>
                    <td className="py-2.5 text-slate-400 max-w-[160px] truncate">{audit.DETAIL}</td>
                    <td className="py-2.5 text-slate-500 font-mono">
                      {new Date(audit.TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      {t.dashboard.noLogs}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
