import React from 'react';
import { 
  RefreshCw, 
  Power, 
  Globe, 
  Moon, 
  Sun, 
  Activity, 
  ShieldAlert
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface HeaderProps {
  pageTitle: string;
  lang: Language;
  onLangChange: (lang: Language) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  lang,
  onLangChange,
  isPaused,
  onTogglePause,
  onRefresh,
  isLoading,
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-20 px-8 py-5 backdrop-blur-md bg-[#0B1020]/80 border-b border-white/10 flex items-center justify-between transition-all">
      <div className="flex flex-col">
        <h1 className="text-2xl font-light text-white tracking-tight flex items-center gap-3">
          {pageTitle}
        </h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">Real-time status of RAHIN infrastructure</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Backend Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-[#E5E7EB]">
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-green-500'}`} />
          <span>Backend: {isPaused ? 'Paused' : 'Connected'}</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          title={t.common.refresh}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#3B82F6]' : ''}`} />
        </button>

        {/* Quick Action Button */}
        <button
          onClick={onTogglePause}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-lg ${
            isPaused
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 hover:bg-amber-400'
              : 'bg-[#3B82F6] text-white shadow-[#3B82F6]/20 hover:bg-blue-600'
          }`}
        >
          {isPaused ? t.dashboard.quickResume : t.dashboard.quickPause}
        </button>

        {/* Language Switch */}
        <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-lg p-1 text-xs">
          <button
            onClick={() => onLangChange('fa')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              lang === 'fa' ? 'bg-white/10 text-[#3B82F6]' : 'text-slate-400 hover:text-white'
            }`}
          >
            FA
          </button>
          <button
            onClick={() => onLangChange('en')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              lang === 'en' ? 'bg-white/10 text-[#3B82F6]' : 'text-slate-400 hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
};
