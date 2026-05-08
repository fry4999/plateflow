import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomBytes, timingSafeEqual, createHmac, scryptSync, createHash, createCipheriv, createDecipheriv } from "node:crypto";

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

let storageInitError = "";
const storage = await createStorage();
const store = await storage.load();
const sessions = new Map();
const rateBuckets = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  try {
    setSecurityHeaders(req, res);
    if (!rateLimit(req, res)) return;

    const url = new URL(req.url || "/", config.appBaseUrl);
    const session = getSession(req, res);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/plateflow")) await refreshStore();

    if (url.pathname === "/auth/plateflow/register" && req.method === "POST") return await registerPlateFlow(req, res, session);
    if (url.pathname === "/auth/plateflow/login" && req.method === "POST") return await loginPlateFlow(req, res, session);
    if (url.pathname === "/auth/plateflow/logout") return logoutPlateFlow(res, session);
    if (url.pathname === "/auth/onshape") return onshapeStart(req, res, session, url);
    if (url.pathname === "/auth/onshape/callback") return await onshapeCallback(req, res, session, url);
    if (url.pathname === "/auth/logout") return await logout(res, session);
    if (url.pathname === "/api/session") return json(res, 200, publicSession(session));
    if (url.pathname === "/api/inventory") return withAppAccess(session, res, () => json(res, 200, inventorySnapshot()));
    if (url.pathname === "/api/inventory/items" && req.method === "POST") return withAppAccess(session, res, (user) => createInventoryItem(req, res, session, user), ["admin", "mentor", "purchaser", "fabricator"]);
    if (url.pathname.startsWith("/api/inventory/items/") && url.pathname.endsWith("/thumbnail")) return withAppAccess(session, res, () => inventoryItemThumbnail(res, session, pathId(url.pathname, "/api/inventory/items/").replace(/\/thumbnail$/, "")));
    if (url.pathname.startsWith("/api/inventory/items/") && req.method === "PATCH") return withAppAccess(session, res, (user) => updateInventoryItem(req, res, session, user, pathId(url.pathname, "/api/inventory/items/")), ["admin", "mentor", "purchaser", "fabricator"]);
    if (url.pathname.startsWith("/api/inventory/items/") && req.method === "DELETE") return withAppAccess(session, res, (user) => deleteInventoryItem(req, res, session, user, pathId(url.pathname, "/api/inventory/items/")), ["admin", "mentor", "purchaser", "fabricator"]);
    if (url.pathname === "/api/dashboard") return withAppAccess(session, res, (user) => json(res, 200, dashboardSnapshot(user)));
    if (url.pathname === "/api/settings" && req.method === "PATCH") return withAppAccess(session, res, (user) => updateSettings(req, res, session, user), ["admin"]);
    if (url.pathname === "/api/sync-batches") return withAppAccess(session, res, () => json(res, 200, syncBatchSnapshot()));
    if (url.pathname === "/api/raw-materials" && req.method === "GET") return withAppAccess(session, res, () => json(res, 200, { rawMaterials: store.rawMaterials }));
    if (url.pathname === "/api/raw-materials" && req.method === "POST") return withAppAccess(session, res, () => addRawMaterial(req, res, session), ["admin", "mentor", "fabricator"]);
    if (url.pathname === "/api/robots" && req.method === "GET") return withAppAccess(session, res, () => json(res, 200, { robots: robotSnapshot(), robotSources: robotSourceSnapshot() }));
    if (url.pathname === "/api/robots" && req.method === "POST") return withAppAccess(session, res, (user) => createRobot(req, res, session, user), ["admin", "mentor"]);
    if (url.pathname.startsWith("/api/robots/") && url.pathname.endsWith("/requirements") && req.method === "POST") return withAppAccess(session, res, (user) => attachRobotRequirements(req, res, session, user, pathId(url.pathname, "/api/robots/").replace(/\/requirements$/, "")), ["admin", "mentor", "student"]);
    if (url.pathname.startsWith("/api/robots/") && url.pathname.includes("/requirements/") && req.method === "PATCH") return withAppAccess(session, res, (user) => updateRobotRequirement(req, res, session, user, robotRequirementPath(url.pathname)), ["admin", "mentor", "student"]);
    if (url.pathname.startsWith("/api/robots/") && req.method === "DELETE") return withAppAccess(session, res, (user) => deleteRobot(req, res, session, user, pathId(url.pathname, "/api/robots/")), ["admin", "mentor"]);
    if (url.pathname === "/api/audit-log") return withAppAccess(session, res, () => json(res, 200, { auditLogs: store.auditLogs.slice(0, 50) }), ["admin", "mentor"]);
    if (url.pathname === "/api/admin/users" && req.method === "GET") return withAppAccess(session, res, () => json(res, 200, adminUsersSnapshot()), ["admin"]);
    if (url.pathname.startsWith("/api/admin/users/") && req.method === "PATCH") return withAppAccess(session, res, (user) => updateAdminUser(req, res, session, user, pathId(url.pathname, "/api/admin/users/")), ["admin"]);
    if (url.pathname.startsWith("/api/admin/users/") && req.method === "DELETE") return withAppAccess(session, res, (user) => deleteAdminUser(req, res, session, user, pathId(url.pathname, "/api/admin/users/")), ["admin"]);
    if (url.pathname === "/api/admin/invites" && req.method === "POST") return withAppAccess(session, res, (user) => createInvite(req, res, session, user), ["admin"]);
    if (url.pathname === "/api/admin/remove-placeholder-cots" && req.method === "POST") return withAppAccess(session, res, () => removePlaceholderCots(req, res, session), ["admin"]);
    if (url.pathname.startsWith("/api/fabrication/jobs/") && req.method === "PATCH") return withAppAccess(session, res, (user) => updateFabricationJob(req, res, session, user, pathId(url.pathname, "/api/fabrication/jobs/")), ["admin", "mentor", "fabricator"]);
    if (url.pathname.startsWith("/api/fabrication/jobs/") && req.method === "DELETE") return withAppAccess(session, res, (user) => deleteFabricationJob(req, res, session, user, pathId(url.pathname, "/api/fabrication/jobs/")), ["admin", "mentor", "fabricator"]);
    if (url.pathname.startsWith("/api/procurement/orders/") && req.method === "PATCH") return withAppAccess(session, res, (user) => updateProcurementOrder(req, res, session, user, pathId(url.pathname, "/api/procurement/orders/")), ["admin", "mentor", "purchaser"]);
    if (url.pathname === "/api/onshape/import" && req.method === "POST") return withAppAccess(session, res, () => importOnshape(req, res, session), ["admin", "mentor", "fabricator", "student"]);
    if (url.pathname === "/api/onshape/import-cots" && req.method === "POST") return withAppAccess(session, res, () => importCots(req, res, session), ["admin", "mentor", "purchaser", "student"]);
    if (url.pathname === "/api/onshape/export-step" && req.method === "POST") return withAppAccess(session, res, () => exportStep(req, res, session), ["admin", "mentor", "fabricator"]);
    if (url.pathname === "/api/orders" && req.method === "POST") return withAppAccess(session, res, () => createOrder(req, res, session), ["admin", "mentor", "purchaser"]);
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
      const pg = await import("pg");
      const { Pool } = pg.default || pg;
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
        kind: "postgres",
        persistent: true,
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
      storageInitError = String(error.message || error).slice(0, 180);
      console.error("Could not initialize Postgres storage, falling back to local file", error);
    }
  }

  return {
    kind: "file",
    persistent: false,
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
    const raw = readFileSync(config.dataPath, "utf8").trim();
    if (!raw) return fallback;
    return mergeStore(JSON.parse(raw));
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
    invites: Array.isArray(parsed.invites) ? parsed.invites : fallback.invites,
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
    settings: mergeSettings(parsed.settings || fallback.settings),
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : fallback.auditLogs
  };
}

function defaultSettings() {
  return {
    updatedAt: "",
    partNumber: {
      template: "{prefix}-{source}-{subsystem}-{part}",
      prefix: "PF",
      sourceLength: 3,
      subsystemLength: 3,
      partLength: 4
    }
  };
}

function mergeSettings(value) {
  const fallback = defaultSettings();
  return {
    ...fallback,
    ...(value && typeof value === "object" ? value : {}),
    partNumber: {
      ...fallback.partNumber,
      ...(value?.partNumber && typeof value.partNumber === "object" ? value.partNumber : {})
    }
  };
}

function defaultStore() {
  const now = new Date().toISOString();
  return {
    teams: [{ id: "team-default", name: "FRC Team", status: "active" }],
    settings: defaultSettings(),
    invites: [],
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

async function refreshStore() {
  const latest = await storage.load();
  for (const key of Object.keys(store)) delete store[key];
  Object.assign(store, latest);
  if (ensureMissingCustomPartNumbers()) await persistStore();
}

function ensureMissingCustomPartNumbers() {
  let changed = false;
  for (const record of store.inventoryRecords || []) {
    if (record.sourceType !== "custom" || !Array.isArray(record.parts)) continue;
    record.parts = record.parts.map((part, index) => {
      if (String(part.partNumber || "").trim()) return part;
      changed = true;
      return ensureCustomPartNumber(part, record.source || part.source || {}, index);
    });
  }
  return changed;
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
    appUserId: null,
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
  restoreOnshapeToken(session);
  return {
    authenticated: Boolean(session.token),
    appAuthenticated: Boolean(session.appUserId),
    bootstrapRequired: !store.users.length,
    csrfToken: session.csrf,
    user: session.user,
    appUser: session.appUserId ? publicAppUser(store.users.find((user) => user.id === session.appUserId)) : null,
    configured: Boolean(config.onshapeClientId && config.onshapeClientSecret),
    appBaseUrl: config.appBaseUrl,
    storage: {
      kind: storage.kind,
      persistent: storage.persistent,
      databaseUrlConfigured: Boolean(config.databaseUrl),
      error: storageInitError
    }
  };
}

function logoutPlateFlow(res, session) {
  session.appUserId = null;
  session.token = null;
  session.user = null;
  audit("auth.logout", "PlateFlow logout", "user");
  return redirect(res, "/");
}

function withAppAccess(session, res, handler, roles = []) {
  const run = (user) => Promise.resolve(handler(user)).catch((error) => {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || "Unexpected server error" });
  });
  if (!store.users.length) return run();
  const user = store.users.find((item) => item.id === session.appUserId && item.status === "active");
  if (!user) return json(res, 401, { error: "Sign in to PlateFlow first" });
  if (roles.length && !roles.includes(user.role)) return json(res, 403, { error: "Your role cannot do that" });
  return run(user);
}

async function registerPlateFlow(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateAuthInput(body, { requireName: !store.users.length });
  const existing = store.users.find((user) => user.email === input.email);
  if (existing) throw httpError(409, "A PlateFlow account already exists for that email");

  const bootstrap = !store.users.length;
  const invite = bootstrap ? null : findUsableInvite(input.email, body.inviteToken);
  if (!bootstrap && !invite) throw httpError(403, "Valid invite required");

  const user = {
    id: `user-${randomBytes(6).toString("hex")}`,
    email: input.email,
    name: input.name || input.email.split("@")[0],
    role: bootstrap ? "admin" : invite.role,
    status: "active",
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString()
  };
  store.users.unshift(user);
  if (invite) {
    invite.status = "accepted";
    invite.acceptedAt = new Date().toISOString();
    invite.acceptedBy = user.id;
  }
  session.appUserId = user.id;
  await saveOnshapeTokenForSession(session);
  audit(bootstrap ? "auth.bootstrap_admin" : "auth.invite_accepted", `Created PlateFlow ${user.role} ${user.email}`, user.email);
  await persistStore();
  return json(res, 201, { user: publicAppUser(user), session: publicSession(session) });
}

async function loginPlateFlow(req, res, session) {
  requireCsrf(req, session);
  const input = validateAuthInput(await readJson(req));
  const user = store.users.find((item) => item.email === input.email);
  if (!user || !verifyPassword(input.password, user.passwordHash)) throw httpError(401, "Invalid email or password");
  if (user.status !== "active") throw httpError(403, "This account is not active yet");
  session.appUserId = user.id;
  session.token = null;
  session.user = null;
  restoreOnshapeToken(session);
  audit("auth.login", `PlateFlow login ${user.email}`, user.email);
  await persistStore();
  return json(res, 200, { user: publicAppUser(user), session: publicSession(session) });
}

function pathId(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length));
}

function validateAuthInput(body, options = {}) {
  const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
  const password = String(body.password || "");
  const name = String(body.name || "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Valid email is required");
  if (password.length < 10 || password.length > 200) throw httpError(400, "Password must be at least 10 characters");
  if (options.requireName && !name) throw httpError(400, "Name is required");
  return { email, password, name };
}

function findUsableInvite(email, token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;
  return store.invites.find((invite) => (
    invite.email === email &&
    invite.token === normalizedToken &&
    invite.status === "pending" &&
    new Date(invite.expiresAt).getTime() > Date.now()
  ));
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("base64url"), "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function publicAppUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    onshapeConnected: Boolean(user.onshapeToken)
  };
}

function restoreOnshapeToken(session) {
  if (session.token || !session.appUserId) return Boolean(session.token);
  const user = store.users.find((item) => item.id === session.appUserId);
  const token = decryptJson(user?.onshapeToken);
  if (!token?.refreshToken) return false;
  session.token = token;
  session.user = { provider: "onshape", label: "Onshape connected" };
  return true;
}

async function saveOnshapeTokenForSession(session) {
  if (!session.appUserId || !session.token?.refreshToken) return;
  const user = store.users.find((item) => item.id === session.appUserId);
  if (!user) return;
  user.onshapeToken = encryptJson(session.token);
  user.updatedAt = new Date().toISOString();
  await persistStore();
}

function encryptJson(value) {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":");
  } catch {
    return "";
  }
}

function decryptJson(value) {
  try {
    const [version, ivRaw, tagRaw, encryptedRaw] = String(value || "").split(":");
    if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) return null;
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

function secretKey() {
  return createHash("sha256").update(config.sessionSecret).digest();
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
    await saveOnshapeTokenForSession(session);
    return redirect(res, addQuery(session.returnTo || "/", "auth", "ok"));
  } catch (error) {
    console.error("Onshape OAuth callback failed", error);
    const detail = encodeURIComponent(error.expose ? error.message : "Token exchange failed. Check hosting environment variables and Onshape redirect URLs.");
    return redirect(res, `${addQuery(session.returnTo || "/", "auth", "callback-failed")}&detail=${detail}`);
  }
}

async function logout(res, session) {
  session.token = null;
  session.user = null;
  session.oauthState = null;
  const user = store.users.find((item) => item.id === session.appUserId);
  if (user?.onshapeToken) {
    delete user.onshapeToken;
    user.updatedAt = new Date().toISOString();
    audit("auth.onshape_disconnected", `Disconnected Onshape for ${user.email}`, user.email);
    await persistStore();
  }
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
  const previousRefreshToken = session.token.refreshToken;
  session.token = normalizeToken(token);
  if (!session.token.refreshToken) session.token.refreshToken = previousRefreshToken;
  await saveOnshapeTokenForSession(session);
  return session.token.accessToken;
}

async function importOnshape(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateImport(body);
  const configuredParts = normalizeConfiguredParts(body.configuredParts);
  const accessToken = await ensureAccessToken(session);
  const base = normalizeOnshapeBase(input.baseUrl);
  await enrichSourceInfo(accessToken, base, input);

  const params = new URLSearchParams({
    elementId: input.elementId,
    withThumbnails: "true",
    includePropertyDefaults: "false"
  });
  if (input.configuration) params.set("configuration", input.configuration);

  const parts = await onshapeJson(accessToken, `${base}/api/v6/parts/d/${input.documentId}/${input.workspacePath}/${input.workspaceId}?${params}`);
  const normalizedParts = await enrichPhysicalPartData(
    accessToken,
    base,
    input,
    (Array.isArray(parts) ? parts : parts.parts || []).map((part) => normalizePart(part, input)),
    configuredParts
  );
  if (body.previewOnly) return json(res, 200, { parts: normalizedParts, source: input });

  const normalized = withGeneratedCustomPartNumbers(
    configuredParts.length ? applyConfiguredParts(normalizedParts, configuredParts, input) : normalizedParts,
    input
  );
  if (!normalized.length) throw httpError(400, "Select at least one custom part to submit");
  const saved = await saveInventory(input, normalized, "custom", "Part Studio custom sync", { mergeParts: Boolean(configuredParts.length) });
  return json(res, 200, { parts: normalized, source: input, inventory: saved });
}

function normalizeConfiguredParts(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((item) => {
    const id = String(item.id || item.partId || "").trim().slice(0, 100);
    const partKey = String(item.partKey || item.id || item.partId || item.name || "").trim().slice(0, 140);
    const stock = String(item.stock || "").trim().slice(0, 80);
    if (!partKey) throw httpError(400, "Configured part is missing an Onshape part selection");
    if (!stock) throw httpError(400, "Stock is required for custom parts");
    const quantity = Math.max(1, Math.min(999, Number(item.quantity || 1)));
    return {
      id,
      partKey,
      name: String(item.name || "").trim().slice(0, 140),
      subsystem: String(item.subsystem || "").trim().slice(0, 120),
      thickness: String(item.thickness || "").trim().slice(0, 40),
      materialType: String(item.materialType || item.material || "").trim().slice(0, 120),
      stock,
      machine: String(item.machine || item.process || "").trim().slice(0, 80),
      partNumber: String(item.partNumber || "").trim().slice(0, 80),
      quantity
    };
  });
}

function applyConfiguredParts(parts, configuredParts, input) {
  const byKey = new Map();
  for (const part of configuredParts) {
    if (part.id) byKey.set(part.id, part);
    if (part.partKey) byKey.set(part.partKey, part);
    if (part.name) byKey.set(part.name, part);
  }
  return parts
    .filter((part) => byKey.has(part.id) || byKey.has(part.name))
    .map((part, index) => {
      const config = byKey.get(part.id) || byKey.get(part.name);
      return {
        ...part,
        partNumber: config.partNumber || generatePartNumber(input, part, config, index),
        subsystem: config.subsystem,
        thickness: config.thickness || part.thickness,
        material: config.materialType || part.material,
        stock: config.stock,
        process: config.machine || "Router",
        machine: config.machine || "Router",
        fabricationIntent: config.machine.toLowerCase() === "fabworks" ? "send_out" : "make_now",
        category: stockCategory(config.stock),
        quantity: config.quantity,
        status: "extracted"
      };
    });
}

function withGeneratedCustomPartNumbers(parts, input) {
  return parts.map((part, index) => ensureCustomPartNumber(part, input, index));
}

function ensureCustomPartNumber(part, input = {}, index = 0) {
  if (String(part.partNumber || "").trim()) return part;
  return {
    ...part,
    partNumber: generatePartNumber(input || {}, part, { subsystem: part.subsystem || "GEN" }, index)
  };
}

function generatePartNumber(input, part, config, index) {
  const settings = settingsSnapshot().partNumber;
  return formatPartNumber(settings, {
    prefix: settings.prefix,
    source: partNumberCode(input.sourceTag || input.documentName || part.sourceDocument || part.source?.sourceTag || "SRC", settings.sourceLength),
    subsystem: partNumberCode(config?.subsystem || part.subsystem || "GEN", settings.subsystemLength),
    part: partNumberCode(part.name || part.id || String(index + 1), settings.partLength)
  });
}

function partNumberCode(value, length) {
  const normalized = normalizeKey(value).replace(/-/g, "").toUpperCase();
  return (normalized || "X").slice(0, length).padEnd(length, "X");
}

function formatPartNumber(settings, tokens) {
  return String(settings.template || "{prefix}-{source}-{subsystem}-{part}")
    .replace(/\{prefix\}/g, tokens.prefix || "PF")
    .replace(/\{source\}/g, tokens.source || "SRC")
    .replace(/\{subsystem\}/g, tokens.subsystem || "GEN")
    .replace(/\{part\}/g, tokens.part || "PART")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stockCategory(stock) {
  const text = String(stock || "").toLowerCase();
  if (text.includes("tube")) return "tube";
  if (text.includes("spacer") || text.includes("churro") || text.includes("hex")) return "stock";
  return "fabricated";
}

async function enrichPhysicalPartData(accessToken, base, input, parts, configuredParts = []) {
  const wantedKeys = configuredParts.length
    ? new Set(configuredParts.flatMap((part) => [part.id, part.partKey, part.name].filter(Boolean)))
    : null;
  const work = parts.filter((part) => {
    if (part.thickness || !part.id) return false;
    if (!wantedKeys) return true;
    return wantedKeys.has(part.id) || wantedKeys.has(part.name);
  });
  if (!work.length) return parts;

  const thicknessByPartId = new Map();
  await mapWithConcurrency(work.slice(0, 80), 4, async (part) => {
    const thickness = await inferPhysicalThickness(accessToken, base, input, part.id);
    if (thickness) thicknessByPartId.set(part.id, thickness);
  });

  if (!thicknessByPartId.size) return parts;
  return parts.map((part) => {
    const thickness = thicknessByPartId.get(part.id);
    return thickness ? { ...part, thickness, thicknessSource: "physical_bounding_box" } : part;
  });
}

async function inferPhysicalThickness(accessToken, base, input, partId) {
  const encodedPartId = encodeURIComponent(partId);
  const params = new URLSearchParams({ includeHidden: "true" });
  if (input.configuration) params.set("configuration", input.configuration);
  try {
    const data = await onshapeJson(accessToken, `${base}/api/parts/d/${input.documentId}/${input.workspacePath}/${input.workspaceId}/e/${input.elementId}/partid/${encodedPartId}/boundingboxes?${params}`);
    const dimensions = boundingBoxDimensions(data);
    if (!dimensions.length) return "";
    const minMeters = Math.min(...dimensions.filter((value) => Number.isFinite(value) && value > 0));
    if (!Number.isFinite(minMeters) || minMeters <= 0) return "";
    return formatMetersAsInches(minMeters);
  } catch (error) {
    if (![400, 403, 404].includes(Number(error.status || 0))) console.warn(`Could not infer thickness for ${partId}`, error.message);
    return "";
  }
}

function boundingBoxDimensions(value) {
  const box = findBoundingBox(value);
  if (!box) return [];
  const low = readPoint(box, ["low", "min", "minimum", "minCorner", "lowerLeft"]);
  const high = readPoint(box, ["high", "max", "maximum", "maxCorner", "upperRight"]);
  if (low && high) {
    return [Math.abs(high.x - low.x), Math.abs(high.y - low.y), Math.abs(high.z - low.z)];
  }
  const values = {
    lowX: numericField(box, ["lowX", "minX", "xmin", "xMin"]),
    lowY: numericField(box, ["lowY", "minY", "ymin", "yMin"]),
    lowZ: numericField(box, ["lowZ", "minZ", "zmin", "zMin"]),
    highX: numericField(box, ["highX", "maxX", "xmax", "xMax"]),
    highY: numericField(box, ["highY", "maxY", "ymax", "yMax"]),
    highZ: numericField(box, ["highZ", "maxZ", "zmax", "zMax"])
  };
  if (Object.values(values).every((item) => item !== null)) {
    return [
      Math.abs(values.highX - values.lowX),
      Math.abs(values.highY - values.lowY),
      Math.abs(values.highZ - values.lowZ)
    ];
  }
  return [
    numericField(box, ["xLength", "lengthX", "width"]),
    numericField(box, ["yLength", "lengthY", "height"]),
    numericField(box, ["zLength", "lengthZ", "depth"])
  ].filter((item) => item !== null);
}

function findBoundingBox(value) {
  if (!value || typeof value !== "object") return null;
  if (hasBoundingBoxFields(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBoundingBox(item);
      if (found) return found;
    }
    return null;
  }
  for (const key of ["boundingBox", "box", "bounds", "boundingBoxes"]) {
    const found = findBoundingBox(value[key]);
    if (found) return found;
  }
  for (const item of Object.values(value)) {
    const found = findBoundingBox(item);
    if (found) return found;
  }
  return null;
}

function hasBoundingBoxFields(value) {
  return (
    numericField(value, ["lowX", "minX", "xmin", "xMin"]) !== null &&
    numericField(value, ["highX", "maxX", "xmax", "xMax"]) !== null
  ) || Boolean(readPoint(value, ["low", "min", "minimum", "minCorner"]) && readPoint(value, ["high", "max", "maximum", "maxCorner"]));
}

function readPoint(value, keys) {
  for (const key of keys) {
    const point = value?.[key];
    if (!point) continue;
    if (Array.isArray(point) && point.length >= 3) {
      const [x, y, z] = point.map(Number);
      if ([x, y, z].every(Number.isFinite)) return { x, y, z };
    }
    if (typeof point === "object") {
      const x = numericField(point, ["x", "X", "0"]);
      const y = numericField(point, ["y", "Y", "1"]);
      const z = numericField(point, ["z", "Z", "2"]);
      if ([x, y, z].every((item) => item !== null)) return { x, y, z };
    }
  }
  return null;
}

function numericField(value, keys) {
  for (const key of keys) {
    const raw = value?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const number = Number(raw);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function formatMetersAsInches(meters) {
  const inches = meters * 39.37007874015748;
  const common = [
    { value: 0.0625, label: "1/16 in" },
    { value: 0.09375, label: "3/32 in" },
    { value: 0.125, label: "1/8 in" },
    { value: 0.1875, label: "3/16 in" },
    { value: 0.25, label: "1/4 in" },
    { value: 0.375, label: "3/8 in" },
    { value: 0.5, label: "1/2 in" }
  ];
  const match = common.find((item) => Math.abs(item.value - inches) <= 0.01);
  if (match) return match.label;
  return `${Number(inches.toFixed(inches < 1 ? 3 : 2))} in`;
}

async function mapWithConcurrency(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function importCots(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const input = validateImport(body);
  const base = normalizeOnshapeBase(input.baseUrl);
  const suppliedRows = Array.isArray(body.rows) && body.rows.length ? body.rows : null;
  let accessToken = "";
  if (suppliedRows) {
    input.documentName = input.sourceTag || shortDocumentId(input.documentId);
    input.sourceTag = input.sourceTag || input.documentName;
  } else {
    accessToken = await ensureAccessToken(session);
    await enrichSourceInfo(accessToken, base, input);
  }

  const rows = suppliedRows || await fetchAssemblyBomRows(accessToken, base, input);
  if (!rows.length) {
    throw httpError(404, "No Assembly BOM rows were returned by Onshape for this tab.");
  }
  const normalized = rows.slice(0, 200).map((row, index) => normalizeCotsRow(row, input, index));
  const saved = await saveInventory(input, normalized, "cots", "Assembly BOM procurement sync");
  return json(res, 200, { parts: normalized, source: input, inventory: saved });
}

async function fetchAssemblyBomRows(accessToken, base, input) {
  const params = new URLSearchParams({ indented: "false" });
  if (input.configuration) params.set("configuration", input.configuration);
  const url = `${base}/api/assemblies/d/${input.documentId}/${input.workspacePath}/${input.workspaceId}/e/${input.elementId}/bom?${params}`;
  try {
    const data = await onshapeJson(accessToken, url);
    return extractBomRows(data);
  } catch (error) {
    const message = String(error.message || "");
    if (error.status === 404) {
      throw httpError(404, "Onshape did not find an Assembly BOM for this tab. Make sure the extension action is opened from an Assembly tab, not a Part Studio.");
    }
    if (error.status === 403) {
      throw httpError(403, "Onshape denied BOM access. Check the OAuth app permissions include assembly/BOM read access, then reconnect Onshape.");
    }
    if (error.status === 400 && /configuration/i.test(message)) {
      throw httpError(400, "Onshape rejected the Assembly configuration. Try the default configuration or reopen PlateFlow from the active Assembly tab.");
    }
    throw error;
  }
}

function extractBomRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.bomTable?.items)) return data.bomTable.items;
  if (Array.isArray(data.bomTable?.rows)) return data.bomTable.rows;
  if (Array.isArray(data.table?.items)) return data.table.items;
  return [];
}

async function enrichSourceInfo(accessToken, base, input) {
  const fallback = input.sourceTag || shortDocumentId(input.documentId);
  try {
    const document = await onshapeJson(accessToken, `${base}/api/documents/${input.documentId}`);
    input.documentName = String(document.name || document.document?.name || "").trim().slice(0, 120);
  } catch {
    input.documentName = "";
  }
  input.sourceTag = String(input.sourceTag || input.documentName || fallback).trim().slice(0, 80) || fallback;
}

function shortDocumentId(documentId) {
  return `doc-${String(documentId || "").slice(0, 6)}`;
}

async function saveInventory(input, parts, sourceType, label, options = {}) {
  const key = `${input.documentId}:${input.workspacePath}:${input.workspaceId}:${input.elementId}:${input.configuration || "default"}`;
  const existingIndex = store.inventoryRecords.findIndex((item) => item.id === key);
  const existing = existingIndex >= 0 ? store.inventoryRecords[existingIndex] : null;
  const recordParts = options.mergeParts && existing ? mergeInventoryParts(existing.parts, parts) : parts;
  const batchId = `S-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const record = {
    id: key,
    batchId,
    sourceType,
    updatedAt: new Date().toISOString(),
    source: input,
    parts: recordParts
  };
  const replacedBatchId = existing?.batchId || "";
  if (existingIndex >= 0) store.inventoryRecords.splice(existingIndex, 1, record);
  else store.inventoryRecords.unshift(record);

  const previousFabStatus = sourceType === "custom" && replacedBatchId ? fabricationStatusByCatalogPart(replacedBatchId) : new Map();
  const normalizedParts = recordParts.map((part) => upsertCatalogPart(part, sourceType, batchId));
  if (replacedBatchId) removeOperationalQueue(replacedBatchId, sourceType);
  upsertOperationalQueue(batchId, sourceType, normalizedParts, previousFabStatus);
  store.syncBatches.unshift({
    id: batchId,
    label,
    sourceType,
    status: "received",
    partCount: recordParts.length,
    createdAt: record.updatedAt,
    source: input
  });
  store.syncBatches.splice(100);
  audit("sync.received", `${label}: ${recordParts.length} item${recordParts.length === 1 ? "" : "s"}`, "onshape");
  await persistStore();
  return record;
}

function mergeInventoryParts(existingParts = [], incomingParts = []) {
  const keyForPart = (part) => part.source?.partId || part.id || part.name;
  const merged = new Map(existingParts.map((part) => [keyForPart(part), part]));
  for (const part of incomingParts) merged.set(keyForPart(part), part);
  return [...merged.values()];
}

function removeOperationalQueue(batchId, sourceType) {
  if (sourceType === "custom") {
    store.fabricationJobs = store.fabricationJobs.filter((job) => job.syncBatchId !== batchId);
  } else {
    store.procurementOrders = store.procurementOrders.filter((order) => order.syncBatchId !== batchId);
  }
  store.syncBatches = store.syncBatches.filter((batch) => batch.id !== batchId);
}

function fabricationStatusByCatalogPart(batchId) {
  ensureIndividualFabricationJobs();
  const statuses = new Map();
  for (const job of store.fabricationJobs.filter((item) => item.syncBatchId === batchId)) {
    const line = Array.isArray(job.lines) ? job.lines[0] : null;
    if (line?.catalogPartId) statuses.set(line.catalogPartId, canonicalFabricationStatus(job.status));
  }
  return statuses;
}

function inventorySnapshot() {
  const records = [...store.inventoryRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const parts = records.flatMap((record) => record.parts.map((part) => {
    const catalog = findCatalogPartForInventoryPart(part, record.sourceType) || {};
    const itemKey = inventoryItemKey(record.id, part);
    const { previewDataUrl: _previewDataUrl, source: rawSource = {}, ...publicPart } = part;
    const { previewDataUrl: _sourcePreviewDataUrl, ...publicSource } = rawSource || {};
    return {
      ...publicPart,
      source: publicSource,
      catalogPartId: catalog.id || "",
      inventoryId: record.id,
      itemKey,
      importedAt: record.updatedAt,
      updatedAt: catalog.updatedAt || record.updatedAt,
      sourceType: record.sourceType,
      sourceDocument: part.sourceDocument || part.source?.sourceTag || record.source?.sourceTag || record.source?.documentName || shortDocumentId(record.source?.documentId),
      sourceDocumentName: part.sourceDocumentName || part.source?.documentName || record.source?.documentName || "",
      sourceDocumentId: part.source?.documentId || record.source?.documentId || "",
      onHand: Number(catalog.onHand ?? part.onHand ?? 0),
      reserved: Number(catalog.reserved ?? part.reserved ?? 0),
      ordered: Number(catalog.ordered ?? part.ordered ?? 0),
      available: Number(catalog.available ?? Math.max(0, Number(catalog.onHand ?? part.onHand ?? 0) - Number(catalog.reserved ?? part.reserved ?? 0))),
      quantityNeeded: Number(catalog.quantityNeeded ?? part.quantityNeeded ?? part.quantity ?? 1),
      defaultLocation: catalog.defaultLocation || part.defaultLocation || "",
      tags: Array.isArray(catalog.tags) ? catalog.tags : Array.isArray(part.tags) ? part.tags : [],
      neededBy: neededByForInventoryPart(record, part),
      previewUrl: `/api/inventory/items/${itemKey}/thumbnail`
    };
  })).sort((a, b) => `${a.sourceDocument || ""}:${a.name || ""}`.localeCompare(`${b.sourceDocument || ""}:${b.name || ""}`));
  return {
    records: records.map(publicInventoryRecord),
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
    },
    documents: [...new Set(parts.map((part) => part.sourceDocument || "Unassigned"))].sort()
  };
}

function publicInventoryRecord(record) {
  return {
    ...record,
    parts: (record.parts || []).map((part) => {
      const { previewDataUrl: _previewDataUrl, source: rawSource = {}, ...publicPart } = part;
      const { previewDataUrl: _sourcePreviewDataUrl, ...publicSource } = rawSource || {};
      return { ...publicPart, source: publicSource };
    })
  };
}

function inventoryItemPartKey(part) {
  return String(part?.source?.partId || part?.source?.bomRowKey || part?.id || part?.name || "").trim();
}

function inventoryItemKey(recordId, part) {
  return Buffer.from(JSON.stringify({ recordId, partKey: inventoryItemPartKey(part) }), "utf8").toString("base64url");
}

function parseInventoryItemKey(itemKey) {
  try {
    const parsed = JSON.parse(Buffer.from(String(itemKey || ""), "base64url").toString("utf8"));
    return {
      recordId: String(parsed.recordId || ""),
      partKey: String(parsed.partKey || "")
    };
  } catch {
    return { recordId: "", partKey: "" };
  }
}

function findInventoryItem(itemKey) {
  const { recordId, partKey } = parseInventoryItemKey(itemKey);
  if (!recordId || !partKey) return null;
  const record = store.inventoryRecords.find((item) => item.id === recordId);
  if (!record) return null;
  const partIndex = record.parts.findIndex((part) => inventoryItemPartKey(part) === partKey);
  if (partIndex === -1) return null;
  return { record, part: record.parts[partIndex], partIndex };
}

function findCatalogPartForInventoryPart(part, sourceType) {
  const identity = partIdentity(part, sourceType);
  return store.catalogParts.find((item) => item.identity === identity);
}

function neededByForInventoryPart(record, part) {
  const partKey = inventoryItemPartKey(part);
  const matches = store.requirements.filter((requirement) => (
    requirement.inventoryRecordId === record.id &&
    (String(requirement.key || "").endsWith(`:${record.id}:${partKey}`) || requirement.name === part.name)
  ));
  if (!matches.length && part.subsystem) {
    return [{ robot: "", subsystem: part.subsystem, quantityNeeded: Number(part.quantityNeeded || part.quantity || 1), status: part.status || "needed" }];
  }
  return matches.map((requirement) => {
    const robot = store.robots.find((item) => item.id === requirement.robotId);
    return {
      robot: robot?.name || "Robot",
      subsystem: requirement.subsystem || "",
      quantityNeeded: Number(requirement.quantityNeeded || 1),
      status: requirement.status || "needed"
    };
  });
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
    sourceDocument: part.sourceDocument || part.source?.sourceTag || "",
    sourceDocumentName: part.sourceDocumentName || part.source?.documentName || "",
    partNumber: part.partNumber || "",
    subsystem: part.subsystem || "",
    stock: part.stock || "",
    machine: part.machine || part.process || "",
    process: part.process || "",
    fabricationIntent: part.fabricationIntent || "",
    status: part.status || (sourceType === "custom" ? "extracted" : "needed"),
    onHand: Number(part.onHand ?? existing?.onHand ?? 0),
    reserved: Number(part.reserved ?? existing?.reserved ?? 0),
    ordered: Number(part.ordered ?? existing?.ordered ?? 0),
    quantityNeeded: Number(part.quantityNeeded ?? part.quantity ?? 1),
    available: Math.max(0, Number(part.onHand ?? existing?.onHand ?? 0) - Number(part.reserved ?? existing?.reserved ?? 0)),
    defaultLocation: part.defaultLocation || existing?.defaultLocation || "",
    tags: Array.isArray(part.tags) ? part.tags : existing?.tags || [],
    source: part.source,
    previewDataUrl: part.previewDataUrl || existing?.previewDataUrl || "",
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
  return reference ? `custom:${reference}` : `custom:${normalizeKey(part.partNumber || part.name)}:${normalizeKey(part.id || part.name)}`;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function upsertOperationalQueue(batchId, sourceType, catalogParts, previousFabStatus = new Map()) {
  const now = new Date().toISOString();
  if (sourceType === "custom") {
    const jobs = catalogParts.map((part, index) => ({
      id: `F-${batchId.slice(2)}-${String(index + 1).padStart(2, "0")}`,
      syncBatchId: batchId,
      status: previousFabStatus.get(part.id) || "todo",
      grouping: groupCustomParts([part]),
      lines: [
        {
          catalogPartId: part.id,
          name: part.name,
          material: part.material,
          thickness: part.thickness,
          subsystem: part.subsystem,
          stock: part.stock,
          process: part.process || "unknown",
          machine: part.machine || part.process || "unknown",
          fabricationIntent: part.fabricationIntent || "review_needed",
          quantityNeeded: part.quantityNeeded,
          quantityMade: 0,
          quantityReceived: 0,
          quantityInstalled: 0
        }
      ],
      createdAt: now,
      updatedAt: now
    }));
    store.fabricationJobs.unshift(...jobs);
    store.fabricationJobs.splice(200);
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

function ensureIndividualFabricationJobs() {
  let changed = false;
  const next = [];
  for (const job of store.fabricationJobs) {
    if (job.status === "canceled") {
      changed = true;
      continue;
    }
    const lines = Array.isArray(job.lines) ? job.lines : [];
    const status = canonicalFabricationStatus(job.status);
    if (lines.length <= 1) {
      if (job.status !== status) {
        job.status = status;
        changed = true;
      }
      next.push(job);
      continue;
    }
    changed = true;
    lines.forEach((line, index) => {
      next.push({
        ...job,
        id: `${job.id}-${String(index + 1).padStart(2, "0")}`,
        status,
        grouping: groupCustomParts([line]),
        lines: [line]
      });
    });
  }
  if (changed) store.fabricationJobs = next.slice(0, 200);
  return changed;
}

function canonicalFabricationStatus(status) {
  if (status === "in_progress") return "in_progress";
  if (["completed", "received", "installed"].includes(status)) return "completed";
  return "todo";
}

function groupCotsParts(parts) {
  return Object.values(parts.reduce((groups, part) => {
    const key = part.vendor || "Unassigned";
    groups[key] ||= { vendor: key, count: 0 };
    groups[key].count += Number(part.quantityNeeded || 1);
    return groups;
  }, {}));
}

function dashboardSnapshot(user = null) {
  ensureIndividualFabricationJobs();
  const inventory = inventorySnapshot();
  const customParts = inventory.parts.filter((part) => part.sourceType === "custom");
  const cotsParts = inventory.parts.filter((part) => part.sourceType === "cots");
  const robots = robotSnapshot();
  const adminVisible = user?.role === "admin";
  return {
    overview: {
      partsMissing: inventory.parts.reduce((sum, part) => sum + Math.max(0, Number(part.quantity || 1) - Number(part.onHand || 0)), 0),
      partsOnOrder: store.procurementOrders.reduce((sum, order) => {
        const lines = Array.isArray(order.lines) ? order.lines : Array.isArray(order.parts) ? order.parts : [];
        return sum + lines.reduce((lineSum, line) => lineSum + Number(line.quantityOrdered || line.quantity || 0), 0);
      }, 0),
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
      jobs: store.fabricationJobs.filter((job) => job.status !== "canceled").slice(0, 200),
      items: customParts
    },
    procurement: {
      orders: store.procurementOrders.slice(0, 20),
      items: cotsParts
    },
    robotSources: robotSourceSnapshot(),
    rawMaterials: store.rawMaterials,
    settings: settingsSnapshot(),
    admin: {
      roles: adminVisible ? ["admin", "mentor", "purchaser", "fabricator", "student", "read_only"] : [],
      locations: adminVisible ? store.inventoryLocations : [],
      auditLogs: adminVisible ? store.auditLogs.slice(0, 20) : []
    }
  };
}

function robotSnapshot() {
  return store.robots.map((robot) => {
    const requirements = store.requirements.filter((requirement) => requirement.robotId === robot.id);
    const customRequirements = requirements.filter((requirement) => requirement.sourceType === "custom");
    const cotsRequirements = requirements.filter((requirement) => requirement.sourceType === "cots");
    const procurementProgress = requirements.length && !cotsRequirements.length ? 100 : percentComplete(cotsRequirements, (requirement) => Number(requirement.quantityReceived || 0) >= Number(requirement.quantityNeeded || 1));
    const fabricationProgress = requirements.length && !customRequirements.length ? 100 : percentComplete(customRequirements, (requirement) => ["received", "installed"].includes(requirement.status));
    const receiveInstallProgress = percentComplete(requirements, (requirement) => Number(requirement.quantityInstalled || 0) >= Number(requirement.quantityNeeded || 1));
    const readiness = Math.round(procurementProgress * 0.4 + fabricationProgress * 0.35 + receiveInstallProgress * 0.25);
    return {
      ...robot,
      readiness,
      counts: {
        requirements: requirements.length,
        custom: customRequirements.length,
        cots: cotsRequirements.length,
        missing: requirements.filter((requirement) => Number(requirement.quantityReceived || 0) < Number(requirement.quantityNeeded || 1)).length,
        inFabrication: customRequirements.filter((requirement) => !["received", "installed"].includes(requirement.status)).length,
        onOrder: cotsRequirements.filter((requirement) => ["ordered", "partially_received", "backordered"].includes(requirement.status)).length,
        ready: requirements.filter((requirement) => Number(requirement.quantityReceived || 0) >= Number(requirement.quantityNeeded || 1)).length
      },
      progress: {
        procurement: procurementProgress,
        fabrication: fabricationProgress,
        receivedInstalled: receiveInstallProgress
      },
      requirements: requirements.map(publicRequirement),
      subsystems: robot.subsystems.map((subsystem, index) => ({
        ...subsystem,
        readiness: Math.max(0, readiness - index * 4),
        partsNeeded: Math.ceil(requirements.length / Math.max(1, robot.subsystems.length)),
        procurementProgress,
        fabricationProgress,
        receivedInstalledProgress: receiveInstallProgress
      }))
    };
  });
}

function percentComplete(items, complete) {
  if (!items.length) return 0;
  return Math.round((items.filter(complete).length / items.length) * 100);
}

function robotSourceSnapshot() {
  return store.inventoryRecords
    .filter((record) => record.sourceType === "cots")
    .map((record) => ({
      id: record.id,
      batchId: record.batchId,
      label: record.source?.sourceTag || record.source?.documentName || shortDocumentId(record.source?.documentId),
      documentName: record.source?.documentName || "",
      documentId: record.source?.documentId || "",
      partCount: record.parts.length,
      updatedAt: record.updatedAt
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function publicRequirement(requirement) {
  return {
    id: requirement.id,
    robotId: requirement.robotId,
    inventoryRecordId: requirement.inventoryRecordId,
    name: requirement.name,
    sourceType: requirement.sourceType,
    sourceDocument: requirement.sourceDocument,
    vendor: requirement.vendor,
    vendorSku: requirement.vendorSku,
    material: requirement.material,
    quantityNeeded: Number(requirement.quantityNeeded || 1),
    quantityReceived: Number(requirement.quantityReceived || 0),
    quantityInstalled: Number(requirement.quantityInstalled || 0),
    status: requirement.status || "needed"
  };
}

function settingsSnapshot() {
  return mergeSettings(store.settings);
}

async function updateSettings(req, res, session, actor) {
  requireCsrf(req, session);
  const next = validateSettings(await readJson(req));
  store.settings = mergeSettings({ ...store.settings, ...next, updatedAt: new Date().toISOString() });
  audit("settings.updated", "Updated global PlateFlow settings", actor.email);
  await persistStore();
  return json(res, 200, { settings: settingsSnapshot() });
}

function normalizePart(part, input) {
  const partId = String(part.partId || part.id || part.partid || "").trim();
  const material = part.material || {};
  const materialName = material.displayName || material.name || material.id || partCustomProperty(part, ["material"]) || "Unassigned";
  const thickness = partCustomProperty(part, ["thickness", "plate thickness", "sheet thickness"]);
  const partNumber = partCustomProperty(part, ["part number", "partnumber", "team part number"]);
  const subsystem = partCustomProperty(part, ["subsystem", "system"]);
  const stock = partCustomProperty(part, ["stock", "stock type"]);
  const machine = partCustomProperty(part, ["machine", "process", "manufacturing process"]) || "unknown";
  const category = partCustomProperty(part, ["category", "part category"]);
  const fabricationIntent = partCustomProperty(part, ["fabrication intent", "fab intent"]);
  return {
    id: partId,
    name: part.name || partId,
    type: "custom",
    category: category || "fabricated",
    material: materialName,
    materialLibrary: material.libraryName || material.libraryId || "",
    bodyType: part.bodyType || "",
    partNumber,
    subsystem,
    stock,
    thickness,
    quantity: 1,
    status: "extracted",
    process: machine,
    machine,
    fabricationIntent: fabricationIntent || "review_needed",
    finish: "Deburred",
    sourceDocument: input.sourceTag,
    sourceDocumentName: input.documentName || input.sourceTag,
    previewHref: findThumbnailHref(part),
    source: {
      documentId: input.documentId,
      workspaceId: input.workspaceId,
      elementId: input.elementId,
      partId,
      sourceTag: input.sourceTag,
      documentName: input.documentName || "",
      configuration: input.configuration || "",
      previewHref: findThumbnailHref(part)
    }
  };
}

function findThumbnailHref(value) {
  const direct = value?.thumbnail?.href || value?.thumbnailInfo?.href || value?.thumbnailUrl || value?.thumbnail?.url;
  if (direct) return String(direct);
  const seen = new Set();
  function walk(item, depth = 0, thumbnailContext = false) {
    if (!item || depth > 5) return "";
    if (typeof item === "string") {
      return thumbnailContext && /^(https?:\/\/|\/api\/|api\/)/i.test(item) ? item : "";
    }
    if (typeof item !== "object" || seen.has(item)) return "";
    seen.add(item);
    for (const [key, nested] of Object.entries(item)) {
      const lower = key.toLowerCase();
      const nextContext = thumbnailContext || lower.includes("thumbnail");
      if (nextContext && typeof nested === "string" && (lower === "href" || lower === "url" || /thumbnail/i.test(nested))) return nested;
      const found = walk(nested, depth + 1, nextContext);
      if (found) return found;
    }
    return "";
  }
  return walk(value);
}

function partCustomProperty(part, aliases) {
  const wanted = aliases.map(normalizePropertyName);
  const direct = findObjectValue(part?.customProperties, wanted);
  if (direct !== "") return direct;
  const nested = findNestedValue(part?.customProperties, wanted);
  if (nested !== "") return nested;
  return findNestedValue(part?.properties || part?.propertyValues, wanted);
}

function normalizeCotsRow(row, input, index) {
  const name = rowValue(row, ["name", "component name", "part name", "title", "description"]) || "Purchased item";
  const vendor = rowValue(row, ["vendor", "supplier", "supplier name"]);
  const vendorSku = rowValue(row, ["vendor sku", "vendor part number", "vendor part no", "sku", "catalog number", "part number"]);
  const manufacturer = rowValue(row, ["manufacturer", "mfg", "maker"]);
  const manufacturerSku = rowValue(row, ["manufacturer sku", "manufacturer part number", "mpn", "manufacturer part no"]);
  const quantity = numericRowValue(row, ["quantity", "qty", "count"]) || 1;
  const rowKey = rowValue(row, ["id", "row id", "rowId", "item", "item number"]) || `bom-${index + 1}`;
  return {
    id: String(rowKey).slice(0, 80),
    name: String(name).slice(0, 120),
    type: "cots",
    category: String(rowValue(row, ["category", "classification"]) || "purchased").slice(0, 80),
    vendor: vendor || "Unassigned",
    vendorSku,
    manufacturer,
    manufacturerSku,
    material: "Purchased",
    thickness: "",
    quantity: Math.min(999, Math.max(1, quantity)),
    status: "needed",
    procurementStatus: "needed",
    vendorUrl: vendorLink(vendor, vendorSku || manufacturerSku, name),
    sourceDocument: input.sourceTag,
    sourceDocumentName: input.documentName || input.sourceTag,
    source: {
      documentId: input.documentId,
      workspaceId: input.workspaceId,
      elementId: input.elementId,
      bomRowKey: String(rowKey),
      sourceTag: input.sourceTag,
      documentName: input.documentName || "",
      configuration: input.configuration || ""
    }
  };
}

function rowValue(row, aliases) {
  const wanted = aliases.map(normalizePropertyName);
  const direct = findObjectValue(row, wanted);
  if (direct !== "") return direct;
  for (const key of ["properties", "propertyValues", "values", "cells", "columns"]) {
    const nested = findNestedValue(row?.[key], wanted);
    if (nested !== "") return nested;
  }
  return "";
}

function numericRowValue(row, aliases) {
  const value = Number(String(rowValue(row, aliases)).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function findObjectValue(value, wanted) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  for (const [key, raw] of Object.entries(value)) {
    if (wanted.includes(normalizePropertyName(key))) return cleanCellValue(raw);
  }
  return "";
}

function findNestedValue(value, wanted) {
  if (!value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = normalizePropertyName(item?.name || item?.displayName || item?.columnName || item?.propertyName || item?.key || item?.id || "");
      if (wanted.includes(name)) {
        const cleaned = cleanCellValue(item?.value ?? item?.displayValue ?? item?.computedValue ?? item?.text);
        if (cleaned !== "") return cleaned;
      }
      const nested = findObjectValue(item, wanted);
      if (nested !== "") return nested;
    }
    return "";
  }
  return findObjectValue(value, wanted);
}

function cleanCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return String(value.displayValue ?? value.value ?? value.name ?? value.text ?? "").trim();
  }
  return String(value).trim();
}

function normalizePropertyName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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

async function createRobot(req, res, session, actor) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const name = String(body.name || "").trim().slice(0, 80);
  const season = String(body.season || new Date().getFullYear()).replace(/[^0-9]/g, "").slice(0, 4);
  if (!name) throw httpError(400, "Robot name is required");
  if (!season) throw httpError(400, "Season is required");
  const robot = {
    id: `robot-${season}-${randomBytes(4).toString("hex")}`,
    season,
    name,
    status: "active",
    subsystems: [
      { id: `drive-${randomBytes(2).toString("hex")}`, name: "Drive", lead: "", status: "designing" },
      { id: `intake-${randomBytes(2).toString("hex")}`, name: "Intake", lead: "", status: "designing" },
      { id: `shooter-${randomBytes(2).toString("hex")}`, name: "Shooter", lead: "", status: "designing" }
    ],
    createdAt: new Date().toISOString()
  };
  store.robots.unshift(robot);
  audit("robot.created", `Created robot ${robot.name}`, actor.email);
  await persistStore();
  return json(res, 201, { robots: robotSnapshot(), robotSources: robotSourceSnapshot() });
}

async function deleteRobot(req, res, session, actor, robotId) {
  requireCsrf(req, session);
  const index = store.robots.findIndex((robot) => robot.id === robotId);
  if (index === -1) throw httpError(404, "Robot not found");
  const [robot] = store.robots.splice(index, 1);
  store.requirements = store.requirements.filter((requirement) => requirement.robotId !== robotId);
  audit("robot.deleted", `Deleted robot ${robot.name}`, actor.email);
  await persistStore();
  return json(res, 200, { robots: robotSnapshot(), robotSources: robotSourceSnapshot() });
}

async function attachRobotRequirements(req, res, session, actor, robotId) {
  requireCsrf(req, session);
  const robot = store.robots.find((item) => item.id === robotId);
  if (!robot) throw httpError(404, "Robot not found");
  const body = await readJson(req);
  const inventoryRecordId = String(body.inventoryRecordId || "").trim();
  const record = store.inventoryRecords.find((item) => item.id === inventoryRecordId && item.sourceType === "cots");
  if (!record) throw httpError(404, "Select a synced Assembly BOM source first");
  const now = new Date().toISOString();
  let added = 0;
  for (const part of record.parts) {
    const key = `${robotId}:${record.id}:${part.id || part.name}`;
    if (store.requirements.some((requirement) => requirement.key === key)) continue;
    store.requirements.push({
      id: `req-${randomBytes(6).toString("hex")}`,
      key,
      robotId,
      inventoryRecordId: record.id,
      sourceType: record.sourceType,
      sourceDocument: part.sourceDocument || record.source?.sourceTag || record.source?.documentName || shortDocumentId(record.source?.documentId),
      name: part.name,
      vendor: part.vendor || "",
      vendorSku: part.vendorSku || "",
      material: part.material || "",
      quantityNeeded: Math.max(1, Number(part.quantity || 1)),
      quantityReceived: 0,
      quantityInstalled: 0,
      status: "needed",
      createdAt: now,
      updatedAt: now
    });
    added += 1;
  }
  audit("robot.requirements_attached", `Attached ${added} BOM item${added === 1 ? "" : "s"} to ${robot.name}`, actor.email);
  await persistStore();
  return json(res, 200, { robots: robotSnapshot(), robotSources: robotSourceSnapshot(), added });
}

async function updateRobotRequirement(req, res, session, actor, ids) {
  requireCsrf(req, session);
  const robot = store.robots.find((item) => item.id === ids.robotId);
  if (!robot) throw httpError(404, "Robot not found");
  const requirement = store.requirements.find((item) => item.id === ids.requirementId && item.robotId === ids.robotId);
  if (!requirement) throw httpError(404, "Requirement not found");
  const body = await readJson(req);
  const quantityNeeded = Math.max(1, Number(requirement.quantityNeeded || 1));
  if (body.received !== undefined) requirement.quantityReceived = body.received ? quantityNeeded : 0;
  if (body.installed !== undefined) {
    requirement.quantityInstalled = body.installed ? quantityNeeded : 0;
    if (body.installed) requirement.quantityReceived = quantityNeeded;
  }
  requirement.status = requirement.quantityInstalled >= quantityNeeded ? "installed" : requirement.quantityReceived >= quantityNeeded ? "received" : "needed";
  requirement.updatedAt = new Date().toISOString();
  audit("robot.requirement_updated", `Updated ${requirement.name} on ${robot.name} to ${requirement.status}`, actor.email);
  await persistStore();
  return json(res, 200, { robots: robotSnapshot(), robotSources: robotSourceSnapshot() });
}

function robotRequirementPath(pathname) {
  const match = pathname.match(/^\/api\/robots\/([^/]+)\/requirements\/([^/]+)$/);
  if (!match) throw httpError(404, "Requirement not found");
  return {
    robotId: decodeURIComponent(match[1]),
    requirementId: decodeURIComponent(match[2])
  };
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

async function createInventoryItem(req, res, session, actor) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const sourceType = String(body.sourceType || body.type || "cots").trim() === "custom" ? "custom" : "cots";
  const updates = validateInventoryItemUpdate(body, sourceType, { status: "stocked", quantityNeeded: 0, quantity: 0, onHand: 0 });
  const id = `manual-${randomBytes(7).toString("hex")}`;
  const now = new Date().toISOString();
  const part = {
    id,
    type: sourceType,
    ...updates,
    quantity: updates.quantityNeeded ?? 0,
    sourceDocument: "Manual",
    sourceDocumentName: "Manual shop inventory",
    source: {
      sourceTag: "Manual",
      documentName: "Manual shop inventory",
      partId: id
    },
    createdAt: now,
    updatedAt: now
  };
  const savedPart = sourceType === "custom" ? ensureCustomPartNumber(part, { sourceTag: "Manual", documentName: "Manual shop inventory" }) : part;
  const record = {
    id: `manual:${sourceType}:${id}`,
    batchId: `M-${now.slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
    sourceType,
    updatedAt: now,
    source: {
      sourceTag: "Manual",
      documentName: "Manual shop inventory"
    },
    parts: [savedPart]
  };
  store.inventoryRecords.unshift(record);
  upsertCatalogPart(savedPart, sourceType, record.batchId);
  audit("inventory.item_created", `Added manual inventory item ${savedPart.name}`, actor.email);
  await persistStore();
  return json(res, 201, inventoryMutationSnapshot());
}

async function updateInventoryItem(req, res, session, actor, itemKey) {
  requireCsrf(req, session);
  const match = findInventoryItem(itemKey);
  if (!match) throw httpError(404, "Inventory item not found");
  const previous = structuredClone(match.part);
  const previousCatalog = findCatalogPartForInventoryPart(previous, match.record.sourceType);
  const updates = validateInventoryItemUpdate(await readJson(req), match.record.sourceType, match.part);
  let next = {
    ...match.part,
    ...updates,
    quantity: updates.quantityNeeded ?? match.part.quantity ?? match.part.quantityNeeded ?? 1,
    updatedAt: new Date().toISOString()
  };
  if (match.record.sourceType === "custom") next = ensureCustomPartNumber(next, match.record.source || next.source || {});
  match.record.parts.splice(match.partIndex, 1, next);
  match.record.updatedAt = next.updatedAt;

  const catalog = upsertCatalogPart(next, match.record.sourceType, match.record.batchId);
  if (previousCatalog && previousCatalog.id !== catalog.id) updateQueueCatalogPart(previousCatalog.id, catalog, next, match.record.sourceType);
  else updateQueueCatalogPart(catalog.id, catalog, next, match.record.sourceType);
  removeUnusedCatalogPart(previous, match.record.sourceType, catalog.id);

  audit("inventory.item_updated", `Updated ${next.name}`, actor.email);
  await persistStore();
  return json(res, 200, inventoryMutationSnapshot());
}

async function deleteInventoryItem(req, res, session, actor, itemKey) {
  requireCsrf(req, session);
  const match = findInventoryItem(itemKey);
  if (!match) throw httpError(404, "Inventory item not found");
  const [removed] = match.record.parts.splice(match.partIndex, 1);
  match.record.updatedAt = new Date().toISOString();
  const catalog = findCatalogPartForInventoryPart(removed, match.record.sourceType);
  if (!match.record.parts.length) {
    store.inventoryRecords = store.inventoryRecords.filter((record) => record.id !== match.record.id);
    removeOperationalQueue(match.record.batchId, match.record.sourceType);
  } else if (catalog) {
    removeQueueCatalogPart(catalog.id, match.record.sourceType);
  }
  removeUnusedCatalogPart(removed, match.record.sourceType);
  removeRequirementsForInventoryPart(match.record.id, removed);
  audit("inventory.item_deleted", `Deleted ${removed.name || inventoryItemPartKey(removed)}`, actor.email);
  await persistStore();
  return json(res, 200, inventoryMutationSnapshot());
}

function inventoryMutationSnapshot() {
  const snapshot = dashboardSnapshot();
  return {
    inventory: snapshot.inventory,
    fabrication: snapshot.fabrication,
    procurement: snapshot.procurement,
    robots: snapshot.robots,
    robotSources: snapshot.robotSources
  };
}

function validateInventoryItemUpdate(body, sourceType, existing = {}) {
  const quantityNeeded = boundedInteger(body.quantityNeeded ?? body.quantity, Number(existing.quantityNeeded ?? existing.quantity ?? 1), 0, 999);
  const onHand = boundedInteger(body.onHand, Number(existing.onHand || 0), 0, 99999);
  const reserved = boundedInteger(body.reserved, Number(existing.reserved || 0), 0, 99999);
  const ordered = boundedInteger(body.ordered, Number(existing.ordered || 0), 0, 99999);
  const name = String(body.name ?? existing.name ?? "").trim().slice(0, 140);
  if (!name) throw httpError(400, "Part name is required");
  const base = {
    name,
    category: String(body.category ?? existing.category ?? (sourceType === "custom" ? "fabricated" : "purchased")).trim().slice(0, 80),
    status: String(body.status ?? existing.status ?? (sourceType === "custom" ? "extracted" : "needed")).trim().slice(0, 60),
    quantity: quantityNeeded,
    quantityNeeded,
    onHand,
    reserved,
    ordered,
    defaultLocation: String(body.defaultLocation ?? existing.defaultLocation ?? "").trim().slice(0, 120),
    tags: Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12)
      : String(body.tags ?? (Array.isArray(existing.tags) ? existing.tags.join(",") : "")).split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12)
  };
  if (sourceType === "cots") {
    return {
      ...base,
      vendor: String(body.vendor ?? body.material ?? existing.vendor ?? "").trim().slice(0, 100),
      vendorSku: String(body.vendorSku ?? body.partNumber ?? existing.vendorSku ?? "").trim().slice(0, 100),
      manufacturer: String(body.manufacturer ?? existing.manufacturer ?? "").trim().slice(0, 100),
      manufacturerSku: String(body.manufacturerSku ?? existing.manufacturerSku ?? "").trim().slice(0, 100),
      partNumber: String(body.partNumber ?? existing.partNumber ?? body.vendorSku ?? existing.vendorSku ?? "").trim().slice(0, 80)
    };
  }
  return {
    ...base,
    material: String(body.material ?? existing.material ?? "").trim().slice(0, 120),
    thickness: String(body.thickness ?? existing.thickness ?? "").trim().slice(0, 40),
    process: String(body.process ?? body.machine ?? existing.process ?? existing.machine ?? "").trim().slice(0, 80),
    machine: String(body.machine ?? body.process ?? existing.machine ?? existing.process ?? "").trim().slice(0, 80),
    stock: String(body.stock ?? existing.stock ?? "").trim().slice(0, 80),
    partNumber: String(body.partNumber ?? existing.partNumber ?? "").trim().slice(0, 80),
    subsystem: String(body.subsystem ?? existing.subsystem ?? "").trim().slice(0, 80)
  };
}

function updateQueueCatalogPart(catalogPartId, catalog, part, sourceType) {
  if (!catalogPartId) return;
  if (sourceType === "custom") {
    for (const job of store.fabricationJobs) {
      if (!Array.isArray(job.lines)) continue;
      job.lines = job.lines.map((line) => line.catalogPartId === catalogPartId ? {
        ...line,
        catalogPartId: catalog.id,
        name: part.name,
        material: part.material || "",
        thickness: part.thickness || "",
        subsystem: part.subsystem || "",
        stock: part.stock || "",
        process: part.process || part.machine || "unknown",
        machine: part.machine || part.process || "unknown",
        quantityNeeded: Number(part.quantityNeeded ?? part.quantity ?? 1)
      } : line);
      job.grouping = groupCustomParts(job.lines);
    }
    return;
  }
  for (const order of store.procurementOrders) {
    if (!Array.isArray(order.lines)) continue;
    order.lines = order.lines.map((line) => line.catalogPartId === catalogPartId ? {
      ...line,
      catalogPartId: catalog.id,
      name: part.name,
      vendor: part.vendor || "Unassigned",
      vendorSku: part.vendorSku || "",
      quantityNeeded: Number(part.quantityNeeded ?? part.quantity ?? 1)
    } : line);
    order.vendorGroups = groupCotsParts(order.lines.map((line) => ({
      vendor: line.vendor,
      quantityNeeded: line.quantityNeeded
    })));
  }
}

function removeQueueCatalogPart(catalogPartId, sourceType) {
  if (!catalogPartId) return;
  if (sourceType === "custom") {
    store.fabricationJobs = store.fabricationJobs.filter((job) => {
      job.lines = Array.isArray(job.lines) ? job.lines.filter((line) => line.catalogPartId !== catalogPartId) : [];
      job.grouping = groupCustomParts(job.lines);
      return job.lines.length;
    });
    return;
  }
  for (const order of store.procurementOrders) {
    order.lines = Array.isArray(order.lines) ? order.lines.filter((line) => line.catalogPartId !== catalogPartId) : [];
    order.vendorGroups = groupCotsParts(order.lines.map((line) => ({
      vendor: line.vendor,
      quantityNeeded: line.quantityNeeded
    })));
  }
  store.procurementOrders = store.procurementOrders.filter((order) => order.lines?.length);
}

function removeUnusedCatalogPart(part, sourceType, keepId = "") {
  const identity = partIdentity(part, sourceType);
  const stillUsed = store.inventoryRecords.some((record) => (
    record.sourceType === sourceType &&
    record.parts.some((item) => partIdentity(item, sourceType) === identity)
  ));
  if (!stillUsed) store.catalogParts = store.catalogParts.filter((item) => item.identity !== identity || item.id === keepId);
}

function removeRequirementsForInventoryPart(recordId, part) {
  const keySuffix = `:${recordId}:${inventoryItemPartKey(part)}`;
  store.requirements = store.requirements.filter((requirement) => (
    requirement.inventoryRecordId !== recordId ||
    (!String(requirement.key || "").endsWith(keySuffix) && requirement.name !== part.name)
  ));
}

async function removePlaceholderCots(req, res, session) {
  requireCsrf(req, session);
  const placeholderNames = new Set(["NEO V1.1 Brushless Motor", "1/2 in Hex Bearing", "HTD 5mm Belt 60T"]);
  const before = {
    records: store.inventoryRecords.length,
    catalogParts: store.catalogParts.length,
    procurementOrders: store.procurementOrders.length,
    syncBatches: store.syncBatches.length
  };
  store.inventoryRecords = store.inventoryRecords.map((record) => ({
    ...record,
    parts: record.parts.filter((part) => !(record.sourceType === "cots" && placeholderNames.has(part.name)))
  })).filter((record) => record.parts.length);
  store.catalogParts = store.catalogParts.filter((part) => !(part.sourceType === "cots" && placeholderNames.has(part.name)));
  store.procurementOrders = store.procurementOrders.filter((order) => !order.lines?.some((line) => placeholderNames.has(line.name)));
  store.syncBatches = store.syncBatches.filter((batch) => batch.sourceType !== "cots" || batch.label !== "Assembly BOM procurement sync");
  const removed = {
    records: before.records - store.inventoryRecords.length,
    catalogParts: before.catalogParts - store.catalogParts.length,
    procurementOrders: before.procurementOrders - store.procurementOrders.length,
    syncBatches: before.syncBatches - store.syncBatches.length
  };
  audit("admin.cleanup_placeholder_cots", `Removed placeholder COTS data: ${JSON.stringify(removed)}`, session.user?.label || "user");
  await persistStore();
  return json(res, 200, { removed });
}

function adminUsersSnapshot() {
  const activeUsers = store.users.filter((user) => user.status === "active");
  const pendingInvites = store.invites.filter((invite) => invite.status === "pending");
  return {
    counts: {
      users: store.users.length,
      active: activeUsers.length,
      admins: activeUsers.filter((user) => user.role === "admin").length,
      pendingInvites: pendingInvites.length
    },
    users: store.users.map(publicAppUser),
    invites: store.invites.slice(0, 50).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      inviteUrl: `${config.appBaseUrl}/?invite=${invite.token}`,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt
    }))
  };
}

async function createInvite(req, res, session, actor) {
  requireCsrf(req, session);
  const body = await readJson(req);
  const invite = validateInvite(body);
  if (store.users.some((user) => user.email === invite.email)) throw httpError(409, "That user already has an account");
  store.invites = store.invites.filter((item) => !(item.email === invite.email && item.status === "pending"));
  store.invites.unshift({
    id: `invite-${randomBytes(6).toString("hex")}`,
    token: randomBytes(24).toString("base64url"),
    email: invite.email,
    role: invite.role,
    status: "pending",
    createdBy: actor.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
  });
  audit("admin.invite_created", `Invited ${invite.email} as ${invite.role}`, actor.email);
  await persistStore();
  return json(res, 201, adminUsersSnapshot());
}

async function updateAdminUser(req, res, session, actor, userId) {
  requireCsrf(req, session);
  const target = store.users.find((user) => user.id === userId);
  if (!target) throw httpError(404, "User not found");
  const body = await readJson(req);
  const nextName = String(body.name || "").trim().slice(0, 80);
  const nextRole = validateRole(body.role || target.role);
  const nextStatus = validateUserStatus(body.status || target.status);
  if (!nextName) throw httpError(400, "Name is required");

  const removingActiveAdmin = target.status === "active" && target.role === "admin" && (nextRole !== "admin" || nextStatus !== "active");
  if (removingActiveAdmin && activeAdminCount() <= 1) throw httpError(400, "PlateFlow must keep at least one active admin");

  target.name = nextName;
  target.role = nextRole;
  target.status = nextStatus;
  target.updatedAt = new Date().toISOString();
  if (nextStatus === "active" && !target.approvedAt) target.approvedAt = target.updatedAt;
  for (const activeSession of sessions.values()) {
    if (activeSession.appUserId === target.id && target.status !== "active") activeSession.appUserId = null;
  }
  audit("admin.user_updated", `Updated ${target.email} to ${target.role}/${target.status}`, actor.email);
  await persistStore();
  return json(res, 200, adminUsersSnapshot());
}

async function deleteAdminUser(req, res, session, actor, userId) {
  requireCsrf(req, session);
  const targetIndex = store.users.findIndex((user) => user.id === userId);
  if (targetIndex === -1) throw httpError(404, "User not found");
  const target = store.users[targetIndex];
  if (target.id === actor.id) throw httpError(400, "You cannot delete your own account while signed in");
  if (target.status === "active" && target.role === "admin" && activeAdminCount() <= 1) {
    throw httpError(400, "PlateFlow must keep at least one active admin");
  }
  store.users.splice(targetIndex, 1);
  for (const activeSession of sessions.values()) {
    if (activeSession.appUserId === target.id) activeSession.appUserId = null;
  }
  audit("admin.user_deleted", `Deleted ${target.email}`, actor.email);
  await persistStore();
  return json(res, 200, adminUsersSnapshot());
}

async function updateFabricationJob(req, res, session, actor, jobId) {
  requireCsrf(req, session);
  ensureIndividualFabricationJobs();
  const job = store.fabricationJobs.find((item) => item.id === jobId);
  if (!job) throw httpError(404, "Fabrication job not found");
  const body = await readJson(req);
  if (body.status === "canceled" || body.status === "delete") {
    return deleteFabricationJob(req, res, session, actor, jobId, { csrfChecked: true });
  }
  const status = validateFabricationStatus(body.status || job.status);
  job.status = status;
  job.updatedAt = new Date().toISOString();
  if (Array.isArray(job.lines)) {
    job.lines = job.lines.map((line) => ({ ...line, status }));
  }
  audit("fabrication.job_updated", `Updated ${job.id} to ${job.status}`, actor.email);
  await persistStore();
  return json(res, 200, { fabrication: dashboardSnapshot().fabrication });
}

async function deleteFabricationJob(req, res, session, actor, jobId, options = {}) {
  if (!options.csrfChecked) requireCsrf(req, session);
  ensureIndividualFabricationJobs();
  const index = store.fabricationJobs.findIndex((item) => item.id === jobId);
  if (index === -1) throw httpError(404, "Fabrication job not found");
  const [job] = store.fabricationJobs.splice(index, 1);
  const line = Array.isArray(job.lines) ? job.lines[0] : null;
  audit("fabrication.job_deleted", `Deleted ${line?.name || job.id}`, actor.email);
  await persistStore();
  return json(res, 200, { fabrication: dashboardSnapshot().fabrication });
}

async function updateProcurementOrder(req, res, session, actor, orderId) {
  requireCsrf(req, session);
  const order = store.procurementOrders.find((item) => item.id === orderId);
  if (!order) throw httpError(404, "Procurement order not found");
  const body = await readJson(req);
  const status = validateProcurementStatus(body.status || order.status);
  order.status = status;
  order.updatedAt = new Date().toISOString();
  if (Array.isArray(order.lines)) {
    order.lines = order.lines.map((line) => ({ ...line, status }));
  }
  audit("procurement.order_updated", `Updated ${order.id} to ${order.status}`, actor.email);
  await persistStore();
  return json(res, 200, { procurement: dashboardSnapshot().procurement });
}

function activeAdminCount() {
  return store.users.filter((user) => user.role === "admin" && user.status === "active").length;
}

function validateRole(value) {
  const role = String(value || "").trim();
  const roles = new Set(["admin", "mentor", "purchaser", "fabricator", "student", "read_only"]);
  if (!roles.has(role)) throw httpError(400, "Invalid role");
  return role;
}

function validateUserStatus(value) {
  const status = String(value || "").trim();
  const statuses = new Set(["active", "disabled", "pending"]);
  if (!statuses.has(status)) throw httpError(400, "Invalid user status");
  return status;
}

function validateFabricationStatus(value) {
  const status = String(value || "").trim();
  const statuses = new Set(["todo", "in_progress", "completed"]);
  if (!statuses.has(status)) throw httpError(400, "Invalid fabrication status");
  return status;
}

function validateProcurementStatus(value) {
  const status = String(value || "").trim();
  const statuses = new Set(["needed", "sourcing", "ready_to_order", "ordered", "partially_received", "received", "backordered", "canceled"]);
  if (!statuses.has(status)) throw httpError(400, "Invalid procurement status");
  return status;
}

function validateSettings(body) {
  const existing = settingsSnapshot();
  const partNumber = body?.partNumber || body || {};
  const template = String(partNumber.template || existing.partNumber.template).trim().slice(0, 120);
  const prefix = String(partNumber.prefix ?? existing.partNumber.prefix).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "PF";
  const sourceLength = boundedInteger(partNumber.sourceLength, existing.partNumber.sourceLength, 1, 12);
  const subsystemLength = boundedInteger(partNumber.subsystemLength, existing.partNumber.subsystemLength, 1, 12);
  const partLength = boundedInteger(partNumber.partLength, existing.partNumber.partLength, 1, 16);
  if (!template.includes("{part}")) throw httpError(400, "Part number template must include {part}");
  return {
    partNumber: {
      template,
      prefix,
      sourceLength,
      subsystemLength,
      partLength
    }
  };
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function validateInvite(body) {
  const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
  const role = validateRole(body.role || "student");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Valid email is required");
  return { email, role };
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

async function inventoryItemThumbnail(res, session, itemKey) {
  const match = findInventoryItem(itemKey);
  if (!match) return placeholderThumbnail(res, "Missing");
  const cached = imageFromDataUrl(match.part.previewDataUrl || match.part.source?.previewDataUrl);
  if (cached?.bytes?.length) {
    res.writeHead(200, {
      "Content-Type": cached.contentType,
      "Cache-Control": "private, max-age=86400"
    });
    return res.end(cached.bytes);
  }
  if (match.record.sourceType === "custom" && session.token) {
    try {
      const preview = await fetchOnshapePartPreview(session, match.record, match.part);
      if (preview?.bytes?.length) {
        await cacheInventoryPreview(match, preview);
        res.writeHead(200, {
          "Content-Type": preview.contentType || "image/png",
          "Cache-Control": "private, max-age=300"
        });
        return res.end(preview.bytes);
      }
    } catch (error) {
      console.warn("Onshape preview failed", error.message);
    }
  }
  return placeholderThumbnail(res, match.part.name || match.part.id || "Part", match.record.sourceType);
}

function imageFromDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64")
  };
}

async function cacheInventoryPreview(match, preview) {
  const contentType = preview.contentType || "image/png";
  if (!/^image\//i.test(contentType) || !preview.bytes?.length || preview.bytes.length > 350_000) return;
  const dataUrl = `data:${contentType};base64,${preview.bytes.toString("base64")}`;
  match.part.previewDataUrl = dataUrl;
  match.part.source = { ...(match.part.source || {}), previewDataUrl: dataUrl };
  match.record.updatedAt = new Date().toISOString();
  const catalog = findCatalogPartForInventoryPart(match.part, match.record.sourceType);
  if (catalog) {
    catalog.previewDataUrl = dataUrl;
    catalog.updatedAt = match.record.updatedAt;
  }
  await persistStore();
}

async function fetchOnshapePartPreview(session, record, part) {
  const source = part.source || record.source || {};
  if (!source.documentId || !source.workspaceId || !source.elementId) return null;
  const accessToken = await ensureAccessToken(session);
  const base = normalizeOnshapeBase(source.baseUrl || record.source?.baseUrl || config.onshapeApiBase);
  const storedPreview = await fetchOnshapePreviewHref(accessToken, base, part.previewHref || source.previewHref);
  if (storedPreview?.bytes?.length) return storedPreview;
  const params = new URLSearchParams({
    outputWidth: "160",
    outputHeight: "160",
    pixelSize: "0"
  });
  if (source.partId) params.set("partIds", source.partId);
  if (source.configuration) params.set("configuration", source.configuration);
  const workspacePath = source.workspacePath || record.source?.workspacePath || "w";
  const workspaceId = source.workspaceId || record.source?.workspaceId;
  const urls = [
    `${base}/api/v6/partstudios/d/${source.documentId}/${workspacePath}/${workspaceId}/e/${source.elementId}/shadedviews?${params}`,
    `${base}/api/partstudios/d/${source.documentId}/${workspacePath}/${workspaceId}/e/${source.elementId}/shadedviews?${params}`
  ];
  for (const url of urls) {
    try {
      const result = await onshapeJson(accessToken, url);
      const image = normalizeImagePayload(extractShadedImagePayload(result, source.partId));
      if (image?.bytes?.length) return image;
    } catch (error) {
      if (![400, 404].includes(Number(error.status || 0))) throw error;
    }
  }
  return null;
}

async function fetchOnshapePreviewHref(accessToken, base, href) {
  if (!href) return null;
  const url = resolveOnshapeHref(base, href);
  const response = await fetch(url, {
    headers: {
      Accept: "image/*,application/json;q=0.8,*/*;q=0.4",
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (/json/i.test(contentType)) {
    const data = await response.json();
    return normalizeImagePayload(extractShadedImagePayload(data));
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: contentType || "image/png"
  };
}

function resolveOnshapeHref(base, href) {
  const value = String(href || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

function extractShadedImagePayload(value, partId = "", depth = 0) {
  if (!value || depth > 6) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractShadedImagePayload(item, partId, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  if (partId && value[partId]) {
    const found = extractShadedImagePayload(value[partId], partId, depth + 1);
    if (found) return found;
  }
  for (const key of ["image", "data", "base64", "imageData", "thumbnail", "href", "url"]) {
    const found = extractShadedImagePayload(value[key], partId, depth + 1);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = extractShadedImagePayload(nested, partId, depth + 1);
    if (found) return found;
  }
  return "";
}

function normalizeImagePayload(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  const contentType = match?.[1] || "image/png";
  const base64 = match ? match[2] : value;
  if (!/^[a-z0-9+/=\s_-]{80,}$/i.test(base64)) return null;
  const compact = base64.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  return {
    bytes: Buffer.from(compact, "base64"),
    contentType
  };
}

function placeholderThumbnail(res, label, sourceType = "custom") {
  const initials = String(label || "PF").trim().slice(0, 2).toUpperCase().replace(/[<&>]/g, "");
  const accent = sourceType === "cots" ? "#22c55e" : "#60a5fa";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${escapeXml(label)} preview"><rect width="160" height="160" rx="18" fill="#0b1020"/><path d="M36 52h88v56H36z" rx="8" fill="#111827" stroke="${accent}" stroke-width="5"/><circle cx="58" cy="74" r="5" fill="${accent}"/><circle cx="102" cy="74" r="5" fill="${accent}"/><circle cx="58" cy="96" r="5" fill="${accent}"/><circle cx="102" cy="96" r="5" fill="${accent}"/><text x="80" y="86" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#f8fafc">${escapeXml(initials)}</text></svg>`;
  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, max-age=300"
  });
  return res.end(svg);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  }[char]));
}

function validateImport(body) {
  const id = /^[a-zA-Z0-9_-]{8,80}$/;
  const input = {
    documentId: String(body.documentId || body.did || "").trim(),
    workspaceId: String(body.workspaceId || body.wid || "").trim(),
    workspaceOrVersion: String(body.workspaceOrVersion || "w").trim().toLowerCase(),
    elementId: String(body.elementId || body.eid || "").trim(),
    configuration: String(body.configuration || "").trim(),
    sourceTag: String(body.sourceTag || body.documentTag || "").trim().slice(0, 80),
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
