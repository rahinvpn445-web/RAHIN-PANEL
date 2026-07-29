import React, { useState, useEffect } from 'react';
import { X, UserCheck, ShieldAlert, Zap, Globe, Sliders, Calendar, Hash, HardDrive } from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { User } from '../types';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Partial<User>) => void;
  user: User | null;
  lang: Language;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
  lang,
}) => {
  const t = translations[lang];

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    tag: '',
    username: '',
    expiry: '',
    quotaBytes: 0,
    dailyQuotaBytes: 0,
    limitDailyReq: 0,
    speedLimitKBps: 0,
    connLimit: null,
    maxConfigs: null,
    ipLimit: 0,
    blockPorn: 0,
    blockAds: 0,
    fragLen: '',
    fragInt: '',
    cleanIp: '',
    proxyIp: '',
    userSocks5: '',
    notes: '',
    autoResetVolDays: 0,
    autoRotateIp: 0,
    rotateTime: 0,
    ipOperator: 'all',
    ipCount: 20
  });

  const [quotaGB, setQuotaGB] = useState<number>(0);
  const [dailyQuotaGB, setDailyQuotaGB] = useState<number>(0);

  useEffect(() => {
    if (user) {
      setFormData(user);
      setQuotaGB(user.quotaBytes ? Number((user.quotaBytes / 1073741824).toFixed(2)) : 0);
      setDailyQuotaGB(user.dailyQuotaBytes ? Number((user.dailyQuotaBytes / 1073741824).toFixed(2)) : 0);
    } else {
      setFormData({
        name: '',
        tag: '',
        username: '',
        expiry: '',
        quotaBytes: 0,
        dailyQuotaBytes: 0,
        limitDailyReq: 0,
        speedLimitKBps: 0,
        connLimit: null,
        maxConfigs: null,
        ipLimit: 0,
        blockPorn: 0,
        blockAds: 0,
        fragLen: '',
        fragInt: '',
        cleanIp: '',
        proxyIp: '',
        userSocks5: '',
        notes: '',
        autoResetVolDays: 0,
        autoRotateIp: 0,
        rotateTime: 0,
        ipOperator: 'all',
        ipCount: 20
      });
      setQuotaGB(0);
      setDailyQuotaGB(0);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      quotaBytes: quotaGB > 0 ? Math.round(quotaGB * 1073741824) : 0,
      dailyQuotaBytes: dailyQuotaGB > 0 ? Math.round(dailyQuotaGB * 1073741824) : 0
    };
    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="glass-card max-w-2xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden border-blue-500/20 shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            {user ? t.users.modalEditTitle : t.users.modalCreateTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Section 1: General Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-blue-300 pb-1 border-b border-white/10 flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              {t.users.secGeneral}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldName} *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldUsername}</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="john_doe"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldTag}</label>
                <input
                  type="text"
                  value={formData.tag || ''}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="john123"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldExpiry}</label>
                <input
                  type="date"
                  value={formData.expiry || ''}
                  onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quotas & Limits */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-cyan-300 pb-1 border-b border-white/10 flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              {t.users.secLimits}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldQuotaGB}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={quotaGB}
                  onChange={(e) => setQuotaGB(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldDailyQuotaGB}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={dailyQuotaGB}
                  onChange={(e) => setDailyQuotaGB(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldSpeedLimit}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.speedLimitKBps || 0}
                  onChange={(e) => setFormData({ ...formData, speedLimitKBps: parseInt(e.target.value) || 0 })}
                  placeholder="0 = unlimited"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldConnLimit}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.connLimit ?? ''}
                  onChange={(e) => setFormData({ ...formData, connLimit: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Unlimited"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldIpLimit}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.ipLimit || 0}
                  onChange={(e) => setFormData({ ...formData, ipLimit: parseInt(e.target.value) || 0 })}
                  placeholder="0 = unlimited IPs"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldMaxConfigs}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxConfigs ?? ''}
                  onChange={(e) => setFormData({ ...formData, maxConfigs: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Default (40)"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Content Filtering & Security */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-300 pb-1 border-b border-white/10 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              {t.users.secNetwork}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <input
                  type="checkbox"
                  id="blockPorn"
                  checked={!!formData.blockPorn}
                  onChange={(e) => setFormData({ ...formData, blockPorn: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded text-blue-500 focus:ring-0"
                />
                <label htmlFor="blockPorn" className="text-xs font-medium text-slate-300 cursor-pointer">
                  {t.users.fieldBlockPorn}
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <input
                  type="checkbox"
                  id="blockAds"
                  checked={!!formData.blockAds}
                  onChange={(e) => setFormData({ ...formData, blockAds: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded text-blue-500 focus:ring-0"
                />
                <label htmlFor="blockAds" className="text-xs font-medium text-slate-300 cursor-pointer">
                  {t.users.fieldBlockAds}
                </label>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldFragLen}</label>
                <input
                  type="text"
                  value={formData.fragLen || ''}
                  onChange={(e) => setFormData({ ...formData, fragLen: e.target.value })}
                  placeholder="e.g. 10-20"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldFragInt}</label>
                <input
                  type="text"
                  value={formData.fragInt || ''}
                  onChange={(e) => setFormData({ ...formData, fragInt: e.target.value })}
                  placeholder="e.g. 10-20"
                  className="w-full p-2.5 glass-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Per-User Overrides */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-300 pb-1 border-b border-white/10 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t.users.secOverrides}
            </h4>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldCleanIp}</label>
              <textarea
                rows={2}
                value={formData.cleanIp || ''}
                onChange={(e) => setFormData({ ...formData, cleanIp: e.target.value })}
                placeholder="104.16.1.1&#10;172.64.1.1"
                className="w-full p-2.5 glass-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldProxyIp}</label>
              <input
                type="text"
                value={formData.proxyIp || ''}
                onChange={(e) => setFormData({ ...formData, proxyIp: e.target.value })}
                placeholder="proxyip.example.com"
                className="w-full p-2.5 glass-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldSocks5}</label>
              <input
                type="text"
                value={formData.userSocks5 || ''}
                onChange={(e) => setFormData({ ...formData, userSocks5: e.target.value })}
                placeholder="socks5://user:pass@host:1080"
                className="w-full p-2.5 glass-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">{t.users.fieldNotes}</label>
              <input
                type="text"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes or customer detail..."
                className="w-full p-2.5 glass-input text-xs"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 btn-secondary text-xs"
            >
              {t.users.cancel}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 btn-primary text-xs font-bold"
            >
              {t.users.saveUser}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
