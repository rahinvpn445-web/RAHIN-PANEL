/**
 * RAHIN PANEL (Beta) - Cloudflare Worker Core
 * Authoritative Repository: https://github.com/rahinvpn445-web/RAHIN-PANEL
 * Built with: Cloudflare Workers + KV + D1
 */

const Version = 'Beta';
const UPDATE_REPO = 'rahinvpn445-web/RAHIN-PANEL';

let config_JSON, metavechIP = '', hafelSocks5Metavech = null, hafelSocks5Klali = false, cheshbonSocks5Sheli = '', parsedSocks5Address = {};
let mitmonReshimaLevanaSocks5 = null, mitmonIpMetavech, mitmonNituachMetavech, indeksMaarachMetavechMitmon = 0, hafelGibuiMetavech = true, hadpasatYomanNipui = false;
let connClientIp = '';
let connRejectReason = null;
let connProxyWhitelist = [];
let _globalEnv = null;
let _globalCtx = null;
let hagdarotReshet = null, mitmonHagdarotReshet = null, zmanMitmonHagdarotReshet = 0;
let tetzurotNat64 = '', mitmonKidometNat64 = null, zmanMitmonNat64 = 0, makorMitmonNat64 = '';
let _d1Ready = false, _kvMigratedFlag = false;

let chiburMishtameshId = null, sibatDchiyatChibur = null, magbilMehirutMishtameshKBps = 0;
let mitmonShimushMishtamesh = {}, zmanMitmonNefachMishtameshChibur = 0;
let mitmonShimushYomiMishtamesh = {}, taarichShimushYomiMishtamesh = '';
let reshimaLevanaSocks5 = ['*tapecontent.net', '*cloudatacdn.com', '*loadshare.org', '*cdn-centaurus.com', 'scholar.google.com'];

globalThis.__workerStart = Date.now();

export default {
  async fetch(request, env, ctx) {
    _globalEnv = env;
    _globalCtx = ctx;

    const url = new URL(request.url);
    const pathname = url.pathname.toLowerCase();

    // Serve API endpoints
    if (pathname === '/version') {
      return new Response(JSON.stringify({ Version: 415, version: 'Beta', name: 'RAHIN PANEL', repository: `https://github.com/${UPDATE_REPO}` }), {
        headers: { 'Content-Type': 'application/json;charset=utf-8' }
      });
    }

    if (pathname === '/backend-test') {
      return new Response(JSON.stringify({ ok: true, name: 'RAHIN PANEL (Beta)', status: 'Backend diagnostic pass' }), {
        headers: { 'Content-Type': 'application/json;charset=utf-8' }
      });
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      try {
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes.status !== 404) return assetRes;
      } catch (e) {}
    }

    // Default response (Nginx welcome decoy)
    return new Response(`<!DOCTYPE html><html><head><title>Welcome to nginx!</title><style>body{width:35em;margin:0 auto;font-family:Tahoma,Verdana,Arial,sans-serif;}</style></head><body><h1>Welcome to nginx!</h1><p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p></body></html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
};
