let csrfToken = "";
let source = null;
let parts = [];
let embeddedMode = false;
let bootstrapRequired = false;
let inviteToken = "";

const els = {
  appShell: document.querySelector("#appShell"),
  loginScreen: document.querySelector("#loginScreen"),
  plateflowLoginForm: document.querySelector("#plateflowLoginForm"),
  plateflowLoginButton: document.querySelector("#plateflowLoginButton"),
  loginHelp: document.querySelector("#loginHelp"),
  loginMessage: document.querySelector("#loginMessage"),
  nameField: document.querySelector("#nameField"),
  appAuthStatus: document.querySelector("#appAuthStatus"),
  storageStatus: document.querySelector("#storageStatus"),
  authStatus: document.querySelector("#authStatus"),
  loginLink: document.querySelector("#loginLink"),
  logoutLink: document.querySelector("#logoutLink"),
  appLogoutLink: document.querySelector("#appLogoutLink"),
  importForm: document.querySelector("#importForm"),
  demoButton: document.querySelector("#demoButton"),
  partsBody: document.querySelector("#partsBody"),
  partCount: document.querySelector("#partCount"),
  exportButton: document.querySelector("#exportButton"),
  selectAll: document.querySelector("#selectAll"),
  orderForm: document.querySelector("#orderForm"),
  themeToggle: document.querySelector("#themeToggle"),
  syncTitle: document.querySelector("#syncTitle"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  metricImports: document.querySelector("#metricImports"),
  metricParts: document.querySelector("#metricParts"),
  metricCustom: document.querySelector("#metricCustom"),
  metricCots: document.querySelector("#metricCots"),
  metricFabrication: document.querySelector("#metricFabrication"),
  metricProcurement: document.querySelector("#metricProcurement"),
  inventorySearch: document.querySelector("#inventorySearch"),
  inventoryBody: document.querySelector("#inventoryBody"),
  robotList: document.querySelector("#robotList"),
  fabQueueCount: document.querySelector("#fabQueueCount"),
  procQueueCount: document.querySelector("#procQueueCount"),
  fabricationJobs: document.querySelector("#fabricationJobs"),
  procurementOrders: document.querySelector("#procurementOrders"),
  batchList: document.querySelector("#batchList"),
  rawMaterialForm: document.querySelector("#rawMaterialForm"),
  rawMaterialList: document.querySelector("#rawMaterialList"),
  inviteForm: document.querySelector("#inviteForm"),
  userList: document.querySelector("#userList"),
  auditLog: document.querySelector("#auditLog"),
  summaryParts: document.querySelector("#summaryParts"),
  summaryQty: document.querySelector("#summaryQty"),
  summaryMaterials: document.querySelector("#summaryMaterials"),
  message: document.querySelector("#message")
};

const demoParts = [
  { id: "JHD", name: "belly-pan-main", material: "6061 Aluminum", thickness: "0.125 in", quantity: 1, finish: "Deburred", selected: true },
  { id: "JFF", name: "swerve-rail-gusset-L", material: "5052 Aluminum", thickness: "0.090 in", quantity: 4, finish: "Tumbled", selected: true },
  { id: "JKK", name: "intake-side-plate", material: "6061 Aluminum", thickness: "0.1875 in", quantity: 2, finish: "Deburred", selected: true },
  { id: "JRM", name: "battery-retainer", material: "304 Stainless Steel", thickness: "0.060 in", quantity: 2, finish: "Raw", selected: false }
];

const roles = ["admin", "mentor", "purchaser", "fabricator", "student", "read_only"];
const userStatuses = ["active", "disabled", "pending"];
const fabricationStatuses = ["draft", "queued", "in_progress", "sent_out", "completed", "received", "installed", "canceled"];

init();

async function init() {
  const params = new URLSearchParams(location.search);
  embeddedMode = location.pathname.startsWith("/onshape") || params.get("embedded") === "1";
  inviteToken = params.get("invite") || "";
  document.body.classList.toggle("embedded", embeddedMode);
  applyTheme(localStorage.getItem("plateflow-theme") || "dark");
  bindEvents();

  for (const [urlKey, formKey] of [
    ["did", "documentId"],
    ["documentId", "documentId"],
    ["wid", "workspaceId"],
    ["workspaceId", "workspaceId"],
    ["workspaceOrVersionId", "workspaceId"],
    ["eid", "elementId"],
    ["elementId", "elementId"],
    ["tabElementId", "elementId"],
    ["configuration", "configuration"]
  ]) {
    const value = params.get(urlKey);
    if (value && !isUnresolvedMacro(value)) els.importForm.elements[formKey].value = value;
  }
  if (params.get("server") && !isUnresolvedMacro(params.get("server"))) {
    els.importForm.dataset.baseUrl = normalizeOnshapeServer(params.get("server"));
  }
  if (params.get("workspaceOrVersion")) {
    els.importForm.dataset.workspaceOrVersion = params.get("workspaceOrVersion");
  }
  setSyncMode(params.get("mode") === "assembly" || params.get("mode") === "cots" ? "cots" : "custom");

  try {
    const session = await api("/api/session", {}, { skipCsrfRetry: true });
    csrfToken = session.csrfToken;
    bootstrapRequired = Boolean(session.bootstrapRequired);
    renderAuth(session);
    renderAppAccess(session);
    if (!session.appAuthenticated && !session.bootstrapRequired) {
      if (els.loginMessage) els.loginMessage.textContent = embeddedMode ? "Sign in to your PlateFlow account before syncing from Onshape." : "";
    } else if (embeddedMode && session.authenticated && hasOnshapeContext()) {
      setMessage("Onshape connected. Press Submit sync batch when you are ready.", "ok");
    } else if (embeddedMode && !session.authenticated) {
      setMessage("Log in with Onshape, then submit this tab to PlateFlow inventory.", "");
    } else if (embeddedMode) {
      setMessage("PlateFlow is missing document context. Check the Onshape extension action URL.", "error");
    } else if (!embeddedMode && canLoadDashboard(session)) {
      await loadDashboard();
    }
  } catch (error) {
    setMessage(`Could not initialize the session: ${error.message}`, "error");
  }

  renderParts();
}

function bindEvents() {
  els.importForm.addEventListener("submit", onImport);
  if (els.plateflowLoginForm) els.plateflowLoginForm.addEventListener("submit", onPlateFlowLogin);
  if (els.inviteForm) els.inviteForm.addEventListener("submit", onInviteCreate);
  if (els.userList) els.userList.addEventListener("click", onAdminUserAction);
  if (els.fabricationJobs) els.fabricationJobs.addEventListener("change", onFabricationJobChange);
  els.demoButton.addEventListener("click", loadDemo);
  els.partsBody.addEventListener("input", onPartEdit);
  els.partsBody.addEventListener("change", onPartEdit);
  els.selectAll.addEventListener("change", toggleAll);
  els.exportButton.addEventListener("click", onExport);
  if (els.orderForm) els.orderForm.addEventListener("submit", onOrder);
  if (els.rawMaterialForm) els.rawMaterialForm.addEventListener("submit", onRawMaterialAdd);
  if (els.inventorySearch) els.inventorySearch.addEventListener("input", () => loadDashboard());
  els.modeTabs.forEach((button) => button.addEventListener("click", () => setSyncMode(button.dataset.mode)));
  if (els.themeToggle) els.themeToggle.addEventListener("click", toggleTheme);
}

function renderAuth(session) {
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
  els.loginLink.href = `/auth/onshape?returnTo=${returnTo}`;
  if (session.authenticated) {
    els.authStatus.textContent = "Onshape connected";
    els.authStatus.classList.add("ok");
    els.loginLink.classList.add("hidden");
    els.logoutLink.classList.remove("hidden");
  } else {
    els.authStatus.textContent = session.configured ? "Not signed in" : "OAuth not configured";
    els.authStatus.classList.remove("ok");
    els.loginLink.classList.remove("hidden");
    els.logoutLink.classList.add("hidden");
  }
}

function renderAppAccess(session) {
  bootstrapRequired = Boolean(session.bootstrapRequired);
  const allowApp = canLoadDashboard(session);
  els.loginScreen?.classList.toggle("hidden", allowApp);
  els.appShell?.classList.toggle("hidden", !allowApp);
  document.body.classList.toggle("locked", !allowApp);
  document.body.classList.toggle("bootstrap", Boolean(session.bootstrapRequired));
  document.body.classList.toggle("admin-user", session.appUser?.role === "admin");
  if (els.nameField) els.nameField.classList.toggle("hidden", !session.bootstrapRequired);
  if (els.plateflowLoginForm?.elements.inviteToken) {
    els.plateflowLoginForm.elements.inviteToken.value = inviteToken;
    if (inviteToken && !session.bootstrapRequired) els.nameField?.classList.remove("hidden");
  }
  if (els.loginHelp) els.loginHelp.textContent = session.bootstrapRequired ? "Create the first admin account." : inviteToken ? "Create your invited PlateFlow account." : "Sign in to continue.";
  if (els.plateflowLoginButton) els.plateflowLoginButton.textContent = session.bootstrapRequired ? "Create admin" : inviteToken ? "Create account" : "Log in";
  if (els.appAuthStatus) {
    if (session.bootstrapRequired) {
      els.appAuthStatus.textContent = "Setup required";
      els.appAuthStatus.classList.remove("ok");
    } else if (session.appAuthenticated) {
      els.appAuthStatus.textContent = session.appUser ? `${session.appUser.name || session.appUser.email} · ${session.appUser.role}` : "Signed in";
      els.appAuthStatus.classList.add("ok");
    } else {
      els.appAuthStatus.textContent = "Not signed in";
      els.appAuthStatus.classList.remove("ok");
    }
  }
  if (els.storageStatus) {
    const postgres = session.storage?.kind === "postgres";
    els.storageStatus.textContent = postgres ? "Postgres connected" : "Local storage";
    els.storageStatus.classList.toggle("ok", postgres);
    els.storageStatus.classList.toggle("warn", !postgres);
  }
  if (els.appLogoutLink) els.appLogoutLink.classList.toggle("hidden", !session.appAuthenticated);
}

function canLoadDashboard(session) {
  return Boolean(session.appAuthenticated);
}

async function onPlateFlowLogin(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(els.plateflowLoginForm).entries());
  try {
    const createAccount = bootstrapRequired || Boolean(body.inviteToken);
    const session = await api(createAccount ? "/auth/plateflow/register" : "/auth/plateflow/login", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const nextSession = session.session || await refreshSession();
    csrfToken = nextSession.csrfToken || csrfToken;
    renderAuth(nextSession);
    renderAppAccess(nextSession);
    els.loginMessage.textContent = "";
    els.plateflowLoginForm.reset();
    await loadDashboard();
  } catch (error) {
    els.loginMessage.textContent = error.message;
    els.loginMessage.className = "message error";
  }
}

async function onImport(event) {
  event.preventDefault();
  const form = new FormData(els.importForm);
  source = Object.fromEntries(form.entries());
  const mode = source.syncMode === "cots" ? "cots" : "custom";
  source.configuration = isUnresolvedMacro(source.configuration) ? "" : source.configuration;
  if (els.importForm.dataset.baseUrl) source.baseUrl = els.importForm.dataset.baseUrl;
  if (els.importForm.dataset.workspaceOrVersion) source.workspaceOrVersion = els.importForm.dataset.workspaceOrVersion;
  setMessage(mode === "cots" ? "Submitting Assembly BOM rows to procurement..." : "Reading custom parts and assigned materials from Onshape...");
  try {
    const result = await api(mode === "cots" ? "/api/onshape/import-cots" : "/api/onshape/import", {
      method: "POST",
      body: JSON.stringify(source)
    });
    parts = result.parts.map((part) => ({ ...part, selected: true }));
    source = result.source;
    renderParts();
    if (!embeddedMode) await loadDashboard();
    const noun = parts.length === 1 ? "part" : "parts";
    setMessage(embeddedMode ? `Sent ${parts.length} ${noun} to the PlateFlow dashboard.` : `Imported ${parts.length} ${noun} into ${mode === "cots" ? "procurement" : "fabrication"} inventory.`, "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function setSyncMode(mode) {
  const selected = mode === "cots" ? "cots" : "custom";
  els.importForm.elements.syncMode.value = selected;
  els.modeTabs.forEach((button) => button.classList.toggle("active", button.dataset.mode === selected));
  if (els.syncTitle) els.syncTitle.textContent = selected === "cots" ? "Assembly BOM COTS sync" : "Part Studio custom sync";
  if (embeddedMode) {
    setMessage(selected === "cots" ? "Assembly mode: submit purchased BOM rows to procurement." : "Part Studio mode: submit custom parts to fabrication inventory.", "");
  }
}

function applyTheme(theme) {
  document.body.dataset.theme = theme === "light" ? "light" : "dark";
  if (els.themeToggle) els.themeToggle.textContent = document.body.dataset.theme === "dark" ? "Light" : "Dark";
}

function toggleTheme() {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("plateflow-theme", next);
  applyTheme(next);
}

function hasOnshapeContext() {
  return ["documentId", "workspaceId", "elementId"].every((name) => els.importForm.elements[name].value.trim());
}

function isUnresolvedMacro(value) {
  const text = String(value || "").trim();
  return text.includes("$") || text.includes("{") || text.includes("}");
}

function normalizeOnshapeServer(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function loadDemo() {
  source = null;
  parts = demoParts.map((part) => ({ ...part, type: "custom", sourceType: "custom", selected: part.selected !== false }));
  renderParts();
  setMessage("Local custom-part demo loaded. Demo rows are never saved unless you import from Onshape.", "ok");
}

function renderParts() {
  els.exportButton.disabled = !source || !parts.length;
  els.partCount.textContent = parts.length ? `${parts.length} part${parts.length === 1 ? "" : "s"} loaded` : "No parts loaded";

  if (!parts.length) {
    els.partsBody.innerHTML = `<tr><td colspan="7" class="empty">Import from Onshape to populate inventory.</td></tr>`;
    updateSummary();
    return;
  }

  els.partsBody.innerHTML = parts.map((part, index) => `
    <tr>
      <td><input type="checkbox" data-index="${index}" data-field="selected" ${part.selected ? "checked" : ""} aria-label="select ${escapeHtml(part.name)}"></td>
      <td><span class="chip ${escapeAttr(part.sourceType || part.type || "custom")}">${escapeHtml((part.sourceType || part.type || "custom").toUpperCase())}</span></td>
      <td><span class="part-name">${escapeHtml(part.name)}</span><br><small>${escapeHtml(part.bodyType || part.id || "")}</small></td>
      <td><input data-index="${index}" data-field="material" value="${escapeAttr(part.material || "Unassigned")}"></td>
      <td>${escapeHtml(part.vendor || part.process || part.thickness || "review")}</td>
      <td><input data-index="${index}" data-field="quantity" type="number" min="1" max="999" value="${Number(part.quantity || 1)}"></td>
      <td><span class="status">${escapeHtml(part.status || part.procurementStatus || "needed")}</span></td>
    </tr>
  `).join("");
  els.selectAll.checked = parts.every((part) => part.selected);
  updateSummary();
}

function onPartEdit(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;
  if (!Number.isInteger(index) || !field) return;
  parts[index][field] = field === "selected" ? event.target.checked : event.target.value;
  if (field === "quantity") parts[index][field] = Math.max(1, Number(event.target.value || 1));
  updateSummary();
}

function toggleAll(event) {
  parts = parts.map((part) => ({ ...part, selected: event.target.checked }));
  renderParts();
}

async function onExport() {
  if (!source) return;
  els.exportButton.disabled = true;
  setMessage("Starting Onshape STEP translation...");
  try {
    const result = await api("/api/onshape/export-step", {
      method: "POST",
      body: JSON.stringify(source)
    });
    const link = document.createElement("a");
    link.href = result.downloadUrl;
    link.textContent = "Download STEP bundle";
    link.className = "button small";
    els.message.replaceChildren(document.createTextNode("STEP export complete. "), link);
    els.message.className = "message ok";
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    els.exportButton.disabled = !source || !parts.length;
  }
}

async function onOrder(event) {
  event.preventDefault();
  const selected = parts.filter((part) => part.selected);
  const form = Object.fromEntries(new FormData(els.orderForm).entries());
  try {
    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...form, parts: selected })
    });
    setMessage(`Quote ${order.id} received. Wire this endpoint to checkout/email before taking real orders.`, "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function loadInventory() {
  const inventory = await api("/api/inventory");
  renderInventory(inventory);
  parts = inventory.parts.map((part) => ({ ...part, selected: true }));
  source = null;
  renderParts();
  if (parts.length) setMessage(`Loaded ${parts.length} inventoried part${parts.length === 1 ? "" : "s"}.`, "ok");
}

async function loadDashboard() {
  const dashboard = await api("/api/dashboard");
  renderInventory(dashboard.inventory);
  renderInventoryTable(dashboard.inventory.parts);
  renderRobots(dashboard.robots);
  renderFabrication(dashboard.fabrication);
  renderProcurement(dashboard.procurement);
  renderRawMaterials(dashboard.rawMaterials);
  renderAudit(dashboard.admin.auditLogs);
  await loadAdminUsers();
  parts = dashboard.inventory.parts.map((part) => ({ ...part, selected: true }));
  source = null;
  renderParts();
  if (parts.length) setMessage(`Loaded ${parts.length} inventoried item${parts.length === 1 ? "" : "s"}.`, "ok");
}

async function loadAdminUsers() {
  if (!els.userList) return;
  try {
    const result = await api("/api/admin/users");
    renderAdminUsers(result);
  } catch {
    els.userList.textContent = "Admin user management is available to admin accounts.";
  }
}

function renderAdminUsers(result) {
  if (!els.userList) return;
  const users = result.users || [];
  const invites = result.invites || [];
  const counts = result.counts || {};
  els.userList.innerHTML = [
    `
      <div class="admin-counts">
        <strong>${Number(counts.users || users.length)} account${Number(counts.users || users.length) === 1 ? "" : "s"}</strong>
        <span>${Number(counts.active || 0)} active · ${Number(counts.admins || 0)} admin · ${Number(counts.pendingInvites || invites.filter((invite) => invite.status === "pending").length)} pending invite${Number(counts.pendingInvites || 0) === 1 ? "" : "s"}</span>
      </div>
    `,
    ...users.map((user) => `
      <div class="user-row" data-user-id="${escapeAttr(user.id)}">
        <label>
          <span>Name</span>
          <input class="user-name" value="${escapeAttr(user.name || user.email)}">
        </label>
        <label>
          <span>Role</span>
          <select class="user-role">
            ${roles.map((role) => `<option value="${escapeAttr(role)}"${role === user.role ? " selected" : ""}>${escapeHtml(role)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select class="user-status">
            ${userStatuses.map((status) => `<option value="${escapeAttr(status)}"${status === user.status ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select>
        </label>
        <span class="user-email">${escapeHtml(user.email)}</span>
        <button class="ghost small" type="button" data-action="save-user">Save</button>
        <button class="ghost small danger" type="button" data-action="delete-user">Delete</button>
      </div>
    `),
    ...invites.map((invite) => `
      <div class="invite-row">
        <strong>Invite · ${escapeHtml(invite.email)} · ${escapeHtml(invite.role)}</strong>
        <span>${escapeHtml(invite.status)} · ${escapeHtml(invite.inviteUrl)}</span>
      </div>
    `)
  ].join("") || "No users loaded.";
}

function renderInventory(inventory) {
  if (!inventory || !els.metricImports) return;
  els.metricImports.textContent = String(inventory.totals.records);
  els.metricParts.textContent = String(inventory.totals.parts);
  els.metricCustom.textContent = String(inventory.totals.custom || 0);
  els.metricCots.textContent = String(inventory.totals.cots || 0);
  els.metricFabrication.textContent = String(inventory.totals.fabrication || 0);
  els.metricProcurement.textContent = String(inventory.totals.procurement || 0);
  if (els.fabQueueCount) els.fabQueueCount.textContent = inventory.totals.fabrication ? `${inventory.totals.fabrication} custom part${inventory.totals.fabrication === 1 ? "" : "s"} awaiting fabrication review.` : "No custom parts queued.";
  if (els.procQueueCount) els.procQueueCount.textContent = inventory.totals.procurement ? `${inventory.totals.procurement} COTS item${inventory.totals.procurement === 1 ? "" : "s"} awaiting procurement review.` : "No COTS parts queued.";
  loadBatches();
}

function renderInventoryTable(items) {
  if (!els.inventoryBody) return;
  const query = (els.inventorySearch?.value || "").trim().toLowerCase();
  const visible = items.filter((part) => [
    part.name,
    part.category,
    part.material,
    part.vendor,
    part.vendorSku,
    part.process,
    part.status
  ].join(" ").toLowerCase().includes(query)).slice(0, 200);

  if (!visible.length) {
    els.inventoryBody.innerHTML = `<tr><td colspan="7" class="empty">No matching inventory.</td></tr>`;
    return;
  }

  els.inventoryBody.innerHTML = visible.map((part) => `
    <tr>
      <td><span class="chip ${escapeAttr(part.sourceType || part.type || "custom")}">${escapeHtml((part.sourceType || part.type || "custom").toUpperCase())}</span></td>
      <td><span class="part-name">${escapeHtml(part.name)}</span><br><small>${escapeHtml(part.vendorSku || part.id || "")}</small></td>
      <td>${escapeHtml(part.category || "uncategorized")}</td>
      <td>${escapeHtml(part.sourceType === "cots" ? [part.vendor, part.vendorSku].filter(Boolean).join(" ") || "Unassigned" : [part.material, part.thickness].filter(Boolean).join(" ") || "Unassigned")}</td>
      <td>${Number(part.quantity || part.quantityNeeded || 1)}</td>
      <td>${Number(part.onHand || 0)}</td>
      <td><span class="status">${escapeHtml(part.status || "needed")}</span></td>
    </tr>
  `).join("");
}

function renderRobots(robots) {
  if (!els.robotList) return;
  if (!robots.length) {
    els.robotList.innerHTML = `<article><p>No robots configured.</p></article>`;
    return;
  }
  els.robotList.innerHTML = robots.map((robot) => `
    <article>
      <div class="card-head">
        <div>
          <h3>${escapeHtml(robot.name)}</h3>
          <p>${escapeHtml(robot.season)} season · ${Number(robot.counts.requirements)} requirements</p>
        </div>
        <strong>${Number(robot.readiness)}%</strong>
      </div>
      <div class="progress"><span style="width:${Math.max(0, Math.min(100, Number(robot.readiness)))}%"></span></div>
      <dl class="mini-stats">
        <div><dt>Procurement</dt><dd>${Number(robot.progress.procurement)}%</dd></div>
        <div><dt>Fabrication</dt><dd>${Number(robot.progress.fabrication)}%</dd></div>
        <div><dt>Install</dt><dd>${Number(robot.progress.receivedInstalled)}%</dd></div>
      </dl>
      <div class="subsystem-list">
        ${robot.subsystems.map((subsystem) => `
          <span>${escapeHtml(subsystem.name)} <b>${Number(subsystem.readiness)}%</b></span>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderFabrication(fabrication) {
  if (!els.fabricationJobs) return;
  if (!fabrication.jobs.length) {
    els.fabricationJobs.textContent = "No fabrication jobs yet.";
    return;
  }
  els.fabricationJobs.innerHTML = fabrication.jobs.slice(0, 8).map((job) => {
    const lines = Array.isArray(job.lines) ? job.lines : [];
    const grouping = Array.isArray(job.grouping) ? job.grouping : [];
    return `
    <div class="queue-row">
      <span>
        <strong>${escapeHtml(job.id)}</strong>
        <small>${lines.length} custom line${lines.length === 1 ? "" : "s"} · ${grouping.map((group) => `${group.key} (${group.count})`).join(", ") || "Ungrouped"}</small>
      </span>
      <label class="inline-select">
        <span>Status</span>
        <select data-job-id="${escapeAttr(job.id)}">
          ${fabricationStatuses.map((status) => `<option value="${escapeAttr(status)}"${status === job.status ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </label>
    </div>
  `;
  }).join("");
}

function renderProcurement(procurement) {
  if (!els.procurementOrders) return;
  if (!procurement.orders.length) {
    els.procurementOrders.textContent = "No procurement groups yet.";
    return;
  }
  els.procurementOrders.innerHTML = procurement.orders.slice(0, 8).map((order) => {
    const lines = Array.isArray(order.lines) ? order.lines : Array.isArray(order.parts) ? order.parts : [];
    const groups = Array.isArray(order.vendorGroups) ? order.vendorGroups : [];
    return `
    <div>
      <strong>${escapeHtml(order.id)} · ${escapeHtml(order.status)}</strong>
      <span>${lines.length} COTS line${lines.length === 1 ? "" : "s"} · ${groups.map((group) => `${group.vendor} (${group.count})`).join(", ") || "Ungrouped"}</span>
    </div>
  `;
  }).join("");
}

function renderRawMaterials(rawMaterials) {
  if (!els.rawMaterialList) return;
  if (!rawMaterials.length) {
    els.rawMaterialList.innerHTML = `<article><p>No raw stock entered.</p></article>`;
    return;
  }
  els.rawMaterialList.innerHTML = rawMaterials.slice(0, 12).map((stock) => `
    <article>
      <div class="card-head">
        <div>
          <h3>${escapeHtml([stock.grade, stock.materialFamily].filter(Boolean).join(" "))}</h3>
          <p>${escapeHtml(stock.stockType)} · ${escapeHtml(stock.dimensions)}</p>
        </div>
        <span class="status">${escapeHtml(stock.status)}</span>
      </div>
      <dl class="mini-stats">
        <div><dt>Remaining</dt><dd>${Number(stock.remainingQuantity)} ${escapeHtml(stock.unit)}</dd></div>
        <div><dt>Location</dt><dd>${escapeHtml(stock.location || "Unset")}</dd></div>
      </dl>
    </article>
  `).join("");
}

function renderAudit(logs) {
  if (!els.auditLog) return;
  if (!logs.length) {
    els.auditLog.textContent = "No audit activity yet.";
    return;
  }
  els.auditLog.innerHTML = logs.slice(0, 8).map((entry) => `
    <div>
      <strong>${escapeHtml(entry.action)}</strong>
      <span>${escapeHtml(entry.detail)} · ${new Date(entry.createdAt).toLocaleString()}</span>
    </div>
  `).join("");
}

async function onRawMaterialAdd(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(els.rawMaterialForm).entries());
  try {
    await api("/api/raw-materials", {
      method: "POST",
      body: JSON.stringify(body)
    });
    els.rawMaterialForm.reset();
    await loadDashboard();
    setMessage("Raw stock added to inventory.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onInviteCreate(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(els.inviteForm).entries());
  try {
    const result = await api("/api/admin/invites", {
      method: "POST",
      body: JSON.stringify(body)
    });
    els.inviteForm.reset();
    renderAdminUsers(result);
    setMessage("Invite created. Copy the invite link from Admin.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onAdminUserAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest("[data-user-id]");
  if (!row) return;
  const userId = row.dataset.userId;
  const action = button.dataset.action;
  try {
    if (action === "delete-user") {
      if (!window.confirm("Delete this PlateFlow account?")) return;
      const result = await api(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
      renderAdminUsers(result);
      setMessage("User deleted.", "ok");
      return;
    }
    if (action === "save-user") {
      const result = await api(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: row.querySelector(".user-name")?.value || "",
          role: row.querySelector(".user-role")?.value || "student",
          status: row.querySelector(".user-status")?.value || "active"
        })
      });
      renderAdminUsers(result);
      setMessage("User updated.", "ok");
    }
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onFabricationJobChange(event) {
  const select = event.target.closest("select[data-job-id]");
  if (!select) return;
  try {
    const result = await api(`/api/fabrication/jobs/${encodeURIComponent(select.dataset.jobId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value })
    });
    renderFabrication(result.fabrication);
    setMessage("Fabrication job status updated.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
    await loadDashboard();
  }
}

async function loadBatches() {
  if (!els.batchList) return;
  try {
    const result = await api("/api/sync-batches");
    if (!result.batches.length) {
      els.batchList.textContent = "No sync batches yet.";
      return;
    }
    els.batchList.innerHTML = result.batches.slice(0, 6).map((batch) => `
      <div>
        <strong>${escapeHtml(batch.id)}</strong>
        <span>${escapeHtml(batch.sourceType)} · ${Number(batch.partCount)} item${Number(batch.partCount) === 1 ? "" : "s"}</span>
      </div>
    `).join("");
  } catch {
    els.batchList.textContent = "Could not load sync batches.";
  }
}

function updateSummary() {
  const selected = parts.filter((part) => part.selected);
  const qty = selected.reduce((sum, part) => sum + Number(part.quantity || 1), 0);
  const materials = [...new Set(selected.map((part) => part.material || "Unassigned"))];
  els.summaryParts.textContent = String(selected.length);
  els.summaryQty.textContent = String(qty);
  els.summaryMaterials.textContent = materials.length ? materials.join(", ") : "None";
}

async function api(url, options = {}, retry = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (response.status === 403 && /csrf/i.test(data.error || "") && !retry.skipCsrfRetry) {
    await refreshSession();
    return api(url, options, { skipCsrfRetry: true });
  }
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function refreshSession() {
  const session = await api("/api/session", {}, { skipCsrfRetry: true });
  csrfToken = session.csrfToken;
  renderAuth(session);
  renderAppAccess(session);
  return session;
}

function setMessage(text, type = "") {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
