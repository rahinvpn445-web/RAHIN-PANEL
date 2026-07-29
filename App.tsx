import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './components/DashboardPage';
import { UsersPage } from './components/UsersPage';
import { ConfigsPage } from './components/ConfigsPage';
import { ScannerPage } from './components/ScannerPage';
import { SettingsPage } from './components/SettingsPage';
import { Language, translations } from './i18n/translations';
import { 
  SystemStats, 
  User, 
  GlobalConfig, 
  NetworkSettings, 
  ActivityLogItem, 
  AuditLogItem, 
  RelayStatus, 
  ApiKeyItem 
} from './types';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('rahin_lang');
    return (saved === 'en' || saved === 'fa') ? saved : 'fa';
  });

  const [currentPage, setCurrentPage] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return ['dashboard', 'users', 'configs', 'scanner', 'settings'].includes(hash) ? hash : 'dashboard';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Application Data States
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const t = translations[lang];

  // Set document dir & lang
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    localStorage.setItem('rahin_lang', lang);
  }, [lang]);

  // Sync Hash
  useEffect(() => {
    window.location.hash = currentPage;
  }, [currentPage]);

  // Fetch All Backend Data
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Stats
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.success) {
          setStats(data.stats);
          setIsPaused(!!data.stats.system.isPaused);
        }
      }

      // 2. Users
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (data.success) setUsers(data.users || []);
      }

      // 3. Config
      const cfgRes = await fetch('/admin/config.json');
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setConfig(data);
        if (data.paused !== undefined) setIsPaused(!!data.paused);
      }

      // 4. Network Settings
      const netRes = await fetch('/admin/network-settings.json');
      if (netRes.ok) {
        const data = await netRes.json();
        setNetworkSettings(data);
      }

      // 5. Logs
      const logsRes = await fetch('/api/logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        if (data.success) {
          setActivityLogs(data.activityLogs || []);
          setAuditLogs(data.auditLogs || []);
        }
      }

      // 6. Relay Status
      const relayRes = await fetch('/api/relay-status');
      if (relayRes.ok) {
        const data = await relayRes.json();
        if (data.success) setRelayStatus(data.relay);
      }

      // 7. API Keys
      const keysRes = await fetch('/admin/api-keys');
      if (keysRes.ok) {
        const data = await keysRes.json();
        if (data.success) setApiKeys(data.keys || []);
      }
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers for User CRUD
  const handleAddUser = async (userData: Partial<User>) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Add user error:', e);
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<User>) => {
    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Update user error:', e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Delete user error:', e);
    }
  };

  const handleToggleUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/toggle?id=${userId}`, { method: 'POST' });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Toggle user error:', e);
    }
  };

  const handleResetTraffic = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/reset?id=${userId}`, { method: 'POST' });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Reset traffic error:', e);
    }
  };

  // Handlers for Config & Network
  const handleSaveConfig = async (updated: Partial<GlobalConfig>) => {
    try {
      const res = await fetch('/admin/config.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Save config error:', e);
    }
  };

  const handleSaveNetworkSettings = async (updated: Partial<NetworkSettings>) => {
    try {
      const res = await fetch('/admin/network-settings.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Save network settings error:', e);
    }
  };

  // Quick Pause / Resume
  const handleTogglePause = async () => {
    try {
      const res = await fetch('/api/pause', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(!!data.isPaused);
        await loadAllData();
      }
    } catch (e) {
      console.error('Pause toggle error:', e);
    }
  };

  // Panic Button
  const handleTriggerPanic = async () => {
    try {
      const res = await fetch('/api/panic', { method: 'POST' });
      if (res.ok) {
        setIsPaused(true);
        await loadAllData();
      }
    } catch (e) {
      console.error('Panic trigger error:', e);
    }
  };

  // Relay Actions
  const handleGenerateRelayKey = async () => {
    try {
      const res = await fetch('/admin/relay-generate', { method: 'POST' });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyRelay = async (gasUrl: string) => {
    try {
      const res = await fetch('/admin/relay-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasUrl })
      });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisableRelay = async () => {
    try {
      const res = await fetch('/admin/relay-disable', { method: 'POST' });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePublishMirrorNow = async () => {
    try {
      await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async (newPass: string): Promise<boolean> => {
    try {
      const res = await fetch('/admin/security/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new: newPass })
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleCreateApiKey = async (name: string) => {
    try {
      const res = await fetch('/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name })
      });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      const res = await fetch('/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', id })
      });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRotatePaths = async () => {
    try {
      const res = await fetch('/admin/security/rotate-path', { method: 'POST' });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckUpdate = async () => {
    const res = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' })
    });
    if (res.ok) {
      return await res.json();
    }
    return { current: 'Beta', latest: 'Beta', updateAvailable: false, notes: 'Up to date' };
  };

  const handleTriggerUpdate = async () => {
    await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update' })
    });
  };

  // Get Page Title
  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return t.nav.dashboard;
      case 'users': return t.nav.users;
      case 'configs': return t.nav.configs;
      case 'scanner': return t.nav.scanner;
      case 'settings': return t.nav.settings;
      default: return t.nav.dashboard;
    }
  };

  return (
    <div className="min-h-screen relative bg-grid-texture text-[#E5E7EB]">
      {/* Animated Aurora Ambient Glow Background */}
      <div className="aurora-bg" />

      {/* Main Container Layout */}
      <div className="relative z-10 flex min-h-screen">
        {/* Fixed Glass Sidebar */}
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          lang={lang}
          onLangChange={setLang}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            lang === 'fa'
              ? (sidebarCollapsed ? 'mr-20' : 'mr-64')
              : (sidebarCollapsed ? 'ml-20' : 'ml-64')
          }`}
        >
          {/* Header Bar */}
          <Header
            pageTitle={getPageTitle()}
            lang={lang}
            onLangChange={setLang}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onRefresh={loadAllData}
            isLoading={isLoading}
          />

          {/* Active Page Component Content */}
          <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
            {currentPage === 'dashboard' && (
              <DashboardPage
                lang={lang}
                stats={stats}
                activityLogs={activityLogs}
                auditLogs={auditLogs}
                isPaused={isPaused}
                onTogglePause={handleTogglePause}
                onRefresh={loadAllData}
                relayEnabled={!!relayStatus?.enabled}
                backendEnabled={!!networkSettings?.backendMode}
                mirrorEnabled={!!config?.mirror?.enabled}
                linkedPanelsCount={networkSettings?.linkedPanels?.length || 0}
              />
            )}

            {currentPage === 'users' && (
              <UsersPage
                lang={lang}
                users={users}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                onToggleUser={handleToggleUser}
                onResetTraffic={handleResetTraffic}
              />
            )}

            {currentPage === 'configs' && config && networkSettings && (
              <ConfigsPage
                lang={lang}
                config={config}
                networkSettings={networkSettings}
                relayStatus={relayStatus}
                onSaveConfig={handleSaveConfig}
                onSaveNetworkSettings={handleSaveNetworkSettings}
                onGenerateRelayKey={handleGenerateRelayKey}
                onVerifyRelay={handleVerifyRelay}
                onDisableRelay={handleDisableRelay}
                onPublishMirrorNow={handlePublishMirrorNow}
                onSyncLinkedPanels={async () => {}}
              />
            )}

            {currentPage === 'scanner' && (
              <ScannerPage lang={lang} />
            )}

            {currentPage === 'settings' && networkSettings && (
              <SettingsPage
                lang={lang}
                onLangChange={setLang}
                networkSettings={networkSettings}
                apiKeys={apiKeys}
                onSaveNetworkSettings={handleSaveNetworkSettings}
                onChangePassword={handleChangePassword}
                onCreateApiKey={handleCreateApiKey}
                onRevokeApiKey={handleRevokeApiKey}
                onRotatePaths={handleRotatePaths}
                onTriggerPanic={handleTriggerPanic}
                onTogglePause={handleTogglePause}
                isPaused={isPaused}
                onCheckUpdate={handleCheckUpdate}
                onTriggerUpdate={handleTriggerUpdate}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
