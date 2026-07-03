import { connect } from "cloudflare:sockets";
const GLOBAL_TRAFFIC_CACHE = new Map();
const ACTIVE_CONNECTIONS_COUNT = new Map();
const GLOBAL_LAST_ACTIVE_WRITE = new Map();
const GLOBAL_LAST_DB_WRITE = new Map();
const GLOBAL_WRITE_LOCK = new Map();
const DNS_CACHE = new Map();
const USER_REQ_CACHE = new Map();
let GLOBAL_REQ_COUNT = 0;
let GLOBAL_LAST_REQ_WRITE = 0;
const DNS_CACHE_TTL = 5 * 60 * 1000;
const DOH_RESOLVER = "https://cloudflare-dns.com/dns-query";
const UPSTREAM_BUNDLE_TARGET_BYTES = 16 * 1024;
const UPSTREAM_QUEUE_MAX_BYTES = 16 * 1024 * 1024;
const UPSTREAM_QUEUE_MAX_ITEMS = 4096;
const DOWNSTREAM_GRAIN_BYTES = 32 * 1024;
const DOWNSTREAM_GRAIN_TAIL_THRESHOLD = 512;
const DOWNSTREAM_GRAIN_SILENT_MS = 1;
const TCP_CONCURRENCY = 2;
const PRELOAD_RACE_DIAL = true;
export default {
	async fetch(request, env, ctx) {
		trackRequest(env, ctx);
		await DbService.ensureSchema(env.DB);
		const url = new URL(request.url);
		if (Router.isWebSocketUpgrade(request) && url.pathname === "/In_Panel_Rayeghan_Ast_Va_Gheyre_Ghabele_Foroosh") {
			return await Router.handleWebSocket(request, env, ctx);
		}
		if (Router.isSubscriptionPath(url.pathname)) {
			return await Router.handleSubscription(url, env);
		}
		if (url.pathname.startsWith("/api/") || url.pathname === "/locations") {
			return await Router.handleApi(request, url, env, ctx);
		}
		if (url.pathname === "/panel" || url.pathname === "/login") {
			return await Router.handlePanel(request, env);
		}
		if (url.pathname.startsWith("/status/")) {
			return await Router.handleUserStatus(url, env);
		}
		return new Response(HTML_TEMPLATES.nginx, {
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	},
};
const Router = {
	isWebSocketUpgrade(request) {
		const upgradeHeader = (request.headers.get("Upgrade") || "").toLowerCase();
		return upgradeHeader === "websocket";
	},
	isSubscriptionPath(pathname) {
		return pathname.startsWith("/sub/") || pathname.startsWith("/feed/");
	},
	async handleWebSocket(request, env, ctx) {
		try {
			let proxyIP = "proxyip.cmliussss.net";
			try {
				const proxyRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'proxy_ip'").first();
				if (proxyRow && proxyRow.value) {
					proxyIP = proxyRow.value;
				}
			} catch (e) {}
			const mockStoredData = { proxy_ip: proxyIP };
			return handleVLESS(env, mockStoredData, ctx, request);
		} catch (e) {
			return new Response("Internal Server Error", { status: 500 });
		}
	},
	async handleSubscription(url, env) {
		const isSubPath = url.pathname.startsWith("/sub/");
		const offset = isSubPath ? 5 : 6;
		let subUser = decodeURIComponent(url.pathname.slice(offset));
		const host = url.hostname;
		try {
			const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? OR uuid = ?").bind(subUser, subUser).first();
			if (!user || user.connection_type !== atob("dmxlc3M=")) {
				return new Response("Not Found", { status: 404 });
			}
			return await SubscriptionService.generateText(user, host, env);
		} catch (err) {
			return new Response("Error building config: " + err.message, { status: 500 });
		}
	},
	async handlePanel(request, env) {
		const hasPassword = await DbService.getPanelPassword(env.DB);
		if (!hasPassword) {
			return new Response(HTML_TEMPLATES.setup, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		const authorized = await DbService.verifyApiAuth(request, env);
		if (!authorized) {
			return new Response(HTML_TEMPLATES.login, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		return new Response(HTML_TEMPLATES.panel, {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
				Pragma: "no-cache",
				Expires: "0",
			},
		});
	},
	async handleUserStatus(url, env) {
		const username = decodeURIComponent(url.pathname.slice(8));
		if (!username) {
			return new Response("Username is required", { status: 400 });
		}
		try {
			const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? OR uuid = ?").bind(username, username).first();
			if (!user) {
				return new Response("User not found", { status: 404 });
			}
			const userJson = JSON.stringify({
				username: user.username,
				uuid: user.uuid,
				limit_gb: user.limit_gb,
				expiry_days: user.expiry_days,
				used_gb: user.used_gb,
				limit_req: user.limit_req,
				used_req: user.used_req,
				is_active: user.is_active,
				online_count: getActiveIpCount(user.active_ips),
				ip_limit: user.ip_limit,
				created_at: user.created_at,
				tls: user.tls,
				port: user.port,
				ips: user.ips,
				fingerprint: user.fingerprint || "chrome",
			});
			const html = HTML_TEMPLATES.status.replace("/* {{USER_DATA_PLACEHOLDER}} */", `window.statusUser = ${userJson};`);
			return new Response(html, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		} catch (err) {
			return new Response("Error: " + err.message, { status: 500 });
		}
	},
	async handleApi(request, url, env, ctx) {
		const hasPassword = await DbService.getPanelPassword(env.DB);
		if (url.pathname === "/api/setup-password" && request.method === "POST") {
			if (hasPassword) {
				return new Response(JSON.stringify({ error: "رمز عبور از قبل تعریف شده است" }), {
					status: 400,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
			const { password } = await request.json();
			if (!password || password.length < 4) {
				return new Response(JSON.stringify({ error: "رمز عبور باید حداقل ۴ کاراکتر باشد" }), {
					status: 400,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
			const hashed = await DbService.sha256(password);
			await DbService.setPanelPassword(env.DB, hashed);
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Set-Cookie": "panel_session=" + hashed + "; Path=/; HttpOnly; Secure; SameSite=Lax",
				},
			});
		}
		if (url.pathname === "/api/login" && request.method === "POST") {
			const { password } = await request.json();
			const hashedInput = await DbService.sha256(password);
			const storedHash = await DbService.getPanelPassword(env.DB);
			if (storedHash === hashedInput) {
				return new Response(JSON.stringify({ success: true }), {
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"Set-Cookie": "panel_session=" + storedHash + "; Path=/; HttpOnly; Secure; SameSite=Lax",
					},
				});
			}
			return new Response(JSON.stringify({ error: "رمز عبور اشتباه است" }), {
				status: 401,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			});
		}
		if (url.pathname === "/api/logout" && request.method === "POST") {
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Set-Cookie": "panel_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
				},
			});
		}
		if (url.pathname === "/api/recover" && request.method === "POST") {
			const { api_token } = await request.json();
			if (!api_token) {
				return new Response(JSON.stringify({ error: "Token is required" }), {
					status: 400,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
			try {
				const cfRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
					headers: { Authorization: "Bearer " + api_token },
				});
				const cfData = await cfRes.json();
				if (!cfRes.ok || !cfData.success) {
					return new Response(JSON.stringify({ error: "Invalid or expired Cloudflare token" }), {
						status: 401,
						headers: { "Content-Type": "application/json; charset=utf-8" },
					});
				}
				const host = url.hostname;
				let isAuthorized = false;
				if (host.endsWith(".workers.dev")) {
					const parts = host.split(".");
					const targetSubdomain = parts[parts.length - 3];
					const accountsRes = await fetch("https://api.cloudflare.com/client/v4/accounts", {
						headers: { Authorization: "Bearer " + api_token },
					});
					const accountsData = await accountsRes.json();
					if (accountsData.success && accountsData.result) {
						for (const acc of accountsData.result) {
							const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc.id}/workers/subdomain`, {
								headers: { Authorization: "Bearer " + api_token },
							});
							const subData = await subRes.json();
							if (subData.success && subData.result && subData.result.subdomain === targetSubdomain) {
								isAuthorized = true;
								break;
							}
						}
					}
				} else {
					const zonesRes = await fetch("https://api.cloudflare.com/client/v4/zones", {
						headers: { Authorization: "Bearer " + api_token },
					});
					const zonesData = await zonesRes.json();
					if (zonesData.success && zonesData.result) {
						for (const zone of zonesData.result) {
							if (host === zone.name || host.endsWith("." + zone.name)) {
								isAuthorized = true;
								break;
							}
						}
					}
				}
				if (!isAuthorized) {
					return new Response(JSON.stringify({ error: "این توکن متعلق به صاحب پنل نیست (ای کــثـــکـــش)" }), {
						status: 403,
						headers: { "Content-Type": "application/json; charset=utf-8" },
					});
				}
				await env.DB.prepare("DELETE FROM settings WHERE key = 'panel_password'").run();
				cachedPanelPassword = null;
				return new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			} catch (err) {
				return new Response(JSON.stringify({ error: "Cloudflare API connection error" }), {
					status: 500,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
		}
		const authorized = await DbService.verifyApiAuth(request, env);
		if (!authorized) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			});
		}
		if (url.pathname === "/api/update-panel" && request.method === "POST") {
			const body = await request.json().catch(() => ({}));
			let currentToken = env.CF_API_TOKEN || body.cf_token;
			let currentAccountId = env.CF_ACCOUNT_ID;

			if (!currentToken) {
				return new Response(JSON.stringify({ error: "TOKEN_REQUIRED" }), { status: 400, headers: { "Content-Type": "application/json" } });
			}

			try {
				if (!currentAccountId) {
					const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", {
						headers: { Authorization: "Bearer " + currentToken },
					});
					const accData = await accRes.json();
					if (!accData.success || accData.result.length === 0) throw new Error("توکن نامعتبر است یا اکانتی یافت نشد.");
					currentAccountId = accData.result[0].id;
				}

				const githubRes = await fetch("https://raw.githubusercontent.com/rahinvpn445-web/RAHIN-PANEL/main/rahin.js?t=" + Date.now() + Math.random(), {
					headers: {
						"Cache-Control": "no-cache, no-store, must-revalidate",
						Pragma: "no-cache",
						Expires: "0",
					},
				});
				if (!githubRes.ok) throw new Error("خطا در دریافت سورس جدید از گیت‌هاب");
				const newCode = await githubRes.text();

				const scriptName = env.WORKER_NAME || url.hostname.split(".")[0];
				const bindingsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${currentAccountId}/workers/scripts/${scriptName}/bindings`, {
					headers: { Authorization: "Bearer " + currentToken },
				});
				const bindingsData = await bindingsRes.json();
				if (!bindingsData.success) throw new Error("عدم دسترسی به تنظیمات ورکر. توکن نامعتبر است.");

				const newBindings = [];
				for (const b of bindingsData.result) {
					if (b.type === "d1") {
						newBindings.push({ type: "d1", name: b.name, id: b.database_id || b.id });
					} else if (b.name === "CF_API_TOKEN") {
						newBindings.push({ type: "secret_text", name: "CF_API_TOKEN", text: currentToken });
					} else if (b.name === "CF_ACCOUNT_ID") {
						newBindings.push({ type: "secret_text", name: "CF_ACCOUNT_ID", text: currentAccountId });
					}
				}

				if (!newBindings.some((b) => b.name === "CF_API_TOKEN")) {
					newBindings.push({ type: "secret_text", name: "CF_API_TOKEN", text: currentToken });
				}
				if (!newBindings.some((b) => b.name === "CF_ACCOUNT_ID")) {
					newBindings.push({ type: "secret_text", name: "CF_ACCOUNT_ID", text: currentAccountId });
				}

				const metadata = {
					main_module: "rahin.js",
					compatibility_date: "2024-02-08",
					bindings: newBindings,
				};

				const formData = new FormData();
				formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
				formData.append("rahin.js", new Blob([newCode], { type: "application/javascript+module" }), "rahin.js");

				const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${currentAccountId}/workers/scripts/${scriptName}`, {
					method: "PUT",
					headers: { Authorization: "Bearer " + currentToken },
					body: formData,
				});
				const deployData = await deployRes.json();
				if (!deployData.success) {
					const cfMsg = deployData.errors && deployData.errors.length > 0 ? deployData.errors.map((e) => e.message).join(" | ") : "نامشخص";
					throw new Error("خطا در اعمال آپدیت در کلودفلر: " + cfMsg);
				}

				return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
			} catch (err) {
				const errorMsg = err.message;
				return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { "Content-Type": "application/json" } });
			}
		}
		if (url.pathname === "/api/restart-core" && request.method === "POST") {
			let currentToken = env.CF_API_TOKEN;
			let currentAccountId = env.CF_ACCOUNT_ID;

			if (!currentToken || !currentAccountId) {
				return new Response(JSON.stringify({ error: "TOKEN_REQUIRED" }), { status: 400, headers: { "Content-Type": "application/json" } });
			}

			try {
				const githubRes = await fetch("https://raw.githubusercontent.com/rahinvpn445-web/RAHIN-PANEL/main/rahin.js?t=" + Date.now(), {
					headers: {
						"Cache-Control": "no-cache, no-store, must-revalidate",
						Pragma: "no-cache",
						Expires: "0",
					},
				});
				if (!githubRes.ok) throw new Error("خطا در دریافت سورس از گیت‌هاب");
				const newCode = await githubRes.text();

				const scriptName = env.WORKER_NAME || url.hostname.split(".")[0];
				const bindingsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${currentAccountId}/workers/scripts/${scriptName}/bindings`, {
					headers: { Authorization: "Bearer " + currentToken },
				});
				const bindingsData = await bindingsRes.json();
				if (!bindingsData.success) throw new Error("عدم دسترسی به تنظیمات ورکر");

				const newBindings = [];
				for (const b of bindingsData.result) {
					if (b.type === "d1") {
						newBindings.push({ type: "d1", name: b.name, id: b.database_id || b.id });
					}
				}

				newBindings.push({ type: "secret_text", name: "CF_API_TOKEN", text: currentToken });
				newBindings.push({ type: "secret_text", name: "CF_ACCOUNT_ID", text: currentAccountId });

				const metadata = {
					main_module: "rahin.js",
					compatibility_date: "2024-02-08",
					bindings: newBindings,
				};

				const formData = new FormData();
				formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
				formData.append("rahin.js", new Blob([newCode], { type: "application/javascript+module" }), "rahin.js");

				const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${currentAccountId}/workers/scripts/${scriptName}`, {
					method: "PUT",
					headers: { Authorization: "Bearer " + currentToken },
					body: formData,
				});
				const deployData = await deployRes.json();
				if (!deployData.success) {
					const cfMsg = deployData.errors && deployData.errors.length > 0 ? deployData.errors.map((e) => e.message).join(" | ") : "نامشخص";
					throw new Error("خطا در اعمال ری‌استارت در کلودفلر: " + cfMsg);
				}

				return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
			} catch (err) {
				return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
			}
		}
		if (url.pathname === "/api/change-password" && request.method === "POST") {
			const { current_password, new_password } = await request.json();
			if (!current_password || !new_password) {
				return new Response(JSON.stringify({ error: "رمز عبور فعلی و جدید الزامی هستند" }), {
					status: 400,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
			const currentHash = await DbService.sha256(current_password);
			const storedHash = await DbService.getPanelPassword(env.DB);
			if (storedHash && storedHash !== currentHash) {
				return new Response(JSON.stringify({ error: "رمز عبور فعلی اشتباه است" }), {
					status: 401,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
			if (new_password.length < 4) {
				return new Response(JSON.stringify({ error: "رمز عبور جدید باید حداقل ۴ کاراکتر باشد" }), {
					status: 400,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				});
			}
			const newHash = await DbService.sha256(new_password);
			await DbService.setPanelPassword(env.DB, newHash);
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Set-Cookie": "panel_session=" + newHash + "; Path=/; HttpOnly; Secure; SameSite=Lax",
				},
			});
		}
		if (url.pathname === "/locations") {
			try {
				const response = await fetch("https://speed.cloudflare.com/locations", {
					headers: { Referer: "https://speed.cloudflare.com/" },
				});
				const data = await response.json();
				return new Response(JSON.stringify(data), {
					headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
				});
			} catch (e) {
				return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
			}
		}
		if (url.pathname === "/api/proxy-ip") {
			if (request.method === "POST") {
				const { proxy_ip, iata, frag_len, frag_int } = await request.json();
				if (proxy_ip) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('proxy_ip', ?)").bind(proxy_ip).run();
				if (iata !== undefined) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('proxy_location_iata', ?)").bind(iata).run();
				if (frag_len !== undefined) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('frag_len', ?)").bind(frag_len).run();
				if (frag_int !== undefined) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('frag_int', ?)").bind(frag_int).run();
				return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
			}
			if (request.method === "GET") {
				const rowIp = await env.DB.prepare("SELECT value FROM settings WHERE key = 'proxy_ip'").first();
				const rowIata = await env.DB.prepare("SELECT value FROM settings WHERE key = 'proxy_location_iata'").first();
				const rowLen = await env.DB.prepare("SELECT value FROM settings WHERE key = 'frag_len'").first();
				const rowInt = await env.DB.prepare("SELECT value FROM settings WHERE key = 'frag_int'").first();
				return new Response(
					JSON.stringify({
						proxy_ip: rowIp ? rowIp.value : "proxyip.cmliussss.net",
						iata: rowIata ? rowIata.value : "",
						frag_len: rowLen ? rowLen.value : "20-30",
						frag_int: rowInt ? rowInt.value : "1-2",
					}),
					{ headers: { "Content-Type": "application/json" } },
				);
			}
		}
		if (url.pathname === "/api/ad-configs") {
			if (request.method === "GET") {
				const configs = await SubscriptionService.getAdConfigs(env);
				return new Response(JSON.stringify({ configs }), { headers: { "Content-Type": "application/json" } });
			}
			if (request.method === "POST") {
				const { configs } = await request.json();
				const saved = await SubscriptionService.saveAdConfigs(env, configs);
				return new Response(JSON.stringify({ success: true, configs: saved }), { headers: { "Content-Type": "application/json" } });
			}
		}
		if (url.pathname.startsWith("/api/users")) {
			const pathParts = url.pathname.split("/");
			const isUserAction = pathParts.length > 3;
			if (isUserAction) {
				const username = decodeURIComponent(pathParts.pop());
				if (request.method === "PUT") {
					const body = await request.json();
					if (body.toggle_only !== undefined) {
						await env.DB.prepare("UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE username = ?").bind(username).run();
						return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
					} else if (body.reset_action !== undefined) {
						if (body.reset_action === "volume") {
							await env.DB.prepare("UPDATE users SET used_gb = 0 WHERE username = ?").bind(username).run();
							GLOBAL_TRAFFIC_CACHE.set(username, 0);
						} else if (body.reset_action === "req") {
							await env.DB.prepare("UPDATE users SET used_req = 0 WHERE username = ?").bind(username).run();
							USER_REQ_CACHE.set(username, 0);
						} else if (body.reset_action === "time") {
							await env.DB.prepare("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE username = ?").bind(username).run();
						}
						return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
					} else {
						const { username: new_username, limit_gb, expiry_days, limit_req, ips, tls, port, fingerprint, ip_limit, remark_name } = body;
						if (new_username && new_username !== username) {
							const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(new_username).first();
							if (existing) {
								return new Response(JSON.stringify({ error: "این نام کاربری از قبل وجود دارد" }), { status: 400, headers: { "Content-Type": "application/json" } });
							}
							if (GLOBAL_TRAFFIC_CACHE.has(username)) {
								GLOBAL_TRAFFIC_CACHE.set(new_username, GLOBAL_TRAFFIC_CACHE.get(username));
								GLOBAL_TRAFFIC_CACHE.delete(username);
							}
							if (USER_REQ_CACHE.has(username)) {
								USER_REQ_CACHE.set(new_username, USER_REQ_CACHE.get(username));
								USER_REQ_CACHE.delete(username);
							}
							if (ACTIVE_CONNECTIONS_COUNT.has(username)) {
								ACTIVE_CONNECTIONS_COUNT.set(new_username, ACTIVE_CONNECTIONS_COUNT.get(username));
								ACTIVE_CONNECTIONS_COUNT.delete(username);
							}
							if (GLOBAL_LAST_ACTIVE_WRITE.has(username)) {
								GLOBAL_LAST_ACTIVE_WRITE.set(new_username, GLOBAL_LAST_ACTIVE_WRITE.get(username));
								GLOBAL_LAST_ACTIVE_WRITE.delete(username);
							}
						}
						await env.DB.prepare("UPDATE users SET username = ?, limit_gb = ?, expiry_days = ?, limit_req = ?, ips = ?, tls = ?, port = ?, fingerprint = ?, max_connections = ?, ip_limit = ?, remark_name = ? WHERE username = ?")
							.bind(new_username || username, limit_gb ? parseFloat(limit_gb) : null, expiry_days ? parseInt(expiry_days) : null, limit_req ? parseInt(limit_req) : null, ips || null, tls, port, fingerprint || "chrome", ip_limit ? parseInt(ip_limit) : null, ip_limit ? parseInt(ip_limit) : null, remark_name || null, username)
							.run();
						return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
					}
				}
				if (request.method === "DELETE") {
					await env.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
					return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
				}
			} else {
				if (request.method === "GET") {
					try {
						await flushExpiredTraffic(env);
					} catch (e) {}
					const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY id DESC").all();
					const now = Date.now();
					const enrichedUsers = (results || []).map((user) => ({
						...user,
						is_online: user.last_active && now - user.last_active < 25000 ? 1 : 0,
						online_count: getActiveIpCount(user.active_ips),
					}));
					let cfReqs = { today: 0, total: 0 };
					try {
						const liveCf = await getCfUsage(env);
						const todayStr = new Date().toISOString().split("T")[0];
						const dateRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_last_date'").first();
						const totalRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_total'").first();
						let dbTotal = totalRow ? parseInt(totalRow.value) || 0 : 0;
						let dbToday = 0;
						if (dateRow && dateRow.value === todayStr) {
							const todayRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_today'").first();
							dbToday = todayRow ? parseInt(todayRow.value) || 0 : 0;
						}
						if (liveCf.today > dbToday) {
							dbToday = liveCf.today;
							await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_today', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(String(dbToday), String(dbToday)).run();
							await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_last_date', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(todayStr, todayStr).run();
						}
						if (liveCf.total > dbTotal) {
							dbTotal = liveCf.total;
							await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_total', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(String(dbTotal), String(dbTotal)).run();
						}
						cfReqs.today = dbToday + GLOBAL_REQ_COUNT;
						cfReqs.total = dbTotal + GLOBAL_REQ_COUNT;
					} catch (e) {}
					return new Response(
						JSON.stringify({
							users: enrichedUsers,
							serverTime: now,
							cfRequestsToday: cfReqs.today,
							cfRequestsTotal: cfReqs.total,
						}),
						{
							headers: {
								"Content-Type": "application/json",
								"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
							},
						},
					);
				}
				if (request.method === "POST") {
					const { username, uuid, limit_gb, expiry_days, limit_req, ips, tls, port, fingerprint, ip_limit, used_gb, used_req, created_at, is_active, remark_name } = await request.json();
					if (!username) {
						return new Response(JSON.stringify({ error: "نام کاربری اجباری است" }), { status: 400, headers: { "Content-Type": "application/json" } });
					}
					const finalUuid = uuid || crypto.randomUUID();
					const parsedUsedGb = parseFloat(used_gb);
					const finalUsedGb = !isNaN(parsedUsedGb) ? parsedUsedGb : 0;
					const parsedUsedReq = parseInt(used_req);
					const finalUsedReq = !isNaN(parsedUsedReq) ? parsedUsedReq : 0;
					const finalCreatedAt = created_at || new Date().toISOString();
					const parsedIsActive = parseInt(is_active);
					const finalIsActive = !isNaN(parsedIsActive) ? parsedIsActive : 1;
					try {
						await env.DB.prepare("INSERT INTO users (username, uuid, limit_gb, expiry_days, limit_req, ips, tls, port, fingerprint, ip_limit, used_gb, used_req, created_at, is_active, remark_name, connection_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
							.bind(username, finalUuid, limit_gb ? parseFloat(limit_gb) : null, expiry_days ? parseInt(expiry_days) : null, limit_req ? parseInt(limit_req) : null, ips || null, tls || "none", port || "443", fingerprint || "chrome", ip_limit ? parseInt(ip_limit) : null, finalUsedGb, finalUsedReq, finalCreatedAt, finalIsActive, remark_name || null, "vless")
							.run();
						return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
					} catch (error) {
						if (error.message && error.message.includes("UNIQUE constraint failed")) {
							return new Response(JSON.stringify({ success: false, error: "USERNAME_ALREADY_EXISTS" }), {
								status: 400,
								headers: { "Content-Type": "application/json" },
							});
						}
						return new Response(JSON.stringify({ success: false, error: error.message }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						});
					}
				}
			}
		}
		return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } });
	},
};
let schemaEnsured = false;
let cachedPanelPassword = null;
const DbService = {
	async ensureSchema(db) {
		if (schemaEnsured) return;
		try {
			await db
				.prepare(
					`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          uuid TEXT,
          limit_gb REAL,
          expiry_days INTEGER,
          ips TEXT,
          connection_type TEXT,
          tls TEXT,
          port INTEGER,
          used_gb REAL DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          last_active INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
				)
				.run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN last_active INTEGER").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN fingerprint TEXT DEFAULT 'chrome'").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN max_connections INTEGER").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN limit_req INTEGER").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN used_req INTEGER DEFAULT 0").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN ip_limit INTEGER DEFAULT NULL").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN active_ips TEXT DEFAULT NULL").run();
		} catch (e) {}
		try {
			await db.prepare("ALTER TABLE users ADD COLUMN remark_name TEXT DEFAULT NULL").run();
		} catch (e) {}
		try {
			await db.prepare("UPDATE users SET connection_type = 'vless' WHERE connection_type IS NULL OR connection_type = ''").run();
		} catch (e) {}
		try {
			await db.prepare("UPDATE users SET ip_limit = max_connections WHERE ip_limit IS NULL AND max_connections IS NOT NULL").run();
		} catch (e) {}
		try {
			await db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run();
		} catch (e) {}
		schemaEnsured = true;
	},
	async getPanelPassword(db) {
		if (cachedPanelPassword !== null) return cachedPanelPassword;
		try {
			const row = await db.prepare("SELECT value FROM settings WHERE key = 'panel_password'").first();
			cachedPanelPassword = row ? row.value : "";
			return cachedPanelPassword || null;
		} catch (e) {
			return null;
		}
	},
	async setPanelPassword(db, password) {
		await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('panel_password', ?)").bind(password).run();
		cachedPanelPassword = password;
	},
	async verifyApiAuth(request, env) {
		const storedPasswordHash = await this.getPanelPassword(env.DB);
		if (!storedPasswordHash) return true;
		const cookies = request.headers.get("Cookie") || "";
		const sessionCookie = cookies.split(";").find((c) => c.trim().startsWith("panel_session="));
		if (!sessionCookie) return false;
		const sessionToken = sessionCookie.split("=")[1].trim();
		return sessionToken === storedPasswordHash;
	},
	async sha256(message) {
		const msgBuffer = new TextEncoder().encode(message);
		const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	},
};
function getActiveIpCount(activeIpsJson) {
	if (!activeIpsJson) return 0;
	try {
		const activeIps = JSON.parse(activeIpsJson);
		const now = Date.now();
		let count = 0;
		for (const [ip, data] of Object.entries(activeIps)) {
			const lastSeen = data && typeof data === "object" ? data.timestamp : data;
			if (now - lastSeen <= 30000) {
				count++;
			}
		}
		return count;
	} catch (e) {
		return 0;
	}
}
const DEFAULT_AD_CONFIGS = [
	{ enabled: true, remark: "🚀 @Rahin_vpn1 🚀" },
	{ enabled: true, remark: "📊 remaining | \u200E{volume} | \u200E{days} | \u200E{requests}" },
];
const SubscriptionService = {
	async getAdConfigs(env) {
		try {
			const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'ad_configs'").first();
			if (row && row.value) {
				const parsed = JSON.parse(row.value);
				if (Array.isArray(parsed)) return parsed;
			}
		} catch (e) {}
		return DEFAULT_AD_CONFIGS;
	},
	async saveAdConfigs(env, configs) {
		const safeConfigs = Array.isArray(configs) ? configs.slice(0, 20).map((c) => ({ enabled: !!c.enabled, remark: String(c.remark || "").slice(0, 300) })) : [];
		await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('ad_configs', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(JSON.stringify(safeConfigs), JSON.stringify(safeConfigs)).run();
		return safeConfigs;
	},
	async generateText(user, host, env) {
		let ips = [host];
		if (user.ips) {
			const parsedIps = user.ips
				.split("\n")
				.map((ip) => ip.trim())
				.filter((ip) => ip.length > 0);
			if (parsedIps.length > 0) ips = parsedIps;
		}
		const ports = String(user.port || "443")
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
		const fp = user.fingerprint || "chrome";
		const links = [];
		let remVol = "Unlimited";
		if (user.limit_gb) {
			let rem = user.limit_gb - (user.used_gb || 0);
			remVol = rem > 0 ? rem.toFixed(2) + "GB" : "0GB";
		}
		let remTime = "Unlimited";
		if (user.expiry_days && user.created_at) {
			const created = new Date(user.created_at);
			const expiryDate = new Date(created.getTime() + user.expiry_days * 24 * 60 * 60 * 1000);
			const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
			remTime = diffDays > 0 ? diffDays + "Days" : "0Days";
		}
		let remReq = "Unlimited";
		if (user.limit_req) {
			let rem = user.limit_req - (user.used_req || 0);
			remReq = rem > 0 ? rem.toLocaleString() + "Req" : "0Req";
		}
		const adConfigs = await this.getAdConfigs(env);
		adConfigs.forEach((cfg) => {
			if (!cfg || !cfg.enabled || !cfg.remark) return;
			const remark = String(cfg.remark).replace("{volume}", remVol).replace("{days}", remTime).replace("{requests}", remReq);
			links.push(atob("dmxlc3M6Ly8=") + user.uuid + "@0.0.0.0:1?encryption=none&security=none&type=ws&host=" + host + "&path=%2FIn_Panel_Rayeghan_Ast_Va_Gheyre_Ghabele_Foroosh#" + encodeURIComponent(remark));
		});
		const displayName = user.remark_name || user.username;
		ips.forEach((ip) => {
			ports.forEach((portStr) => {
				const isTlsPort = ["443", "2053", "2083", "2087", "2096", "8443"].includes(portStr);
				const tlsVal = isTlsPort ? "tls" : "none";
				const remark = displayName + " | " + ip + " | " + portStr;
				links.push(atob("dmxlc3M6Ly8=") + user.uuid + "@" + ip + ":" + portStr + "?path=%2FIn_Panel_Rayeghan_Ast_Va_Gheyre_Ghabele_Foroosh&security=" + tlsVal + "&encryption=none&insecure=0&host=" + host + "&fp=" + fp + "&type=ws&allowInsecure=0&sni=" + host + "#" + encodeURIComponent(remark));
			});
		});
		const noise = ["# System Update Feed: OK", "# Sync Code: " + Math.random().toString(36).slice(2, 10), "# Version: 2.10.1", "# Description: Secure Node Configurations", ""].join("\n");
		const plainContent = noise + links.join("\n");
		const subContent = btoa(unescape(encodeURIComponent(plainContent)));
		const downloadBytes = Math.floor((user.used_gb || 0) * 1073741824);
		const totalBytes = user.limit_gb ? Math.floor(user.limit_gb * 1073741824) : 0;
		let expireTimestamp = 0;
		if (user.expiry_days && user.created_at) {
			expireTimestamp = Math.floor((new Date(user.created_at).getTime() + user.expiry_days * 86400000) / 1000);
		}
		const subUserInfo = `upload=0; download=${downloadBytes}; total=${totalBytes}; expire=${expireTimestamp}`;
		return new Response(subContent, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "no-store",
				"Subscription-Userinfo": subUserInfo,
			},
		});
	},
};
async function flushExpiredTraffic(env) {
	const now = Date.now();
	for (const [uname, cachedBytes] of GLOBAL_TRAFFIC_CACHE.entries()) {
		const cachedReqs = USER_REQ_CACHE.get(uname) || 0;
		if (cachedBytes <= 0 && cachedReqs <= 0) continue;
		if (GLOBAL_WRITE_LOCK.get(uname)) continue;
		const lastActive = GLOBAL_LAST_ACTIVE_WRITE.get(uname) || 0;
		const activeCount = ACTIVE_CONNECTIONS_COUNT.get(uname) || 0;
		if (activeCount <= 0 || now - lastActive > 25000) {
			GLOBAL_WRITE_LOCK.set(uname, true);
			const deltaGb = cachedBytes / (1024 * 1024 * 1024);
			try {
				await env.DB.prepare("UPDATE users SET used_gb = used_gb + ?, used_req = used_req + ? WHERE username = ?").bind(deltaGb, cachedReqs, uname).run();
			} catch (e) {
				console.error(e.message);
			} finally {
				GLOBAL_WRITE_LOCK.delete(uname);
				GLOBAL_TRAFFIC_CACHE.delete(uname);
				USER_REQ_CACHE.delete(uname);
				GLOBAL_LAST_ACTIVE_WRITE.delete(uname);
			}
		}
	}
}
async function handleVLESS(env, storedData = null, ctx = null, request = null) {
	const clientIP = request ? request.headers.get("CF-Connecting-IP") || "unknown" : "unknown";
	const socketPair = new WebSocketPair();
	const [clientSock, serverSock] = Object.values(socketPair);
	serverSock.accept();
	serverSock.binaryType = "arraybuffer";
	let username = null;
	let tickCount = 0;
	let validUUID = null;
	let userIpLimit = null;
	function addBytes(bytes) {
		if (bytes <= 0) return;
		if (!username) {
			uncountedBytes += bytes;
			return;
		}
		if (uncountedBytes > 0) {
			bytes += uncountedBytes;
			uncountedBytes = 0;
		}
		let current = GLOBAL_TRAFFIC_CACHE.get(username) || 0;
		GLOBAL_TRAFFIC_CACHE.set(username, current + bytes);
		GLOBAL_LAST_ACTIVE_WRITE.set(username, Date.now());
		if (GLOBAL_WRITE_LOCK.get(username)) return;
		let lastDbWrite = GLOBAL_LAST_DB_WRITE.get(username) || 0;
		let now = Date.now();
		let thresholdBytes = 10 * 1024 * 1024;
		if (current >= thresholdBytes || (current > 0 && now - lastDbWrite > 60000)) {
			GLOBAL_WRITE_LOCK.set(username, true);
			let toCommit = GLOBAL_TRAFFIC_CACHE.get(username) || 0;
			let toCommitReq = USER_REQ_CACHE.get(username) || 0;
			if (toCommit <= 0 && toCommitReq <= 0) {
				GLOBAL_WRITE_LOCK.set(username, false);
				return;
			}
			GLOBAL_TRAFFIC_CACHE.set(username, 0);
			USER_REQ_CACHE.set(username, 0);
			GLOBAL_LAST_DB_WRITE.set(username, now);
			let deltaGb = toCommit / (1024 * 1024 * 1024);
			let writeTask = async () => {
				try {
					await env.DB.prepare("UPDATE users SET used_gb = used_gb + ?, used_req = used_req + ? WHERE username = ?").bind(deltaGb, toCommitReq, username).run();
				} catch (e) {
					console.error(e.message);
				} finally {
					GLOBAL_WRITE_LOCK.set(username, false);
				}
			};
			if (ctx) ctx.waitUntil(writeTask());
			else writeTask();
		}
	}
	let isOfflineSet = false;
	const setOffline = () => {
		if (isOfflineSet) return;
		isOfflineSet = true;
		const uname = username;
		if (!uname) return;
		if (clientIP && clientIP !== "unknown" && validUUID) {
			const removeIpTask = async () => {
				try {
					const user = await env.DB.prepare("SELECT active_ips FROM users WHERE uuid = ?").bind(validUUID).first();
					if (user) {
						console.log(`[setOffline Task] DB active_ips for ${uname}: ${user.active_ips}`);
						let activeIps = JSON.parse(user.active_ips || "{}");
						if (activeIps[clientIP]) {
							if (typeof activeIps[clientIP] === "object") {
								activeIps[clientIP].count = (activeIps[clientIP].count || 1) - 1;
								if (activeIps[clientIP].count <= 0) {
									delete activeIps[clientIP];
								}
							} else {
								delete activeIps[clientIP];
							}
							await env.DB.prepare("UPDATE users SET active_ips = ? WHERE uuid = ?").bind(JSON.stringify(activeIps), validUUID).run();
							console.log(`[setOffline Task] Updated active_ips in DB to: ${JSON.stringify(activeIps)}`);
						} else {
							console.log(`[setOffline Task] IP ${clientIP} not found in user's active_ips`);
						}
					}
				} catch (e) {
					console.error(`[setOffline Task] Error: ${e.message}`);
				}
			};
			if (ctx) ctx.waitUntil(removeIpTask());
			else removeIpTask();
		}
		let activeCount = ACTIVE_CONNECTIONS_COUNT.get(uname) || 1;
		activeCount = activeCount - 1;
		if (activeCount <= 0) {
			ACTIVE_CONNECTIONS_COUNT.delete(uname);
			let cachedBytes = GLOBAL_TRAFFIC_CACHE.get(uname) || 0;
			let cachedReqs = USER_REQ_CACHE.get(uname) || 0;
			if ((cachedBytes > 0 || cachedReqs > 0) && !GLOBAL_WRITE_LOCK.get(uname)) {
				GLOBAL_WRITE_LOCK.set(uname, true);
				const deltaGb = cachedBytes / (1024 * 1024 * 1024);
				const writeTask = async () => {
					try {
						await env.DB.prepare("UPDATE users SET used_gb = used_gb + ?, used_req = used_req + ? WHERE username = ?").bind(deltaGb, cachedReqs, uname).run();
					} catch (e) {
						console.error(e.message);
					} finally {
						GLOBAL_WRITE_LOCK.delete(uname);
						GLOBAL_TRAFFIC_CACHE.delete(uname);
						USER_REQ_CACHE.delete(uname);
						GLOBAL_LAST_ACTIVE_WRITE.delete(uname);
					}
				};
				if (ctx) {
					ctx.waitUntil(writeTask());
				} else {
					writeTask();
				}
			} else {
				GLOBAL_TRAFFIC_CACHE.delete(uname);
				USER_REQ_CACHE.delete(uname);
				GLOBAL_LAST_ACTIVE_WRITE.delete(uname);
				GLOBAL_WRITE_LOCK.delete(uname);
			}
		} else {
			ACTIVE_CONNECTIONS_COUNT.set(uname, activeCount);
		}
	};
	const heartbeat = setInterval(async () => {
		if (serverSock.readyState === WebSocket.OPEN) {
			try {
				serverSock.send(new Uint8Array(0));
				if (!validUUID) return;
				tickCount++;
				if (tickCount >= 1) {
					tickCount = 0;
					const user = await env.DB.prepare("SELECT is_active, limit_gb, used_gb, limit_req, used_req, expiry_days, created_at, ip_limit, active_ips FROM users WHERE uuid = ?").bind(validUUID).first();
					if (user) {
						userIpLimit = user.ip_limit;
					}
					let isExpired = false;
					let isIpLimitExpired = false;
					let updatedActiveIps = null;
					if (!user || user.is_active === 0) {
						isExpired = true;
					} else {
						if (user.limit_gb && user.used_gb >= user.limit_gb) {
							isExpired = true;
						}
						if (user.limit_req && user.used_req + (USER_REQ_CACHE.get(username) || 0) >= user.limit_req) {
							isExpired = true;
						}
						if (user.expiry_days && user.created_at) {
							const created = new Date(user.created_at);
							const expiryDate = new Date(created.getTime() + user.expiry_days * 24 * 60 * 60 * 1000);
							if (new Date() > expiryDate) {
								isExpired = true;
							}
						}
						if (!isExpired && clientIP && clientIP !== "unknown") {
							let activeIps = {};
							try {
								activeIps = JSON.parse(user.active_ips || "{}");
							} catch (e) {}
							const nowTime = Date.now();
							let hasChanges = false;
							for (const [ip, data] of Object.entries(activeIps)) {
								const lastSeen = data && typeof data === "object" ? data.timestamp : data;
								if (nowTime - lastSeen > 30000) {
									delete activeIps[ip];
									hasChanges = true;
								}
							}
							if (!activeIps[clientIP]) {
								isIpLimitExpired = true;
								console.log(`[Heartbeat] IP ${clientIP} expired from active_ips due to inactivity.`);
							} else {
								const sortedIps = Object.keys(activeIps).sort((a, b) => {
									const tA = activeIps[a] && typeof activeIps[a] === "object" ? activeIps[a].timestamp : activeIps[a];
									const tB = activeIps[b] && typeof activeIps[b] === "object" ? activeIps[b].timestamp : activeIps[b];
									return tB - tA;
								});
								const clientIpIndex = sortedIps.indexOf(clientIP);
								if (user.ip_limit && user.ip_limit > 0 && clientIpIndex >= user.ip_limit) {
									isIpLimitExpired = true;
									console.log(`[Heartbeat] IP Limit Exceeded. Client IP index ${clientIpIndex} >= limit ${user.ip_limit}.`);
								}
							}
							if (hasChanges || isIpLimitExpired) {
								updatedActiveIps = JSON.stringify(activeIps);
							}
						}
					}
					if (isExpired) {
						await env.DB.prepare("UPDATE users SET is_active = 0, last_active = 0 WHERE uuid = ?").bind(validUUID).run();
						clearInterval(heartbeat);
						closeSocketQuietly(serverSock);
						return;
					}
					if (isIpLimitExpired) {
						console.log(`[Heartbeat] Terminating socket for user ${username}.`);
						clearInterval(heartbeat);
						closeSocketQuietly(serverSock);
						return;
					}
					const now = Date.now();
					const lastRecorded = GLOBAL_LAST_ACTIVE_WRITE.get(username) || 0;
					if (now - lastRecorded > 15000 || updatedActiveIps !== null) {
						GLOBAL_LAST_ACTIVE_WRITE.set(username, now);
						if (updatedActiveIps !== null) {
							await env.DB.prepare("UPDATE users SET last_active = ?, active_ips = ? WHERE username = ?").bind(now, updatedActiveIps, username).run();
						} else {
							await env.DB.prepare("UPDATE users SET last_active = ? WHERE username = ?").bind(now, username).run();
						}
					}
				}
			} catch (e) {}
		} else {
			clearInterval(heartbeat);
		}
	}, 15000);
	let remoteConnWrapper = { socket: null, connectingPromise: null, retryConnect: null };
	let reqUUID = null;
	let isHeaderParsed = false;
	let isHeaderParsing = false;
	let isDnsQuery = false;
	let chunkBuffer = new Uint8Array(0);
	let uncountedBytes = 0;
	const proxyIP = storedData?.proxy_ip || "proxyip.cmliussss.net";
	let wsChain = Promise.resolve();
	let wsStopped = false,
		wsFailed = false,
		wsFinished = false;
	let wsQueueBytes = 0,
		wsQueueItems = 0;
	let currentSocketWriter = null,
		activeRemoteWriter = null;
	const releaseRemoteWriter = () => {
		if (activeRemoteWriter) {
			try {
				activeRemoteWriter.releaseLock();
			} catch (e) {}
			activeRemoteWriter = null;
		}
		currentSocketWriter = null;
	};
	const getRemoteWriter = () => {
		const s = remoteConnWrapper.socket;
		if (!s) return null;
		if (s !== currentSocketWriter) {
			releaseRemoteWriter();
			currentSocketWriter = s;
			activeRemoteWriter = s.writable.getWriter();
		}
		return activeRemoteWriter;
	};
	const upstreamQueue = createUpstreamQueue({
		getWriter: getRemoteWriter,
		releaseWriter: releaseRemoteWriter,
		retryConnect: async () => {
			if (typeof remoteConnWrapper.retryConnect === "function") {
				await remoteConnWrapper.retryConnect();
			}
		},
		closeConnection: () => {
			try {
				remoteConnWrapper.socket?.close();
			} catch (e) {}
			closeSocketQuietly(serverSock);
		},
		name: "VlessWSQueue",
	});
	const writeToRemote = async (chunk, allowRetry = true) => {
		return upstreamQueue.writeAndAwait(chunk, allowRetry);
	};
	const processWsMessage = async (chunk) => {
		const bytes = chunk.byteLength || 0;
		await addBytes(bytes);
		if (isDnsQuery) {
			await forwardVlessUDP(chunk, serverSock, null, addBytes);
			return;
		}
		if (await writeToRemote(chunk)) return;
		if (!isHeaderParsed) {
			chunkBuffer = concatBytes(chunkBuffer, chunk);
			if (chunkBuffer.byteLength < 24) return;
			if (isHeaderParsing) return;
			isHeaderParsing = true;
			reqUUID = extractUUIDFromVless(chunkBuffer);
			if (!reqUUID) {
				serverSock.close();
				return;
			}
			let user = null;
			try {
				user = await env.DB.prepare("SELECT * FROM users WHERE uuid = ?").bind(reqUUID).first();
			} catch (e) {}
			if (isOfflineSet || serverSock.readyState !== WebSocket.OPEN) {
				return;
			}
			if (!user || user.is_active === 0) {
				serverSock.close();
				return;
			}
			if (user.limit_gb && user.used_gb >= user.limit_gb) {
				serverSock.close();
				return;
			}
			if (user.limit_req && user.used_req + (USER_REQ_CACHE.get(user.username) || 0) >= user.limit_req) {
				serverSock.close();
				return;
			}
			if (user.expiry_days && user.created_at) {
				const created = new Date(user.created_at);
				const expiryDate = new Date(created.getTime() + user.expiry_days * 24 * 60 * 60 * 1000);
				if (new Date() > expiryDate) {
					try {
						await env.DB.prepare("UPDATE users SET is_active = 0, last_active = 0 WHERE uuid = ?").bind(reqUUID).run();
					} catch (e) {}
					serverSock.close();
					return;
				}
			}
			userIpLimit = user.ip_limit;
			if (clientIP && clientIP !== "unknown") {
				console.log(`[VLESS Handshake] User: ${user.username}, clientIP: ${clientIP}, active_ips in DB: ${user.active_ips}`);
				let activeIps = {};
				try {
					activeIps = JSON.parse(user.active_ips || "{}");
				} catch (e) {}
				const now = Date.now();
				for (const [ip, data] of Object.entries(activeIps)) {
					const lastSeen = data && typeof data === "object" ? data.timestamp : data;
					if (now - lastSeen > 30000) {
						delete activeIps[ip];
					}
				}
				if (!activeIps[clientIP]) {
					const sortedIps = Object.keys(activeIps).sort((a, b) => {
						const tA = activeIps[a] && typeof activeIps[a] === "object" ? activeIps[a].timestamp : activeIps[a];
						const tB = activeIps[b] && typeof activeIps[b] === "object" ? activeIps[b].timestamp : activeIps[b];
						return tB - tA;
					});
					console.log(`[VLESS Handshake] Non-expired active IPs: ${JSON.stringify(activeIps)}, count: ${sortedIps.length}, limit: ${user.ip_limit}`);
					if (user.ip_limit && user.ip_limit > 0 && sortedIps.length >= user.ip_limit) {
						console.log(`[VLESS Handshake] BLOCKED user ${user.username} because sortedIps.length (${sortedIps.length}) >= limit (${user.ip_limit})`);
						serverSock.close();
						return;
					}
					activeIps[clientIP] = { timestamp: now, count: 1 };
				} else {
					if (typeof activeIps[clientIP] === "object") {
						activeIps[clientIP].timestamp = now;
						activeIps[clientIP].count = (activeIps[clientIP].count || 0) + 1;
					} else {
						activeIps[clientIP] = { timestamp: now, count: 1 };
					}
					console.log(`[VLESS Handshake] Reconnected from same IP: ${clientIP}, count: ${activeIps[clientIP].count}`);
				}
				try {
					await env.DB.prepare("UPDATE users SET active_ips = ?, last_active = ? WHERE uuid = ?").bind(JSON.stringify(activeIps), now, reqUUID).run();
					console.log(`[VLESS Handshake] Successfully updated active_ips to: ${JSON.stringify(activeIps)}`);
				} catch (e) {
					console.error(`[VLESS Handshake] DB Update Error: ${e.message}`);
				}
			}
			validUUID = reqUUID;
			username = user.username;
			isHeaderParsed = true;
			let currentReqs = USER_REQ_CACHE.get(username) || 0;
			USER_REQ_CACHE.set(username, currentReqs + 1);
			let activeCount = ACTIVE_CONNECTIONS_COUNT.get(username) || 0;
			ACTIVE_CONNECTIONS_COUNT.set(username, activeCount + 1);
			if (activeCount === 0) {
				const setOnlineTask = async () => {
					try {
						const now = Date.now();
						GLOBAL_LAST_ACTIVE_WRITE.set(username, now);
						await env.DB.prepare("UPDATE users SET last_active = ? WHERE username = ?").bind(now, username).run();
					} catch (e) {}
				};
				if (ctx) ctx.waitUntil(setOnlineTask());
				else setOnlineTask();
			}
			try {
				let offset = 17;
				const optLen = chunkBuffer[offset++];
				offset += optLen;
				const cmd = chunkBuffer[offset++];
				const port = (chunkBuffer[offset++] << 8) | chunkBuffer[offset++];
				const addrType = chunkBuffer[offset++];
				let addr = "";
				if (addrType === 1) {
					addr = `${chunkBuffer[offset++]}.${chunkBuffer[offset++]}.${chunkBuffer[offset++]}.${chunkBuffer[offset++]}`;
				} else if (addrType === 2) {
					const domainLen = chunkBuffer[offset++];
					addr = new TextDecoder().decode(chunkBuffer.slice(offset, offset + domainLen));
					offset += domainLen;
				} else if (addrType === 3) {
					offset += 16;
					addr = "ipv6-unsupported";
				}
				const rawData = chunkBuffer.slice(offset);
				const respHeader = new Uint8Array([chunkBuffer[0], 0]);
				if (cmd === 2) {
					if (port === 53) {
						isDnsQuery = true;
						await forwardVlessUDP(rawData, serverSock, respHeader, addBytes);
					} else {
						serverSock.close();
					}
					return;
				}
				const connectTCP = async (dataPayload = null, useFallback = true) => {
					if (remoteConnWrapper.connectingPromise) {
						await remoteConnWrapper.connectingPromise;
						return;
					}
					const task = (async () => {
						let s = null;
						try {
							s = await connectDirect(addr, port, dataPayload);
						} catch (err) {
							if (useFallback && proxyIP) {
								s = await connectDirect(proxyIP, port, dataPayload);
							} else {
								throw err;
							}
						}
						remoteConnWrapper.socket = s;
						s.closed.catch(() => {}).finally(() => closeSocketQuietly(serverSock));
						connectStreams(s, serverSock, respHeader, null, (b) => {
							addBytes(b);
						});
					})();
					remoteConnWrapper.connectingPromise = task;
					try {
						await task;
					} finally {
						if (remoteConnWrapper.connectingPromise === task) {
							remoteConnWrapper.connectingPromise = null;
						}
					}
				};
				remoteConnWrapper.retryConnect = async () => connectTCP(null, false);
				await connectTCP(rawData, true);
			} catch (e) {
				serverSock.close();
			}
		}
	};
	const handleWsError = (err) => {
		if (wsFailed) return;
		wsFailed = true;
		wsStopped = true;
		wsQueueBytes = 0;
		wsQueueItems = 0;
		upstreamQueue.clear();
		releaseRemoteWriter();
		closeSocketQuietly(serverSock);
		setOffline();
	};
	const pushToChain = (task) => {
		wsChain = wsChain.then(task).catch(handleWsError);
	};
	serverSock.addEventListener("message", (event) => {
		if (wsStopped || wsFailed) return;
		const size = event.data.byteLength || 0;
		const nextBytes = wsQueueBytes + size;
		const nextItems = wsQueueItems + 1;
		if (nextBytes > UPSTREAM_QUEUE_MAX_BYTES || nextItems > UPSTREAM_QUEUE_MAX_ITEMS) {
			handleWsError(new Error("ws queue overflow"));
			return;
		}
		wsQueueBytes = nextBytes;
		wsQueueItems = nextItems;
		pushToChain(async () => {
			wsQueueBytes = Math.max(0, wsQueueBytes - size);
			wsQueueItems = Math.max(0, wsQueueItems - 1);
			if (wsFailed) return;
			await processWsMessage(event.data);
		});
	});
	serverSock.addEventListener("close", () => {
		clearInterval(heartbeat);
		closeSocketQuietly(serverSock);
		setOffline();
		if (wsFinished) return;
		wsFinished = true;
		wsStopped = true;
		pushToChain(async () => {
			if (wsFailed) return;
			await upstreamQueue.awaitEmpty();
			releaseRemoteWriter();
		});
	});
	serverSock.addEventListener("error", (err) => {
		handleWsError(err);
	});
	return new Response(null, { status: 101, webSocket: clientSock });
}
async function getCfUsage(env) {
	if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { today: 0, total: 0 };
	try {
		const now = new Date();
		const startOfDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).toISOString();
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
		const q = `query {
      viewer {
        accounts(filter: {accountTag: "${env.CF_ACCOUNT_ID}"}) {
          today: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: "${startOfDay}"}) {
            sum { requests }
          }
          total: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: "${thirtyDaysAgo}"}) {
            sum { requests }
          }
        }
      }
    }`;
		const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
			method: "POST",
			headers: { Authorization: "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json" },
			body: JSON.stringify({ query: q }),
		});
		const j = await res.json();
		const acc = j?.data?.viewer?.accounts?.[0];
		const todayReqs = acc?.today?.[0]?.sum?.requests || 0;
		const totalReqs = acc?.total?.[0]?.sum?.requests || todayReqs;
		return { today: todayReqs, total: totalReqs };
	} catch (e) {
		return { today: 0, total: 0 };
	}
}
function isIPv4(value) {
	const parts = String(value || "").split(".");
	return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}
function stripIPv6Brackets(hostname = "") {
	const host = String(hostname || "").trim();
	return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}
function isIPHostname(hostname = "") {
	const host = stripIPv6Brackets(hostname);
	if (isIPv4(host)) return true;
	if (!host.includes(":")) return false;
	try {
		new URL(`http://[${host}]/`);
		return true;
	} catch (e) {
		return false;
	}
}
function convertToUint8Array(data) {
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return new Uint8Array(data || 0);
}
function concatBytes(...chunkList) {
	const chunks = chunkList.map(convertToUint8Array);
	const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		result.set(c, offset);
		offset += c.byteLength;
	}
	return result;
}
function closeSocketQuietly(socket) {
	try {
		if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
			socket.close();
		}
	} catch (e) {}
}
async function dohQuery(domain, recordType) {
	const cacheKey = `${domain}:${recordType}`;
	if (DNS_CACHE.has(cacheKey)) {
		const cached = DNS_CACHE.get(cacheKey);
		if (Date.now() < cached.expires) return cached.data;
		DNS_CACHE.delete(cacheKey);
	}
	try {
		const typeMap = { A: 1, AAAA: 28 };
		const qtype = typeMap[recordType.toUpperCase()] || 1;
		const encodeDomain = (name) => {
			const parts = name.endsWith(".") ? name.slice(0, -1).split(".") : name.split(".");
			const bufs = [];
			for (const label of parts) {
				const enc = new TextEncoder().encode(label);
				bufs.push(new Uint8Array([enc.length]), enc);
			}
			bufs.push(new Uint8Array([0]));
			return concatBytes(...bufs);
		};
		const qname = encodeDomain(domain);
		const query = new Uint8Array(12 + qname.length + 4);
		const qview = new DataView(query.buffer);
		qview.setUint16(0, crypto.getRandomValues(new Uint16Array(1))[0]);
		qview.setUint16(2, 0x0100);
		qview.setUint16(4, 1);
		query.set(qname, 12);
		qview.setUint16(12 + qname.length, qtype);
		qview.setUint16(12 + qname.length + 2, 1);
		const response = await fetch(DOH_RESOLVER, {
			method: "POST",
			headers: {
				"Content-Type": "application/dns-message",
				Accept: "application/dns-message",
			},
			body: query,
		});
		if (!response.ok) return [];
		const buf = new Uint8Array(await response.arrayBuffer());
		const dv = new DataView(buf.buffer);
		const qdcount = dv.getUint16(4);
		const ancount = dv.getUint16(6);
		const parseName = (pos) => {
			const labels = [];
			let p = pos,
				jumped = false,
				endPos = -1,
				safe = 128;
			while (p < buf.length && safe-- > 0) {
				const len = buf[p];
				if (len === 0) {
					if (!jumped) endPos = p + 1;
					break;
				}
				if ((len & 0xc0) === 0xc0) {
					if (!jumped) endPos = p + 2;
					p = ((len & 0x3f) << 8) | buf[p + 1];
					jumped = true;
					continue;
				}
				labels.push(new TextDecoder().decode(buf.slice(p + 1, p + 1 + len)));
				p += len + 1;
			}
			if (endPos === -1) endPos = p + 1;
			return [labels.join("."), endPos];
		};
		let offset = 12;
		for (let i = 0; i < qdcount; i++) {
			const [, end] = parseName(offset);
			offset = Number(end) + 4;
		}
		const answers = [];
		for (let i = 0; i < ancount && offset < buf.length; i++) {
			const [name, nameEnd] = parseName(offset);
			offset = Number(nameEnd);
			const type = dv.getUint16(offset);
			offset += 2;
			offset += 2;
			const ttl = dv.getUint32(offset);
			offset += 4;
			const rdlen = dv.getUint16(offset);
			offset += 2;
			const rdata = buf.slice(offset, offset + rdlen);
			offset += rdlen;
			let data;
			if (type === 1 && rdlen === 4) {
				data = `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`;
			} else if (type === 28 && rdlen === 16) {
				const segs = [];
				for (let j = 0; j < 16; j += 2) segs.push(((rdata[j] << 8) | rdata[j + 1]).toString(16));
				data = segs.join(":");
			} else {
				data = Array.from(rdata)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
			}
			answers.push({ name, type, TTL: ttl, data });
		}
		DNS_CACHE.set(cacheKey, { data: answers, expires: Date.now() + DNS_CACHE_TTL });
		return answers;
	} catch (e) {
		return [];
	}
}
function createUpstreamQueue({ getWriter, releaseWriter, retryConnect, closeConnection, name = "UpstreamQueue" }) {
	let chunks = [];
	let head = 0;
	let queuedBytes = 0;
	let draining = false;
	let closed = false;
	let bundleBuffer = null;
	let idleResolvers = [];
	let activeCompletions = null;
	const settleCompletions = (completions, err = null) => {
		if (!completions) return;
		for (const comp of completions) {
			if (comp) {
				if (err) comp.reject(err);
				else comp.resolve();
			}
		}
	};
	const rejectQueued = (err) => {
		for (let i = head; i < chunks.length; i++) {
			const item = chunks[i];
			if (item && item.completions) settleCompletions(item.completions, err);
		}
	};
	const compact = () => {
		if (head > 32 && head * 2 >= chunks.length) {
			chunks = chunks.slice(head);
			head = 0;
		}
	};
	const resolveIdle = () => {
		if (queuedBytes || draining || !idleResolvers.length) return;
		const resolvers = idleResolvers;
		idleResolvers = [];
		for (const resolve of resolvers) resolve();
	};
	const clear = (err = null) => {
		const closeErr = err || (closed ? new Error(`${name}: queue closed`) : null);
		if (closeErr) {
			rejectQueued(closeErr);
			settleCompletions(activeCompletions, closeErr);
			activeCompletions = null;
		}
		chunks = [];
		head = 0;
		queuedBytes = 0;
		resolveIdle();
	};
	const shift = () => {
		if (head >= chunks.length) return null;
		const item = chunks[head];
		chunks[head++] = undefined;
		queuedBytes -= item.chunk.byteLength;
		compact();
		return item;
	};
	const bundle = () => {
		const first = shift();
		if (!first) return null;
		if (head >= chunks.length || first.chunk.byteLength >= UPSTREAM_BUNDLE_TARGET_BYTES) return first;
		let byteLength = first.chunk.byteLength;
		let end = head;
		let allowRetry = first.allowRetry;
		let completions = first.completions || null;
		while (end < chunks.length) {
			const next = chunks[end];
			const nextLength = byteLength + next.chunk.byteLength;
			if (nextLength > UPSTREAM_BUNDLE_TARGET_BYTES) break;
			byteLength = nextLength;
			allowRetry = allowRetry && next.allowRetry;
			if (next.completions) completions = completions ? completions.concat(next.completions) : next.completions;
			end++;
		}
		if (end === head) return first;
		const output = (bundleBuffer ||= new Uint8Array(UPSTREAM_BUNDLE_TARGET_BYTES));
		output.set(first.chunk);
		let offset = first.chunk.byteLength;
		while (head < end) {
			const next = chunks[head];
			chunks[head++] = undefined;
			queuedBytes -= next.chunk.byteLength;
			output.set(next.chunk, offset);
			offset += next.chunk.byteLength;
		}
		compact();
		return { chunk: output.subarray(0, byteLength), allowRetry, completions };
	};
	const drain = async () => {
		if (draining || closed) return;
		draining = true;
		try {
			for (;;) {
				if (closed) break;
				const item = bundle();
				if (!item) break;
				let writer = getWriter();
				if (!writer) throw new Error(`${name}: remote writer unavailable`);
				const completions = item.completions || null;
				activeCompletions = completions;
				try {
					try {
						await writer.write(item.chunk);
					} catch (err) {
						releaseWriter?.();
						if (!item.allowRetry || typeof retryConnect !== "function") throw err;
						await retryConnect();
						writer = getWriter();
						if (!writer) throw err;
						await writer.write(item.chunk);
					}
					settleCompletions(completions);
				} catch (err) {
					settleCompletions(completions, err);
					throw err;
				} finally {
					if (activeCompletions === completions) activeCompletions = null;
				}
			}
		} catch (err) {
			closed = true;
			clear(err);
			try {
				closeConnection?.(err);
			} catch (_) {}
		} finally {
			draining = false;
			if (!closed && head < chunks.length) queueMicrotask(drain);
			else resolveIdle();
		}
	};
	const enqueue = (data, allowRetry = true, waitForFlush = false) => {
		if (closed) return false;
		if (!getWriter()) return false;
		const chunk = convertToUint8Array(data);
		if (!chunk.byteLength) return true;
		const nextBytes = queuedBytes + chunk.byteLength;
		const nextItems = chunks.length - head + 1;
		if (nextBytes > UPSTREAM_QUEUE_MAX_BYTES || nextItems > UPSTREAM_QUEUE_MAX_ITEMS) {
			closed = true;
			const err = Object.assign(new Error(`${name}: upload queue overflow (${nextBytes}B/${nextItems})`), { isQueueOverflow: true });
			clear(err);
			try {
				closeConnection?.(err);
			} catch (_) {}
			throw err;
		}
		let completionPromise = null;
		let completions = null;
		if (waitForFlush) {
			completions = [];
			completionPromise = new Promise((resolve, reject) => completions.push({ resolve, reject }));
		}
		chunks.push({ chunk, allowRetry, completions });
		queuedBytes = nextBytes;
		if (!draining) queueMicrotask(drain);
		return waitForFlush ? completionPromise.then(() => true) : true;
	};
	return {
		writeAndAwait(data, allowRetry = true) {
			return enqueue(data, allowRetry, true);
		},
		async awaitEmpty() {
			if (!queuedBytes && !draining) return;
			await new Promise((resolve) => idleResolvers.push(resolve));
		},
		clear() {
			closed = true;
			clear();
		},
	};
}
function createDownstreamSender(webSocket, headerData = null) {
	const packetCap = DOWNSTREAM_GRAIN_BYTES;
	const tailBytes = DOWNSTREAM_GRAIN_TAIL_THRESHOLD;
	const lowWaterBytes = Math.max(4096, tailBytes << 3);
	let header = headerData;
	let pendingBuffer = new Uint8Array(packetCap);
	let pendingBytes = 0;
	let flushTimer = null;
	let microtaskQueued = false;
	let generation = 0;
	let scheduledGeneration = 0;
	let waitRounds = 0;
	let flushPromise = null;
	const sendRawChunk = async (chunk) => {
		if (webSocket.readyState !== WebSocket.OPEN) throw new Error("ws.readyState is not open");
		webSocket.send(chunk);
	};
	const attachResponseHeader = (chunk) => {
		if (!header) return chunk;
		const merged = new Uint8Array(header.length + chunk.byteLength);
		merged.set(header, 0);
		merged.set(chunk, header.length);
		header = null;
		return merged;
	};
	const flush = async () => {
		while (flushPromise) await flushPromise;
		if (flushTimer) clearTimeout(flushTimer);
		flushTimer = null;
		microtaskQueued = false;
		if (!pendingBytes) return;
		const output = pendingBuffer.subarray(0, pendingBytes).slice();
		pendingBuffer = new Uint8Array(packetCap);
		pendingBytes = 0;
		waitRounds = 0;
		flushPromise = sendRawChunk(output).finally(() => {
			flushPromise = null;
		});
		return flushPromise;
	};
	const scheduleFlush = () => {
		if (flushTimer || microtaskQueued) return;
		microtaskQueued = true;
		scheduledGeneration = generation;
		queueMicrotask(() => {
			microtaskQueued = false;
			if (!pendingBytes || flushTimer) return;
			if (packetCap - pendingBytes < tailBytes) {
				flush().catch(() => closeSocketQuietly(webSocket));
				return;
			}
			flushTimer = setTimeout(
				() => {
					flushTimer = null;
					if (!pendingBytes) return;
					if (packetCap - pendingBytes < tailBytes) {
						flush().catch(() => closeSocketQuietly(webSocket));
						return;
					}
					if (waitRounds < 2 && (generation !== scheduledGeneration || pendingBytes < lowWaterBytes)) {
						waitRounds++;
						scheduledGeneration = generation;
						scheduleFlush();
						return;
					}
					flush().catch(() => closeSocketQuietly(webSocket));
				},
				Math.max(DOWNSTREAM_GRAIN_SILENT_MS, 1),
			);
		});
	};
	return {
		async sendDirect(data) {
			let chunk = convertToUint8Array(data);
			if (!chunk.byteLength) return;
			chunk = attachResponseHeader(chunk);
			await sendRawChunk(chunk);
		},
		async send(data) {
			let chunk = convertToUint8Array(data);
			if (!chunk.byteLength) return;
			chunk = attachResponseHeader(chunk);
			let offset = 0;
			const totalBytes = chunk.byteLength;
			while (offset < totalBytes) {
				if (!pendingBytes && totalBytes - offset >= packetCap) {
					const sendBytes = Math.min(packetCap, totalBytes - offset);
					const view = offset || sendBytes !== totalBytes ? chunk.subarray(offset, offset + sendBytes) : chunk;
					await sendRawChunk(view);
					offset += sendBytes;
					continue;
				}
				const copyBytes = Math.min(packetCap - pendingBytes, totalBytes - offset);
				pendingBuffer.set(chunk.subarray(offset, offset + copyBytes), pendingBytes);
				pendingBytes += copyBytes;
				offset += copyBytes;
				generation++;
				if (pendingBytes === packetCap || packetCap - pendingBytes < tailBytes) await flush();
				else scheduleFlush();
			}
		},
		flush,
	};
}
async function waitForBackpressure(ws) {
	if (typeof ws.bufferedAmount === "number") {
		while (ws.bufferedAmount > 256 * 1024) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}
}
async function connectStreams(remoteSocket, webSocket, headerData, retryFunc, onBytes) {
	let header = headerData,
		hasData = false,
		reader,
		useBYOB = false;
	const BYOB_LIMIT = 64 * 1024;
	const downstreamSender = createDownstreamSender(webSocket, header);
	header = null;
	try {
		reader = remoteSocket.readable.getReader({ mode: "byob" });
		useBYOB = true;
	} catch (e) {
		reader = remoteSocket.readable.getReader();
	}
	try {
		if (!useBYOB) {
			while (true) {
				await waitForBackpressure(webSocket);
				const { done, value } = await reader.read();
				if (done) break;
				if (!value || value.byteLength === 0) continue;
				hasData = true;
				if (typeof onBytes === "function") onBytes(value.byteLength);
				await downstreamSender.send(value);
			}
		} else {
			let readBuffer = new ArrayBuffer(BYOB_LIMIT);
			while (true) {
				await waitForBackpressure(webSocket);
				const { done, value } = await reader.read(new Uint8Array(readBuffer, 0, BYOB_LIMIT));
				if (done) break;
				if (!value || value.byteLength === 0) continue;
				hasData = true;
				if (typeof onBytes === "function") onBytes(value.byteLength);
				if (value.byteLength >= DOWNSTREAM_GRAIN_BYTES) {
					await downstreamSender.flush();
					await downstreamSender.sendDirect(value);
					readBuffer = new ArrayBuffer(BYOB_LIMIT);
				} else {
					await downstreamSender.send(value);
					readBuffer = value.buffer.byteLength >= BYOB_LIMIT ? value.buffer : new ArrayBuffer(BYOB_LIMIT);
				}
			}
		}
		await downstreamSender.flush();
	} catch (err) {
		closeSocketQuietly(webSocket);
	} finally {
		try {
			reader.cancel();
		} catch (e) {}
		try {
			reader.releaseLock();
		} catch (e) {}
	}
	if (!hasData && retryFunc) await retryFunc();
}
async function buildRaceCandidates(address, port) {
	if (!PRELOAD_RACE_DIAL || isIPHostname(address)) return null;
	const [aRecords, aaaaRecords] = await Promise.all([dohQuery(address, "A"), dohQuery(address, "AAAA")]);
	const ipv4List = [
		...new Set(
			aRecords.flatMap((r) => {
				return r.type === 1 && typeof r.data === "string" && isIPv4(r.data) ? [r.data] : [];
			}),
		),
	];
	const ipv6List = [
		...new Set(
			aaaaRecords.flatMap((r) => {
				return r.type === 28 && typeof r.data === "string" && isIPHostname(r.data) ? [r.data] : [];
			}),
		),
	];
	const limit = Math.max(1, TCP_CONCURRENCY | 0);
	const ipList = ipv4List.length >= limit ? ipv4List.slice(0, limit) : ipv4List.concat(ipv6List.slice(0, limit - ipv4List.length));
	if (ipList.length === 0) return null;
	return ipList.map((hostname, attempt) => ({ hostname, port, attempt, resolvedFrom: address }));
}
async function connectDirect(address, port, initialData = null) {
	const raceCandidates = await buildRaceCandidates(address, port);
	const candidates = raceCandidates || Array.from({ length: TCP_CONCURRENCY }, () => ({ hostname: address, port }));
	const openConnection = async (host, prt) => {
		const socket = connect({ hostname: host, port: prt });
		await Promise.race([socket.opened, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000))]);
		return socket;
	};
	if (candidates.length === 1) {
		const s = await openConnection(candidates[0].hostname, candidates[0].port);
		if (initialData && initialData.byteLength > 0) {
			const w = s.writable.getWriter();
			await w.write(convertToUint8Array(initialData));
			w.releaseLock();
		}
		return s;
	}
	const attempts = candidates.map((c) => openConnection(c.hostname, c.port).then((socket) => ({ socket, candidate: c })));
	let winner = null;
	try {
		winner = await Promise.any(attempts);
		if (initialData && initialData.byteLength > 0) {
			const w = winner.socket.writable.getWriter();
			await w.write(convertToUint8Array(initialData));
			w.releaseLock();
		}
		return winner.socket;
	} finally {
		if (winner) {
			for (const attempt of attempts) {
				attempt
					.then(({ socket }) => {
						if (socket !== winner.socket) {
							try {
								socket.close();
							} catch (e) {}
						}
					})
					.catch(() => {});
			}
		}
	}
}
async function forwardVlessUDP(udpChunk, webSocket, respHeader, onBytes) {
	const requestData = convertToUint8Array(udpChunk);
	try {
		const tcpSocket = connect({ hostname: "8.8.4.4", port: 53 });
		let vlessHeader = respHeader;
		const writer = tcpSocket.writable.getWriter();
		await writer.write(requestData);
		writer.releaseLock();
		await tcpSocket.readable.pipeTo(
			new WritableStream({
				async write(chunk) {
					const response = convertToUint8Array(chunk);
					if (typeof onBytes === "function") onBytes(response.byteLength);
					if (webSocket.readyState !== WebSocket.OPEN) return;
					if (vlessHeader) {
						const merged = new Uint8Array(vlessHeader.length + response.byteLength);
						merged.set(vlessHeader, 0);
						merged.set(response, vlessHeader.length);
						webSocket.send(merged.buffer);
						vlessHeader = null;
					} else {
						webSocket.send(response);
					}
				},
			}),
		);
	} catch (e) {}
}
function extractUUIDFromVless(data) {
	if (data.byteLength < 17) return null;
	const hex = [...data.slice(1, 17)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}
function trackRequest(env, ctx) {
	GLOBAL_REQ_COUNT++;
	const now = Date.now();
	if (now - GLOBAL_LAST_REQ_WRITE > 15000 && GLOBAL_REQ_COUNT > 0) {
		GLOBAL_LAST_REQ_WRITE = now;
		const countToSave = GLOBAL_REQ_COUNT;
		GLOBAL_REQ_COUNT = 0;
		const task = async () => {
			try {
				const today = new Date().toISOString().split("T")[0];
				await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_total', ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + ?").bind(String(countToSave), String(countToSave)).run();
				const lastDateRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_last_date'").first();
				if (!lastDateRow || lastDateRow.value !== today) {
					await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_last_date', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(today, today).run();
					await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_today', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(String(countToSave), String(countToSave)).run();
				} else {
					await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_today', ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + ?").bind(String(countToSave), String(countToSave)).run();
				}
			} catch (e) {}
		};
		if (ctx) ctx.waitUntil(task());
		else task();
	}
}
const HTML_TEMPLATES = {
	nginx: `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>دسترسی به پنل</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['Vazirmatn', 'sans-serif'] },
                    colors: { amoled: { bg: '#000000', card: '#080b0f', input: '#0d1117', border: '#1c2330' } }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50 text-gray-900 dark:bg-amoled-bg dark:text-zinc-100 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white dark:bg-amoled-card border border-gray-200 dark:border-amoled-border rounded-2xl shadow-xl p-8 text-center flex flex-col items-center gap-4">
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full mb-2">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">ورود به پنل مدیریت</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
            برای ورود به پنل، لطفاً عبارت 
            <span class="inline-block px-2 py-1 bg-gray-100 dark:bg-amoled-input border border-gray-200 dark:border-zinc-800 rounded-md font-mono text-blue-500 font-bold mx-1 shadow-sm" dir="ltr">/panel</span> 
            را به انتهای آدرس مرورگر خود اضافه کنید.
        </p>
        <button onclick="window.location.href='/panel'" class="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors duration-200 shadow-lg shadow-blue-600/20 font-bold">
            ورود به پنل
        </button>
    </div>
</body>
</html>`,
	setup: `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تعریف رمز عبور پنل</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['Vazirmatn', 'sans-serif'] },
                    colors: { amoled: { bg: '#000000', card: '#080b0f', input: '#0d1117', border: '#1c2330' } }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50 text-gray-900 dark:bg-amoled-bg dark:text-zinc-100 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white dark:bg-amoled-card border border-gray-200 dark:border-amoled-border rounded-2xl shadow-xl p-6">
        <h2 class="text-xl font-bold mb-2 text-center text-blue-600 dark:text-blue-400">تنظیم رمز عبور جدید</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">این اولین ورود شما به پنل مدیریت است. لطفاً رمز عبور خود را تعیین کنید.</p>
        <form onsubmit="handleSetup(event)" class="space-y-4">
            <div>
                <label class="block text-sm font-medium mb-1.5">رمز عبور</label>
                <input type="password" id="password" class="w-full px-3 py-2 bg-gray-50 dark:bg-amoled-input border border-gray-300 dark:border-amoled-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center font-mono" required minlength="4">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1.5">تکرار رمز عبور</label>
                <input type="password" id="confirm-password" class="w-full px-3 py-2 bg-gray-50 dark:bg-amoled-input border border-gray-300 dark:border-amoled-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center font-mono" required minlength="4">
            </div>
            <button type="submit" id="submit-btn" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition font-bold">ثبت و ورود</button>
        </form>
    </div>
    <script>
        async function handleSetup(event) {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const btn = document.getElementById('submit-btn');
            if (password !== confirmPassword) {
                alert('⚠️ رمز عبور و تکرار آن مطابقت ندارند!');
                return;
            }
            btn.disabled = true;
            btn.innerText = 'در حال ثبت...';
            try {
                const res = await fetch('/api/setup-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('✅ رمز عبور با موفقیت تنظیم شد. در حال ورود...');
                    window.location.reload();
                } else {
                    alert('خطا: ' + (data.error || 'عملیات ناموفق بود'));
                }
            } catch (err) {
                alert('خطا در ارتباط با سرور');
            } finally {
                btn.disabled = false;
                btn.innerText = 'ثبت و ورود';
            }
        }
    </script>
</body>
</html>`,

	login: `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ورود به پنل مدیریت</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['Vazirmatn', 'sans-serif'] },
                    colors: { amoled: { bg: '#000000', card: '#080b0f', input: '#0d1117', border: '#1c2330' } }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50 text-gray-900 dark:bg-amoled-bg dark:text-zinc-100 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white dark:bg-amoled-card border border-gray-200 dark:border-amoled-border rounded-2xl shadow-xl p-6">
        <div id="login-section">
            <h2 class="text-xl font-bold mb-6 text-center text-blue-600 dark:text-blue-400">ورود به پنل مدیریت</h2>
            <form onsubmit="handleLogin(event)" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1.5">رمز عبور</label>
                    <input type="password" id="password" class="w-full px-3 py-2 bg-gray-50 dark:bg-amoled-input border border-gray-300 dark:border-amoled-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center font-mono" required>
                </div>
                <button type="submit" id="submit-btn" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition font-bold">ورود</button>
            </form>
            <div class="mt-4 text-center">
                <button onclick="toggleRecovery(true)" class="text-xs text-blue-500 hover:text-blue-600 transition font-medium">بازیابی رمز پنل</button>
            </div>
        </div>
        <div id="recovery-section" class="hidden">
            <h2 class="text-xl font-bold mb-4 text-center text-orange-600 dark:text-orange-400">بازیابی رمز پنل</h2>
            
            <div class="mb-5 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl text-xs leading-relaxed text-orange-800 dark:text-orange-300">
                برای احراز هویت و اثبات مالکیت پنل، از طریق دکمه زیر وارد کلودفلر شوید و توکن دریافتی را کپی کرده و در کادر زیر وارد کنید.
                <a href="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_subdomain%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=RAHIN-Deployer-Token" target="_blank" class="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition shadow-md shadow-orange-500/20">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    دریافت توکن
                </a>
            </div>

            <form onsubmit="handleRecovery(event)" class="space-y-4">
                <div>
                    <input type="password" id="api-token" placeholder="توکن را وارد کنید" class="w-full px-3 py-2 bg-gray-50 dark:bg-amoled-input border border-gray-300 dark:border-amoled-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs text-center font-mono" required>
                </div>
                <div class="flex gap-2 pt-2">
                    <button type="button" onclick="toggleRecovery(false)" class="w-1/3 py-2.5 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-medium rounded-lg text-sm transition">انصراف</button>
                    <button type="submit" id="recover-btn" class="w-2/3 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg text-sm transition font-bold">بازیابی رمز پنل</button>
                </div>
            </form>
        </div>
    </div>
    <script>
        async function handleLogin(event) {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const btn = document.getElementById('submit-btn');
            btn.disabled = true;
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    window.location.reload();
                } else {
                    alert('رمز عبور اشتباه است');
                }
            } catch (err) {
                alert('خطا در ارتباط با سرور');
            } finally {
                btn.disabled = false;
            }
        }
        function toggleRecovery(show) {
            document.getElementById('login-section').classList.toggle('hidden', show);
            document.getElementById('recovery-section').classList.toggle('hidden', !show);
        }
        async function handleRecovery(event) {
            event.preventDefault();
            const apiToken = document.getElementById('api-token').value;
            const btn = document.getElementById('recover-btn');
            btn.disabled = true;
            try {
                const res = await fetch('/api/recover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_token: apiToken })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('رمز عبور با موفقیت حذف شد. در حال انتقال به صفحه تنظیمات اولیه...');
                    window.location.reload();
                } else {
                    alert(data.error || 'خطا در تایید اطلاعات');
                }
            } catch (err) {
                alert('خطا در ارتباط با سرور');
            } finally {
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>`,

	panel: `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAHIN Panel</title>
    <script>
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
            originalWarn(...args);
        };
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['Vazirmatn', 'sans-serif'] },
                    colors: { amoled: { bg: '#000000', card: '#080b0f', input: '#0d1117', border: '#1c2330' } }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Vazirmatn', sans-serif; }
		.dark input[type="checkbox"] {
            filter: invert(1) hue-rotate(180deg);
        }
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #f3f4f6; 
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
            background: #d1d5db; 
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }
        .dark ::-webkit-scrollbar-track {
            background: #080b0f; 
        }
        .dark ::-webkit-scrollbar-thumb {
            background: #1c2330; 
        }
        .dark ::-webkit-scrollbar-thumb:hover {
            background: #2d3748;
        }
        /* استایل اسکرول‌بار برای مرورگر فایرفاکس */
        * {
            scrollbar-width: thin;
            scrollbar-color: #d1d5db #f3f4f6;
        }
        .dark * {
            scrollbar-color: #1c2330 #080b0f;
        }
    </style>
</head>
<body class="bg-gray-50 text-gray-900 dark:bg-amoled-bg dark:text-zinc-100 min-h-screen transition-colors duration-200">
    <header class="border-b border-gray-200 dark:border-amoled-border bg-white dark:bg-amoled-card px-4 py-4">
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex flex-row flex-wrap justify-center items-center gap-3 w-full md:w-auto">
                <h1 class="text-lg font-bold flex items-center gap-2" dir="ltr">
                    RAHIN Panel 
                    <span id="panel-version" class="text-xs px-2 py-0.5 font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">v1.5.10</span>
                </h1>
                <div class="flex items-center gap-3 bg-gray-100 dark:bg-zinc-800/60 px-3 py-1.5 rounded-full border border-gray-200 dark:border-zinc-800/80 shadow-sm flex-shrink-0 w-fit">
                    <a href="https://github.com/rahinvpn445-web/RAHIN-PANEL" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-all transform hover:scale-125 duration-200 flex-shrink-0" title="GitHub">
                        <svg class="w-[22px] h-[22px] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                        </svg>
                    </a>
                    <a href="https://t.me/Rahin_vpn1" target="_blank" rel="noopener noreferrer" class="text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all transform hover:scale-125 duration-200 flex-shrink-0" title="Telegram">
                        <svg class="w-[22px] h-[22px] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.94-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
                        </svg>
                    </a>
                </div>
            </div>
            <div class="flex items-center justify-center gap-3 w-full md:w-auto mt-2 md:mt-0">
			
				<button onclick="restartCore()" 
                        class="p-2 rounded-lg 
                               bg-blue-50 dark:bg-blue-950/30 
                               border border-blue-200 dark:border-blue-900 
                               hover:bg-blue-100 dark:hover:bg-blue-900/50 
                               transition-all duration-200 
                               text-blue-600 dark:text-blue-400 shadow-sm" 
                        title="ری‌استارت هسته ورکر">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                </button>
				
                <button id="theme-toggle" 
                        class="p-2 rounded-lg 
                               bg-amber-50 dark:bg-amber-950/30 
                               border border-amber-200 dark:border-amber-900 
                               hover:bg-amber-100 dark:hover:bg-amber-900/50 
                               transition-all duration-200 
                               text-amber-500 dark:text-amber-400 shadow-sm"
                        title="تغییر تم">
                    <svg id="sun-icon" class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <svg id="moon-icon" class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                    </svg>
                </button>
                
                <button id="update-toggle" onclick="checkForUpdates(true)" 
                        class="p-2 rounded-lg 
                               bg-emerald-50 dark:bg-emerald-950/30 
                               border border-emerald-200 dark:border-emerald-900 
                               hover:bg-emerald-100 dark:hover:bg-emerald-900/50 
                               transition-all duration-200 
                               text-emerald-600 dark:text-emerald-400 
                               relative shadow-sm" 
                        title="Update">
                    
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"></path>
                    </svg>
                    <span id="update-badge" class="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-emerald-50 dark:border-emerald-900 rounded-full hidden animate-pulse"></span>
                </button>
                
                <button onclick="toggleSettingsModal(true)" 
                        class="p-2 rou