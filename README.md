# RAHIN PANEL (Beta)

**RAHIN PANEL (Beta)** is a minimal premium, enterprise-grade Cloudflare Worker & Proxy Management Platform with Glassmorphism aesthetic, deep navy themes, and slow animated aurora gradient backdrops.

- **Authoritative Repository (Pinned)**: `https://github.com/rahinvpn445-web/RAHIN-PANEL`
- **Version**: `Beta`
- **Languages**: Persian (`FA`) and English (`EN`) with full RTL support

---

## 🌟 Key Features

1. **5 Admin Pages Architecture**:
   - **Dashboard**: System metrics, live online count, daily/monthly traffic totals, bandwidth trend visualization, recent activity & admin audit log.
   - **Users**: Complete multi-user management with search & filter, status chips (Active, Disabled, Expired, Quota Exceeded), quota enforcement, speed limits, connection limits, auto-reset, auto-rotate IP, content filtering (Block Porn/Ads), fragmentation, and per-user proxy overrides.
   - **Configs**: Infrastructure control center for global domains, protocol options (VLESS, Trojan, VMess, Shadowsocks, Mixed), transport modes (WS, gRPC, xhttp), ECH, TLS fragment, GitHub Mirror auto-publishing, system Clean/Proxy IPs, Backend mode, SSRF-safe Relay, Multi-Panel Hub clusters, and WARP/DoH settings.
   - **RAHIN Scanner**: Built-in browser-based client-side clean-IP scanner for Cloudflare ranges across multi-ports (443, 8443, 2053, 2083, 2087, 2096) with live latency, jitter, loss scoring, and one-click apply to clean IPs.
   - **Panel Settings**: Appearance & language toggle, master password rotation, Panel API Keys CRUD, disguise paths (`/admin`, `/login`, `/sub`) with zero-downtime rotation, emergency controls (Pause / Resume / Panic mode), Cloudflare token verification, D1/KV storage health indicators, and decoy policies.

2. **Hard Exclusions**:
   - **NO Telegram Functionality**: Telegram bots, webhooks, commands, tokens, chat IDs, announcements, or bot install flows are completely excluded.
   - **NO Nova Branding**: Clean RAHIN PANEL (Beta) identity throughout.
   - **Pinned Update Source**: Locked to `https://github.com/rahinvpn445-web/RAHIN-PANEL` to prevent unauthorized updates from untrusted repositories.

---

## 🚀 Cloudflare Deployment

### 1. Bindings & Variables
When deploying to Cloudflare Workers, configure the following bindings:

- **KV Namespace**: Bound as `KV`
- **D1 Database**: Bound as `DB`
- **Static Assets**: Bound as `ASSETS` (for dashboard UI assets)
- **Environment Variables**:
  - `ADMIN_PATH`: Custom hidden path for admin UI (default: `admin`)
  - `LOGIN_PATH`: Custom path for login (default: `login`)
  - `SUB_PATH`: Custom path for subscriptions (default: `sub`)
  - `RELAY_AUTH_KEY`: Auth key for SSRF-safe relay hop

### 2. Deploy Command
```bash
# Install dependencies
npm install

# Build static assets & server
npm run build

# Deploy using Wrangler
npx wrangler deploy worker.js --name rahin-panel
```

---

## 🛠 Local Development

```bash
# Start local full-stack dev server on port 3000
npm run dev
```

Visit `http://localhost:3000/` in your browser.
