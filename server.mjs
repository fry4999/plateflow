import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";

const root = new URL(".", import.meta.url).pathname;
const publicDir = join(root, "public");

loadDotEnv();

const config = {
  port: Number(process.env.PORT || 4321),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:4321",
  dataPath: process.env.PLATEFLOW_DATA_PATH || join(root, ".plateflow-data.json"),
  databaseUrl: process.env.DATABASE_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me-change-me-change-me",
  onshapeClientId: process.env.ONSHAPE_CLIENT_ID || "",
  onshapeClientSecret: process.env.ONSHAPE_CLIENT_SECRET || "",
  onshapeOAuthBase: process.env.ONSHAPE_OAUTH_BASE || "https://oauth.onshape.com",
  onshapeApiBase: process.env.ONSHAPE_API_BASE || "https://cad.onshape.com",
  onshapeScope: process.env.ONSHAPE_OAUTH_SCOPE || "",
  trustProxy: process.env.TRUST_PROXY === "true",
  prod: process.env.NODE_ENV === "production"
};

const storage = await createStorage();
const store = await storage.load();
const sessions = new Map();
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
    if (url.pathname === "/api/inventory") return json(res, 200, inventorySnapshot());
    if (url.pathname === "/api/dashboard") return json(res, 200, dashboardSnapshot());
    if (url.pathname === "/api/sync-batches") return json(res, 200, syncBatchSnapshot());
    if (url.pathname === "/api/raw-materials" && req.method === "GET") return json(res, 200, { rawMaterials: store.rawMaterials });
    if (url.pathname === "/api/raw-materials" && req.method === "POST") return await addRawMaterial(req, res, session);
    if (url.pathname === "/api/robots") return json(res, 200, { robots: robotSnapshot(inventorySnapshot().parts) });
    if (url.pathname === "/api/audit-log") return json(res, 200, { auditLogs: store.auditLogs.slice(0, 50) });
    if (url.pathname === "/api/onshape/import" && req.method === "POST") return await importOnshape(req, res, session);
    if (url.pathname === "/api/onshape/import-cots" && req.method === "POST") return await importCots(req, res, session);
    if (url.pathname === "/api/onshape/export-step" && req.method === "POST") return await exportStep(req, res, session);
    if (url.pathname === "/api/orders" && req.method === "POST") return await createOrder(req, res, session);
    if (url.pathname.startsWith("/api/downloads/")) return downloadBlob(res, session, url.pathname.split("/").pop());
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "Not found" });

    return await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || "Unexpected server error" });
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

async function createStorage() {
  if (config.databaseUrl) {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: config.databaseUrl,
        ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false }
      });
      await pool.query(`
        create table if not exists plateflow_store (
          id text primary key,
          data jsonb not null,
          updated_at timestamptz not null default now()
        )
      `);
      return {
        async load() {
          const result = await pool.query("select data from plateflow_store where id = $1", ["default"]);
          if (!result.rows.length) {
            const initial = defaultStore();
            await this.save(initial);
            return initial;
          }
          return mergeStore(result.rows[0].data);
        },
        async save(nextStore) {
          await pool.query(
            `insert into plateflow_store (id, data, updated_at)
             values ($1, $2::jsonb, now())
             on conflict (id) do update set data = excluded.data, updated_at = now()`,
            ["default", JSON.stringify(nextStore)]
          );
        }
      };
    } catch (error) {
      console.error("Could not initialize Postgres storage, falling back to local file", error);
    }
  }

  return {
    async load() {
      return loadFileStore();
    },
    async save(nextStore) {
      await writeFile(config.dataPath, JSON.stringify(nextStore, null, 2));
    }
  };
}

function loadFileStore() {
  const fallback = defaultStore();
  if (!existsSync(config.dataPath)) return fallback;
  try {
    return mergeStore(JSON.parse(readFileSync(config.dataPath, "utf8")));
  } catch (error) {
    console.error("Could not read PlateFlow data file", error);
    return fallback;
  }
}

function mergeStore(parsed) {
  const fallback = defaultStore();
  return {
    ...fallback,
    ...parsed,
    teams: Array.isArray(parsed.teams) ? parsed.teams : fallback.teams,
    users: Array.isArray(parsed.users) ? parsed.users : fallback.users,
    robots: Array.isArray(parsed.robots) ? parsed.robots : fallback.robots,
    inventoryRecords: Array.isArray(parsed.inventoryRecords) ? parsed.inventoryRecords : fallback.inventoryRecords,
    syncBatches: Array.isArray(parsed.syncBatches) ? parsed.syncBatches : fallback.syncBatches,
    catalogParts: Array.isArray(parsed.catalogParts) ? parsed.catalogParts : fallback.catalogParts,
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements : fallback.requirements,
    reservations: Array.isArray(parsed.reservations) ? parsed.reservations : fallback.reservations,
    procurementOrders: Array.isArray(parsed.procurementOrders) ? parsed.procurementOrders : fallback.procurementOrders,
    fabricationJobs: Array.isArray(parsed.fabricationJobs) ? parsed.fabricationJobs : fallback.fabricationJobs,
    fileArtifacts: Array.isArray(parsed.fileArtifacts) ? parsed.fileArtifacts : fallback.fileArtifacts,
    vendorMatches: Array.isArray(parsed.vendorMatches) ? parsed.vendorMatches : fallback.vendorMatches,
    rawMaterials: Array.isArray(parsed.rawMaterials) ? parsed.rawMaterials : fallback.rawMaterials,
    inventoryLocations: Array.isArray(parsed.inventoryLocations) ? parsed.inventoryLocations : fallback.inventoryLocations,
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : fallback.auditLogs
  };
}

function defaultStore() {
  const now = new Date().toISOString();
  return {
    teams: [{ id: "team-default", name: "FRC Team", status: "active" }],
    users: [],
    robots: [
      {
        id: "robot-2026",
        season: "2026",
        name: "2026 Robot",
        status: "active",
        subsystems: [
          { id: "drive", name: "Drive", lead: "", status: "designing" },
          { id: "intake", name: "Intake", lead: "", status: "designing" },
          { id: "shooter", name: "Shooter", lead: "", status: "designing" }
        ]
      }
    ],
    inventoryRecords: [],
    syncBatches: [],
    catalogParts: [],
    requirements: [],
    reservations: [],
    procurementOrders: [],
    fabricationJobs: [],
    fileArtifacts: [],
    vendorMatches: [],
    inventoryLocations: [
      { id: "fab-shelf", name: "Fab shelf" },
      { id: "electrical", name: "Electrical bins" },
      { id: "raw-rack", name: "Raw material rack" }
    ],
    rawMaterials: [
      {
        id: "raw-6061-125",
        materialFamily: "aluminum",
        grade: "6061",
        stockType: "sheet",
        dimensions: "0.125 x 24 x 48",
        remainingQuantity: 2,
        unit: "sheets",
        status: "available",
        location: "Raw material rack",
        remnant: false,
        notes: "Common belly pan and gusset stock",
        updatedAt: now
      },
      {
        id: "raw-tube-1x1",
        materialFamily: "aluminum",
        grade: "6061",
        stockType: "tube",
        dimensions: "1 x 1 x 0.062",
        remainingQuantity: 72,
        unit: "in",
        status: "available",
        location: "Raw material rack",
        remnant: true,
        notes: "Use for prototypes or small rails",
        updatedAt: now
      }
    ],
    auditLogs: [
      { id: `A-${now}`, action: "system.initialized", actor: "system", detail: "PlateFlow data store initialized", createdAt: now }
    ]
  };
}

async function persistStore() {
  await storage.save(store);
}

function audit(action, detail, actor = "system") {
  store.auditLogs.unshift({
    id: `A-${new Date().toISOString()}-${randomBytes(2).toString("hex")}`,
    action,
    actor,
    detail,
    createdAt: new Date().toISOString()
  });
  store.auditLogs.splice(200);
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
    sameSite: config.prod ? "None" : "Lax",
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
    return redirect(res, addQuery(session.returnTo || "/", "auth", "ok"));
  } catch (error) {
    console.error("Onshape OAuth callback failed", error);
    const detail = encodeURIComponent(error.expose ? error.message : "Token exchange failed. Check hosting environment variables and Onshape redirect URLs.");
    return redirect(res, `${addQuery(session.returnTo || "/", "auth", "callback-failed")}&detail=${detail}`);
  }
}

function logout(res, session) {
  sessions.delete(session.id);
  res.setHeader("Set-Cookie", cookie("sid", "", {
    httpOnly: true,
    sameSite: config.prod ? "None" : "Lax",
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

function addQuery(path, key, value) {
  const url = new URL(path, config.appBaseUrl);
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
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

  const parts = await onshapeJson(accessToken, `${base}/api/v6/parts/d/${input.documentId}/${input.workspacePath}/${input.workspaceId}?${params}`);
  const normalized = (Array.isArray(parts) ? parts : parts.parts || []).map((part) => normalizePart(part, input));
  const saved = saveInventory(input, normalized, "custom", "Part Studio custom sync");
  return json(res, 200, { parts: normalized, source: input, inventory: saved });
}

async function importCots(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateImport(body);
  await ensureAccessToken(session);

  const rows = Array.isArray(body.rows) && body.rows.length ? body.rows : demoCotsRows();
  const normalized = rows.slice(0, 200).map((row, index) => normalizeCotsRow(row, input, index));
  const saved = saveInventory(input, normalized, "cots", "Assembly BOM procurement sync");
  return json(res, 200, { parts: normalized, source: input, inventory: saved });
}

function saveInventory(input, parts, sourceType, label) {
  const key = `${input.documentId}:${input.workspacePath}:${input.workspaceId}:${input.elementId}:${input.configuration || "default"}`;
  const batchId = `S-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const record = {
    id: key,
    batchId,
    sourceType,
    updatedAt: new Date().toISOString(),
    source: input,
    parts
  };
  const existingIndex = store.inventoryRecords.findIndex((item) => item.id === key);
  if (existingIndex >= 0) store.inventoryRecords.splice(existingIndex, 1, record);
  else store.inventoryRecords.unshift(record);

  const normalizedParts = parts.map((part) => upsertCatalogPart(part, sourceType, batchId));
  upsertOperationalQueue(batchId, sourceType, normalizedParts);
  store.syncBatches.unshift({
    id: batchId,
    label,
    sourceType,
    status: "received",
    partCount: parts.length,
    createdAt: record.updatedAt,
    source: input
  });
  store.syncBatches.splice(100);
  audit("sync.received", `${label}: ${parts.length} item${parts.length === 1 ? "" : "s"}`, "onshape");
  void persistStore().catch((error) => console.error("Could not persist PlateFlow data", error));
  return record;
}

function inventorySnapshot() {
  const records = [...store.inventoryRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const parts = records.flatMap((record) => record.parts.map((part) => ({
    ...part,
    inventoryId: record.id,
    importedAt: record.updatedAt,
    sourceType: record.sourceType
  })));
  return {
    records,
    parts,
    totals: {
      records: records.length,
      parts: parts.length,
      custom: parts.filter((part) => part.sourceType === "custom").length,
      cots: parts.filter((part) => part.sourceType === "cots").length,
      raw: store.rawMaterials.length,
      materials: new Set(parts.map((part) => part.material || "Unassigned")).size,
      procurement: parts.filter((part) => part.sourceType === "cots").length,
      fabrication: parts.filter((part) => part.sourceType === "custom").length,
      lowStock: store.rawMaterials.filter((stock) => Number(stock.remainingQuantity || 0) <= 1).length
    }
  };
}

function syncBatchSnapshot() {
  return { batches: store.syncBatches };
}

function upsertCatalogPart(part, sourceType, syncBatchId) {
  const identity = partIdentity(part, sourceType);
  const now = new Date().toISOString();
  const existing = store.catalogParts.find((item) => item.identity === identity);
  const next = {
    ...(existing || {}),
    id: existing?.id || `part-${randomBytes(6).toString("hex")}`,
    identity,
    sourceType,
    type: sourceType,
    name: part.name,
    category: part.category || (sourceType === "custom" ? "fabricated" : "purchased"),
    material: part.material || "",
    thickness: part.thickness || "",
    vendor: part.vendor || "",
    vendorSku: part.vendorSku || "",
    manufacturer: part.manufacturer || "",
    manufacturerSku: part.manufacturerSku || "",
    process: part.process || "",
    fabricationIntent: part.fabricationIntent || "",
    status: part.status || (sourceType === "custom" ? "extracted" : "needed"),
    onHand: Number(existing?.onHand || 0),
    reserved: Number(existing?.reserved || 0),
    ordered: Number(existing?.ordered || 0),
    quantityNeeded: Number(part.quantity || 1),
    available: Math.max(0, Number(existing?.onHand || 0) - Number(existing?.reserved || 0)),
    defaultLocation: existing?.defaultLocation || "",
    tags: existing?.tags || [],
    source: part.source,
    lastSyncBatchId: syncBatchId,
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };
  if (existing) Object.assign(existing, next);
  else store.catalogParts.unshift(next);
  return next;
}

function partIdentity(part, sourceType) {
  if (sourceType === "cots") {
    const vendor = normalizeKey(part.vendor || "unknown");
    const sku = normalizeKey(part.vendorSku || part.manufacturerSku || part.name);
    return `cots:${vendor}:${sku}`;
  }
  const source = part.source || {};
  const reference = [source.documentId, source.workspaceId, source.elementId, source.partId || part.id].filter(Boolean).join(":");
  return `custom:${normalizeKey(part.partNumber || part.name)}:${reference || normalizeKey(part.id || part.name)}`;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function upsertOperationalQueue(batchId, sourceType, catalogParts) {
  const now = new Date().toISOString();
  if (sourceType === "custom") {
    store.fabricationJobs.unshift({
      id: `F-${batchId.slice(2)}`,
      syncBatchId: batchId,
      status: "queued",
      grouping: groupCustomParts(catalogParts),
      lines: catalogParts.map((part) => ({
        catalogPartId: part.id,
        name: part.name,
        material: part.material,
        thickness: part.thickness,
        process: part.process || "unknown",
        fabricationIntent: part.fabricationIntent || "review_needed",
        quantityNeeded: part.quantityNeeded,
        quantityMade: 0,
        quantityReceived: 0,
        quantityInstalled: 0
      })),
      createdAt: now,
      updatedAt: now
    });
    store.fabricationJobs.splice(100);
    return;
  }

  store.procurementOrders.unshift({
    id: `P-${batchId.slice(2)}`,
    syncBatchId: batchId,
    status: "needed",
    vendorGroups: groupCotsParts(catalogParts),
    lines: catalogParts.map((part) => ({
      catalogPartId: part.id,
      name: part.name,
      vendor: part.vendor || "Unassigned",
      vendorSku: part.vendorSku || "",
      quantityNeeded: part.quantityNeeded,
      quantityOrdered: 0,
      quantityReceived: 0,
      status: "needed"
    })),
    createdAt: now,
    updatedAt: now
  });
  store.procurementOrders.splice(100);
}

function groupCustomParts(parts) {
  return Object.values(parts.reduce((groups, part) => {
    const key = [part.material || "Unassigned", part.thickness || "n/a", part.process || "unknown"].join(" / ");
    groups[key] ||= { key, count: 0 };
    groups[key].count += Number(part.quantityNeeded || 1);
    return groups;
  }, {}));
}

function groupCotsParts(parts) {
  return Object.values(parts.reduce((groups, part) => {
    const key = part.vendor || "Unassigned";
    groups[key] ||= { vendor: key, count: 0 };
    groups[key].count += Number(part.quantityNeeded || 1);
    return groups;
  }, {}));
}

function dashboardSnapshot() {
  const inventory = inventorySnapshot();
  const customParts = inventory.parts.filter((part) => part.sourceType === "custom");
  const cotsParts = inventory.parts.filter((part) => part.sourceType === "cots");
  const robots = robotSnapshot(inventory.parts);
  return {
    overview: {
      partsMissing: inventory.parts.reduce((sum, part) => sum + Math.max(0, Number(part.quantity || 1) - Number(part.onHand || 0)), 0),
      partsOnOrder: store.procurementOrders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.quantityOrdered || 0), 0), 0),
      partsInFabrication: customParts.length,
      partsReceivedToday: 0,
      lowStockAlerts: inventory.totals.lowStock,
      activeRobots: robots.length,
      recentSyncBatches: store.syncBatches.slice(0, 6),
      recentActivity: store.auditLogs.slice(0, 8)
    },
    inventory,
    robots,
    fabrication: {
      jobs: store.fabricationJobs.slice(0, 20),
      items: customParts
    },
    procurement: {
      orders: store.procurementOrders.slice(0, 20),
      items: cotsParts
    },
    rawMaterials: store.rawMaterials,
    admin: {
      roles: ["admin", "mentor", "purchaser", "fabricator", "student", "read_only"],
      locations: store.inventoryLocations,
      auditLogs: store.auditLogs.slice(0, 20)
    }
  };
}

function robotSnapshot(parts) {
  const customCount = parts.filter((part) => part.sourceType === "custom").length;
  const cotsCount = parts.filter((part) => part.sourceType === "cots").length;
  return store.robots.map((robot) => {
    const procurementProgress = cotsCount ? 15 : 0;
    const fabricationProgress = customCount ? 20 : 0;
    const receiveInstallProgress = parts.length ? 5 : 0;
    const readiness = Math.min(100, procurementProgress + fabricationProgress + receiveInstallProgress);
    return {
      ...robot,
      readiness,
      counts: {
        requirements: parts.length,
        custom: customCount,
        cots: cotsCount,
        missing: parts.length,
        inFabrication: customCount,
        onOrder: 0,
        ready: 0
      },
      progress: {
        procurement: procurementProgress,
        fabrication: fabricationProgress,
        receivedInstalled: receiveInstallProgress
      },
      subsystems: robot.subsystems.map((subsystem, index) => ({
        ...subsystem,
        readiness: Math.max(0, readiness - index * 4),
        partsNeeded: Math.ceil(parts.length / Math.max(1, robot.subsystems.length)),
        procurementProgress,
        fabricationProgress,
        receivedInstalledProgress: receiveInstallProgress
      }))
    };
  });
}

function normalizePart(part, input) {
  const material = part.material || {};
  const materialName = material.displayName || material.name || material.id || part.customProperties?.Material || "Unassigned";
  const thickness = part.customProperties?.Thickness || part.customProperties?.thickness || "";
  return {
    id: part.partId,
    name: part.name || part.partId,
    type: "custom",
    category: part.customProperties?.Category || part.customProperties?.category || "fabricated",
    material: materialName,
    materialLibrary: material.libraryName || material.libraryId || "",
    bodyType: part.bodyType || "",
    thickness,
    quantity: 1,
    status: "extracted",
    process: part.customProperties?.Process || "unknown",
    fabricationIntent: part.customProperties?.FabricationIntent || "review_needed",
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

function normalizeCotsRow(row, input, index) {
  const vendor = String(row.vendor || row.supplier || "").trim();
  const vendorSku = String(row.vendorSku || row.partNumber || row.sku || "").trim();
  return {
    id: String(row.id || row.rowId || `bom-${index + 1}`).slice(0, 80),
    name: String(row.name || row.title || row.partName || "Purchased item").slice(0, 120),
    type: "cots",
    category: String(row.category || "purchased").slice(0, 80),
    vendor: vendor || "Unassigned",
    vendorSku,
    manufacturer: String(row.manufacturer || "").slice(0, 120),
    manufacturerSku: String(row.manufacturerSku || row.mpn || "").slice(0, 120),
    material: "Purchased",
    thickness: "",
    quantity: Math.min(999, Math.max(1, Number(row.quantity || 1))),
    status: "needed",
    procurementStatus: "needed",
    vendorUrl: vendorLink(vendor, vendorSku, row.name || row.title || ""),
    source: {
      documentId: input.documentId,
      workspaceId: input.workspaceId,
      elementId: input.elementId,
      bomRowKey: String(row.id || row.rowId || `bom-${index + 1}`),
      configuration: input.configuration || ""
    }
  };
}

function vendorLink(vendor, sku, name) {
  const query = encodeURIComponent(sku || name || "");
  const normalized = String(vendor || "").toLowerCase();
  if (normalized.includes("rev")) return `https://www.revrobotics.com/search?q=${query}`;
  if (normalized.includes("wcp") || normalized.includes("west coast")) return `https://wcproducts.com/search?q=${query}`;
  if (normalized.includes("andymark")) return `https://andymark.com/search?q=${query}`;
  if (normalized.includes("ttb") || normalized.includes("thrifty")) return `https://www.thethriftybot.com/search?q=${query}`;
  return query ? `https://www.google.com/search?q=${query}` : "";
}

function demoCotsRows() {
  return [
    { name: "NEO V1.1 Brushless Motor", vendor: "REV", vendorSku: "REV-21-1650", quantity: 4, category: "motors" },
    { name: "1/2 in Hex Bearing", vendor: "WCP", vendorSku: "WCP-0132", quantity: 12, category: "bearings" },
    { name: "HTD 5mm Belt 60T", vendor: "WCP", vendorSku: "WCP-0158", quantity: 6, category: "belts" }
  ];
}

async function exportStep(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateImport(body);
  const accessToken = await ensureAccessToken(session);
  const base = normalizeOnshapeBase(input.baseUrl);

  if (input.workspacePath !== "w") throw httpError(400, "STEP export requires a workspace, not a version");
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
  store.procurementOrders.unshift(saved);
  audit("procurement.received", `Manual procurement intake ${id}`, session.user?.label || "user");
  await persistStore();
  return json(res, 201, saved);
}

async function addRawMaterial(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const material = validateRawMaterial(body);
  store.rawMaterials.unshift(material);
  audit("raw_material.added", `${material.grade} ${material.materialFamily} ${material.dimensions}`, session.user?.label || "user");
  await persistStore();
  return json(res, 201, material);
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
    workspaceOrVersion: String(body.workspaceOrVersion || "w").trim().toLowerCase(),
    elementId: String(body.elementId || body.eid || "").trim(),
    configuration: String(body.configuration || "").trim(),
    baseUrl: String(body.baseUrl || config.onshapeApiBase).trim()
  };
  if (!id.test(input.documentId)) throw httpError(400, "Invalid document ID");
  if (!id.test(input.workspaceId)) throw httpError(400, "Invalid workspace ID");
  if (!id.test(input.elementId)) throw httpError(400, "Invalid element ID");
  if (input.configuration.length > 1000) throw httpError(400, "Configuration is too long");
  input.workspacePath = input.workspaceOrVersion === "v" || input.workspaceOrVersion === "version" ? "v" : "w";
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

function validateRawMaterial(body) {
  const quantity = Number(body.remainingQuantity || body.quantity || 0);
  if (!Number.isFinite(quantity) || quantity < 0) throw httpError(400, "Raw material quantity must be a valid number");
  const material = {
    id: `raw-${randomBytes(5).toString("hex")}`,
    materialFamily: String(body.materialFamily || body.material || "material").trim().slice(0, 80),
    grade: String(body.grade || body.type || "").trim().slice(0, 80),
    stockType: String(body.stockType || "sheet").trim().slice(0, 40),
    dimensions: String(body.dimensions || "").trim().slice(0, 120),
    remainingQuantity: quantity,
    unit: String(body.unit || "ea").trim().slice(0, 20),
    status: String(body.status || "available").trim().slice(0, 40),
    location: String(body.location || "").trim().slice(0, 120),
    remnant: Boolean(body.remnant),
    notes: String(body.notes || "").trim().slice(0, 500),
    updatedAt: new Date().toISOString()
  };
  if (!material.materialFamily) throw httpError(400, "Material family is required");
  if (!material.dimensions) throw httpError(400, "Dimensions are required");
  return material;
}

function normalizeOnshapeBase(value) {
  const raw = String(value || config.onshapeApiBase).trim();
  const normalized = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : config.onshapeApiBase;
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw httpError(400, "Invalid Onshape server URL");
  }
  if (!/\.onshape\.com$/.test(url.hostname)) throw httpError(400, "Onshape base URL must be an onshape.com host");
  return `${url.protocol}//${url.hostname}`;
}

function requireCsrf(req, session) {
  const header = req.headers["x-csrf-token"];
  if (!header || header !== session.csrf) {
    session.csrf = randomBytes(24).toString("base64url");
    throw httpError(403, "Invalid CSRF token");
  }
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
