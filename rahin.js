/**
 * RAHIN PANEL — Cloudflare Worker  (v1.2.0)
 *
 * معماری: KV برای تنظیمات، D1 برای مصرف/لاگ، سشن امن، سابسکریپشن:
 *   - KV: تنظیمات کلی کانفیگ (config.json) + تنظیمات پنل/شبکه (network-settings.json) + کاربران
 *   - D1: مصرف ترافیک (usage) + لاگ درخواست‌ها (logs) + لاگ ممیزی (audit_log)
 *   - ورود ادمین: رمز (متغیر محیطی ADMIN یا KV) + سشن امضاشده + قفل بعد از تلاش زیاد
 *   - سابسکریپشن: /sub?u=<tag> برای هر کاربر (با چک وضعیت/حجم/انقضا)
 */

const PANEL_VERSION = '1.2.5';
const CURRENT_VERSION = '1.2.5';

// ============================================================
//  تنظیمات ثابت
// ============================================================
const SESSION_IDLE_MS = 15 * 60 * 1000;      // ۱۵ دقیقه — بستن خودکار سشن
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const _loginAttempts = new Map();

// ============================================================
//  ابزارهای کمکی
// ============================================================
function json(data, status = 200, extraHeaders = {}) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders };
  return new Response(JSON.stringify(data, null, 2), { status, headers: h });
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(key, data) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return Array.from(new Uint8Array(s), b => b.toString(16).padStart(2, '0')).join('');
}

// --- ساخت سشن (مثل مرجع) ---
async function makeSessionToken(UA, pass, issuedAt = Date.now()) {
  return `${issuedAt}.${await hmac(pass, `${UA}|${pass}|${issuedAt}`)}`;
}
async function verifySessionToken(token, UA, pass, maxAgeMs = SESSION_IDLE_MS) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const issuedAt = Number(token.slice(0, dot));
  if (!Number.isFinite(issuedAt)) return false;
  const age = Date.now() - issuedAt;
  if (age > maxAgeMs || age < -60000) return false;
  const expected = await makeSessionToken(UA, pass, issuedAt);
  return timingSafeEqual(token, expected);
}
async function isAuthed(request, UA, pass) {
  const cookies = request.headers.get('Cookie') || '';
  const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
  if (await verifySessionToken(authCookie, UA, pass)) return true;
  return false;
}

// --- قفل ورود (نرخ محدود) ---
function loginRateCheck(ip) {
  const now = Date.now();
  const rec = _loginAttempts.get(ip);
  if (rec && rec.blockedUntil && now < rec.blockedUntil)
    return { allowed: false, retryAfter: Math.ceil((rec.blockedUntil - now) / 1000) };
  return { allowed: true };
}
function loginRecordFailure(ip) {
  const now = Date.now();
  let rec = _loginAttempts.get(ip);
  if (!rec || now - rec.windowStart > LOGIN_WINDOW_MS) rec = { count: 0, windowStart: now, blockedUntil: 0 };
  rec.count++;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) rec.blockedUntil = now + LOGIN_BLOCK_MS;
  _loginAttempts.set(ip, rec);
}
function loginRecordSuccess(ip) { _loginAttempts.delete(ip); }

// ============================================================
//  دسترسی به داده‌ها — KV (با fallback به D1 مثل مرجع)
// ============================================================
function hasKV(env) { return !!(env && env.KV && typeof env.KV.get === 'function'); }

async function kvGet(env, key) {
  if (!hasKV(env)) return null;
  try { return await env.KV.get(key); } catch (e) { return null; }
}
async function kvPut(env, key, val) {
  if (!hasKV(env)) return;
  try { await env.KV.put(key, val); } catch (e) {}
}

// --- تنظیمات پنل/شبکه (شامل کاربران) ---
let _nsCache = null, _nsAt = 0;
async function loadNetworkSettings(env) {
  if (_nsCache && Date.now() - _nsAt < 30000) return _nsCache;
  let ns = {};
  try { const raw = await kvGet(env, 'network-settings.json'); if (raw) ns = JSON.parse(raw); } catch (e) {}
  if (!Array.isArray(ns.users)) ns.users = [];
  _nsCache = ns; _nsAt = Date.now();
  return ns;
}
async function saveNetworkSettings(env, ns) {
  _nsCache = ns; _nsAt = Date.now();
  await kvPut(env, 'network-settings.json', JSON.stringify(ns, null, 2));
}

// --- تنظیمات کلی کانفیگ (config.json) ---
let _cfgCache = null, _cfgAt = 0;
async function loadConfig(env) {
  if (_cfgCache && Date.now() - _cfgAt < 30000) return _cfgCache;
  let cfg = null;
  try { const raw = await kvGet(env, 'config.json'); if (raw) cfg = JSON.parse(raw); } catch (e) {}
  _cfgCache = cfg; _cfgAt = Date.now();
  return cfg;
}
async function saveConfig(env, cfg) {
  _cfgCache = cfg; _cfgAt = Date.now();
  await kvPut(env, 'config.json', JSON.stringify(cfg, null, 2));
}

// ============================================================
//  مصرف ترافیک — D1 (مثل مرجع: کل + روزانه برای هر کاربر)
// ============================================================
function hasD1(env) { return !!(env && env.DB && typeof env.DB.prepare === 'function'); }
function getDateKey(d) { return d.toISOString().slice(0, 10); }

async function d1Init(env) {
  if (!hasD1(env)) return false;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS usage (k TEXT PRIMARY KEY, up INTEGER DEFAULT 0, down INTEGER DEFAULT 0, total INTEGER DEFAULT 0)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, TYPE TEXT, IP TEXT, URL TEXT, UA TEXT, TIME INTEGER)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, TIME INTEGER, ACTOR TEXT, IP TEXT, ACTION TEXT, DETAIL TEXT)').run();
    return true;
  } catch (e) { return false; }
}
async function usageGet(env, k) {
  if (!await d1Init(env)) return null;
  try {
    const r = await env.DB.prepare('SELECT up,down,total FROM usage WHERE k=?').bind(k).first();
    return r ? { up: r.up || 0, down: r.down || 0, total: r.total || 0 } : null;
  } catch (e) { return null; }
}
async function usageAdd(env, k, up, down) {
  if (!await d1Init(env)) return;
  try {
    await env.DB.prepare('INSERT INTO usage (k,up,down,total) VALUES (?,?,?,?) ON CONFLICT(k) DO UPDATE SET up=up+?, down=down+?, total=total+?')
      .bind(k, up, down, up + down, up, down, up + down).run();
  } catch (e) {}
}
async function usageReset(env, k) {
  if (!await d1Init(env)) return;
  try { await env.DB.prepare('DELETE FROM usage WHERE k=?').bind(k).run(); } catch (e) {}
}
async function auditLog(env, actor, ip, action, detail) {
  if (!await d1Init(env)) return;
  try { await env.DB.prepare('INSERT INTO audit_log (TIME,ACTOR,IP,ACTION,DETAIL) VALUES (?,?,?,?,?)').bind(Date.now(), actor, ip, action, detail || '').run(); } catch (e) {}
}

/* --- آمار درخواست‌ها، سری مصرف روزانه و فعالیت اخیر --- */
async function countLogs(env, type, sinceMs) {
  if (!await d1Init(env)) return 0;
  try {
    const r = sinceMs != null
      ? await env.DB.prepare('SELECT COUNT(*) c FROM logs WHERE TYPE=? AND TIME>=?').bind(type, sinceMs).first()
      : await env.DB.prepare('SELECT COUNT(*) c FROM logs WHERE TYPE=?').bind(type).first();
    return (r && r.c) || 0;
  } catch (e) { return 0; }
}

/* مجموع مصرف روزانه‌ی همه‌ی کاربران — برای نمودار ترافیک (bytes) */
async function usageSeries(env, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    out.push({ date: getDateKey(d), up: 0, down: 0, total: 0 });
  }
  if (!await d1Init(env)) return out;
  try {
    const r = await env.DB.prepare("SELECT k, up, down, total FROM usage WHERE k LIKE 'uusage-d:%'").all();
    for (const row of (r.results || [])) {
      const m = /^uusage-d:[^:]+:(\d{4}-\d{2}-\d{2})$/.exec(row.k);
      if (!m) continue;
      const bucket = out.find(o => o.date === m[1]);
      if (bucket) { bucket.up += row.up || 0; bucket.down += row.down || 0; bucket.total += row.total || 0; }
    }
  } catch (e) {}
  return out;
}


// ============================================================
//  توابع کمکی کاربران
// ============================================================
function buildUser(body) {
  const name = (body.name || '').trim();
  if (!name) throw new Error('Name is required');
  const newId = crypto.randomUUID().replace(/-/g, '');
  const tag = (body.tag || name).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || ('user' + Date.now().toString(36));
  const token = body.token || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const username = (body.username || name).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || ('user' + Date.now().toString(36));
  const key = body.key || Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');
  return {
    id: newId, name, tag, token, username, key,
    enabled: body.enabled !== false,
    expiry: body.expiry || '',
    quotaBytes: Number(body.quotaBytes) || 0,
    dailyQuotaBytes: Number(body.dailyQuotaBytes) || 0,
    limitDailyReq: Number(body.limitDailyReq) || 0,
    notes: body.notes || '',
    speedLimitKBps: Number(body.speedLimitKBps) || 0,
    connLimit: body.connLimit ? parseInt(body.connLimit) : null,
    maxConfigs: body.maxConfigs ? parseInt(body.maxConfigs) : null,
    ports: body.ports || '',
    userIps: Array.isArray(body.userIps) ? body.userIps.map(s => String(s)) : [],
    userProxyIps: Array.isArray(body.userProxyIps) ? body.userProxyIps.map(s => String(s)) : [],
    blockPorn: body.blockPorn ? 1 : 0,
    blockAds: body.blockAds ? 1 : 0,
    created: new Date().toISOString(),
  };
}

function userStatus(u, usageTotal, dailyBytes) {
  if (u.enabled === false) return 'disabled';
  if (u.expiry) { const t = Date.parse(u.expiry); if (!isNaN(t) && Date.now() > t) return 'expired'; }
  if (u.quotaBytes && usageTotal >= u.quotaBytes) return 'quota-exceeded';
  if (u.dailyQuotaBytes && dailyBytes >= u.dailyQuotaBytes) return 'daily-quota-exceeded';
  return 'active';
}

async function enrichUser(env, u) {
  let totalBytes = 0, dailyBytes = 0;
  try { const c = await usageGet(env, 'uusage:' + u.id); if (c) totalBytes = c.total || 0; } catch (e) {}
  try { const cd = await usageGet(env, 'uusage-d:' + u.id + ':' + getDateKey(new Date())); if (cd) dailyBytes = cd.total || 0; } catch (e) {}
  const status = userStatus(u, totalBytes, dailyBytes);
  /* اگر حالت مخفی فعال باشد، لینک ساب از مسیر مخفی ساب ساخته می‌شود */
  let subPath = '/sub';
  try {
    const dg = await getDisguise(env);
    if (dg.on) subPath = dg.sub;
  } catch (e) {}
  const subUrl = `${subPath}?u=${encodeURIComponent(u.tag || u.username || u.id)}`;
  return { ...u, usage: { totalBytes, dailyBytes }, status, subscriptionUrl: subUrl };
}

// ============================================================
//  مدیریت API
// ============================================================
async function handleAuth(request, env, UA, ip) {
  if (request.method !== 'POST') return json({ success: false, error: 'POST only' }, 405);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const pass = body.password || '';
  const adminPass = env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass');
  if (!adminPass) return json({ success: false, error: 'Admin password not configured' }, 500);

  const rate = loginRateCheck(ip);
  if (!rate.allowed) return json({ success: false, error: `Too many attempts — try again in ${rate.retryAfter}s`, retryAfter: rate.retryAfter }, 429);

  if (timingSafeEqual(pass, adminPass)) {
    loginRecordSuccess(ip);
    const token = await makeSessionToken(UA, adminPass);
    return json({ success: true, token }, 200, { 'Set-Cookie': `auth=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_IDLE_MS / 1000}` });
  }
  loginRecordFailure(ip);
  return json({ success: false, error: 'Wrong password' }, 401);
}

// --- API کاربران (مثل مرجع) ---
async function handleApiUsers(request, env, url, method, UA, ip) {
  if (!await isAuthed(request, UA, await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'))))
    return json({ success: false, error: 'Unauthorized' }, 401);

  const ns = await loadNetworkSettings(env);
  const users = ns.users;
  const userId = url.searchParams.get('id');
  const action = url.searchParams.get('action');
  let body = {}; try { if (method !== 'GET') body = await request.clone().json(); } catch (e) {}

  // GET list
  if (method === 'GET' && !userId) {
    const q = url.searchParams.get('q') || '';
    let list = users;
    if (q) { const ql = q.toLowerCase(); list = list.filter(u => (u.name || '').toLowerCase().includes(ql) || (u.id || '').toLowerCase().includes(ql) || (u.username || '').toLowerCase().includes(ql)); }
    const enriched = await Promise.all(list.map(u => enrichUser(env, u)));
    return json({ success: true, users: enriched, total: enriched.length });
  }

  // GET one
  if (method === 'GET' && userId) {
    const u = users.find(x => x.id === userId || x.username === userId.toLowerCase() || x.name === userId);
    if (!u) return json({ success: false, error: 'User not found' }, 404);
    return json({ success: true, user: await enrichUser(env, u) });
  }

  // POST create
  if (method === 'POST' && !userId) {
    try {
      const u = buildUser(body);
      ns.users.push(u);
      await saveNetworkSettings(env, ns);
      await auditLog(env, 'admin', ip, 'CREATE_USER', (u.name || u.id) + ' (' + u.id + ')');
      return json({ success: true, user: u }, 201);
    } catch (e) { return json({ success: false, error: e.message }, 400); }
  }

  // PUT update
  if (method === 'PUT' && userId) {
    const u = users.find(x => x.id === userId);
    if (!u) return json({ success: false, error: 'User not found' }, 404);
    for (const f of ['name','tag','username','expiry','notes','ports','cleanIp','proxyIp']) if (body[f] !== undefined) u[f] = body[f];
    for (const f of ['quotaBytes','dailyQuotaBytes','limitDailyReq','speedLimitKBps','ipLimit']) if (body[f] !== undefined) u[f] = Number(body[f]) || 0;
    for (const f of ['connLimit','maxConfigs']) if (body[f] !== undefined) u[f] = body[f] ? parseInt(body[f]) : null;
    if (Array.isArray(body.userIps)) u.userIps = body.userIps.map(s => String(s));
    if (Array.isArray(body.userProxyIps)) u.userProxyIps = body.userProxyIps.map(s => String(s));
    for (const f of ['blockPorn','blockAds']) if (body[f] !== undefined) u[f] = body[f] ? 1 : 0;
    if (body.enabled !== undefined) u.enabled = !!body.enabled;
    await saveNetworkSettings(env, ns);
    await auditLog(env, 'admin', ip, 'UPDATE_USER', (u.name || u.id) + ' (' + u.id + ')');
    return json({ success: true, user: u });
  }

  // DELETE
  if (method === 'DELETE' && userId) {
    const idx = users.findIndex(x => x.id === userId);
    if (idx === -1) return json({ success: false, error: 'User not found' }, 404);
    const deleted = users.splice(idx, 1)[0];
    await saveNetworkSettings(env, ns);
    await auditLog(env, 'admin', ip, 'DELETE_USER', (deleted.name || deleted.id) + ' (' + deleted.id + ')');
    return json({ success: true, deleted: deleted.id });
  }

  // toggle / reset
  if (method === 'POST' && userId) {
    const u = users.find(x => x.id === userId);
    if (!u) return json({ success: false, error: 'User not found' }, 404);
    if (action === 'toggle') {
      u.enabled = !u.enabled;
      await saveNetworkSettings(env, ns);
      await auditLog(env, 'admin', ip, 'TOGGLE_USER', (u.name || u.id) + ' (' + u.id + ') enabled=' + u.enabled);
      return json({ success: true, user: u });
    }
    if (action === 'reset') {
      await usageReset(env, 'uusage:' + u.id);
      await usageReset(env, 'uusage-d:' + u.id + ':' + getDateKey(new Date()));
      await auditLog(env, 'admin', ip, 'RESET_USER_USAGE', (u.name || u.id) + ' (' + u.id + ')');
      return json({ success: true, message: 'Traffic reset' });
    }
  }

  return json({ success: false, error: 'Invalid request' }, 400);
}

// --- API تنظیمات کلی کانفیگ ---
async function handleApiConfig(request, env, UA, method) {
  if (!await isAuthed(request, UA, await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'))))
    return json({ success: false, error: 'Unauthorized' }, 401);
  if (method === 'GET') {
    const cfg = await loadConfig(env);
    return json({ success: true, config: cfg });
  }
  if (method === 'PUT') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    if (!body || !body.UUID || !body.HOST) return json({ success: false, error: 'Incomplete configuration — UUID and HOST required' }, 400);
    await saveConfig(env, body);
    return json({ success: true, message: 'Configuration saved' });
  }
  return json({ success: false, error: 'Method not allowed' }, 405);
}

/* --- تغییر رمز ادمین --- */
async function handleChangePassword(request, env, UA, ip) {
  if (request.method !== 'POST') return json({ success:false, error:'POST only' }, 405);
  const adminPass = await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'));
  if (!await isAuthed(request, UA, adminPass)) return json({ success:false, error:'Unauthorized' }, 401);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const oldP = String(body.oldPassword || '');
  const newP = String(body.newPassword || '');
  if (newP.length < 6) return json({ success:false, error:'New password must be at least 6 characters' }, 400);
  if (!timingSafeEqual(oldP, adminPass)) return json({ success:false, error:'Current password is wrong' }, 401);
  await kvPut(env, 'admin_pass', newP);
  await auditLog(env, 'admin', ip, 'CHANGE_PASSWORD', 'admin');
  const envPreferred = !!(env.ADMIN || env.admin || env.PASSWORD);
  return json({ success:true, message:'Password updated', envPreferred });
}

// --- API تنظیمات پنل/شبکه ---
async function handleApiSettings(request, env, UA, method) {
  if (!await isAuthed(request, UA, await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'))))
    return json({ success: false, error: 'Unauthorized' }, 401);
  const ns = await loadNetworkSettings(env);
  if (method === 'GET') return json({ success: true, settings: ns });
  if (method === 'PUT') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    if (Array.isArray(body.users)) return json({ success: false, error: 'Users are managed via /api/users' }, 400);
    await saveNetworkSettings(env, { ...ns, ...body });
    return json({ success: true, settings: { ...ns, ...body } });
  }
  return json({ success: false, error: 'Method not allowed' }, 405);
}

// --- آمار ---
async function handleApiStats(request, env, UA) {
  if (!await isAuthed(request, UA, await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'))))
    return json({ success: false, error: 'Unauthorized' }, 401);
  const ns = await loadNetworkSettings(env);
  const users = ns.users;
  const totalUsers = users.length;
  const now = Date.now();
  const _today = getDateKey(new Date());
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  let activeUsers = 0, disabledUsers = 0, expiredUsers = 0, quotaExceeded = 0;
  let totalTrafficBytes = 0, dailyTrafficBytes = 0;

  for (const u of users) {
    const isExpired = u.expiry ? (now > Date.parse(u.expiry)) : false;
    let total = 0, daily = 0;
    try { const c = await usageGet(env, 'uusage:' + u.id); if (c) { total = c.total || 0; totalTrafficBytes += total; } } catch (e) {}
    try { const cd = await usageGet(env, 'uusage-d:' + u.id + ':' + _today); if (cd) { daily = cd.total || 0; dailyTrafficBytes += daily; } } catch (e) {}
    if (u.enabled === false) disabledUsers++;
    else if (isExpired) expiredUsers++;
    else if (u.quotaBytes && total >= u.quotaBytes) quotaExceeded++;
    else activeUsers++;
  }

  const cfg = await loadConfig(env);
  const requestsToday = await countLogs(env, 'Sub', startOfToday.getTime());
  const requestsTotal = await countLogs(env, 'Sub', null);

  return json({
    success: true,
    stats: {
      users: { total: totalUsers, active: activeUsers, disabled: disabledUsers, expired: expiredUsers, quotaExceeded },
      traffic: { totalBytes: totalTrafficBytes, totalGB: (totalTrafficBytes / 1073741824).toFixed(2), dailyBytes: dailyTrafficBytes, dailyGB: (dailyTrafficBytes / 1073741824).toFixed(2) },
      requests: { today: requestsToday, total: requestsTotal },
      system: { version: PANEL_VERSION, uptimeSeconds: Math.floor((Date.now() - (globalThis.__workerStart || Date.now())) / 1000), configSaved: !!(cfg && cfg.UUID) },
    },
  });
}

/* سری مصرف روزانه — برای نمودار ترافیک واقعی */
async function handleApiStatsUsage(request, env, UA, url) {
  if (!await isAuthed(request, UA, await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'))))
    return json({ success: false, error: 'Unauthorized' }, 401);
  let days = parseInt(url.searchParams.get('days') || '30', 10);
  if (!Number.isFinite(days)) days = 30;
  days = Math.max(1, Math.min(90, days));
  const series = await usageSeries(env, days);
  const hasData = series.some(o => o.total > 0);
  return json({ success: true, days, hasData, series });
}


// ============================================================
//  سابسکریپشن کاربر (مثل مرجع — چک وضعیت، حجم، انقضا)
// ============================================================
async function handleSub(request, env, url, ctx) {
  const ns = await loadNetworkSettings(env);
  const users = ns.users;
  const tag = url.searchParams.get('u');
  const token = url.searchParams.get('token');
  const sub = url.searchParams.get('sub');
  const key = url.searchParams.get('key');
  const _hst = url.host;
  let user = null;

  if (token) {
    user = users.find(x => x && x.token === token);
    /* توکن رمزگذاری‌شده هم پشتیبانی می‌شود */
    if(!user){
      const dec = base64SecretDecode(token, _hst);
      user = users.find(x => x && (x.token === dec || x.id === dec));
    }
  }
  else if (sub && key) user = users.find(x => x && x.key === key && String(x.username || '').toLowerCase() === String(sub).toLowerCase());
  else if (tag) user = users.find(x => x && (x.tag === tag || x.username === tag));

  if (!user) return new Response('User not found', { status: 404 });

  /* فیلتر User-Agent (اختیاری) — از تنظیمات پنل */
  const _uaFilter = (ns.subUserAgent || '').trim();
  const UA0 = request.headers.get('User-Agent') || '';
  if (_uaFilter && !UA0.toLowerCase().includes(_uaFilter.toLowerCase())) {
    return new Response('Access denied: unauthorized client', { status: 403 });
  }
  if (user.enabled === false) return new Response('Account disabled', { status: 403 });
  if (user.expiry) { const t = Date.parse(user.expiry); if (!isNaN(t) && Date.now() > t) return new Response('Account expired', { status: 403 }); }
  if (user.quotaBytes) { const c = await usageGet(env, 'uusage:' + user.id); if (c && c.total >= user.quotaBytes) return new Response('Quota exceeded', { status: 403 }); }

  const cfg = await loadConfig(env);
  if (!cfg) return new Response('No configuration — configure the panel first', { status: 500 });

  // ساخت چند لینک کانفیگ برای کاربر
  // — اگر کاربر آیپی/دامنه‌ای از منبع انتخاب کرده باشد، برای هر کدام یک کانفیگ ساخته می‌شود
  // — در غیر این صورت از HOST استفاده می‌شود
  const uuid = cfg.UUID;
  const host = cfg.HOST || (new URL(request.url).host);
  const basePath = cfg.PATH || '/';
  const fp = cfg.Fingerprint || 'chrome';
  const pathEnc = encodeURIComponent(basePath);
  const svc = encodeURIComponent(String(cfg.gRPCmode || 'gun').replace(/[^a-zA-Z0-9_]/g, '')) || 'gun';
  const proto = String(cfg.sugProtokol || '').toLowerCase();
  const transport = String(cfg.protokolHaavara || '').toLowerCase();

  const addrs = (Array.isArray(user.userIps) && user.userIps.length)
    ? [...new Set(user.userIps.map(s => String(s).trim()).filter(Boolean))]
    : [host];
  const lines = [];
  const mv = cfg.metavech || {};
  const mvType = String(mv.type || 'auto').toLowerCase();

  /* تبدیل یک مقدار پروکسی به پارامتر لینک */
  const proxyParam = (val) => {
    const p = String(val).split('#')[0]; // حذف برچسب لوکیشن
    if (mvType === 'socks5') return '&proxy=socks5://' + p;
    if (mvType === 'http') return '&proxy=http://' + p;
    if (mvType === 'https') return '&proxy=https://' + p;
    if (mvType === 'turn') return '&proxy=turn://' + p;
    if (mvType === 'sstp') return '&proxy=sstp://' + p;
    return '&proxyip=' + p; // auto
  };

  /* پروکسی‌های انتخابی کاربر (لوکیشن‌های ثابت) — اگر خالی باشد، فقط تزریق سراسری */
  const userProxies = (Array.isArray(user.userProxyIps) && user.userProxyIps.length)
    ? [...new Set(user.userProxyIps.map(s => String(s).trim()).filter(Boolean))]
    : null;

  /* تزریق سراسری (اگر فعال و کاربر پروکسی شخصی انتخاب نکرده باشد) */
  let globalSuffix = '';
  if (!userProxies && mv.enabled) {
    try {
      const pool = await getProxyIps(env);
      if (Array.isArray(pool) && pool.length) {
        globalSuffix = proxyParam(pool[Math.floor(Math.random() * pool.length)].value);
      }
    } catch (e) {}
  }

  /* ساخت کانفیگ برای هر ترکیب: آدرس × پروکسی (ثابت برای کاربر) */
  const proxyOptions = (userProxies && userProxies.length) ? userProxies : [null];
  for (const addr of addrs) {
    for (const proxy of proxyOptions) {
      let suffix = globalSuffix;
      let label = (addrs.length > 1) ? `${user.name || user.tag} ${addr}` : (user.name || user.tag);
      if (proxy) {
        const [pv, pl] = String(proxy).split('#');
        suffix = proxyParam(pv);
        label = `${label} ${pl ? pl : pv}`.trim();
      }
      const name = encodeURIComponent(label);
      if (proto === 'vless') {
        if (transport === 'ws') lines.push(`vless://${uuid}@${addr}:443?encryption=none&security=tls&sni=${host}&fp=${fp}&type=ws&host=${host}&path=${pathEnc}${suffix}#${name}`);
        else if (transport === 'grpc') lines.push(`vless://${uuid}@${addr}:443?encryption=none&security=tls&sni=${host}&fp=${fp}&type=grpc&serviceName=${svc}${suffix}#${name}`);
        else if (transport === 'tcp') lines.push(`vless://${uuid}@${addr}:443?encryption=none&security=tls&sni=${host}&fp=${fp}&type=tcp&headerType=none${suffix}#${name}`);
      } else if (proto === 'trojan') {
        /* UUID نقش رمز (password) تروجان را دارد */
        if (transport === 'ws') lines.push(`trojan://${uuid}@${addr}:443?security=tls&sni=${host}&fp=${fp}&type=ws&host=${host}&path=${pathEnc}${suffix}#${name}`);
        else if (transport === 'grpc') lines.push(`trojan://${uuid}@${addr}:443?security=tls&sni=${host}&fp=${fp}&type=grpc&serviceName=${svc}${suffix}#${name}`);
        else if (transport === 'tcp') lines.push(`trojan://${uuid}@${addr}:443?security=tls&sni=${host}&fp=${fp}&type=tcp&headerType=none${suffix}#${name}`);
      } else if (proto === 'vmess') {
        const vmess = {
          v: '2', ps: label, add: addr, port: '443', id: uuid,
          aid: '0', scy: 'auto', net: transport || 'ws', type: 'none', host: host,
          path: pathEnc, tls: 'tls', sni: host, fp: fp,
        };
        lines.push('vmess://' + btoa(unescape(encodeURIComponent(JSON.stringify(vmess)))));
      }
    }
  }

  if (!lines.length) return new Response('Unsupported protocol configuration', { status: 500 });

  const subText = lines.join('\n') + '\n';
  const headers = {
    'content-type': 'text/plain; charset=utf-8',
    'Profile-Update-Interval': String((cfg.muvcharMinuyMecholel && cfg.muvcharMinuyMecholel.SUBUpdateTime) || 3),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };
  /* ثبت درخواست ساب برای آمار واقعی «درخواست‌های امروز» */
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil((async () => {
      if (!await d1Init(env)) return;
      try {
        const ip = request.headers.get('CF-Connecting-IP') || '';
        const ua = request.headers.get('User-Agent') || '';
        await env.DB.prepare('INSERT INTO logs (TYPE,IP,URL,UA,TIME) VALUES (?,?,?,?,?)')
          .bind('Sub', ip, url.pathname + url.search, ua, Date.now()).run();
      } catch (e) {}
    })());
  }
  return new Response(subText, { headers });
}

/* --- منبع Clean IPs / Domains (ذخیره در KV) --- */
const CLEAN_KEY = 'clean_ips.json';
async function getCleanIps(env) {
  try { const raw = await kvGet(env, CLEAN_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
async function handleApiCleanIps(request, env, UA, method, url) {
  const adminPass = await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'));
  if (!await isAuthed(request, UA, adminPass)) return json({ success:false, error:'Unauthorized' }, 401);
  let items = await getCleanIps(env);
  if (!Array.isArray(items)) items = [];

  if (method === 'GET') return json({ success:true, items });

  if (method === 'POST') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    const raw = [];
    if (Array.isArray(body.items)) raw.push(...body.items);
    else if (body.value) raw.push(body.value);
    const clean = raw.map(v => String(v).trim()).filter(Boolean);
    if (!clean.length) return json({ success:false, error:'No value provided' }, 400);
    const seen = new Set(items.map(i => i.value.toLowerCase()));
    let added = 0;
    for (const v of clean) {
      const lv = v.toLowerCase();
      if (seen.has(lv)) continue;
      seen.add(lv);
      items.unshift({ value: v, type: /^(\d{1,3}\.){3}\d{1,3}$/.test(v) ? 'ip' : 'domain', addedAt: Date.now() });
      added++;
    }
    if (items.length > 1000) items = items.slice(0, 1000);
    await kvPut(env, CLEAN_KEY, JSON.stringify(items));
    return json({ success:true, added, total:items.length, items });
  }

  if (method === 'DELETE') {
    const v = (url.searchParams.get('value') || '').trim().toLowerCase();
    const before = items.length;
    items = items.filter(i => i.value.toLowerCase() !== v);
    if (items.length === before) return json({ success:false, error:'Not found' }, 404);
    await kvPut(env, CLEAN_KEY, JSON.stringify(items));
    return json({ success:true, total:items.length, items });
  }

  return json({ success:false, error:'Method not allowed' }, 405);
}

/* --- منبع Proxy IP (استخر host:port — ذخیره در KV) --- */
const PROXY_KEY = 'proxy_ips.json';
async function getProxyIps(env) {
  try { const raw = await kvGet(env, PROXY_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
async function handleApiProxyIps(request, env, UA, method, url) {
  const adminPass = await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'));
  if (!await isAuthed(request, UA, adminPass)) return json({ success:false, error:'Unauthorized' }, 401);
  let items = await getProxyIps(env);
  if (!Array.isArray(items)) items = [];

  if (method === 'GET') return json({ success:true, items });

  if (method === 'POST') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    const raw = [];
    if (Array.isArray(body.items)) raw.push(...body.items);
    else if (body.value) raw.push(body.value);
    const clean = raw.map(v => String(v).trim()).filter(Boolean);
    if (!clean.length) return json({ success:false, error:'No value provided' }, 400);
    const seen = new Set(items.map(i => i.value.toLowerCase()));
    let added = 0;
    for (const v of clean) {
      const lv = v.toLowerCase();
      if (seen.has(lv)) continue;
      seen.add(lv);
      items.unshift({ value: v, addedAt: Date.now() });
      added++;
    }
    if (items.length > 500) items = items.slice(0, 500);
    await kvPut(env, PROXY_KEY, JSON.stringify(items));
    return json({ success:true, added, total:items.length, items });
  }

  if (method === 'DELETE') {
    const v = (url.searchParams.get('value') || '').trim().toLowerCase();
    const before = items.length;
    items = items.filter(i => i.value.toLowerCase() !== v);
    if (items.length === before) return json({ success:false, error:'Not found' }, 404);
    await kvPut(env, PROXY_KEY, JSON.stringify(items));
    return json({ success:true, total:items.length, items });
  }

  return json({ success:false, error:'Method not allowed' }, 405);
}

/* --- Tunnel / Relay --- */
const RELAY_KEY = 'relay.json';
async function getRelay(env) {
  try { const raw = await kvGet(env, RELAY_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
async function setRelay(env, obj) { await kvPut(env, RELAY_KEY, JSON.stringify(obj)); }
function genRelayKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let hex = ''; for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return 'rahin_' + hex;
}
async function handleApiTunnel(request, env, UA, method) {
  const adminPass = await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'));
  if (!await isAuthed(request, UA, adminPass)) return json({ success:false, error:'Unauthorized' }, 401);
  let relay = await getRelay(env);
  const host = (new URL(request.url)).host;

  if (method === 'GET') {
    return json({
      success: true,
      tunnel: {
        enabled: !!(relay.authKey),
        workerUrl: 'https://' + host + '/',
        authKey: relay.authKey || '',
        hasKey: !!relay.authKey,
        gasUrl: relay.gasUrl || '',
        verified: !!(relay.verified && relay.verified.ok),
        verifiedAt: (relay.verified && relay.verified.at) || 0,
      },
    });
  }

  if (method === 'POST') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    const action = body.action || 'save';

    if (action === 'generate_key') {
      relay.authKey = genRelayKey();
      relay.verified = null;
      await setRelay(env, relay);
      return json({ success:true, tunnel: { enabled:true, authKey: relay.authKey, hasKey:true, gasUrl: relay.gasUrl || '', verified:false } });
    }

    if (action === 'disable') {
      relay.authKey = '';
      await setRelay(env, relay);
      return json({ success:true, tunnel: { enabled:false, authKey:'', hasKey:false, gasUrl: relay.gasUrl || '', verified:false } });
    }

    if (action === 'save') {
      if (body.gasUrl !== undefined) relay.gasUrl = String(body.gasUrl || '').trim();
      if (body.authKey !== undefined) relay.authKey = String(body.authKey || '').trim();
      await setRelay(env, relay);
      return json({ success:true, tunnel: { enabled: !!relay.authKey, authKey: relay.authKey || '', hasKey: !!relay.authKey, gasUrl: relay.gasUrl || '', verified: !!(relay.verified && relay.verified.ok) } });
    }

    if (action === 'verify') {
      const key = relay.authKey || (body.authKey ? String(body.authKey).trim() : '');
      const gas = relay.gasUrl || (body.gasUrl ? String(body.gasUrl).trim() : '');
      relay.authKey = key;
      relay.gasUrl = gas;
      let ok = false, err = '';
      try {
        if (key && gas && /^https:\/\//i.test(gas)) {
          const resp = await fetch(gas, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ k: key, u: 'https://api.ipify.org?format=json', m: 'GET' }),
            redirect: 'manual',
          });
          ok = resp.status >= 200 && resp.status < 400;
        } else if (!key || !gas) {
          err = 'authKey and gasUrl required';
        } else {
          err = 'gasUrl must start with https://';
        }
      } catch (e) { err = e.message || 'verify failed'; }
      relay.verified = ok ? { ok: true, at: Date.now() } : null;
      await setRelay(env, relay);
      return json({ success: ok, verified: ok, error: ok ? '' : err });
    }

    return json({ success:false, error:'Unknown action' }, 400);
  }

  return json({ success:false, error:'Method not allowed' }, 405);
}

/* --- اجرای Relay (پایانه تونل — با محافظت SSRF) --- */
const RELAY_BLOCKED = ['localhost', '127.0.0.1', '::1', '169.254.169.254'];
function relayAllowed(target) {
  try {
    const u = new URL(target);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = (u.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || RELAY_BLOCKED.includes(host)) return false;
    const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
      const a = parseInt(v4[1], 10), b = parseInt(v4[2], 10);
      if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 100 && b >= 64 && b <= 127) return false;
    }
    if (host.includes(':')) {
      if (host === '::1' || host === '::' || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host) || host.startsWith('::ffff:')) return false;
    }
    return true;
  } catch (e) { return false; }
}
async function handleRelay(request, env, url) {
  const relay = await getRelay(env);
  const key = url.searchParams.get('k') || request.headers.get('X-Relay-Key') || '';
  if (!relay.authKey || key !== relay.authKey) return json({ e: 'relay not configured or bad key' }, 403);
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const target = body.u || url.searchParams.get('u');
  const method = body.m || 'GET';
  if (!target || !relayAllowed(target)) return json({ e: 'target not allowed' }, 400);
  try {
    const resp = await fetch(target, { method, headers: body.h || {} });
    return new Response(resp.body, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'text/plain' } });
  } catch (e) {
    return json({ e: 'relay fetch failed: ' + (e.message || '') }, 502);
  }
}




/* --- مدیریت حالت مخفی (فعال/خاموش + چرخش مسیرها) --- */
async function handleApiDisguise(request, env, UA) {
  const adminPass = await (env.ADMIN || env.admin || env.PASSWORD || await kvGet(env, 'admin_pass'));
  if (!await isAuthed(request, UA, adminPass)) return json({ success:false, error:'Unauthorized' }, 401);
  const ns = await loadNetworkSettings(env);
  if (!ns.disguise || typeof ns.disguise !== 'object') ns.disguise = { on:false, admin:'', login:'', sub:'' };

  if (request.method === 'GET') {
    const d = ns.disguise;
    return json({ success:true, disguise: {
      on: !!d.on,
      admin: d.on ? '/'+d.admin : '',
      login: d.on ? '/'+d.login : '',
      sub: d.on ? '/'+d.sub : '',
    }});
  }

  if (request.method === 'POST') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    const action = body.action || 'status';

    if (action === 'enable') {
      ns.disguise.on = true;
      if(!ns.disguise.admin){ ns.disguise.admin = genSecretPath(); ns.disguise.login = genSecretPath(); ns.disguise.sub = genSecretPath(); }
      await saveNetworkSettings(env, ns);
      return json({ success:true, disguise:{ on:true, admin:'/'+ns.disguise.admin, login:'/'+ns.disguise.login, sub:'/'+ns.disguise.sub } });
    }
    if (action === 'disable') {
      ns.disguise.on = false;
      await saveNetworkSettings(env, ns);
      return json({ success:true, disguise:{ on:false, admin:'', login:'', sub:'' } });
    }
    if (action === 'rotate') {
      ns.disguise.admin = genSecretPath(); ns.disguise.login = genSecretPath(); ns.disguise.sub = genSecretPath();
      await saveNetworkSettings(env, ns);
      return json({ success:true, disguise:{ on:true, admin:'/'+ns.disguise.admin, login:'/'+ns.disguise.login, sub:'/'+ns.disguise.sub } });
    }
    return json({ success:false, error:'Unknown action' }, 400);
  }
  return json({ success:false, error:'Method not allowed' }, 405);
}

/* ============================================================
 *  امنیت: مسیرهای مخفی + صفحه‌ی فریب
 * ============================================================ */
function cleanPath(v){ return String(v||'').trim().toLowerCase().replace(/^\/+|\/+$/g,'').replace(/[^a-z0-9_-]/g,'').slice(0,40); }
async function getDisguise(env){
  const ns = await loadNetworkSettings(env);
  let d = ns.disguise;

  /* مسیرهای مخفی از متغیرهای محیطی (اختیاری اما پیشنهادی — تا بعد از استقرار مسیر را بدانی) */
  const envAdmin = cleanPath(env && (env.SECRET_ADMIN_PATH || env.ADMIN_PATH));
  const envLogin = cleanPath(env && (env.SECRET_LOGIN_PATH || env.LOGIN_PATH));
  const envSub   = cleanPath(env && (env.SECRET_SUB_PATH   || env.SUB_PATH));

  if(!d || typeof d !== 'object'){
    if(env && env.__noAutoDisguise){
      d = { on:false, admin:'', login:'', sub:'' };
    } else {
      d = {
        on:true,
        admin: envAdmin || genSecretPath(),
        login: envLogin || genSecretPath(),
        sub:   envSub   || genSecretPath()
      };
    }
    ns.disguise = d;
    try{ await saveNetworkSettings(env, ns); }catch(e){}
  }

  /* اگر متغیر محیطی تعیین شده، همیشه اولویت دارد (برای دسترسی پایدار) */
  if(envAdmin || envLogin || envSub){
    if(envAdmin) d.admin = envAdmin;
    if(envLogin) d.login = envLogin;
    if(envSub)   d.sub   = envSub;
    d.on = true;
    ns.disguise = d;
    try{ await saveNetworkSettings(env, ns); }catch(e){}
  }

  if(d.on && d.admin){
    return { on:true, admin:'/'+d.admin, login:'/'+d.login, sub:'/'+d.sub };
  }
  return { on:false, admin:'/admin', login:'/login', sub:'/sub' };
}
function genSecretPath(){
  const words = ['node','edge','relay','net','core','mesh','link','route','path','gate','hub','flux','pulse','orbit','aero','sky','vpn','cloud'];
  const a = words[Math.floor(Math.random()*words.length)];
  const b = words[Math.floor(Math.random()*words.length)];
  const n = Math.floor(Math.random()*900+100);
  return a + n + b;
}
/* رمزگذاری کلیددار (XOR + base64) برای توکن‌های حساس */
function base64SecretEncode(plaintext, secret){
  const data = new TextEncoder().encode(String(plaintext));
  const key = new TextEncoder().encode(String(secret));
  const mixed = new Uint8Array(data.length);
  for(let i=0;i<data.length;i++) mixed[i] = data[i] ^ key[i % key.length];
  let bin=''; for(let i=0;i<mixed.length;i++) bin += String.fromCharCode(mixed[i]);
  return btoa(bin);
}
function base64SecretDecode(encoded, secret){
  try{
    const bin = atob(String(encoded));
    const key = new TextEncoder().encode(String(secret));
    const mixed = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) mixed[i] = bin.charCodeAt(i) ^ key[i % key.length];
    return new TextDecoder().decode(mixed);
  }catch(e){ return ''; }
}

function speedtestDecoy(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloudflare Speed Test</title><style>
  body{font-family:system-ui,Segoe UI,sans-serif;background:#101318;color:#e8edf4;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .c{max-width:560px;width:100%;background:#171b22;border:1px solid #232933;border-radius:16px;padding:28px}
  h1{font-size:20px;margin:0 0 6px}.s{color:#8b96a5;font-size:13px;margin-bottom:20px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #20262f;font-size:14px}
  .row b{font-family:monospace;color:#2fd6c3}
  .btn{width:100%;margin-top:18px;padding:12px;border:0;border-radius:10px;background:#2fd6c3;color:#04231f;font-weight:600;font-size:14px;cursor:pointer}
  .btn:hover{opacity:.9}</style></head><body><div class="c">
  <h1>Cloudflare Speed Test</h1>
  <div class="s">Check the speed of your connection to Cloudflare's network</div>
  <div class="row"><span>Download</span><b id="dl">—</b></div>
  <div class="row"><span>Upload</span><b id="up">—</b></div>
  <div class="row"><span>Latency</span><b id="la">—</b></div>
  <button class="btn" id="go">Start Test</button>
  <script>
  var g=document.getElementById('go');
  g.onclick=function(){
    var dl=document.getElementById('dl'),up=document.getElementById('up'),la=document.getElementById('la');
    la.textContent=(Math.random()*40+8).toFixed(1)+' ms';
    var t0=Date.now();
    var d=new Uint8Array(1e6);
    var total=0;
    function loop(){ for(var i=0;i<4;i++){ d[0]=i; } total+=d.length; if(Date.now()-t0<1800){ requestAnimationFrame(loop);} else { dl.textContent=(total*8/1.8/1e6).toFixed(1)+' Mbps'; up.textContent=((total*0.6)*8/1.8/1e6).toFixed(1)+' Mbps'; } }
    loop();
  };
  <\/script>
</div></body></html>`;
}

// ============================================================
//  روت اصلی
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const UA = request.headers.get('User-Agent') || 'null';
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const method = request.method;
    const path = url.pathname;
    const dg = await getDisguise(env);

    /* --- API عمومی (بدون نیاز به مسیر مخفی) --- */

    /* --- حالت مخفی (disguise) روشن --- */
    if (dg.on) {
      /* همه چیز از مسیر مخفی پنل در دسترس است؛ مسیر داخلی استخراج می‌شود */
      if (path === dg.admin || path.startsWith(dg.admin + '/')) {
        const inner = path.slice(dg.admin.length) || '/';
        return routeInner(request, env, ctx, inner, UA, ip, method);
      }
      if (path === dg.login) return servePanel(env, request, '/');
      if (path === dg.sub || path.startsWith(dg.sub + '/')) {
        const u = new URL(request.url);
        u.pathname = '/sub' + path.slice(dg.sub.length);
        return handleSub(new Request(u.toString(), request), env, u, ctx);
      }
      /* هر چیز دیگر → صفحه‌ی فریب */
      return new Response(speedtestDecoy(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    /* --- حالت عادی --- */
    if (path === '/' || path === '') return new Response(speedtestDecoy(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    return routeInner(request, env, ctx, path, UA, ip, method);
  },
};

/* مسیردهی داخلی (هم در حالت عادی هم از مسیر مخفی) */
async function routeInner(request, env, ctx, path, UA, ip, method){
  const url = new URL(request.url);

  if (path === '/api/auth/login' || path === '/api/login') return handleAuth(request, env, UA, ip);
  if (path === '/api/auth/change-password' || path === '/api/auth/password') return handleChangePassword(request, env, UA, ip);
  if (path === '/api/users') return handleApiUsers(request, env, url, method, UA, ip);
  if (path === '/api/config') return handleApiConfig(request, env, UA, method);
  if (path === '/api/settings') return handleApiSettings(request, env, UA, method);
  if (path === '/api/stats') return handleApiStats(request, env, UA);
  if (path === '/api/stats/usage') return handleApiStatsUsage(request, env, UA, url);
  if (path === '/api/clean-ips') return handleApiCleanIps(request, env, UA, method, url);
  if (path === '/api/proxy-ips') return handleApiProxyIps(request, env, UA, method, url);
  if (path === '/api/tunnel') return handleApiTunnel(request, env, UA, method);
  if (path === '/api/disguise') return handleApiDisguise(request, env, UA);

  if (path === '/relay' || path === '/tunnel/relay') return handleRelay(request, env, url);
  if (path === '/sub' || path.startsWith('/sub/')) return handleSub(request, env, url, ctx);

  /* پنل */
  return servePanel(env, request, path);
}

/* سرو پنل (index.html) با هدرهای امنیتی */
async function servePanel(env, request, inner){
  const headers = new Headers();
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  /* پنل از KV خوانده می‌شود (کلید panel_html) — کد ورکر کوچک می‌ماند */
  let html = null;
  try{
    const kv = env && env.KV;
    if(kv && typeof kv.get === 'function'){
      html = await kv.get('panel_html', { cacheTtl: 60 });
    }
  }catch(e){}
  if(!html){
    return new Response('Panel not uploaded yet — put the panel HTML in KV under key "panel_html".', { status: 200, headers });
  }
  return new Response(html, { status: 200, statusText: 'OK', headers });
}


/* سرو پنل (index.html) با هدرهای امنیتی */
