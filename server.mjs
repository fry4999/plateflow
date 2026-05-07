import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";

const root = new URL(".", import.meta.url).pathname;
const publicDir = join(root, "public");

loadDotEnv();

const config = {
  port: Number(process.env.PORT || 4321),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:4321",
  sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me-change-me-change-me",
  onshapeClientId: process.env.ONSHAPE_CLIENT_ID || "",
  onshapeClientSecret: process.env.ONSHAPE_CLIENT_SECRET || "",
  onshapeOAuthBase: process.env.ONSHAPE_OAUTH_BASE || "https://oauth.onshape.com",
  onshapeApiBase: process.env.ONSHAPE_API_BASE || "https://cad.onshape.com",
  onshapeScope: process.env.ONSHAPE_OAUTH_SCOPE || "",
  trustProxy: process.env.TRUST_PROXY === "true",
  prod: process.env.NODE_ENV === "production"
};

const sessions = new Map();
const orders = new Map();
const rateBuckets = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  try {
    setSecurityHeaders(req, res);
    if (!rateLimit(req, res)) return;

    const url = new URL(req.url || "/", config.appBaseUrl);
    const session = getSession(req, res);

    if (url.pathname === "/auth/onshape") return onshapeStart(req, res, session, url);
    if (url.pathname === "/auth/onshape/callback") return await onshapeCallback(req, res, session, url);
    if (url.pathname === "/auth/logout") return logout(res, session);
    if (url.pathname === "/api/session") return json(res, 200, publicSession(session));
    if (url.pathname === "/api/onshape/import" && req.method === "POST") return await importOnshape(req, res, session);
    if (url.pathname === "/api/onshape/export-step" && req.method === "POST") return await exportStep(req, res, session);
    if (url.pathname === "/api/orders" && req.method === "POST") return await createOrder(req, res, session);
    if (url.pathname.startsWith("/api/downloads/")) return downloadBlob(res, session, url.pathname.split("/").pop());
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "Not found" });

    return await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.expose ? error.message : "Unexpected server error" });
  }
}).listen(config.port, () => {
  console.log(`FRC PlateFlow listening on ${config.appBaseUrl}`);
});

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function setSecurityHeaders(_req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self' https://*.onshape.com",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
  if (config.prod) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function rateLimit(req, res) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "local";
  const bucketKey = `${ip}:${(req.url || "/").split("?")[0].split("/")[1]}`;
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  if (bucket.count > 180) {
    json(res, 429, { error: "Too many requests" });
    return false;
  }
  return true;
}

function getSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const rawSid = cookies.sid;
  const sid = verifySigned(rawSid);
  if (sid && sessions.has(sid)) return sessions.get(sid);

  const newSid = randomBytes(32).toString("base64url");
  const session = {
    id: newSid,
    csrf: randomBytes(24).toString("base64url"),
    oauthState: null,
    token: null,
    user: null,
    downloads: new Map(),
    createdAt: Date.now()
  };
  sessions.set(newSid, session);
  res.setHeader("Set-Cookie", cookie("sid", sign(newSid), {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.prod,
    path: "/",
    maxAge: 60 * 60 * 8
  }));
  return session;
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("=") || "")];
  }).filter(([key]) => key));
}

function sign(value) {
  const sig = createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function verifySigned(signed) {
  if (!signed || !signed.includes(".")) return null;
  const [value, sig] = signed.split(".");
  const expected = createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

function cookie(name, value, opts) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

function publicSession(session) {
  return {
    authenticated: Boolean(session.token),
    csrfToken: session.csrf,
    user: session.user,
    configured: Boolean(config.onshapeClientId && config.onshapeClientSecret),
    appBaseUrl: config.appBaseUrl
  };
}

function onshapeStart(_req, res, session, url) {
  if (!config.onshapeClientId || !config.onshapeClientSecret) {
    return redirect(res, "/?auth=missing-config");
  }
  const state = randomBytes(24).toString("base64url");
  session.oauthState = state;
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo") || "/");
  session.returnTo = returnTo;

  const auth = new URL("/oauth/authorize", config.onshapeOAuthBase);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", config.onshapeClientId);
  auth.searchParams.set("redirect_uri", `${config.appBaseUrl}/auth/onshape/callback`);
  auth.searchParams.set("state", state);
  if (config.onshapeScope) auth.searchParams.set("scope", config.onshapeScope);
  return redirect(res, auth.toString());
}

async function onshapeCallback(_req, res, session, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== session.oauthState) return redirect(res, "/?auth=state-failed");

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.onshapeClientId,
      client_secret: config.onshapeClientSecret,
      redirect_uri: `${config.appBaseUrl}/auth/onshape/callback`
    });

    const token = await fetchJson(`${config.onshapeOAuthBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    session.token = normalizeToken(token);
    session.oauthState = null;
    session.user = { provider: "onshape", label: "Onshape connected" };
    return redirect(res, session.returnTo || "/?auth=ok");
  } catch (error) {
    console.error("Onshape OAuth callback failed", error);
    const detail = encodeURIComponent(error.expose ? error.message : "Token exchange failed. Check Render environment variables and Onshape redirect URLs.");
    return redirect(res, `/?auth=callback-failed&detail=${detail}`);
  }
}

function logout(res, session) {
  sessions.delete(session.id);
  res.setHeader("Set-Cookie", cookie("sid", "", {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.prod,
    path: "/",
    maxAge: 0
  }));
  return redirect(res, "/");
}

function sanitizeReturnTo(value) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 300);
}

function normalizeToken(token) {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000 - 60_000
  };
}

async function ensureAccessToken(session) {
  if (!session.token) throw httpError(401, "Sign in with Onshape first");
  if (session.token.expiresAt > Date.now()) return session.token.accessToken;
  if (!session.token.refreshToken) throw httpError(401, "Onshape session expired");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.token.refreshToken,
    client_id: config.onshapeClientId,
    client_secret: config.onshapeClientSecret
  });
  const token = await fetchJson(`${config.onshapeOAuthBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  session.token = normalizeToken(token);
  return session.token.accessToken;
}

async function importOnshape(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateImport(body);
  const accessToken = await ensureAccessToken(session);
  const base = normalizeOnshapeBase(input.baseUrl);

  const params = new URLSearchParams({
    elementId: input.elementId,
    withThumbnails: "false",
    includePropertyDefaults: "false"
  });
  if (input.configuration) params.set("configuration", input.configuration);

  const parts = await onshapeJson(accessToken, `${base}/api/v6/parts/d/${input.documentId}/w/${input.workspaceId}?${params}`);
  const normalized = (Array.isArray(parts) ? parts : parts.parts || []).map((part) => normalizePart(part, input));
  return json(res, 200, { parts: normalized, source: input });
}

function normalizePart(part, input) {
  const material = part.material || {};
  const materialName = material.displayName || material.name || material.id || part.customProperties?.Material || "Unassigned";
  const thickness = part.customProperties?.Thickness || part.customProperties?.thickness || "";
  return {
    id: part.partId,
    name: part.name || part.partId,
    material: materialName,
    materialLibrary: material.libraryName || material.libraryId || "",
    bodyType: part.bodyType || "",
    thickness,
    quantity: 1,
    finish: "Deburred",
    source: {
      documentId: input.documentId,
      workspaceId: input.workspaceId,
      elementId: input.elementId,
      partId: part.partId,
      configuration: input.configuration || ""
    }
  };
}

async function exportStep(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateImport(body);
  const accessToken = await ensureAccessToken(session);
  const base = normalizeOnshapeBase(input.baseUrl);

  const exportUrl = `${base}/api/v11/partstudios/d/${input.documentId}/w/${input.workspaceId}/e/${input.elementId}/export/step`;
  const translation = await onshapeJson(accessToken, exportUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8; qs=0.09" },
    body: JSON.stringify({
      storeInDocument: true,
      formatName: "STEP",
      stepVersionString: "AP242",
      grouping: true,
      configuration: input.configuration || undefined
    })
  });

  const done = await pollTranslation(accessToken, base, translation.id || translation.href);
  const resultElementId = done.resultElementIds?.[0];
  if (!resultElementId) throw httpError(502, done.failureReason || "STEP export did not return a downloadable blob");

  const blob = await onshapeBlob(accessToken, `${base}/api/v6/blobelements/d/${input.documentId}/w/${input.workspaceId}/e/${resultElementId}`);
  const downloadId = randomBytes(16).toString("base64url");
  session.downloads.set(downloadId, {
    bytes: blob.bytes,
    contentType: blob.contentType || "application/zip",
    name: safeFileName(`frc-plates-${input.elementId}.step.zip`)
  });
  return json(res, 200, { downloadUrl: `/api/downloads/${downloadId}`, translation: done });
}

async function pollTranslation(accessToken, base, idOrHref) {
  const id = String(idOrHref).split("/").pop();
  for (let i = 0; i < 25; i += 1) {
    const state = await onshapeJson(accessToken, `${base}/api/v9/translations/${id}`);
    if (state.requestState === "DONE") return state;
    if (state.requestState === "FAILED") throw httpError(502, state.failureReason || "Onshape translation failed");
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  throw httpError(504, "STEP export is still running. Try again in a moment.");
}

async function createOrder(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const order = validateOrder(body);
  const id = `Q-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const saved = { id, status: "received", createdAt: new Date().toISOString(), ...order };
  orders.set(id, saved);
  return json(res, 201, saved);
}

function downloadBlob(res, session, id) {
  const download = session.downloads.get(id);
  if (!download) return json(res, 404, { error: "Download not found" });
  res.writeHead(200, {
    "Content-Type": download.contentType,
    "Content-Disposition": `attachment; filename="${download.name}"`,
    "Cache-Control": "private, no-store"
  });
  return res.end(download.bytes);
}

function validateImport(body) {
  const id = /^[a-zA-Z0-9_-]{8,80}$/;
  const input = {
    documentId: String(body.documentId || body.did || "").trim(),
    workspaceId: String(body.workspaceId || body.wid || "").trim(),
    elementId: String(body.elementId || body.eid || "").trim(),
    configuration: String(body.configuration || "").trim(),
    baseUrl: String(body.baseUrl || config.onshapeApiBase).trim()
  };
  if (!id.test(input.documentId)) throw httpError(400, "Invalid document ID");
  if (!id.test(input.workspaceId)) throw httpError(400, "Invalid workspace ID");
  if (!id.test(input.elementId)) throw httpError(400, "Invalid element ID");
  if (input.configuration.length > 1000) throw httpError(400, "Configuration is too long");
  return input;
}

function validateOrder(body) {
  const parts = Array.isArray(body.parts) ? body.parts.slice(0, 200) : [];
  if (!parts.length) throw httpError(400, "Select at least one part");
  const order = {
    teamNumber: String(body.teamNumber || "").replace(/\D/g, "").slice(0, 6),
    contactName: String(body.contactName || "").trim().slice(0, 80),
    email: String(body.email || "").trim().slice(0, 120),
    needBy: String(body.needBy || "").trim().slice(0, 40),
    notes: String(body.notes || "").trim().slice(0, 1000),
    parts: parts.map((part) => ({
      id: String(part.id || "").slice(0, 80),
      name: String(part.name || "").slice(0, 120),
      material: String(part.material || "Unassigned").slice(0, 120),
      thickness: String(part.thickness || "").slice(0, 40),
      quantity: Math.min(999, Math.max(1, Number(part.quantity || 1))),
      finish: String(part.finish || "Deburred").slice(0, 60)
    }))
  };
  if (!order.teamNumber) throw httpError(400, "FRC team number is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) throw httpError(400, "Valid email is required");
  return order;
}

function normalizeOnshapeBase(value) {
  const url = new URL(value);
  if (!/\.onshape\.com$/.test(url.hostname)) throw httpError(400, "Onshape base URL must be an onshape.com host");
  return `${url.protocol}//${url.hostname}`;
}

function requireCsrf(req, session) {
  const header = req.headers["x-csrf-token"];
  if (!header || header !== session.csrf) throw httpError(403, "Invalid CSRF token");
}

async function onshapeJson(accessToken, url, options = {}) {
  return fetchJson(url, {
    ...options,
    headers: {
      Accept: "application/json;charset=UTF-8; qs=0.09",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });
}

async function onshapeBlob(accessToken, url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/octet-stream",
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) throw httpError(response.status, await response.text());
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type")
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw httpError(response.status, text || response.statusText);
  return text ? JSON.parse(text) : {};
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw httpError(413, "Request body too large");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw httpError(400, "Invalid JSON");
  }
}

function httpError(status, message) {
  const error = new Error(String(message).slice(0, 500));
  error.status = status;
  error.expose = status < 500;
  return error;
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return json(res, 403, { error: "Forbidden" });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath)] || "application/octet-stream",
      "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=3600"
    });
    return res.end(content);
  } catch {
    const content = await readFile(join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": mime[".html"], "Cache-Control": "no-store" });
    return res.end(content);
  }
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  return res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  return res.end();
}

function safeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}
