import React, { useState } from 'react';
import { 
  Sliders, 
  Key, 
  ShieldAlert, 
  Lock, 
  RotateCw, 
  GitBranch, 
  Cloud, 
  HardDrive, 
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Power
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { NetworkSettings, ApiKeyItem } from '../types';

interface SettingsPageProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
  networkSettings: NetworkSettings;
  apiKeys: ApiKeyItem[];
  onSaveNetworkSettings: (settings: Partial<NetworkSettings>) => Promise<void>;
  onChangePassword: (newPass: string) => Promise<boolean>;
  onCreateApiKey: (name: string) => Promise<void>;
  onRevokeApiKey: (id: string) => Promise<void>;
  onRotatePaths: () => Promise<void>;
  onTriggerPanic: () => Promise<void>;
  onTogglePause: () => void;
  isPaused: boolean;
  onCheckUpdate: () => Promise<{ current: string; latest: string; updateAvailable: boolean; notes: string }>;
  onTriggerUpdate: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  lang,
  onLangChange,
  networkSettings,
  apiKeys,
  onSaveNetworkSettings,
  onChangePassword,
  onCreateApiKey,
  onRevokeApiKey,
  onRotatePaths,
  onTriggerPanic,
  onTogglePause,
  isPaused,
  onCheckUpdate,
  onTriggerUpdate,
}) => {
  const t = translations[lang];

  const [netState, setNetState] = useState<NetworkSettings>(networkSettings);
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [passChangedSuccess, setPassChangedSuccess] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [rotatedSuccess, setRotatedSuccess] = useState<boolean>(false);

  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassInput || newPassInput.length < 6) return;
    const ok = await onChangePassword(newPassInput);
    if (ok) {
      setPassChangedSuccess(true);
      setNewPassInput('');
      setTimeout(() => setPassChangedSuccess(false), 3000);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    await onCreateApiKey(newKeyName.trim());
    setNewKeyName('');
  };

  const handleRotatePaths = async () => {
    setIsRotating(true);
    await onRotatePaths();
    setIsRotating(false);
    setRotatedSuccess(true);
    setTimeout(() => setRotatedSuccess(false), 3000);
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const info = await onCheckUpdate();
    setUpdateInfo(info);
    setCheckingUpdate(false);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-400" />
            {t.settings.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{t.settings.desc}</p>
        </div>
      </div>

      {/* Section 1: Appearance & Language */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-base font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          {t.settings.secAppearance}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">{t.settings.languageSelect}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onLangChange('fa')}
                className={`flex-1 py-2.5 rounded-xl font-bold border transition-all ${
                  lang === 'fa'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                فارسی (FA)
              </button>
              <button
                type="button"
                onClick={() => onLangChange('en')}
                className={`flex-1 py-2.5 rounded-xl font-bold border transition-all ${
                  lang === 'en'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                English (EN)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">{t.settings.panelName}</label>
            <input
              type="text"
              value={netState.hubPanelUrl ? 'Master Panel' : 'RAHIN PANEL (Beta)'}
              readOnly
              className="w-full p-2.5 glass-input font-bold text-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Admin Password Change & Session Security */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-base font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          {t.settings.secAdminAuth}
        </h3>

        <form onSubmit={handleChangePass} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block text-slate-300 font-semibold mb-1">{t.settings.newPassword}</label>
            <input
              type="password"
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
              placeholder="Minimum 6 characters..."
              className="w-full p-2.5 glass-input font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              {passChangedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>{t.settings.passwordChangedMsg}</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>{t.settings.changePasswordBtn}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Section 3: Panel API Keys CRUD */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" />
            {t.settings.secApiKeys}
          </h3>
        </div>

        <form onSubmit={handleCreateKey} className="flex gap-2 text-xs">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t.settings.keyNamePlaceholder}
            className="flex-1 p-2.5 glass-input"
          />
          <button type="submit" className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            <span>{t.settings.createApiKey}</span>
          </button>
        </form>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-2 font-bold">{t.settings.colKeyName}</th>
                <th className="pb-2 font-bold">{t.settings.colKeyPreview}</th>
                <th className="pb-2 font-bold">{t.settings.colCreated}</th>
                <th className="pb-2 font-bold text-right rtl:text-left">{t.settings.colKeyActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {apiKeys.map((k) => (
                <tr key={k.id} className="hover:bg-white/5">
                  <td className="py-2.5 font-semibold text-white">{k.name}</td>
                  <td className="py-2.5 font-mono text-cyan-300">{k.keyPreview || k.key?.slice(0, 10)}</td>
                  <td className="py-2.5 text-slate-400 font-mono">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 text-right rtl:text-left">
                    <button
                      type="button"
                      onClick={() => onRevokeApiKey(k.id)}
                      className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400"
                      title={t.settings.revokeKey}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Disguise Paths */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-cyan-400" />
            {t.settings.secDisguise}
          </h3>

          <button
            type="button"
            onClick={handleRotatePaths}
            disabled={isRotating}
            className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            <span>{rotatedSuccess ? t.settings.pathsRotatedMsg : t.settings.rotatePathsBtn}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 font-sans mb-1">{t.settings.adminPath}</label>
            <input
              type="text"
              value={'/' + (netState.adminPath || 'admin')}
              readOnly
              className="w-full p-2.5 glass-input text-blue-300"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-sans mb-1">{t.settings.loginPath}</label>
            <input
              type="text"
              value={'/' + (netState.loginPath || 'login')}
              readOnly
              className="w-full p-2.5 glass-input text-blue-300"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-sans mb-1">{t.settings.subPath}</label>
            <input
              type="text"
              value={'/' + (netState.subPath || 'sub')}
              readOnly
              className="w-full p-2.5 glass-input text-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Emergency Controls & Panic */}
      <div className="glass-card p-6 border-red-500/30 bg-red-500/5 space-y-4">
        <h3 className="text-base font-bold text-red-400 border-b border-white/10 pb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          {t.settings.secEmergency}
        </h3>

        <p className="text-xs text-slate-300">{t.settings.panicNotice}</p>

        <div className="flex flex-wrap gap-4 pt-2">
          <button
            type="button"
            onClick={onTogglePause}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 ${
              isPaused
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isPaused ? t.settings.resumeService : t.settings.pauseService}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (window.confirm('Are you sure you want to activate Panic Mode?')) {
                await onTriggerPanic();
              }
            }}
            className="btn-danger px-6 py-2.5 text-xs font-bold flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{t.settings.panicButton}</span>
          </button>
        </div>
      </div>

      {/* Section 6: Product Identity & Updates */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-base font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-400" />
          {t.settings.secUpdate}
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">{t.settings.pinnedRepoLabel}</label>
            <input
              type="text"
              readOnly
              value="https://github.com/rahinvpn445-web/RAHIN-PANEL"
              className="w-full p-2.5 glass-input font-mono text-cyan-300"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{t.settings.checkUpdateBtn}</span>
            </button>

            {updateInfo && (
              <span className="text-xs font-semibold text-emerald-400">
                {updateInfo.notes || 'Panel is running latest Beta code'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
