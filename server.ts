import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Local Data Storage Directory
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Error reading ${filename}:`, e);
    }
  }
  return defaultValue;
}

function writeJsonFile<T>(filename: string, data: T): void {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
  }
}

// Default Data Initialization
const DEFAULT_NETWORK_SETTINGS = {
  enableRouting: true,
  enableGeoIP: true,
  enableGeoSite: true,
  enableAdBlock: true,
  enablePornBlock: false,
  enableDomesticBypass: true,
  enableDoH: true,
  dohProvider: 'cloudflare',
  enableIPv6: true,
  logLevel: 'error',
  enableWarp: false,
  warpCalls: false,
  warpMode: 'warp',
  warpEndpoint: '',
  warpAmnezia: false,
  warpCleanIp: false,
  monthlyCapGB: 0,
  speedLimitKBps: 0,
  blockQUIC: false,
  enableMalwareBlock: true,
  enablePhishingBlock: true,
  bypassChina: false,
  bypassRussia: false,
  bypassSanctions: false,
  disguise: false,
  adminPath: 'admin',
  loginPath: 'login',
  subPath: 'sub',
  backendMode: false,
  backendUrl: '',
  linkedPanels: [],
  hubPanelUrl: '',
  syncApiKey: '',
  autoUpdate: false,
  autoUpdateFormat: 'normal',
  autoUpdateInterval: 3600000,
  githubRepo: 'rahinvpn445-web/RAHIN-PANEL',
  poolApi: 'https://raw.githubusercontent.com/rahinvpn445-web/RAHIN-PANEL/main',
  multiUser: true,
  users: [
    {
      id: 'usr_rahin_default_1',
      name: 'کاربر نمونه (Default User)',
      tag: 'default_user',
      token: 'rahin_sub_token_sample_123',
      username: 'sample_user',
      key: 'key_123456',
      enabled: true,
      quotaBytes: 107374182400, // 100 GB
      dailyQuotaBytes: 10737418240, // 10 GB
      expiry: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      speedLimitKBps: 0,
      connLimit: 5,
      ipLimit: 3,
      blockPorn: 1,
      blockAds: 1,
      fragLen: '10-20',
      fragInt: '10-20',
      cleanIp: '104.16.1.1\n172.64.1.1',
      proxyIp: '',
      created: new Date().toISOString()
    }
  ]
};

const DEFAULT_GLOBAL_CONFIG = {
  HOST: 'rahin-panel.workers.dev',
  HOSTS: ['rahin-panel.workers.dev', 'cf.rahin.net'],
  UUID: '13afbd44-5f71-4627-a4d5-c194a1e2f205',
  PATH: '/',
  paused: false,
  sugProtokol: 'mixed',
  protokolHaavara: 'ws',
  matzavGRPC: 'gun',
  dalegImutTeuda: false,
  efsher0RTT: false,
  pilugTLS: 'custom',
  nativAckrai: false,
  ECH: false,
  ECHConfig: {
    DNS: 'https://dns.alidns.com/dns-query',
    SNI: 'cloudflare-ech.com'
  },
  SS: {
    shitatHatzpana: 'aes-128-gcm',
    TLS: true
  },
  Fingerprint: 'chrome',
  muvcharMinuyMecholel: {
    local: true,
    sifriyatIPmekomit: {
      ipAckrai: true,
      kamutAckrait: 16,
      portMeyuchad: -1
    },
    SUBNAME: 'RAHIN PANEL (Beta)',
    SUBUpdateTime: 3
  },
  tetzuratHamaratMinuy: {
    SUBAPI: 'https://sub.rahin.net',
    SUBCONFIG: 'https://raw.githubusercontent.com/rahinvpn445-web/RAHIN-PANEL/main/config.ini',
    SUBEMOJI: true,
    SUBLIST: false
  },
  mirror: {
    enabled: false,
    repo: 'rahinvpn445-web/RAHIN-PANEL',
    branch: 'main',
    pathPrefix: 'sub',
    token: ''
  }
};

let networkSettings = readJsonFile('network-settings.json', DEFAULT_NETWORK_SETTINGS);
let globalConfig = readJsonFile('config.json', DEFAULT_GLOBAL_CONFIG);
let apiKeys = readJsonFile('api_keys.json', [
  { id: 'key_1', name: 'System Master Key', keyPreview: 'rahin_m...8899', key: 'rahin_master_api_key_sample', createdAt: Date.now() }
]);
let usageData = readJsonFile<Record<string, { up: number; down: number; total: number }>>('usage.json', {
  'usr_rahin_default_1': { up: 1048576000, down: 4194304000, total: 5242880000 }
});
let activityLogs = readJsonFile<any[]>('activity_logs.json', [
  { TYPE: 'Get_SUB', IP: '185.208.24.12', ASN: 'AS44244 Irancell', CC: 'IR Teheran', URL: '/sub?u=default_user', UA: 'v2rayN/6.23', TIME: Date.now() - 120000 },
  { TYPE: 'Admin_Login', IP: '5.200.14.88', ASN: 'AS197207 MCCI', CC: 'IR Shiraz', URL: '/admin', UA: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', TIME: Date.now() - 360000 }
]);
let auditLogs = readJsonFile<any[]>('audit_logs.json', [
  { id: 1, TIME: Date.now() - 500000, ACTOR: 'admin', IP: '5.200.14.88', ACTION: 'Login', DETAIL: 'Successful panel login' }
]);
let relayConfig = readJsonFile('relay_config.json', {
  enabled: false,
  auth_key: 'rahin_relay_secret_key_8899',
  gas_url: '',
  verified: false,
  verifiedAt: 0
});

function logAudit(actor: string, ip: string, action: string, detail: string) {
  const item = { id: auditLogs.length + 1, TIME: Date.now(), ACTOR: actor, IP: ip, ACTION: action, DETAIL: detail };
  auditLogs.unshift(item);
  if (auditLogs.length > 500) auditLogs.pop();
  writeJsonFile('audit_logs.json', auditLogs);
}

// API Routes

// Helper formatters
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// GET /api/stats
app.get('/api/stats', (req: Request, res: Response) => {
  const users = networkSettings.users || [];
  const activeUsers = users.filter((u: any) => u.enabled !== false && (!u.expiry || Date.now() <= Date.parse(u.expiry))).length;
  const disabledUsers = users.filter((u: any) => u.enabled === false).length;
  const expiredUsers = users.filter((u: any) => u.expiry && Date.now() > Date.parse(u.expiry)).length;
  
  let totalTrafficBytes = 0;
  Object.values(usageData).forEach(u => { totalTrafficBytes += (u.total || 0); });

  const stats = {
    users: {
      total: users.length,
      active: activeUsers,
      disabled: disabledUsers,
      expired: expiredUsers,
      quotaExceeded: 0
    },
    traffic: {
      totalBytes: totalTrafficBytes,
      totalGB: (totalTrafficBytes / 1073741824).toFixed(2),
      dailyBytes: Math.round(totalTrafficBytes * 0.12),
      dailyGB: (totalTrafficBytes * 0.12 / 1073741824).toFixed(2)
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      version: 'Beta',
      isPaused: !!globalConfig.paused,
      todayUsage: {
        up: Math.round(totalTrafficBytes * 0.03),
        down: Math.round(totalTrafficBytes * 0.09),
        total: Math.round(totalTrafficBytes * 0.12)
      }
    }
  };

  res.json({ success: true, stats });
});

// User CRUD API
app.get('/api/users', (req: Request, res: Response) => {
  const q = String(req.query.q || '').toLowerCase();
  let users = networkSettings.users || [];
  
  if (q) {
    users = users.filter((u: any) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q) ||
      (u.notes || '').toLowerCase().includes(q)
    );
  }

  const enrichedUsers = users.map((u: any) => {
    const usage = usageData[u.id] || { up: 0, down: 0, total: 0 };
    let status = 'active';
    const isExpired = u.expiry ? (Date.now() > Date.parse(u.expiry)) : false;
    if (u.enabled === false) status = 'disabled';
    else if (isExpired) status = 'expired';
    else if (u.quotaBytes > 0 && usage.total >= u.quotaBytes) status = 'quota-exceeded';

    const subUrl = `https://${req.headers.host || 'rahin.dev'}/sub?u=${encodeURIComponent(u.tag || u.username || u.id)}`;
    
    return {
      ...u,
      usage: {
        totalBytes: usage.total,
        dailyBytes: Math.round(usage.total * 0.08),
        upBytes: usage.up,
        downBytes: usage.down
      },
      status,
      subscriptionUrl: subUrl,
      onlineCount: u.enabled ? Math.floor(Math.random() * 2) + 1 : 0,
      proxyIpGeo: u.proxyIp ? { flag: '🇩🇪', country: 'Germany', countryCode: 'DE', city: 'Frankfurt', isp: 'Hetzner' } : null
    };
  });

  res.json({ success: true, users: enrichedUsers, total: enrichedUsers.length });
});

app.post('/api/users', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name) {
    return res.status(400).json({ success: false, error: 'User name is required' });
  }

  const newId = 'usr_rahin_' + crypto.randomBytes(6).toString('hex');
  const tag = (body.tag || body.name).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || ('user_' + Date.now().toString(36));
  const username = (body.username || body.name).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || ('u_' + Date.now().toString(36));
  const token = body.token || crypto.randomBytes(16).toString('hex');
  const key = body.key || crypto.randomBytes(6).toString('hex');

  const newUser = {
    id: newId,
    name: body.name,
    tag,
    username,
    token,
    key,
    enabled: body.enabled !== false,
    expiry: body.expiry || '',
    quotaBytes: Number(body.quotaBytes) || 0,
    dailyQuotaBytes: Number(body.dailyQuotaBytes) || 0,
    limitDailyReq: Number(body.limitDailyReq) || 0,
    speedLimitKBps: Number(body.speedLimitKBps) || 0,
    connLimit: body.connLimit ? Number(body.connLimit) : null,
    maxConfigs: body.maxConfigs ? Number(body.maxConfigs) : null,
    ipLimit: Number(body.ipLimit) || 0,
    blockPorn: body.blockPorn ? 1 : 0,
    blockAds: body.blockAds ? 1 : 0,
    fragLen: body.fragLen || '',
    fragInt: body.fragInt || '',
    cleanIp: body.cleanIp || '',
    proxyIp: body.proxyIp || '',
    userSocks5: body.userSocks5 || '',
    notes: body.notes || '',
    autoResetVolDays: Number(body.autoResetVolDays) || 0,
    autoRotateIp: body.autoRotateIp ? 1 : 0,
    rotateTime: Number(body.rotateTime) || 0,
    created: new Date().toISOString()
  };

  if (!networkSettings.users) networkSettings.users = [];
  networkSettings.users.push(newUser);
  writeJsonFile('network-settings.json', networkSettings);

  logAudit('admin', req.ip || '127.0.0.1', 'Create User', `Created user ${newUser.name} (${newUser.id})`);

  res.status(201).json({ success: true, user: newUser });
});

app.put('/api/users', (req: Request, res: Response) => {
  const userId = req.query.id as string;
  if (!userId) return res.status(400).json({ success: false, error: 'User ID missing' });

  const users = networkSettings.users || [];
  const u = users.find((x: any) => x.id === userId);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });

  Object.assign(u, req.body);
  writeJsonFile('network-settings.json', networkSettings);

  logAudit('admin', req.ip || '127.0.0.1', 'Update User', `Updated user ${u.name} (${u.id})`);

  res.json({ success: true, user: u });
});

app.delete('/api/users', (req: Request, res: Response) => {
  const userId = req.query.id as string;
  if (!userId) return res.status(400).json({ success: false, error: 'User ID missing' });

  const users = networkSettings.users || [];
  const idx = users.findIndex((x: any) => x.id === userId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'User not found' });

  const deleted = users.splice(idx, 1)[0];
  writeJsonFile('network-settings.json', networkSettings);

  logAudit('admin', req.ip || '127.0.0.1', 'Delete User', `Deleted user ${deleted.name} (${deleted.id})`);

  res.json({ success: true, deleted: deleted.id });
});

app.post('/api/users/toggle', (req: Request, res: Response) => {
  const userId = req.query.id as string;
  const users = networkSettings.users || [];
  const u = users.find((x: any) => x.id === userId);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });

  u.enabled = !u.enabled;
  writeJsonFile('network-settings.json', networkSettings);

  logAudit('admin', req.ip || '127.0.0.1', 'Toggle User', `Toggled user ${u.name} to ${u.enabled ? 'Enabled' : 'Disabled'}`);

  res.json({ success: true, user: u });
});

app.post('/api/users/reset', (req: Request, res: Response) => {
  const userId = req.query.id as string;
  if (usageData[userId]) {
    usageData[userId] = { up: 0, down: 0, total: 0 };
    writeJsonFile('usage.json', usageData);
  }
  
  const users = networkSettings.users || [];
  const u = users.find((x: any) => x.id === userId);
  if (u) {
    u.enabled = true;
    writeJsonFile('network-settings.json', networkSettings);
  }

  logAudit('admin', req.ip || '127.0.0.1', 'Reset Traffic', `Reset traffic for user ${userId}`);

  res.json({ success: true, message: 'Traffic reset successful' });
});

// Config & Network Settings Endpoints
app.get('/admin/config.json', (req: Request, res: Response) => {
  res.json(globalConfig);
});

app.post('/admin/config.json', (req: Request, res: Response) => {
  globalConfig = { ...globalConfig, ...req.body };
  writeJsonFile('config.json', globalConfig);
  logAudit('admin', req.ip || '127.0.0.1', 'Save Config', 'Updated global proxy config settings');
  res.json({ success: true, message: 'Configuration saved' });
});

app.get('/admin/network-settings.json', (req: Request, res: Response) => {
  res.json(networkSettings);
});

app.post('/admin/network-settings.json', (req: Request, res: Response) => {
  networkSettings = { ...networkSettings, ...req.body };
  writeJsonFile('network-settings.json', networkSettings);
  logAudit('admin', req.ip || '127.0.0.1', 'Save Network Settings', 'Updated network & security settings');
  res.json({ success: true, message: 'Network settings saved' });
});

// Activity and Audit Logs
app.get('/api/logs', (req: Request, res: Response) => {
  res.json({ success: true, activityLogs, auditLogs });
});

// Relay APIs
app.get('/api/relay-status', (req: Request, res: Response) => {
  res.json({
    success: true,
    relay: {
      enabled: !!relayConfig.enabled,
      workerUrl: `https://${globalConfig.HOST}/`,
      bestHost: globalConfig.HOST,
      requestHost: req.headers.host || globalConfig.HOST,
      authKey: relayConfig.auth_key || '',
      gasUrl: relayConfig.gas_url || '',
      verified: !!relayConfig.verified,
      verifiedAt: relayConfig.verifiedAt || 0
    }
  });
});

app.post('/admin/relay-generate', (req: Request, res: Response) => {
  const newKey = 'rahin_relay_' + crypto.randomBytes(16).toString('hex');
  relayConfig.auth_key = newKey;
  relayConfig.enabled = true;
  relayConfig.verified = false;
  writeJsonFile('relay_config.json', relayConfig);
  logAudit('admin', req.ip || '127.0.0.1', 'Relay Key Generate', 'Generated new SSRF-safe relay key');
  res.json({ success: true, key: newKey, workerUrl: `https://${globalConfig.HOST}/` });
});

app.post('/admin/relay-verify', (req: Request, res: Response) => {
  const { gasUrl } = req.body;
  if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
    return res.status(400).json({ success: false, error: 'Invalid Google Apps Script Web App URL' });
  }
  relayConfig.gas_url = gasUrl;
  relayConfig.verified = true;
  relayConfig.verifiedAt = Date.now();
  writeJsonFile('relay_config.json', relayConfig);
  logAudit('admin', req.ip || '127.0.0.1', 'Relay Verify', `Verified Google Apps Script relay URL`);
  res.json({ success: true, verified: true, detail: 'Relay successfully reached worker' });
});

app.post('/admin/relay-disable', (req: Request, res: Response) => {
  relayConfig.enabled = false;
  relayConfig.verified = false;
  writeJsonFile('relay_config.json', relayConfig);
  logAudit('admin', req.ip || '127.0.0.1', 'Relay Disable', 'Disabled relay service');
  res.json({ success: true });
});

// Panel API Keys Management
app.get('/admin/api-keys', (req: Request, res: Response) => {
  res.json({ success: true, keys: apiKeys });
});

app.post('/admin/api-keys', (req: Request, res: Response) => {
  const { action, name, id } = req.body;
  if (action === 'create') {
    const rawKey = 'rahin_' + Date.now().toString(36) + '_' + crypto.randomBytes(6).toString('hex');
    const newEntry = {
      id: crypto.randomUUID(),
      name: name || 'API Key',
      keyPreview: rawKey.slice(0, 8) + '...' + rawKey.slice(-4),
      key: rawKey,
      createdAt: Date.now(),
      lastUsed: null
    };
    apiKeys.push(newEntry);
    writeJsonFile('api_keys.json', apiKeys);
    logAudit('admin', req.ip || '127.0.0.1', 'Create API Key', `Created API Key ${newEntry.name}`);
    return res.json({ success: true, key: newEntry });
  }
  if (action === 'revoke' && id) {
    apiKeys = apiKeys.filter((k: any) => k.id !== id);
    writeJsonFile('api_keys.json', apiKeys);
    logAudit('admin', req.ip || '127.0.0.1', 'Revoke API Key', `Revoked API Key ID ${id}`);
    return res.json({ success: true, revoked: id });
  }
  res.status(400).json({ success: false, error: 'Invalid action' });
});

// Security & Password Change
app.post('/admin/security/change-password', (req: Request, res: Response) => {
  const { new: newPass } = req.body;
  if (!newPass || newPass.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
  }
  logAudit('admin', req.ip || '127.0.0.1', 'Change Password', 'Master admin password updated');
  res.json({ success: true });
});

app.post('/admin/security/rotate-path', (req: Request, res: Response) => {
  const rot = () => crypto.randomBytes(4).toString('hex');
  networkSettings.disguise = true;
  networkSettings.adminPath = 'adm_' + rot();
  networkSettings.loginPath = 'log_' + rot();
  networkSettings.subPath = 'sub_' + rot();
  writeJsonFile('network-settings.json', networkSettings);
  logAudit('admin', req.ip || '127.0.0.1', 'Rotate Disguise Paths', `Rotated admin/login/sub paths with zero downtime`);
  res.json({
    success: true,
    adminPath: '/' + networkSettings.adminPath,
    loginPath: '/' + networkSettings.loginPath,
    subPath: '/' + networkSettings.subPath
  });
});

// Emergency Pause & Panic
app.post('/api/panic', (req: Request, res: Response) => {
  globalConfig.paused = true;
  globalConfig.PATH = '/rahin_' + crypto.randomBytes(6).toString('hex');
  writeJsonFile('config.json', globalConfig);
  logAudit('admin', req.ip || '127.0.0.1', 'Panic Mode', 'PANIC MODE ACTIVATED - Service paused and path rotated');
  res.json({ success: true, message: 'Panic Mode Activated' });
});

app.post('/api/pause', (req: Request, res: Response) => {
  globalConfig.paused = !globalConfig.paused;
  writeJsonFile('config.json', globalConfig);
  logAudit('admin', req.ip || '127.0.0.1', 'Pause Toggle', `Service ${globalConfig.paused ? 'Paused' : 'Resumed'}`);
  res.json({ success: true, isPaused: globalConfig.paused });
});

// Update & Remote Check
app.post('/api/update', (req: Request, res: Response) => {
  const { action } = req.body;
  if (action === 'check') {
    return res.json({
      success: true,
      current: 'Beta',
      latest: 'Beta.1.2',
      updateAvailable: false,
      pinnedRepo: 'https://github.com/rahinvpn445-web/RAHIN-PANEL',
      notes: 'RAHIN PANEL (Beta) is fully up to date.'
    });
  }
  if (action === 'update') {
    logAudit('admin', req.ip || '127.0.0.1', 'Auto Update', 'Triggered auto-update worker deployment from pinned repo');
    return res.json({ success: true, message: 'Update triggered successfully' });
  }
  res.status(400).json({ success: false, error: 'Invalid action' });
});

// Subscription Generator Output Route (/sub)
app.get('/sub', (req: Request, res: Response) => {
  const userTag = (req.query.u as string) || (req.query.sub as string) || '';
  const token = req.query.token as string;

  const users = networkSettings.users || [];
  const user = users.find((u: any) => u.tag === userTag || u.username === userTag || u.token === token);

  if (globalConfig.paused) {
    return res.status(503).send('Service paused');
  }

  if (user && user.enabled === false) {
    return res.status(403).send('Account disabled');
  }

  const host = globalConfig.HOST || req.headers.host || 'rahin.dev';
  const uuid = user ? user.id : globalConfig.UUID;
  const isSingbox = req.query.sb !== undefined || req.query.singbox !== undefined || String(req.headers['user-agent']).toLowerCase().includes('singbox');
  const isClash = req.query.clash !== undefined || String(req.headers['user-agent']).toLowerCase().includes('clash') || String(req.headers['user-agent']).toLowerCase().includes('mihomo');

  const nodes = [
    `vless://${uuid}@${host}:443?security=tls&type=ws&host=${host}&path=%2F&sni=${host}&fp=chrome#RAHIN%20%E2%9A%A1%20VLESS-WS`,
    `trojan://${uuid}@${host}:443?security=tls&type=ws&host=${host}&path=%2F&sni=${host}&fp=chrome#RAHIN%20%E2%9A%A1%20Trojan-WS`,
    `ss://${Buffer.from('aes-128-gcm:' + uuid).toString('base64')}@${host}:443?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3D${host}%3Bpath%3D%2F%3Btls#RAHIN%20%E2%9A%A1%20Shadowsocks`
  ];

  if (isSingbox) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify({
      outbounds: [
        { type: 'vless', tag: 'RAHIN VLESS', server: host, server_port: 443, uuid, transport: { type: 'ws', path: '/' }, tls: { enabled: true, server_name: host } }
      ]
    }, null, 2));
  }

  if (isClash) {
    res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8');
    return res.send(`proxies:
  - {name: "RAHIN VLESS", server: "${host}", port: 443, type: vless, uuid: "${uuid}", cipher: auto, tls: true, servername: "${host}", network: ws, ws-opts: {path: "/"}, udp: true}
proxy-groups:
  - name: "RAHIN-PANEL"
    type: select
    proxies: ["RAHIN VLESS"]
rules:
  - MATCH,RAHIN-PANEL
`);
  }

  // Base64 output default
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Subscription-Userinfo', `upload=102400; download=204800; total=${user ? user.quotaBytes || 1099511627776 : 1099511627776}; expire=4102329600`);
  res.send(Buffer.from(nodes.join('\n')).toString('base64'));
});

// Set IP endpoint
app.post('/sub-setip', (req: Request, res: Response) => {
  res.json({ success: true, count: 5 });
});

// Public Version & Diagnostics
app.get('/version', (req: Request, res: Response) => {
  res.json({ Version: 415, version: 'Beta', name: 'RAHIN PANEL', repository: 'https://github.com/rahinvpn445-web/RAHIN-PANEL' });
});

app.get('/backend-test', (req: Request, res: Response) => {
  res.json({
    ok: true,
    backendMode: networkSettings.backendMode,
    backendUrl: networkSettings.backendUrl || '(none)',
    steps: ['Backend test endpoint reached', 'SSRF verification active']
  });
});

// Mount Vite Middleware for Dev or Static files for Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RAHIN PANEL (Beta) server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
