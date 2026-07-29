import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings2, 
  Radar, 
  Sliders, 
  ShieldCheck, 
  Globe, 
  Power,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  lang,
  onLangChange,
  isPaused,
  onTogglePause,
  collapsed,
  onToggleCollapse,
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'users', label: t.nav.users, icon: Users },
    { id: 'configs', label: t.nav.configs, icon: Settings2 },
    { id: 'scanner', label: t.nav.scanner, icon: Radar },
    { id: 'settings', label: t.nav.settings, icon: Sliders },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 ${lang === 'fa' ? 'right-0 border-l' : 'left-0 border-r'} z-30 flex flex-col glass-sidebar transition-all duration-300 border-white/10 ${
        collapsed ? 'w-20' : 'w-60'
      }`}
    >
      {/* Brand & Logo Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#3B82F6] text-white shrink-0 shadow-lg shadow-blue-500/20 font-black text-xs">
            R
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0B1020] ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white truncate">
                  RAHIN PANEL
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-[#60A5FA] font-semibold mt-0.5 opacity-80 truncate">
                Beta Edition • v1.0.4
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {lang === 'fa' ? (
            collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-xs transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 text-[#AEEBFF] border border-white/10 shadow-sm font-semibold'
                  : 'text-[#94A3B8] hover:bg-white/5 hover:text-white border border-transparent'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#3B82F6]' : 'text-slate-400'}`} />
              {!collapsed && (
                <div className="flex items-center justify-between w-full">
                  <span className="truncate text-xs">{item.label}</span>
                  <span className="text-[11px] font-mono opacity-60 uppercase">{item.id}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Controls & Panic Widget */}
      <div className="p-4 border-t border-white/10 space-y-3">
        {/* Panic Mode Widget in High Density style */}
        {!collapsed ? (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 p-3.5 rounded-xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#EF4444] font-bold uppercase tracking-wider">Panic Mode</span>
              <span className="text-[11px] text-slate-300 opacity-80">Kill active tunnels</span>
            </div>
            <button
              onClick={onTogglePause}
              className={`w-7 h-4 rounded-full flex items-center p-0.5 transition-colors ${
                isPaused ? 'bg-[#EF4444] justify-end' : 'bg-[#EF4444]/30 justify-start'
              }`}
              title="Toggle Panic Mode"
            >
              <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
            </button>
          </div>
        ) : (
          <button
            onClick={onTogglePause}
            className="w-full p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/20"
            title="Toggle Panic Mode"
          >
            <Power className="w-4 h-4" />
          </button>
        )}

        {/* Language Switcher */}
        {!collapsed ? (
          <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 px-2 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-[#3B82F6]" />
              Language
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onLangChange('fa')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                  lang === 'fa'
                    ? 'bg-[#3B82F6] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                FA
              </button>
              <button
                onClick={() => onLangChange('en')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-[#3B82F6] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onLangChange(lang === 'fa' ? 'en' : 'fa')}
            className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300 hover:text-white text-center"
            title="Switch Language"
          >
            {lang === 'fa' ? 'EN' : 'FA'}
          </button>
        )}
      </div>
    </aside>
  );
};
