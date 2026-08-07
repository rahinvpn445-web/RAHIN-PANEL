// ===== Update System: repository configuration =====
// Single source of truth for fetching the latest RAHIN Panel source when
// checking/applying updates to already-deployed panels. Only the
// Update-System-related endpoints (/api/list-panels version check and
// /api/do-update) were changed to use this.
const RAHIN_RAW_SOURCE_BASE = "https://raw.githubusercontent.com/rahinvpn445-web/RAHIN-PANEL/main/rahin.js";
function buildRahinSourceUrl() {
	return RAHIN_RAW_SOURCE_BASE + "?cb=" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
function rahinNoCacheFetchInit() {
	return {
		cf: { cacheEverything: false },
		headers: {
			"Cache-Control": "no-cache, no-store, must-revalidate",
			Pragma: "no-cache",
			Expires: "0",
		},
	};
}
async function fetchRahinLatestSource() {
	return fetch(buildRahinSourceUrl(), rahinNoCacheFetchInit());
}

// The bindings endpoint returns the currently attached resources.  Rebuild the
// metadata from that list so an update never drops KV, D1, variables, secrets,
// or future binding types.
function preserveBindings(bindings, token, accountId) {
	return (bindings || []).map((b) => {
		switch (b.type) {
			case "d1":
				return { type: "d1", name: b.name, id: b.database_id || b.id };
			case "kv_namespace":
				return { type: "kv_namespace", name: b.name, namespace_id: b.namespace_id || b.id };
			case "plain_text":
				return { type: "plain_text", name: b.name, text: b.text };
			case "secret_text":
				// Cloudflare does not expose existing secret values. The two
				// deployer-owned values can be refreshed from this request; all
				// other secret bindings are retained verbatim.
				if (b.name === "CF_API_TOKEN") return { type: "secret_text", name: b.name, text: token };
				if (b.name === "CF_ACCOUNT_ID") return { type: "secret_text", name: b.name, text: accountId };
				return b;
			default:
				return b;
		}
	}).filter(Boolean);
}
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (request.method === "GET" && url.pathname === "/") {
			return new Response(getHtmlContent(), {
				headers: { "Content-Type": "text/html;charset=UTF-8" },
			});
		}
		if (request.method === "POST" && url.pathname === "/api/deploy") {
			try {
				const { token } = await request.json();
				if (!token) throw new Error("توکن نمی‌تواند خالی باشد.");
				const headers = {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				};
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				if (!accData.success || accData.result.length === 0) {
					throw new Error("فقط با دکمه نارنجی «دریافت توکن» توکن بسازید.");
				}
				const accountId = accData.result[0].id;
				let devSub = null;
				const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, { headers });
				const subData = await subRes.json();
				if (subData.success && subData.result && subData.result.subdomain) {
					devSub = subData.result.subdomain;
				} else {
					const newSub = `rahin-${Math.random().toString(36).substring(2, 8)}`;
					const createSub = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
						method: "PUT",
						headers,
						body: JSON.stringify({ subdomain: newSub }),
					});
					const createSubData = await createSub.json();
					if (!createSubData.success) {
						const cfError = createSubData.errors && createSubData.errors.length > 0 ? createSubData.errors[0].message : "نامشخص";
						throw new Error(`CF_TOS_ERROR|${cfError}`);
					}
					devSub = newSub;
				}
				const uniqueSuffix = Math.random().toString(36).substring(2, 8);
				const workerName = `rahin-panel-${uniqueSuffix}`;
				const dbName = `rahin-db-${uniqueSuffix}`;
				const dbRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
					method: "POST",
					headers,
					body: JSON.stringify({ name: dbName }),
				});
				const dbData = await dbRes.json();
				if (!dbData.success) {
					const cfError = dbData.errors && dbData.errors.length > 0 ? dbData.errors[0].message : "نامشخص";
					throw new Error(`CF_DB_ERROR|${cfError}`);
				}
				const dbUuid = dbData.result.uuid;
				await new Promise((resolve) => setTimeout(resolve, 1000));
				/* ساخت KV namespace (برای ذخیره پنل و تنظیمات) */
				const kvRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`, {
					method: "POST",
					headers,
					body: JSON.stringify({ title: `rahin-kv-${uniqueSuffix}` }),
				});
				const kvData = await kvRes.json();
				if (!kvData.success) {
					const cfError = kvData.errors && kvData.errors.length > 0 ? kvData.errors[0].message : "نامشخص";
					throw new Error(`CF_KV_ERROR|${cfError}`);
				}
				const kvUuid = kvData.result.id;
				await new Promise((resolve) => setTimeout(resolve, 1000));
				const githubRes = await fetchRahinLatestSource();
				if (!githubRes.ok) throw new Error("خطا در دریافت سورس از گیت‌هاب.");
				const rahinCode = await githubRes.text();
				const metadata = {
					main_module: "rahin.js",
					compatibility_date: "2024-02-08",
					bindings: [
						{ type: "d1", name: "DB", id: dbUuid },
						{ type: "kv_namespace", name: "KV", namespace_id: kvUuid },
						{ type: "plain_text", name: "ADMIN", text: "rahin-admin-" + uniqueSuffix },
						{ type: "plain_text", name: "SECRET_ADMIN_PATH", text: "panel369" },
						{ type: "plain_text", name: "SECRET_LOGIN_PATH", text: "login369" },
						{ type: "plain_text", name: "SECRET_SUB_PATH", text: "sub369" },
						{ type: "secret_text", name: "CF_API_TOKEN", text: token },
						{ type: "secret_text", name: "CF_ACCOUNT_ID", text: accountId },
					],
				};
				const formData = new FormData();
				formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
				formData.append("rahin.js", new Blob([rahinCode], { type: "application/javascript+module" }), "rahin.js");
				const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`, {
					method: "PUT",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});
				const deployData = await deployRes.json();
				if (!deployData.success) {
					const cfError = deployData.errors && deployData.errors.length > 0 ? deployData.errors[0].message : "نامشخص";
					throw new Error(`CF_DEPLOY_ERROR|${cfError}`);
				}
				const routeRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
					method: "POST",
					headers,
					body: JSON.stringify({ enabled: true }),
				});
				if (!routeRes.ok) throw new Error("خطا در فعال‌سازی لینک نهایی.");
				/* آپلود پنل به KV — پنل از گیت‌هاب جداگانه نمی‌آید،
				   بلکه در یک فایل جدا (panel_html) در همین مخزن قرار دارد */
				const panelRes = await fetch(`https://raw.githubusercontent.com/rahinvpn445-web/RAHIN-PANEL/main/panel.html?cb=${Date.now()}`);
				if (!panelRes.ok) throw new Error("خطا در دریافت پنل از گیت‌هاب (panel.html موجود نیست).");
				const panelHtml = await panelRes.text();
				const kvPutRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvUuid}/values/panel_html`, {
					method: "PUT",
					headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/html;charset=UTF-8" },
					body: panelHtml,
				});
				if (!kvPutRes.ok) throw new Error("خطا در آپلود پنل به KV.");
				const finalUrl = `https://${workerName}.${devSub}.workers.dev/panel369`;
				return new Response(JSON.stringify({ success: true, url: finalUrl, adminPath: "/panel369" }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
		}
		if (request.method === "POST" && url.pathname === "/api/list-panels") {
			try {
				const { token } = await request.json();
				if (!token) throw new Error("Token cannot be empty");
				const headers = {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				};
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				if (!accData.success || accData.result.length === 0) {
					throw new Error("Account not found");
				}
				const accountId = accData.result[0].id;
				const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, { headers });
				const subData = await subRes.json();
				const devSub = subData.success && subData.result && subData.result.subdomain ? subData.result.subdomain : "";
				const scriptsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, { headers });
				const scriptsData = await scriptsRes.json();
				if (!scriptsData.success) {
					throw new Error("Failed to fetch scripts");
				}
				let panels = [];
				for (let script of scriptsData.result) {
					if (script.id.startsWith("rahin-panel") || script.id.startsWith("ez-")) {
						panels.push({ name: script.id });
					}
				}
				let latestVersion = "Unknown";
				try {
					const ghRes = await fetchRahinLatestSource();
					if (ghRes.ok) {
						const ghText = await ghRes.text();
						const match = ghText.match(/CURRENT_VERSION\s*=\s*['"]([0-9\.]+)['"]/i);
						if (match && match[1]) latestVersion = "v" + match[1];
					}
				} catch (e) {}
				return new Response(JSON.stringify({ success: true, panels, latestVersion, devSub }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
		}
		if (request.method === "POST" && url.pathname === "/api/get-panel-version") {
			try {
				const { token, scriptName } = await request.json();
				const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				const accountId = accData.result[0].id;
				const contentRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, { headers });
				const contentText = await contentRes.text();
				let version = "Unknown";
				const varMatch = contentText.match(/CURRENT_VERSION\s*=\s*['"]([0-9\.]+)['"]/i);
				if (varMatch && varMatch[1]) {
					version = "v" + varMatch[1];
				} else {
					const spanMatch = contentText.match(/id=["']panel-version["'][^>]*>\s*v?([0-9\.]+)\s*<\/span>/i);
					if (spanMatch && spanMatch[1]) {
						version = "v" + spanMatch[1];
					}
				}
				return new Response(JSON.stringify({ success: true, version }), { headers: { "Content-Type": "application/json" } });
			} catch (e) {
				return new Response(JSON.stringify({ success: false, version: "Unknown" }), { headers: { "Content-Type": "application/json" } });
			}
		}
		if (request.method === "POST" && url.pathname === "/api/do-update") {
			try {
				const { token, scriptName } = await request.json();
				if (!token || !scriptName) throw new Error("Token or script name missing");
				const headers = {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				};
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				if (!accData.success || accData.result.length === 0) {
					throw new Error("Account not found");
				}
				const accountId = accData.result[0].id;
				const githubRes = await fetchRahinLatestSource();
				if (!githubRes.ok) throw new Error("Failed to fetch source from GitHub");
				const newCode = await githubRes.text();
				const bindingsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, { headers });
				const bindingsData = await bindingsRes.json();
				if (!bindingsData.success) throw new Error("Failed to fetch bindings");
				const newBindings = preserveBindings(bindingsData.result, token, accountId);
				const metadata = {
					main_module: "rahin.js",
					compatibility_date: "2024-02-08",
					bindings: newBindings,
				};
				const formData = new FormData();
				formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
				formData.append("rahin.js", new Blob([newCode], { type: "application/javascript+module" }), "rahin.js");
				const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
					method: "PUT",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});
				const deployData = await deployRes.json();
				if (!deployData.success) {
					const cfError = deployData.errors && deployData.errors.length > 0 ? deployData.errors[0].message : "Unknown error";
					throw new Error(cfError);
				}
				return new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
		}
if (request.method === "POST" && url.pathname === "/api/reset-password") {
	try {
		const { token, scriptName } = await request.json();
		if (!token || !scriptName) throw new Error("Token or script name missing");
		const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
		const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
		const accData = await accRes.json();
		if (!accData.success || !accData.result.length) throw new Error("Account not found");
		const accountId = accData.result[0].id;
		const bindingsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, { headers });
		const bindingsData = await bindingsRes.json();
		if (!bindingsData.success) throw new Error("Failed to fetch bindings");
		const kvBinding = bindingsData.result.find((b) => b.type === "kv_namespace" && b.name === "KV");
		if (!kvBinding) throw new Error("KV binding not found");
		const namespaceId = kvBinding.namespace_id || kvBinding.id;
		const deleteRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/admin_pass`, {
			method: "DELETE", headers: { Authorization: `Bearer ${token}` },
		});
		if (!deleteRes.ok && deleteRes.status !== 404) throw new Error("Failed to delete the KV password");

		// One deployment is enough to restart the Worker; it uses the same
		// binding-preservation path as update and therefore keeps all data.
		const githubRes = await fetchRahinLatestSource();
		if (!githubRes.ok) throw new Error("Failed to fetch source from GitHub");
		const newCode = await githubRes.text();
		const metadata = { main_module: "rahin.js", compatibility_date: "2024-02-08", bindings: preserveBindings(bindingsData.result, token, accountId) };
		const formData = new FormData();
		formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
		formData.append("rahin.js", new Blob([newCode], { type: "application/javascript+module" }), "rahin.js");
		const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: formData });
		const deployData = await deployRes.json();
		if (!deployData.success) throw new Error("Failed to restart worker");
		return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
	} catch (error) {
		return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
	}
}
		if (request.method === "POST" && url.pathname === "/api/delete-panel") {
			try {
				const { token, scriptName } = await request.json();
				if (!token || !scriptName) throw new Error("Token or script name missing");
				const headers = {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				};
				const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers });
				const accData = await accRes.json();
				if (!accData.success || accData.result.length === 0) {
					throw new Error("Account not found");
				}
				const accountId = accData.result[0].id;
				const deleteRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
					method: "DELETE",
					headers,
				});
				const deleteData = await deleteRes.json();
				if (!deleteData.success) {
					const cfError = deleteData.errors && deleteData.errors.length > 0 ? deleteData.errors[0].message : "Unknown error";
					throw new Error(cfError);
				}
				return new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ success: false, error: error.message }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
		}
		return new Response("Not Found", { status: 404 });
	},
};
function getHtmlContent() {
	return `
<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#070d18">
<title>RAHIN Deployer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#070d18; --panel:rgba(14,23,40,.78); --panel2:rgba(18,30,52,.55);
  --line:rgba(126,156,198,.14); --line2:rgba(126,156,198,.26);
  --ink:#e8eef8; --mut:#94a3bb; --faint:#5f6e86;
  --teal:#2fd6c3; --blue:#54a9ff; --amber:#ffb454; --green:#3ddc97; --red:#ff6b7a; --purple:#b794ff; --cyan:#5ce1ff; --yellow:#ffd166;
  --disp:'Chakra Petch',sans-serif; --body:'IBM Plex Sans',sans-serif; --mono:'JetBrains Mono',monospace;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:'Vazirmatn',var(--body);font-size:14px;line-height:1.6;min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
[dir="rtl"] body{font-family:'Vazirmatn',var(--body)}
[dir="rtl"] .brand-t,[dir="rtl"] h1,[dir="rtl"] h2,[dir="rtl"] h3,[dir="rtl"] .deploy-badge{font-family:'Vazirmatn',var(--disp);font-weight:800}
::selection{background:rgba(47,214,195,.3)}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:rgba(126,156,198,.22);border-radius:8px;border:3px solid var(--bg)}
::-webkit-scrollbar-track{background:transparent}
* { scrollbar-width:thin; scrollbar-color:rgba(126,156,198,.25) transparent; }

/* layered background */
.bg{position:fixed;inset:0;z-index:-1;background:
  radial-gradient(900px 620px at 6% -8%, rgba(47,214,195,.10), transparent 60%),
  radial-gradient(760px 520px at 100% 2%, rgba(84,169,255,.08), transparent 55%),
  radial-gradient(720px 700px at 88% 102%, rgba(84,169,255,.10), transparent 65%),
  var(--bg)}
.bg .grid{position:absolute;inset:0;background-image:
  linear-gradient(rgba(140,170,210,.045) 1px,transparent 1px),
  linear-gradient(90deg,rgba(140,170,210,.045) 1px,transparent 1px);
  background-size:44px 44px;
  -webkit-mask-image:radial-gradient(1200px 820px at 50% 0%,#000 30%,transparent 78%);
  mask-image:radial-gradient(1200px 820px at 50% 0%,#000 30%,transparent 78%)}
.bg .glow{position:absolute;border-radius:50%;will-change:transform}
.bg .g1{width:620px;height:620px;left:-180px;top:-220px;background:radial-gradient(circle,rgba(47,214,195,.13),transparent 65%);animation:drift 26s ease-in-out infinite alternate}
.bg .g2{width:520px;height:520px;right:-160px;bottom:-180px;background:radial-gradient(circle,rgba(84,169,255,.14),transparent 70%);will-change:auto;transform:translateZ(0)}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(70px,50px)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(61,220,151,.55)}70%{box-shadow:0 0 0 9px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}
@keyframes shim{to{transform:translateX(100%)}}

.shell{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px}
.deploy-card{width:100%;max-width:460px;background:var(--panel);border:1px solid var(--line2);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);position:relative;overflow:hidden}
.deploy-card::before{content:'';position:absolute;inset:0;background:radial-gradient(420px 220px at 50% -40%,rgba(47,214,195,.10),transparent 70%);pointer-events:none}
.card-inner{position:relative;padding:28px 26px 24px}

.brand{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin-bottom:22px}
.brand-logo{width:64px;height:64px;filter:drop-shadow(0 8px 22px rgba(47,214,195,.4));animation:floaty 6s ease-in-out infinite}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.brand-t{font:800 26px/1 var(--disp);letter-spacing:.06em;background:linear-gradient(135deg,#e8eef8,#7fd8ff 55%,#2fd6c3);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.brand-sub{font:500 13px/1.7 var(--body);color:var(--mut);margin-top:4px}
.deploy-badge{display:inline-flex;align-items:center;gap:8px;font:700 10.5px var(--mono);letter-spacing:.18em;color:var(--teal);border:1px solid rgba(47,214,195,.35);background:rgba(47,214,195,.08);padding:7px 13px;border-radius:9px;text-transform:uppercase}
.deploy-badge i{width:7px;height:7px;border-radius:50%;background:var(--teal);box-shadow:0 0 9px var(--teal);animation:blink 2.2s infinite}
.deploy-badge small{font-size:.62em;opacity:.7;font-weight:500;letter-spacing:.05em}

.sec-label{display:block;font:600 9.5px var(--mono);letter-spacing:.2em;color:var(--faint);text-transform:uppercase;margin:0 0 8px}
.token-link{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px 14px;border:1px solid rgba(255,180,84,.38);color:var(--amber);background:rgba(255,180,84,.07);border-radius:11px;text-decoration:none;font:600 12.5px var(--body);transition:all .2s}
.token-link:hover{background:rgba(255,180,84,.14);border-color:rgba(255,180,84,.7);box-shadow:0 0 22px rgba(255,180,84,.16);transform:translateY(-1px)}
.token-link svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hint{font:500 11px/1.8 var(--body);color:var(--faint);text-align:center;margin:10px 0 16px}
.hint b{color:var(--amber);font-weight:700}
.hint .blue{color:var(--blue);font-weight:700;font-family:var(--mono);font-size:10.5px}

.field{position:relative;margin-bottom:14px}
.f-in{width:100%;font:500 13px var(--mono);color:var(--ink);background:rgba(126,156,198,.06);border:1px solid var(--line2);border-radius:11px;padding:12px 44px 12px 14px;outline:none;caret-color:var(--teal);transition:border-color .2s,box-shadow .2s,background .2s;text-align:right;direction:ltr}
.f-in::placeholder{color:var(--faint);opacity:.75}
.f-in:hover{border-color:rgba(126,156,198,.34)}
.f-in:focus{border-color:rgba(47,214,195,.5);background:rgba(47,214,195,.05);box-shadow:0 0 0 3px rgba(47,214,195,.1)}
.eye-btn{position:absolute;inset-inline-end:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:grid;place-items:center;background:none;border:0;color:var(--faint);cursor:pointer;border-radius:9px;transition:color .2s,background .2s}
.eye-btn:hover{color:var(--teal);background:rgba(47,214,195,.08)}
.eye-btn svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 15px;border-radius:11px;cursor:pointer;border:1px solid transparent;font:700 14px var(--body);transition:transform .15s,box-shadow .2s,background .2s,border-color .2s,color .2s}
.btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.btn:active{transform:translateY(1px) scale(.99)}
.btn.primary{background:linear-gradient(135deg,#2fd6c3,#18b5a3);color:#04231f;box-shadow:0 6px 22px rgba(47,214,195,.28)}
.btn.primary:hover{box-shadow:0 8px 30px rgba(47,214,195,.45);transform:translateY(-1px)}
.btn.blue{background:rgba(84,169,255,.09);border-color:rgba(84,169,255,.4);color:var(--blue)}
.btn.blue:hover{background:rgba(84,169,255,.18);border-color:rgba(84,169,255,.7);box-shadow:0 0 22px rgba(84,169,255,.18)}
.btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
.btn-block + .btn-block{margin-top:10px}

.status{margin-top:16px;background:rgba(10,17,32,.55);border:1px solid var(--line);border-radius:12px;padding:13px 14px;display:none}
.status.show{display:block}
.status-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
.status-txt{font:600 11.5px var(--mono);color:var(--mut);letter-spacing:.03em}
.status-pct{font:800 12px var(--mono);color:var(--green)}
.prog{height:5px;border-radius:4px;background:rgba(126,156,198,.14);overflow:hidden}
.prog i{display:block;height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,var(--teal),var(--blue));transition:width .3s ease}
.error-box{display:none;margin-top:14px;padding:13px 14px;background:rgba(255,107,122,.08);border:1px solid rgba(255,107,122,.3);border-radius:12px;font:500 12.5px/1.8 var(--body);color:var(--red);text-align:center}
.error-box.show{display:block}
.error-box a{display:inline-block;margin-top:10px;background:rgba(255,107,122,.2);color:#ffd6db;padding:7px 12px;border-radius:8px;font:700 11.5px var(--mono);text-decoration:none}
.success-txt{text-align:center;margin-top:18px;font:700 13px var(--body);color:var(--green)}
.link-box{margin-top:12px;display:flex;flex-direction:column;align-items:center;gap:9px;padding:14px;background:rgba(61,220,151,.07);border:1px solid rgba(61,220,151,.32);border-radius:12px}
.link-url{font:600 12px var(--mono);color:var(--green);word-break:break-all;text-align:center;direction:ltr;line-height:1.7}
.copy-btn{padding:7px 14px;border-radius:8px;border:1px solid rgba(61,220,151,.4);background:rgba(61,220,151,.1);color:var(--green);font:700 11.5px var(--mono);cursor:pointer;transition:all .2s}
.copy-btn:hover{background:rgba(61,220,151,.2)}
.success-link{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:12px;border-radius:11px;text-decoration:none;font:700 13.5px var(--body);background:rgba(84,169,255,.1);border:1px solid rgba(84,169,255,.4);color:var(--blue);transition:all .2s}
.success-link:hover{background:rgba(84,169,255,.2);box-shadow:0 0 22px rgba(84,169,255,.2)}
.success-link svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

/* social neon icons */
.social-row{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:22px auto 0}
.soc{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:rgba(10,17,32,.72);border:1px solid var(--line2);text-decoration:none;position:relative;transition:transform .18s ease,border-color .25s,box-shadow .3s}
.soc svg{width:20px;height:20px;display:block;filter:drop-shadow(0 0 5px var(--glow,rgba(255,255,255,.35)))}
.soc::after{content:'';position:absolute;inset:0;border-radius:13px;background:linear-gradient(160deg,rgba(255,255,255,.1),transparent 45%);pointer-events:none}
.soc:hover{transform:translateY(-3px)}
.soc:active{transform:translateY(-1px) scale(.96)}
.soc.tg{--glow:rgba(42,171,238,.75);border-color:rgba(42,171,238,.5);box-shadow:0 0 14px rgba(42,171,238,.16),inset 0 0 12px rgba(42,171,238,.05)}
.soc.tg:hover{border-color:rgba(42,171,238,.95);box-shadow:0 0 28px rgba(42,171,238,.6),inset 0 0 16px rgba(42,171,238,.14)}
.soc.gh{--glow:rgba(240,246,252,.55);border-color:rgba(240,246,252,.32);box-shadow:0 0 14px rgba(240,246,252,.1),inset 0 0 12px rgba(240,246,252,.04)}
.soc.gh:hover{border-color:rgba(240,246,252,.8);box-shadow:0 0 28px rgba(240,246,252,.45),inset 0 0 16px rgba(240,246,252,.12)}

.foot{margin-top:16px;text-align:center;font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.08em}
.foot span{color:var(--mut)}

/* modal veil */
.modal-veil{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(4,8,16,.66);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .25s;padding:16px}
.modal-veil.show{opacity:1;pointer-events:auto}
.modal{width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 36px);display:flex;flex-direction:column;background:rgba(13,22,40,.97);border:1px solid var(--line2);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.6);transform:translateY(10px) scale(.98);transition:transform .25s cubic-bezier(.2,.7,.2,1);overflow:hidden}
.modal-veil.show .modal{transform:none}
.modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px 0;flex:none}
.modal-head h2{font:800 18px var(--disp);letter-spacing:.02em}
.modal-x{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;background:rgba(126,156,198,.08);border:1px solid var(--line);color:var(--mut);cursor:pointer;font:600 18px/1 var(--body);transition:color .18s,border-color .18s,background .18s}
.modal-x:hover{color:var(--red);border-color:rgba(255,107,122,.45);background:rgba(255,107,122,.08)}
.modal-sub{font:500 11px var(--mono);color:var(--faint);letter-spacing:.1em;margin:4px 22px 14px;text-transform:uppercase}
.modal-body{overflow-y:auto;min-height:0;padding:6px 22px 20px;overscroll-behavior:contain}
.modal .token-link{margin-bottom:0}
.modal .hint{margin:10px 0 14px}
.modal .f-in{margin-bottom:14px}
.modal-list{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.panel-item{display:flex;flex-direction:column;gap:10px;padding:13px;background:rgba(126,156,198,.05);border:1px solid var(--line);border-radius:12px}
.pi-top{display:flex;flex-direction:column;gap:4px;min-width:0}
.pi-name{font:700 13px var(--body);color:var(--ink);word-break:break-all}
.pi-ver{font:600 10.5px var(--mono);color:var(--blue)}
.pi-ver.spin{color:var(--faint);animation:blink 1.2s infinite}
.pi-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.pi-actions .btn{padding:8px 10px;font:700 11px var(--mono);letter-spacing:.02em;border-radius:9px}
.pi-actions .btn.full{grid-column:1/-1}
.btn.teal{background:rgba(47,214,195,.08);border-color:rgba(47,214,195,.4);color:var(--teal)}
.btn.teal:hover{background:rgba(47,214,195,.18);box-shadow:0 0 18px rgba(47,214,195,.18)}
.btn.purple{background:rgba(183,148,255,.08);border-color:rgba(183,148,255,.4);color:var(--purple)}
.btn.purple:hover{background:rgba(183,148,255,.18)}
.btn.yellow{background:rgba(255,209,102,.08);border-color:rgba(255,209,102,.4);color:var(--yellow)}
.btn.yellow:hover{background:rgba(255,209,102,.18)}
.btn.cyan{background:rgba(92,225,255,.08);border-color:rgba(92,225,255,.4);color:var(--cyan)}
.btn.cyan:hover{background:rgba(92,225,255,.18)}
.btn.muted{background:rgba(126,156,198,.07);border-color:var(--line2);color:var(--faint);cursor:not-allowed}
.indigo-btn{background:rgba(127,163,255,.09)!important;border-color:rgba(127,163,255,.4)!important;color:#9bb6ff!important}
.indigo-btn:hover{background:rgba(127,163,255,.2)!important;box-shadow:0 0 22px rgba(127,163,255,.2)!important}

.modal-status{display:none;margin-top:14px;padding:11px 13px;border-radius:11px;font:700 12px var(--body);text-align:center}
.modal-status.show{display:block}
.modal-status.ok{background:rgba(61,220,151,.1);color:var(--green);border:1px solid rgba(61,220,151,.3)}
.modal-status.err{background:rgba(255,107,122,.1);color:var(--red);border:1px solid rgba(255,107,122,.3)}
.modal-status.warn{background:rgba(255,180,84,.1);color:var(--amber);border:1px solid rgba(255,180,84,.3)}

/* confirm modal */
.confirm-card{width:min(380px,calc(100vw - 32px));background:rgba(13,22,40,.98);border:1px solid var(--line2);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.6);padding:24px;text-align:center;transform:scale(.95);transition:transform .25s}
.modal-veil.show .confirm-card{transform:scale(1)}
.confirm-card h3{font:800 18px var(--disp);margin-bottom:10px}
.confirm-card p{font:500 12.5px/1.8 var(--body);color:var(--mut);margin-bottom:20px}
.confirm-actions{display:flex;gap:10px}
.confirm-actions .btn{padding:11px}

/* toast */
.toasts{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:9px;pointer-events:none;max-width:calc(100vw - 32px)}
[dir="ltr"] .toasts{left:auto;right:18px;bottom:18px;top:auto;transform:none}
.toast{display:flex;align-items:center;gap:9px;max-width:340px;background:rgba(12,21,38,.96);border:1px solid var(--line2);border-radius:11px;padding:11px 15px;font:600 12.5px var(--body);color:var(--ink);box-shadow:0 12px 32px rgba(0,0,0,.45);opacity:0;transform:translateY(-12px) scale(.97);transition:opacity .28s ease,transform .28s cubic-bezier(.2,.7,.2,1);border-inline-start:3px solid var(--tc,var(--teal))}
.toast.show{opacity:1;transform:none}
.toast i{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 8px currentColor;background:var(--tc,var(--teal))}
.toast.err{--tc:var(--red)}
.toast.ok{--tc:var(--green)}

@media(max-width:520px){
  .shell{padding:14px 10px}
  .card-inner{padding:24px 18px 20px}
  .brand-t{font-size:23px}
  .modal{width:calc(100vw - 20px)}
  .pi-actions{grid-template-columns:1fr 1fr}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<div class="bg" aria-hidden="true"><i class="glow g1"></i><i class="glow g2"></i><i class="grid"></i></div>

<div class="shell">
  <div class="deploy-card">
    <div class="card-inner">
      <div class="brand">
        <svg class="brand-logo" viewBox="0 0 40 40" aria-hidden="true">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ee0cc"/><stop offset="1" stop-color="#14a08f"/></linearGradient></defs>
          <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#lg)"/>
          <g stroke="#052e29" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <path d="M14 27V13h6a4.5 4.5 0 0 1 0 9h-6"/>
            <path d="M18 22l6 5"/>
          </g>
          <circle cx="14" cy="13" r="2.4" fill="#052e29"/>
        </svg>
        <div>
          <div class="brand-t">RAHIN DEPLOYER</div>
          <div class="brand-sub">راه‌انداز خودکار پنل راهین روی کلودفلر</div>
        </div>
        <span class="deploy-badge"><i></i> CLOUDFLARE <small>WORKER</small></span>
      </div>

      <label class="sec-label">گام ۱ — دریافت توکن</label>
      <a href="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_subdomain%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=RAHIN-Deployer-Token" target="_blank" rel="noopener" class="token-link">
        <svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.6 7.6a5 5 0 11-7.07 7.07 5 5 0 017.07-7.07zm0 0L15 8m0 0l3 3 3-3-3-3m-3 3L9 5l3-3h9v9l-3 3"/></svg>
        دریافت توکن کلودفلر
      </a>
      <div class="hint">
        در کلودفلر لاگین کنید، روی دکمه <b>دریافت توکن</b> بزنید، در انتهای صفحه روی دکمه آبی
        <span class="blue">Continue to summary</span> کلیک کنید و توکن را بسازید.
      </div>

      <label class="sec-label" for="apiToken">گام ۲ — توکن</label>
      <div class="field">
        <input type="password" id="apiToken" class="f-in token-input" placeholder="توکن خود را اینجا وارد کنید" autocomplete="off" spellcheck="false" dir="auto">
        <button type="button" class="eye-btn" onclick="toggleToken()" aria-label="نمایش توکن">
          <svg id="eyeIcon" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>

      <button id="deployBtn" onclick="startDeploy()" class="btn primary btn-block">
        <svg viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        ساخت پنل
      </button>
      <button type="button" id="openUpdateModalBtn" onclick="toggleUpdateModal(true)" class="btn blue btn-block">
        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
        مدیریت و آپدیت پنل‌ها
      </button>

      <div id="status-container" class="status">
        <div class="status-row">
          <span id="status-text" class="status-txt">شروع فرآیند...</span>
          <span id="status-pct" class="status-pct">۰٪</span>
        </div>
        <div class="prog"><i id="progressBar"></i></div>
      </div>
      <div id="error-box" class="error-box"></div>
    </div>
  </div>

  <div class="social-row">
    <a class="soc tg" href="https://t.me/Rahin_vpn1" target="_blank" rel="noopener" title="Telegram">
      <svg viewBox="0 0 24 24"><defs><linearGradient id="tgN" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#41b7ff"/><stop offset="1" stop-color="#1e96e0"/></linearGradient></defs><path fill="url(#tgN)" d="M21.9 4.6 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-.9.5l.3-4.6L18.3 6c.4-.3-.1-.5-.6-.2L7 12.3 2.5 11c-1-.3-1-1 .2-1.5L20.7 3c.8-.3 1.6.2 1.2 1.6z"/></svg>
    </a>
    <a class="soc gh" href="https://github.com/rahinvpn445-web/RAHIN-PANEL" target="_blank" rel="noopener" title="GitHub">
      <svg viewBox="0 0 24 24"><path fill="#f0f6fc" d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.9 18.3 5.2 18.3 5.2c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg>
    </a>
  </div>
  <div class="foot"><span>RAHIN Deployer</span> · TLS 1.3 · AES-256-GCM</div>
</div>

<div id="toast-container" class="toasts"></div>

<div id="custom-confirm-modal" class="modal-veil">
  <div class="confirm-card">
    <h3>تایید عملیات</h3>
    <p id="custom-confirm-message"></p>
    <div class="confirm-actions">
      <button id="custom-confirm-cancel" class="btn" style="background:rgba(255,107,122,.08);border-color:rgba(255,107,122,.4);color:var(--red)">لغو</button>
      <button id="custom-confirm-ok" class="btn primary">تایید</button>
    </div>
  </div>
</div>

<div id="update-modal" class="modal-veil">
  <div class="modal">
    <div class="modal-head">
      <h2>مدیریت و آپدیت پنل‌ها</h2>
      <button onclick="toggleUpdateModal(false)" class="modal-x" aria-label="بستن">×</button>
    </div>
    <div class="modal-sub">PANEL · UPDATE · MANAGE</div>
    <div class="modal-body">
      <a href="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_subdomain%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=RAHIN-Deployer-Token" target="_blank" rel="noopener" class="token-link">
        <svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.6 7.6a5 5 0 11-7.07 7.07 5 5 0 017.07-7.07zm0 0L15 8m0 0l3 3 3-3-3-3m-3 3L9 5l3-3h9v9l-3 3"/></svg>
        دریافت توکن کلودفلر
      </a>
      <div class="hint">
        در کلودفلر لاگین کنید، روی <b>دریافت توکن</b> بزنید و سپس
        <span class="blue">Continue to summary</span> را بزنید.
      </div>
      <input type="password" id="updateApiToken" class="f-in token-input" placeholder="توکن خود را وارد کنید" autocomplete="off" spellcheck="false" dir="auto">
      <button id="checkPanelsBtn" onclick="checkExistingPanels()" class="btn indigo-btn" style="margin-top:12px">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        بررسی پنل‌های موجود
      </button>
      <div id="panels-list-container" class="modal-list" style="display:none;margin-top:16px"></div>
      <div id="update-status" class="modal-status"></div>
    </div>
  </div>
</div>

<script>
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const isError = type === 'error';
    toast.className = 'toast ' + (isError ? 'err' : 'ok');
    toast.innerHTML = '<i></i><span></span>';
    toast.querySelector('span').textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 320);
    }, 3200);
}

function customConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const msgEl = document.getElementById('custom-confirm-message');
        const btnOk = document.getElementById('custom-confirm-ok');
        const btnCancel = document.getElementById('custom-confirm-cancel');
        msgEl.textContent = message;
        modal.classList.add('show');
        const cleanup = () => {
            modal.classList.remove('show');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
        };
        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
}

window.alert = function(message) {
    const msgStr = message ? message.toString() : '';
    if (msgStr.includes('خطا') || msgStr.includes('⚠️') || msgStr.includes('❌') || msgStr.includes('لطفاً') || msgStr.includes('نشد')) {
        showToast(msgStr, 'error');
    } else {
        showToast(msgStr, 'success');
    }
};
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function toggleToken() {
    const tokenInput = document.getElementById('apiToken');
    const eyeIcon = document.getElementById('eyeIcon');
    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>';
    } else {
        tokenInput.type = 'password';
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
    }
}
function toggleUpdateModal(show) {
    const modal = document.getElementById('update-modal');
    if (show) modal.classList.add('show');
    else modal.classList.remove('show');
}
async function checkExistingPanels() {
    const token = document.getElementById('updateApiToken').value.trim();
    const btn = document.getElementById('checkPanelsBtn');
    const listContainer = document.getElementById('panels-list-container');
    const statusBox = document.getElementById('update-status');
    if (!token) {
        statusBox.className = 'modal-status show err';
        statusBox.textContent = 'توکن وارد نشده است';
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-3-6.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> در حال بررسی...';
    statusBox.className = 'modal-status';
    listContainer.style.display = 'none';
    listContainer.innerHTML = '';
    try {
        const response = await fetch('/api/list-panels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const result = await response.json();
        if (result.success) {
            const latestVersion = result.latestVersion || "Unknown";
            const devSub = result.devSub || "";
            if (result.panels.length === 0) {
                statusBox.className = 'modal-status show warn';
                statusBox.textContent = 'هیچ پنلی یافت نشد';
            } else {
                result.panels.forEach(panel => {
                    const panelDiv = document.createElement('div');
                    panelDiv.className = 'panel-item';
                    panelDiv.id = 'panel-item-' + panel.name;
                    panelDiv.innerHTML = '<div class="pi-top">' +
                        '<span class="pi-name">' + panel.name + '</span>' +
                        '<span id="version-text-' + panel.name + '" class="pi-ver spin">در حال بررسی نسخه...</span>' +
                    '</div>' +
                    '<div id="btn-container-' + panel.name + '" class="pi-actions">' +
                        '<span class="btn muted">در حال بارگذاری...</span>' +
                    '</div>';
                    listContainer.appendChild(panelDiv);
                    fetchPanelVersion(token, panel.name, latestVersion, devSub);
                });
                listContainer.style.display = 'flex';
            }
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        statusBox.className = 'modal-status show err';
        statusBox.textContent = 'خطا: ' + e.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> بررسی پنل‌های موجود';
    }
}
async function fetchPanelVersion(token, scriptName, latestVersion, devSub) {
    try {
        const response = await fetch('/api/get-panel-version', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, scriptName })
        });
        const result = await response.json();
        const version = result.success ? result.version : "Unknown";
        const isLatest = (version === latestVersion && latestVersion !== "Unknown");
        const displayVersion = version === "Unknown" ? "نامشخص" : version;
        const versionText = document.getElementById('version-text-' + scriptName);
        const btnContainer = document.getElementById('btn-container-' + scriptName);
        if (versionText && btnContainer) {
            versionText.className = 'pi-ver' + (isLatest ? '' : '');
            versionText.style.color = isLatest ? 'var(--green)' : 'var(--amber)';
            versionText.textContent = 'نسخه ' + displayVersion + (isLatest ? ' · به‌روز' : '');
            let panelUrl = "#";
            if (devSub) panelUrl = "https://" + scriptName + "." + devSub + ".workers.dev/panel369";
            let html = '';
            if (isLatest) {
                html += '<button disabled class="btn teal">آپدیت شده ✓</button>';
            } else {
                html += '<button data-name="' + scriptName + '" onclick="updateRahinPanel(this.dataset.name)" class="btn purple">آپدیت پنل</button>';
            }
            if (devSub) {
                html += '<a href="' + panelUrl + '" target="_blank" rel="noopener" class="btn blue">ورود به پنل</a>';
            } else {
                html += '<button disabled class="btn muted">ورود به پنل</button>';
            }
            html += '<button data-name="' + scriptName + '" onclick="resetPanelPassword(this.dataset.name)" class="btn yellow">بازیابی رمز</button>';
            html += '<button data-name="' + scriptName + '" onclick="reloadRahinPanel(this.dataset.name)" class="btn cyan">ری‌استارت</button>';
            html += '<button data-name="' + scriptName + '" onclick="deleteRahinPanel(this.dataset.name)" class="btn full" style="background:rgba(255,107,122,.08);border-color:rgba(255,107,122,.4);color:var(--red)">حذف پنل</button>';
            btnContainer.innerHTML = html;
        }
    } catch (e) {
        const versionText = document.getElementById('version-text-' + scriptName);
        if (versionText) {
            versionText.className = 'pi-ver';
            versionText.style.color = 'var(--red)';
            versionText.textContent = 'خطا در بررسی نسخه';
        }
    }
}
async function updateRahinPanel(scriptName) {
    const token = document.getElementById('updateApiToken').value.trim();
    if (!(await customConfirm('آیا از آپدیت پنل ' + scriptName + ' مطمئن هستید؟'))) return;
    showToast('در حال آپدیت ' + scriptName + '...');
    try {
        const response = await fetch('/api/do-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, scriptName }) });
        const result = await response.json();
        if (result.success) { showToast('پنل ' + scriptName + ' با موفقیت آپدیت شد'); setTimeout(() => checkExistingPanels(), 1500); }
        else throw new Error(result.error);
    } catch (e) { showToast('خطا: ' + e.message, 'error'); }
}
async function deleteRahinPanel(scriptName) {
    const token = document.getElementById('updateApiToken').value.trim();
    if (!(await customConfirm('آیا از حذف پنل ' + scriptName + ' مطمئن هستید؟'))) return;
    showToast('در حال حذف ' + scriptName + '...');
    try {
        const response = await fetch('/api/delete-panel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, scriptName }) });
        const result = await response.json();
        if (result.success) { showToast('پنل با موفقیت حذف شد'); setTimeout(() => checkExistingPanels(), 1500); }
        else throw new Error(result.error);
    } catch (e) { showToast('خطا: ' + e.message, 'error'); }
}
async function resetPanelPassword(scriptName) {
    const token = document.getElementById('updateApiToken').value.trim();
    if (!(await customConfirm('بازیابی رمز عبور پنل ' + scriptName + '؟'))) return;
    showToast('در حال بازیابی رمز عبور...');
    try {
        const response = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, scriptName }) });
        const result = await response.json();
        if (result.success) { showToast('رمز عبور بازنشانی شد'); setTimeout(() => checkExistingPanels(), 1500); }
        else throw new Error(result.error);
    } catch (e) { showToast('خطا: ' + e.message, 'error'); }
}
async function reloadRahinPanel(scriptName) {
    const token = document.getElementById('updateApiToken').value.trim();
    if (!(await customConfirm('آیا پنل مجدداً دیپلوی شود؟ کاربران شما باقی می‌مانند.'))) return;
    showToast('در حال ریلود پنل...');
    try {
        const response = await fetch('/api/do-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, scriptName }) });
        const result = await response.json();
        if (result.success) { showToast('پنل با موفقیت ریلود شد'); setTimeout(() => checkExistingPanels(), 1500); }
        else throw new Error(result.error);
    } catch (e) { showToast('خطا: ' + e.message, 'error'); }
}
async function startDeploy() {
    const token = document.getElementById('apiToken').value.trim();
    const btn = document.getElementById('deployBtn');
    const statusContainer = document.getElementById('status-container');
    const statusText = document.getElementById('status-text');
    const statusPct = document.getElementById('status-pct');
    const progressBar = document.getElementById('progressBar');
    const errorBox = document.getElementById('error-box');
    const oldText = document.getElementById('successTxt');
    if (oldText) oldText.remove();
    const oldSuccessLink = document.getElementById('successBtn');
    if (oldSuccessLink) oldSuccessLink.remove();
    const oldLinkBox = document.getElementById('linkBox');
    if (oldLinkBox) oldLinkBox.remove();
    if(!token) {
        errorBox.classList.add('show');
        errorBox.textContent = 'لطفاً ابتدا توکن را وارد کنید.';
        return;
    }
    errorBox.classList.remove('show');
    errorBox.innerHTML = '';
    btn.disabled = true;
    document.getElementById('apiToken').disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="40 20"/></svg> در حال پردازش...';
    statusContainer.classList.add('show');
    statusText.textContent = 'در حال بررسی توکن...';
    statusPct.textContent = '۱۵٪';
    progressBar.style.width = '15%';
    await sleep(500);
    statusText.textContent = 'در حال ارتباط با کلودفلر...';
    statusPct.textContent = '۳۰٪';
    progressBar.style.width = '30%';
    await sleep(500);
    statusText.textContent = 'در حال ایجاد دیتابیس D1...';
    statusPct.textContent = '۵۰٪';
    progressBar.style.width = '50%';
    try {
        const response = await fetch('/api/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        statusText.textContent = 'در حال دریافت پنل راهین...';
        statusPct.textContent = '۷۵٪';
        progressBar.style.width = '75%';
        await sleep(600);
        statusText.textContent = 'در حال فعال‌سازی لینک...';
        statusPct.textContent = '۹۰٪';
        progressBar.style.width = '90%';
        await sleep(500);
        const result = await response.json();
        if (result.success) {
            progressBar.style.width = '100%';
            statusPct.textContent = '۱۰۰٪';
            statusText.textContent = 'تکمیل شد!';
            await sleep(400);
            statusContainer.classList.remove('show');
            const successText = document.createElement('div');
            successText.id = 'successTxt';
            successText.className = 'success-txt';
            successText.textContent = 'پنل ساخته شد؛ لطفاً ۵ دقیقه صبر کنید و سپس وارد شوید.';
            document.querySelector('.card-inner').appendChild(successText);
            const linkBox = document.createElement('div');
            linkBox.id = 'linkBox';
            linkBox.className = 'link-box';
            const linkDisplay = document.createElement('span');
            linkDisplay.className = 'link-url';
            linkDisplay.textContent = result.url;
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.type = 'button';
            copyBtn.textContent = 'کپی لینک پنل';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(result.url);
                copyBtn.textContent = 'کپی شد!';
                setTimeout(() => { copyBtn.textContent = 'کپی لینک پنل'; }, 2000);
            };
            linkBox.appendChild(linkDisplay);
            linkBox.appendChild(copyBtn);
            document.querySelector('.card-inner').appendChild(linkBox);
            const successLink = document.createElement('a');
            successLink.href = result.url;
            successLink.target = '_blank';
            successLink.rel = 'noopener';
            successLink.className = 'success-link';
            successLink.id = 'successBtn';
            successLink.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> ورود به پنل';
            document.querySelector('.card-inner').appendChild(successLink);
        } else {
            throw new Error(result.error);
        }
    } catch(e) {
        statusContainer.classList.remove('show');
        errorBox.classList.add('show');
        btn.disabled = false;
        document.getElementById('apiToken').disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> ساخت پنل';
        const errorMsg = e.message;
        const rawError = errorMsg.includes('|') ? errorMsg.split('|')[1] : errorMsg;
        if (errorMsg.includes("databases per account") || errorMsg.includes("limit reached")) {
            errorBox.innerHTML = '<div style="margin-bottom:6px"><b>به سقف مجاز ساخت دیتابیس D1 رسیده‌اید.</b></div><div style="font:500 10.5px var(--mono);opacity:.75;margin-bottom:8px" dir="ltr">' + rawError + '</div><a href="https://dash.cloudflare.com/?to=/:account/workers/d1" target="_blank" rel="noopener">مدیریت دیتابیس‌ها</a>';
        } else if (errorMsg.includes("script limit") || errorMsg.includes("scripts per account")) {
            errorBox.innerHTML = '<div style="margin-bottom:6px"><b>به سقف مجاز ساخت ورکر رسیده‌اید.</b></div><div style="font:500 10.5px var(--mono);opacity:.75;margin-bottom:8px" dir="ltr">' + rawError + '</div><a href="https://dash.cloudflare.com/?to=/:account/workers/services" target="_blank" rel="noopener">مدیریت ورکرها</a>';
        } else if (errorMsg.includes("اکانتی یافت نشد") || errorMsg.includes("Authentication") || errorMsg.includes("Invalid")) {
            errorBox.innerHTML = '<div style="margin-bottom:6px"><b>توکن دسترسی ندارد؛ فقط با دکمه نارنجی «دریافت توکن» کار کنید.</b></div><div style="font:500 10.5px var(--mono);opacity:.75;margin-bottom:8px" dir="ltr">' + rawError + '</div><a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener">مدیریت توکن‌ها</a>';
        } else if (errorMsg.includes("CF_TOS_ERROR") || errorMsg.includes("CF_DB_ERROR") || errorMsg.includes("CF_DEPLOY_ERROR")) {
            if (errorMsg.includes("email") || errorMsg.includes("verify")) {
                errorBox.innerHTML = '<div style="margin-bottom:6px"><b>ابتدا ایمیل خود را در کلودفلر تایید کنید.</b></div><div style="font:500 10.5px var(--mono);opacity:.75;margin-bottom:8px" dir="ltr">' + rawError + '</div><a href="https://dash.cloudflare.com/profile" target="_blank" rel="noopener">تایید ایمیل</a>';
            } else {
                errorBox.innerHTML = '<div style="margin-bottom:6px"><b>قوانین کلودفلر را در داشبورد تایید کنید.</b></div><div style="font:500 10.5px var(--mono);opacity:.75;margin-bottom:8px" dir="ltr">' + rawError + '</div><a href="https://dash.cloudflare.com/?to=/:account/workers/overview" target="_blank" rel="noopener">ورود به کلودفلر</a>';
            }
        } else {
            errorBox.textContent = errorMsg;
        }
    }
}
</script>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</body>
</html>
	`;
}

