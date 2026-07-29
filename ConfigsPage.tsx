import React, { useState } from 'react';
import { 
  Globe, 
  Settings2, 
  GitBranch, 
  ShieldCheck, 
  Layers, 
  Radio, 
  Network, 
  Cpu, 
  Check, 
  Save, 
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Zap,
  Lock
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { GlobalConfig, NetworkSettings, RelayStatus } from '../types';

interface ConfigsPageProps {
  lang: Language;
  config: GlobalConfig;
  networkSettings: NetworkSettings;
  relayStatus: RelayStatus | null;
  onSaveConfig: (updatedConfig: Partial<GlobalConfig>) => Promise<void>;
  onSaveNetworkSettings: (updatedSettings: Partial<NetworkSettings>) => Promise<void>;
  onGenerateRelayKey: () => Promise<void>;
  onVerifyRelay: (gasUrl: string) => Promise<void>;
  onDisableRelay: () => Promise<void>;
  onPublishMirrorNow: () => Promise<void>;
  onSyncLinkedPanels: () => Promise<void>;
}

export const ConfigsPage: React.FC<ConfigsPageProps> = ({
  lang,
  config,
  networkSettings,
  relayStatus,
  onSaveConfig,
  onSaveNetworkSettings,
  onGenerateRelayKey,
  onVerifyRelay,
  onDisableRelay,
  onPublishMirrorNow,
  onSyncLinkedPanels,
}) => {
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<string>('network');
  const [cfgState, setCfgState] = useState<GlobalConfig>(config);
  const [netState, setNetState] = useState<NetworkSettings>(networkSettings);
  const [newHostInput, setNewHostInput] = useState<string>('');
  const [gasUrlInput, setGasUrlInput] = useState<string>(relayStatus?.gasUrl || '');
  const [warpLicenseInput, setWarpLicenseInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [mirrorPublishing, setMirrorPublishing] = useState<boolean>(false);

  const tabs = [
    { id: 'network', label: t.configs.tabNetwork, icon: Globe },
    { id: 'protocols', label: t.configs.tabProtocols, icon: Cpu },
    { id: 'subscription', label: t.configs.tabSubscription, icon: GitBranch },
    { id: 'proxy', label: t.configs.tabProxy, icon: Network },
    { id: 'backend', label: t.configs.tabBackend, icon: Layers },
    { id: 'relay', label: t.configs.tabRelay, icon: Radio },
    { id: 'hub', label: t.configs.tabHub, icon: ShieldCheck },
    { id: 'warp', label: t.configs.tabWarp, icon: Zap },
  ];

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveConfig(cfgState);
      await onSaveNetworkSettings(netState);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHost = () => {
    if (!newHostInput.trim()) return;
    const clean = newHostInput.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!cfgState.HOSTS.includes(clean)) {
      setCfgState({
        ...cfgState,
        HOSTS: [...cfgState.HOSTS, clean]
      });
    }
    setNewHostInput('');
  };

  const handleRemoveHost = (hostToRemove: string) => {
    if (cfgState.HOSTS.length <= 1) return;
    setCfgState({
      ...cfgState,
      HOSTS: cfgState.HOSTS.filter(h => h !== hostToRemove)
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Section Header & Global Save */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-blue-400" />
            {t.configs.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{t.configs.desc}</p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="btn-primary flex items-center gap-2 px-6 py-3 text-xs font-bold shrink-0"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              <span>{t.common.success}</span>
            </>
          ) : (
            <>
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? t.common.saving : t.configs.saveSettings}</span>
            </>
          )}
        </button>
      </div>

      {/* Glass Tabs Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shrink-0 ${
                isActive
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-lg shadow-blue-500/10'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Network & Domains */}
      {activeTab === 'network' && (
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
            {t.configs.tabNetwork}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Primary Domain (HOST) */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.globalHost}
              </label>
              <input
                type="text"
                value={cfgState.HOST || ''}
                onChange={(e) => setCfgState({ ...cfgState, HOST: e.target.value })}
                className="w-full p-3 glass-input font-mono"
              />
            </div>

            {/* Service Path */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.servicePath}
              </label>
              <input
                type="text"
                value={cfgState.PATH || '/'}
                onChange={(e) => setCfgState({ ...cfgState, PATH: e.target.value })}
                className="w-full p-3 glass-input font-mono"
              />
            </div>

            {/* SUBNAME */}
            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.subName}
              </label>
              <input
                type="text"
                value={cfgState.muvcharMinuyMecholel?.SUBNAME || 'RAHIN PANEL (Beta)'}
                onChange={(e) =>
                  setCfgState({
                    ...cfgState,
                    muvcharMinuyMecholel: {
                      ...cfgState.muvcharMinuyMecholel,
                      SUBNAME: e.target.value
                    }
                  })
                }
                className="w-full p-3 glass-input"
              />
            </div>

            {/* Domain Pool Manager (HOSTS) */}
            <div className="md:col-span-2 space-y-3 pt-2">
              <label className="block text-slate-300 font-semibold">
                {t.configs.hostPool}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHostInput}
                  onChange={(e) => setNewHostInput(e.target.value)}
                  placeholder="cdn.example.com"
                  className="flex-1 p-2.5 glass-input font-mono"
                />
                <button
                  onClick={handleAddHost}
                  className="btn-secondary px-4 py-2.5 flex items-center gap-1.5 font-semibold shrink-0"
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>{t.configs.addHost}</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {cfgState.HOSTS.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs font-mono">
                    <span className="text-blue-300">{h}</span>
                    <button
                      onClick={() => handleRemoveHost(h)}
                      disabled={cfgState.HOSTS.length <= 1}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Protocols & Output */}
      {activeTab === 'protocols' && (
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
            {t.configs.tabProtocols}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Protocol Selector */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.protocolType}
              </label>
              <select
                value={cfgState.sugProtokol}
                onChange={(e) => setCfgState({ ...cfgState, sugProtokol: e.target.value as any })}
                className="w-full p-3 glass-input bg-[#111827]"
              >
                <option value="vless">VLESS</option>
                <option value="trojan">Trojan</option>
                <option value="vmess">VMess</option>
                <option value="ss">Shadowsocks</option>
                <option value="mixed">Mixed Protocol (ترکیبی)</option>
              </select>
            </div>

            {/* Transport Protocol */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.transportProtocol}
              </label>
              <select
                value={cfgState.protokolHaavara}
                onChange={(e) => setCfgState({ ...cfgState, protokolHaavara: e.target.value as any })}
                className="w-full p-3 glass-input bg-[#111827]"
              >
                <option value="ws">WebSocket (WS)</option>
                <option value="grpc">gRPC</option>
                <option value="xhttp">xhttp</option>
              </select>
            </div>

            {/* Fingerprint */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.fingerprint}
              </label>
              <select
                value={cfgState.Fingerprint || 'chrome'}
                onChange={(e) => setCfgState({ ...cfgState, Fingerprint: e.target.value })}
                className="w-full p-3 glass-input bg-[#111827]"
              >
                <option value="chrome">Chrome</option>
                <option value="firefox">Firefox</option>
                <option value="safari">Safari</option>
                <option value="edge">Edge</option>
                <option value="random">Randomized (اتفاقی)</option>
              </select>
            </div>

            {/* TLS Fragment */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.tlsFragment}
              </label>
              <select
                value={cfgState.pilugTLS || 'none'}
                onChange={(e) => setCfgState({ ...cfgState, pilugTLS: e.target.value === 'none' ? null : e.target.value })}
                className="w-full p-3 glass-input bg-[#111827]"
              >
                <option value="none">Disabled (غیرفعال)</option>
                <option value="Shadowrocket">Shadowrocket Preset</option>
                <option value="Happ">Happ Preset</option>
                <option value="custom">Custom Parameters</option>
              </select>
            </div>

            {/* Insecure / Skip Cert */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/5">
              <input
                type="checkbox"
                id="skipCertVerify"
                checked={cfgState.dalegImutTeuda}
                onChange={(e) => setCfgState({ ...cfgState, dalegImutTeuda: e.target.checked })}
                className="w-4 h-4 rounded text-blue-500"
              />
              <label htmlFor="skipCertVerify" className="text-slate-300 font-semibold cursor-pointer">
                {t.configs.skipCertVerify}
              </label>
            </div>

            {/* ECH */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/5">
              <input
                type="checkbox"
                id="enableECH"
                checked={cfgState.ECH}
                onChange={(e) => setCfgState({ ...cfgState, ECH: e.target.checked })}
                className="w-4 h-4 rounded text-blue-500"
              />
              <label htmlFor="enableECH" className="text-slate-300 font-semibold cursor-pointer">
                {t.configs.enableECH}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Subscription & GitHub Mirror */}
      {activeTab === 'subscription' && (
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
            {t.configs.tabSubscription}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.subUpdateInterval}
              </label>
              <input
                type="number"
                value={cfgState.muvcharMinuyMecholel?.SUBUpdateTime || 3}
                onChange={(e) =>
                  setCfgState({
                    ...cfgState,
                    muvcharMinuyMecholel: {
                      ...cfgState.muvcharMinuyMecholel,
                      SUBUpdateTime: parseInt(e.target.value) || 3
                    }
                  })
                }
                className="w-full p-3 glass-input"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {t.configs.subConverterApi}
              </label>
              <input
                type="text"
                value={cfgState.tetzuratHamaratMinuy?.SUBAPI || ''}
                onChange={(e) =>
                  setCfgState({
                    ...cfgState,
                    tetzuratHamaratMinuy: {
                      ...cfgState.tetzuratHamaratMinuy,
                      SUBAPI: e.target.value
                    }
                  })
                }
                className="w-full p-3 glass-input font-mono"
              />
            </div>

            {/* GitHub Mirror Box */}
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  {t.configs.githubMirror}
                </h4>

                <button
                  type="button"
                  onClick={async () => {
                    setMirrorPublishing(true);
                    await onPublishMirrorNow();
                    setMirrorPublishing(false);
                  }}
                  disabled={mirrorPublishing}
                  className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${mirrorPublishing ? 'animate-spin' : ''}`} />
                  <span>{t.configs.publishMirrorNow}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">{t.configs.mirrorRepo}</label>
                  <input
                    type="text"
                    value={cfgState.mirror?.repo || 'rahinvpn445-web/RAHIN-PANEL'}
                    onChange={(e) =>
                      setCfgState({
                        ...cfgState,
                        mirror: { ...(cfgState.mirror || { enabled: false, branch: 'main', pathPrefix: 'sub', token: '' }), repo: e.target.value }
                      })
                    }
                    className="w-full p-2.5 glass-input font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">{t.configs.mirrorToken}</label>
                  <input
                    type="password"
                    value={cfgState.mirror?.token || ''}
                    onChange={(e) =>
                      setCfgState({
                        ...cfgState,
                        mirror: { ...(cfgState.mirror || { enabled: false, repo: 'rahinvpn445-web/RAHIN-PANEL', branch: 'main', pathPrefix: 'sub' }), token: e.target.value }
                      })
                    }
                    placeholder="ghp_..."
                    className="w-full p-2.5 glass-input font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Backend Mode */}
      {activeTab === 'backend' && (
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
            {t.configs.tabBackend}
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <input
                type="checkbox"
                id="backendMode"
                checked={netState.backendMode}
                onChange={(e) => setNetState({ ...netState, backendMode: e.target.checked })}
                className="w-5 h-5 rounded text-blue-500"
              />
              <label htmlFor="backendMode" className="text-sm font-bold text-white cursor-pointer">
                {t.configs.backendEnable}
              </label>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">{t.configs.backendUrl}</label>
              <input
                type="text"
                value={netState.backendUrl || ''}
                onChange={(e) => setNetState({ ...netState, backendUrl: e.target.value })}
                placeholder="https://xray.example.com/vless"
                className="w-full p-3 glass-input font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <a
                href="/backend-test"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary px-4 py-2.5 flex items-center gap-2 text-xs"
              >
                <ExternalLink className="w-4 h-4 text-cyan-400" />
                <span>{t.configs.testBackendBtn}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Relay */}
      {activeTab === 'relay' && (
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
            {t.configs.tabRelay}
          </h3>

          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div>
                <h4 className="font-bold text-white text-sm">SSRF-Safe Worker Relay</h4>
                <p className="text-slate-400 text-xs">Status: {relayStatus?.enabled ? 'Active Online' : 'Disabled'}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGenerateRelayKey}
                  className="btn-primary px-4 py-2 text-xs"
                >
                  {t.configs.generateKey}
                </button>
                {relayStatus?.enabled && (
                  <button
                    type="button"
                    onClick={onDisableRelay}
                    className="btn-danger px-4 py-2 text-xs"
                  >
                    {t.configs.disableRelayBtn}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">{t.configs.relayAuthKey}</label>
              <input
                type="text"
                readOnly
                value={relayStatus?.authKey || ''}
                className="w-full p-3 glass-input font-mono text-cyan-300"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">{t.configs.gasUrl}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 p-3 glass-input font-mono"
                />
                <button
                  type="button"
                  onClick={() => onVerifyRelay(gasUrlInput)}
                  className="btn-secondary px-5 py-3 font-bold shrink-0"
                >
                  {t.configs.verifyRelayBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
