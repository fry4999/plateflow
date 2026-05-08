let csrfToken = "";
let source = null;
let parts = [];
let embeddedMode = false;
let bootstrapRequired = false;
let inviteToken = "";
let dashboardState = null;
let selectedRobotId = "";
let messageTimer = null;
let dialogResolver = null;
let lastFocusedElement = null;

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
  navLinks: document.querySelectorAll(".nav a[href^='#']"),
  pages: document.querySelectorAll("[data-page]"),
  importForm: document.querySelector("#importForm"),
  importSubmitButton: document.querySelector("#importSubmitButton"),
  demoButton: document.querySelector("#demoButton"),
  customConfigurator: document.querySelector("#customConfigurator"),
  configPartSelect: document.querySelector("#configPartSelect"),
  configSubsystem: document.querySelector("#configSubsystem"),
  configStock: document.querySelector("#configStock"),
  configMachine: document.querySelector("#configMachine"),
  configQuantity: document.querySelector("#configQuantity"),
  configPartNumber: document.querySelector("#configPartNumber"),
  configMaterialDetected: document.querySelector("#configMaterialDetected"),
  configThicknessDetected: document.querySelector("#configThicknessDetected"),
  configDetectedStatus: document.querySelector("#configDetectedStatus"),
  autoPartNumberButton: document.querySelector("#autoPartNumberButton"),
  clearConfigButton: document.querySelector("#clearConfigButton"),
  submitConfiguredPartButton: document.querySelector("#submitConfiguredPartButton"),
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
  inventoryTypeFilter: document.querySelector("#inventoryTypeFilter"),
  inventoryDocumentFilter: document.querySelector("#inventoryDocumentFilter"),
  inventorySort: document.querySelector("#inventorySort"),
  inventoryForm: document.querySelector("#inventoryForm"),
  inventoryBody: document.querySelector("#inventoryBody"),
  robotForm: document.querySelector("#robotForm"),
  robotList: document.querySelector("#robotList"),
  robotWorkspace: document.querySelector("#robotWorkspace"),
  robotWorkspaceTitle: document.querySelector("#robotWorkspaceTitle"),
  robotWorkspaceMeta: document.querySelector("#robotWorkspaceMeta"),
  robotAssemblySelect: document.querySelector("#robotAssemblySelect"),
  attachAssemblyButton: document.querySelector("#attachAssemblyButton"),
  deleteRobotButton: document.querySelector("#deleteRobotButton"),
  robotRequirementList: document.querySelector("#robotRequirementList"),
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
  settingsForm: document.querySelector("#settingsForm"),
  settingsSavedStatus: document.querySelector("#settingsSavedStatus"),
  storageAdminStatus: document.querySelector("#storageAdminStatus"),
  summaryParts: document.querySelector("#summaryParts"),
  summaryQty: document.querySelector("#summaryQty"),
  summaryMaterials: document.querySelector("#summaryMaterials"),
  message: document.querySelector("#message"),
  dialogBackdrop: document.querySelector("#dialogBackdrop"),
  dialogKicker: document.querySelector("#dialogKicker"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogBody: document.querySelector("#dialogBody"),
  dialogInputWrap: document.querySelector("#dialogInputWrap"),
  dialogInputLabel: document.querySelector("#dialogInputLabel"),
  dialogInput: document.querySelector("#dialogInput"),
  dialogCancel: document.querySelector("#dialogCancel"),
  dialogConfirm: document.querySelector("#dialogConfirm")
};

const demoParts = [
  { id: "JHD", name: "belly-pan-main", material: "6061 Aluminum", thickness: "0.125 in", quantity: 1, finish: "Deburred", selected: true },
  { id: "JFF", name: "swerve-rail-gusset-L", material: "5052 Aluminum", thickness: "0.090 in", quantity: 4, finish: "Tumbled", selected: true },
  { id: "JKK", name: "intake-side-plate", material: "6061 Aluminum", thickness: "0.1875 in", quantity: 2, finish: "Deburred", selected: true },
  { id: "JRM", name: "battery-retainer", material: "304 Stainless Steel", thickness: "0.060 in", quantity: 2, finish: "Raw", selected: false }
];

const roles = ["admin", "mentor", "purchaser", "fabricator", "student", "read_only"];
const userStatuses = ["active", "disabled", "pending"];
const fabricationStatuses = ["todo", "in_progress", "completed"];
const procurementStatuses = ["needed", "sourcing", "ready_to_order", "ordered", "partially_received", "received", "backordered", "canceled"];

init();

async function init() {
  const params = new URLSearchParams(location.search);
  embeddedMode = location.pathname.startsWith("/onshape") || params.get("embedded") === "1";
  inviteToken = params.get("invite") || "";
  document.body.classList.toggle("embedded", embeddedMode);
  applyTheme(localStorage.getItem("plateflow-theme") || "dark");
  bindEvents();
  setupEmbeddedPage();
  syncPageFromHash();

  for (const [urlKey, formKey] of [
    ["did", "documentId"],
    ["documentId", "documentId"],
    ["wid", "workspaceId"],
    ["workspaceId", "workspaceId"],
    ["workspaceOrVersionId", "workspaceId"],
    ["eid", "elementId"],
    ["elementId", "elementId"],
    ["tabElementId", "elementId"],
    ["documentName", "sourceTag"],
    ["sourceTag", "sourceTag"],
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
    if (canLoadDashboard(session)) {
      await loadDashboard({ preserveParts: embeddedMode, quiet: embeddedMode });
    }
    if (!session.appAuthenticated && !session.bootstrapRequired) {
      if (els.loginMessage) els.loginMessage.textContent = embeddedMode ? "Sign in to your PlateFlow account before syncing from Onshape." : "";
    } else if (embeddedMode && session.authenticated && hasOnshapeContext()) {
      setMessage("Onshape connected. Load this tab's parts, then submit the configured custom part.", "ok");
    } else if (embeddedMode && !session.authenticated) {
      setMessage("Log in with Onshape, then submit this tab to PlateFlow inventory.", "");
    } else if (embeddedMode) {
      setMessage("PlateFlow is missing document context. Check the Onshape extension action URL.", "error");
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
  if (els.fabricationJobs) els.fabricationJobs.addEventListener("click", onFabricationJobAction);
  if (els.fabricationJobs) els.fabricationJobs.addEventListener("dragstart", onFabricationDragStart);
  if (els.fabricationJobs) els.fabricationJobs.addEventListener("dragend", onFabricationDragEnd);
  if (els.fabricationJobs) els.fabricationJobs.addEventListener("dragover", onFabricationDragOver);
  if (els.fabricationJobs) els.fabricationJobs.addEventListener("drop", onFabricationDrop);
  if (els.procurementOrders) els.procurementOrders.addEventListener("change", onProcurementOrderChange);
  els.demoButton.addEventListener("click", loadDemo);
  els.configPartSelect?.addEventListener("change", onConfigPartChange);
  els.configSubsystem?.addEventListener("change", onGeneratePartNumber);
  els.autoPartNumberButton?.addEventListener("click", onGeneratePartNumber);
  els.clearConfigButton?.addEventListener("click", onClearConfig);
  els.submitConfiguredPartButton?.addEventListener("click", onSubmitConfiguredPart);
  els.partsBody.addEventListener("input", onPartEdit);
  els.partsBody.addEventListener("change", onPartEdit);
  els.selectAll.addEventListener("change", toggleAll);
  els.exportButton.addEventListener("click", onExport);
  if (els.orderForm) els.orderForm.addEventListener("submit", onOrder);
  if (els.rawMaterialForm) els.rawMaterialForm.addEventListener("submit", onRawMaterialAdd);
  if (els.inventoryForm) els.inventoryForm.addEventListener("submit", onInventoryAdd);
  if (els.settingsForm) els.settingsForm.addEventListener("submit", onSettingsSave);
  if (els.robotForm) els.robotForm.addEventListener("submit", onRobotCreate);
  if (els.robotList) els.robotList.addEventListener("click", onRobotSelect);
  if (els.attachAssemblyButton) els.attachAssemblyButton.addEventListener("click", onRobotAttachAssembly);
  if (els.deleteRobotButton) els.deleteRobotButton.addEventListener("click", onRobotDelete);
  if (els.robotRequirementList) els.robotRequirementList.addEventListener("change", onRobotRequirementChange);
  if (els.inventorySearch) els.inventorySearch.addEventListener("input", renderCurrentInventoryTable);
  if (els.inventoryTypeFilter) els.inventoryTypeFilter.addEventListener("change", renderCurrentInventoryTable);
  if (els.inventoryDocumentFilter) els.inventoryDocumentFilter.addEventListener("change", renderCurrentInventoryTable);
  if (els.inventorySort) els.inventorySort.addEventListener("change", renderCurrentInventoryTable);
  if (els.inventoryBody) els.inventoryBody.addEventListener("click", onInventoryAction);
  if (els.inventoryBody) els.inventoryBody.addEventListener("input", onInventoryCellInput);
  if (els.dialogCancel) els.dialogCancel.addEventListener("click", () => closeDialog(false));
  if (els.dialogConfirm) els.dialogConfirm.addEventListener("click", () => closeDialog(true));
  if (els.dialogBackdrop) els.dialogBackdrop.addEventListener("click", (event) => {
    if (event.target === els.dialogBackdrop) closeDialog(false);
  });
  document.addEventListener("keydown", onDialogKeydown);
  window.addEventListener("hashchange", syncPageFromHash);
  els.modeTabs.forEach((button) => button.addEventListener("click", () => setSyncMode(button.dataset.mode)));
  if (els.themeToggle) els.themeToggle.addEventListener("click", toggleTheme);
}

function syncPageFromHash() {
  if (embeddedMode) {
    setupEmbeddedPage();
    return;
  }
  const visiblePages = [...els.pages].filter((page) => (
    !["admin", "settings"].includes(page.id) || document.body.classList.contains("admin-user")
  )).filter((page) => !["parts", "selection"].includes(page.id));
  if (!visiblePages.length) return;
  const requested = (location.hash || "#dashboard").slice(1);
  const fallback = visiblePages[0].id;
  const active = visiblePages.some((page) => page.id === requested) ? requested : fallback;
  els.pages.forEach((page) => {
    const selected = page.id === active;
    page.classList.toggle("active-page", selected);
    page.toggleAttribute("hidden", !selected);
  });
  els.navLinks.forEach((link) => {
    const selected = link.getAttribute("href") === `#${active}`;
    link.classList.toggle("active", selected);
    link.setAttribute("aria-current", selected ? "page" : "false");
  });
}

function setupEmbeddedPage() {
  if (!embeddedMode) return;
  els.pages.forEach((page) => {
    const selected = page.id === "parts";
    page.classList.toggle("active-page", selected);
    page.toggleAttribute("hidden", !selected);
  });
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
  if ((!session.appUser || session.appUser.role !== "admin") && ["#admin", "#settings"].includes(location.hash)) {
    history.replaceState(null, "", "#dashboard");
  }
  if (embeddedMode) setupEmbeddedPage();
  else syncPageFromHash();
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
  if (els.storageAdminStatus && session.appUser?.role === "admin") {
    const postgres = session.storage?.kind === "postgres";
    els.storageAdminStatus.innerHTML = `
      <strong>${postgres ? "Postgres connected" : "Local file storage"}</strong>
      <span>${session.storage?.databaseUrlConfigured ? "DATABASE_URL configured" : "DATABASE_URL not configured"}${session.storage?.error ? ` · ${escapeHtml(session.storage.error)}` : ""}</span>
    `;
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
  const previewOnly = embeddedMode && mode === "custom";
  source.configuration = isUnresolvedMacro(source.configuration) ? "" : source.configuration;
  if (els.importForm.dataset.baseUrl) source.baseUrl = els.importForm.dataset.baseUrl;
  if (els.importForm.dataset.workspaceOrVersion) source.workspaceOrVersion = els.importForm.dataset.workspaceOrVersion;
  setMessage(mode === "cots" ? "Submitting Assembly BOM rows to procurement..." : "Reading custom parts, assigned material, and part metadata from Onshape...");
  try {
    const result = await api(mode === "cots" ? "/api/onshape/import-cots" : "/api/onshape/import", {
      method: "POST",
      body: JSON.stringify({ ...source, previewOnly })
    });
    parts = result.parts.map((part) => ({ ...part, selected: true }));
    source = result.source;
    renderParts();
    if (previewOnly) {
      setMessage(`Loaded ${parts.length} Onshape custom part${parts.length === 1 ? "" : "s"}. Pick one, add routing data, then submit it.`, "ok");
      return;
    }
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
  if (els.importSubmitButton) {
    if (embeddedMode && selected === "custom") els.importSubmitButton.textContent = "Load parts from Onshape";
    else if (selected === "cots") els.importSubmitButton.textContent = "Submit Assembly BOM";
    else els.importSubmitButton.textContent = "Submit sync batch";
  }
  renderCustomConfigurator();
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
    renderCustomConfigurator();
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
  renderCustomConfigurator();
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

function renderCustomConfigurator() {
  if (!els.customConfigurator) return;
  const mode = els.importForm?.elements.syncMode?.value === "cots" ? "cots" : "custom";
  const visible = mode === "custom" && Boolean(source) && parts.length > 0;
  els.customConfigurator.classList.toggle("hidden", !visible);
  if (!visible) return;

  const currentId = els.configPartSelect?.value || parts[0]?.id || "";
  els.configPartSelect.innerHTML = parts.map((part) => `
    <option value="${escapeAttr(part.id || part.name)}"${(part.id || part.name) === currentId ? " selected" : ""}>
      ${escapeHtml(part.name || part.id || "Unnamed part")}
    </option>
  `).join("");
  if (![...els.configPartSelect.options].some((option) => option.value === currentId) && els.configPartSelect.options.length) {
    els.configPartSelect.selectedIndex = 0;
  }
  renderSubsystemOptions();
  fillConfigFromSelectedPart({ preservePartNumber: true });
}

function renderSubsystemOptions() {
  if (!els.configSubsystem) return;
  const current = els.configSubsystem.value;
  const subsystems = [...new Set((dashboardState?.robots || []).flatMap((robot) => robot.subsystems || []).map((subsystem) => subsystem.name).filter(Boolean))];
  const options = subsystems.length ? subsystems : ["Drive", "Intake", "Shooter"];
  els.configSubsystem.innerHTML = [
    `<option value="">Unassigned</option>`,
    ...options.map((name) => `<option value="${escapeAttr(name)}"${name === current ? " selected" : ""}>${escapeHtml(name)}</option>`)
  ].join("");
  if (current && !options.includes(current)) els.configSubsystem.value = "";
}

function selectedConfigPart() {
  const selectedId = els.configPartSelect?.value || "";
  return parts.find((part) => (part.id || part.name) === selectedId) || parts[0] || null;
}

function onConfigPartChange() {
  fillConfigFromSelectedPart();
}

function fillConfigFromSelectedPart(options = {}) {
  const part = selectedConfigPart();
  if (!part) return;
  const material = part.material && part.material !== "Unassigned" ? part.material : "Not assigned in Onshape";
  const thickness = part.thicknessSource === "physical_bounding_box" ? `${part.thickness} (physical)` : part.thickness || "Not set in Onshape";
  els.configMaterialDetected.textContent = material;
  els.configThicknessDetected.textContent = thickness;
  els.configDetectedStatus.textContent = part.thickness ? "Onshape data loaded" : "Could not infer thickness";
  els.configDetectedStatus.classList.toggle("warn", !part.thickness);
  if (els.configQuantity) els.configQuantity.value = Math.max(1, Number(part.quantity || 1));
  if (!options.preservePartNumber || !els.configPartNumber?.value) onGeneratePartNumber();
}

function onGeneratePartNumber() {
  const part = selectedConfigPart();
  if (!part || !els.configPartNumber) return;
  els.configPartNumber.value = generateClientPartNumber(part);
}

function generateClientPartNumber(part) {
  const settings = dashboardState?.settings?.partNumber || defaultPartNumberSettings();
  return formatPartNumber(settings, {
    prefix: settings.prefix || "PF",
    source: partNumberCode(source?.sourceTag || source?.documentName || "SRC", settings.sourceLength),
    subsystem: partNumberCode(els.configSubsystem?.value || "GEN", settings.subsystemLength),
    part: partNumberCode(part.name || part.id || "part", settings.partLength)
  });
}

function partNumberCode(value, length) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return (normalized || "X").slice(0, length).padEnd(length, "X");
}

function defaultPartNumberSettings() {
  return {
    template: "{prefix}-{source}-{subsystem}-{part}",
    prefix: "PF",
    sourceLength: 3,
    subsystemLength: 3,
    partLength: 4
  };
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

function onClearConfig() {
  if (els.configSubsystem) els.configSubsystem.value = "";
  if (els.configStock) els.configStock.value = "";
  if (els.configMachine) els.configMachine.value = "Router";
  if (els.configQuantity) els.configQuantity.value = selectedConfigPart()?.quantity || 1;
  onGeneratePartNumber();
  setMessage("Cleared routing fields. Onshape material and thickness stay attached to the selected part.", "");
}

async function onSubmitConfiguredPart() {
  const part = selectedConfigPart();
  if (!source || !part) {
    setMessage("Load Onshape parts before submitting a custom part.", "error");
    return;
  }
  const stock = els.configStock?.value || "";
  if (!stock) {
    setMessage("Choose a stock type before submitting.", "error");
    els.configStock?.focus();
    return;
  }
  const configuredPart = {
    id: part.id || "",
    partKey: part.id || part.name || "",
    name: part.name || "",
    subsystem: els.configSubsystem?.value || "",
    thickness: part.thickness || "",
    materialType: part.material || "",
    stock,
    machine: els.configMachine?.value || "Router",
    partNumber: els.configPartNumber?.value || generateClientPartNumber(part),
    quantity: Math.max(1, Number(els.configQuantity?.value || part.quantity || 1))
  };
  const previousParts = parts;
  setMessage(`Submitting ${part.name || part.id} to fabrication inventory...`);
  try {
    const result = await api("/api/onshape/import", {
      method: "POST",
      body: JSON.stringify({ ...source, configuredParts: [configuredPart] })
    });
    const savedPart = result.parts[0] || {};
    source = result.source;
    parts = previousParts.map((item) => (item.id === part.id ? { ...item, ...savedPart, selected: true } : item));
    renderParts();
    await loadDashboard({ preserveParts: true, quiet: true });
    setMessage(`Sent ${savedPart.partNumber || configuredPart.partNumber} to fabrication inventory.`, "ok");
  } catch (error) {
    parts = previousParts;
    renderParts();
    setMessage(error.message, "error");
  }
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

async function loadDashboard(options = {}) {
  const dashboard = await api("/api/dashboard");
  dashboardState = dashboard;
  renderInventory(dashboard.inventory);
  renderInventoryTable(dashboard.inventory.parts);
  renderRobots(dashboard.robots);
  renderFabrication(dashboard.fabrication);
  renderProcurement(dashboard.procurement);
  renderRawMaterials(dashboard.rawMaterials);
  renderSettings(dashboard.settings);
  renderAudit(dashboard.admin.auditLogs);
  await loadAdminUsers();
  renderSubsystemOptions();
  if (!options.preserveParts) {
    parts = dashboard.inventory.parts.map((part) => ({ ...part, selected: true }));
    source = null;
    renderParts();
    if (!options.quiet && parts.length) setMessage(`Loaded ${parts.length} inventoried item${parts.length === 1 ? "" : "s"}.`, "ok");
  } else {
    renderCustomConfigurator();
  }
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

function renderSettings(settings) {
  if (!els.settingsForm) return;
  const partNumber = settings?.partNumber || defaultPartNumberSettings();
  els.settingsForm.elements.template.value = partNumber.template || "";
  els.settingsForm.elements.prefix.value = partNumber.prefix || "PF";
  els.settingsForm.elements.sourceLength.value = Number(partNumber.sourceLength || 3);
  els.settingsForm.elements.subsystemLength.value = Number(partNumber.subsystemLength || 3);
  els.settingsForm.elements.partLength.value = Number(partNumber.partLength || 4);
  if (els.settingsSavedStatus) {
    els.settingsSavedStatus.textContent = settings?.updatedAt ? `Last saved ${formatDateTime(settings.updatedAt)}` : "Not saved yet";
  }
}

function renderInventory(inventory) {
  if (!inventory || !els.metricImports) return;
  renderDocumentFilter(inventory);
  els.metricImports.textContent = String(inventory.totals.records);
  els.metricParts.textContent = String(inventory.totals.parts);
  els.metricCustom.textContent = String(inventory.totals.custom || 0);
  els.metricCots.textContent = String(inventory.totals.cots || 0);
  els.metricFabrication.textContent = String(inventory.totals.fabrication || 0);
  els.metricProcurement.textContent = String(inventory.totals.procurement || 0);
  if (els.fabQueueCount) els.fabQueueCount.textContent = inventory.totals.fabrication ? `${inventory.totals.fabrication} custom part${inventory.totals.fabrication === 1 ? "" : "s"} on the fabrication board.` : "No custom parts queued.";
  if (els.procQueueCount) els.procQueueCount.textContent = inventory.totals.procurement ? `${inventory.totals.procurement} COTS item${inventory.totals.procurement === 1 ? "" : "s"} awaiting procurement review.` : "No COTS parts queued.";
}

function renderDocumentFilter(inventory) {
  if (!els.inventoryDocumentFilter) return;
  const current = els.inventoryDocumentFilter.value;
  const documents = inventory.documents || [...new Set((inventory.parts || []).map((part) => part.sourceDocument || "Unassigned"))].sort();
  els.inventoryDocumentFilter.innerHTML = [
    `<option value="">All documents</option>`,
    ...documents.map((documentName) => `<option value="${escapeAttr(documentName)}"${documentName === current ? " selected" : ""}>${escapeHtml(documentName)}</option>`)
  ].join("");
  if (current && !documents.includes(current)) els.inventoryDocumentFilter.value = "";
}

function renderCurrentInventoryTable() {
  renderInventoryTable(dashboardState?.inventory?.parts || []);
}

function renderInventoryTable(items) {
  if (!els.inventoryBody) return;
  const query = (els.inventorySearch?.value || "").trim().toLowerCase();
  const typeFilter = els.inventoryTypeFilter?.value || "";
  const documentFilter = els.inventoryDocumentFilter?.value || "";
  const sortMode = els.inventorySort?.value || "name";
  const visible = items
    .filter((part) => (!typeFilter || (part.sourceType || part.type || "custom") === typeFilter))
    .filter((part) => (!documentFilter || (part.sourceDocument || "Unassigned") === documentFilter))
    .filter((part) => [
    part.name,
    part.partNumber,
    part.category,
    part.material,
    part.vendor,
    part.vendorSku,
    part.process,
    part.status,
    part.sourceDocument,
    part.sourceDocumentName
  ].join(" ").toLowerCase().includes(query))
    .sort(inventorySorter(sortMode))
    .slice(0, 200);

  if (!visible.length) {
    els.inventoryBody.innerHTML = `<tr><td colspan="11" class="empty">No matching inventory.</td></tr>`;
    return;
  }

  els.inventoryBody.innerHTML = visible.map((part) => `
    <tr data-item-key="${escapeAttr(part.itemKey)}" data-source-type="${escapeAttr(part.sourceType || part.type || "custom")}">
      <td><img class="inventory-preview" src="${escapeAttr(part.previewUrl || "")}" alt="${escapeAttr(part.name)} preview" loading="lazy"></td>
      <td><span class="chip ${escapeAttr(part.sourceType || part.type || "custom")}">${escapeHtml((part.sourceType || part.type || "custom").toUpperCase())}</span></td>
      <td><span class="status">${escapeHtml(part.sourceDocument || "Unassigned")}</span></td>
      <td><input class="part-name-input" data-field="name" size="${partNameInputSize(part.name)}" value="${escapeAttr(part.name || "")}" aria-label="Part name"></td>
      <td><input data-field="partNumber" value="${escapeAttr(inventoryPartNumber(part))}" aria-label="Part number or SKU"></td>
      <td><input data-field="category" value="${escapeAttr(part.category || "uncategorized")}" aria-label="Category"></td>
      <td><input data-field="${part.sourceType === "cots" ? "vendor" : "material"}" value="${escapeAttr(part.sourceType === "cots" ? part.vendor || "" : [part.material, part.thickness].filter(Boolean).join(" "))}" aria-label="${part.sourceType === "cots" ? "Vendor" : "Material"}"></td>
      <td>${neededCell(part)}</td>
      <td><input class="number-input" data-field="onHand" type="number" min="0" value="${Number(part.onHand || 0)}" aria-label="On hand"></td>
      <td><input data-field="status" value="${escapeAttr(part.status || "needed")}" aria-label="Status"></td>
      <td class="row-actions">
        <button class="ghost small" type="button" data-action="save-inventory">Save</button>
        <button class="ghost small danger" type="button" data-action="delete-inventory">Delete</button>
      </td>
    </tr>
  `).join("");
}

function onInventoryCellInput(event) {
  const input = event.target.closest(".part-name-input");
  if (!input) return;
  input.size = partNameInputSize(input.value);
}

function partNameInputSize(value) {
  return Math.min(90, Math.max(22, String(value || "").length + 3));
}

function inventorySorter(mode) {
  return (a, b) => {
    if (mode === "newest") return String(b.updatedAt || b.importedAt || "").localeCompare(String(a.updatedAt || a.importedAt || ""));
    if (mode === "type") return `${a.sourceType || a.type || ""}:${a.name || ""}`.localeCompare(`${b.sourceType || b.type || ""}:${b.name || ""}`);
    if (mode === "source") return `${a.sourceDocument || ""}:${a.name || ""}`.localeCompare(`${b.sourceDocument || ""}:${b.name || ""}`);
    return String(a.name || "").localeCompare(String(b.name || ""));
  };
}

function inventoryPartNumber(part) {
  return part.partNumber || part.vendorSku || part.manufacturerSku || part.id || "";
}

function neededCell(part) {
  const neededBy = Array.isArray(part.neededBy) ? part.neededBy : [];
  const total = neededBy.length ? neededBy.reduce((sum, item) => sum + Number(item.quantityNeeded || 0), 0) : Number(part.quantityNeeded ?? part.quantity ?? 0);
  const details = neededBy.length ? neededBy.map((item) => {
    const owner = [item.robot, item.subsystem].filter(Boolean).join(" / ") || "Inventory";
    return `${owner}: ${Number(item.quantityNeeded || 1)} ${item.status || "needed"}`;
  }).join("\n") : "No robot requirement is currently attached.";
  return `<span class="needed-tooltip" tabindex="0" data-quantity="${Number(total)}">${Number(total)}<span role="tooltip">${escapeHtml(details).replace(/\n/g, "<br>")}</span></span>`;
}

function renderRobots(robots) {
  if (!els.robotList) return;
  if (!robots.length) {
    els.robotList.innerHTML = `<article><p>No robots configured.</p></article>`;
    renderRobotWorkspace(null);
    return;
  }
  if (!selectedRobotId || !robots.some((robot) => robot.id === selectedRobotId)) selectedRobotId = robots[0].id;
  els.robotList.innerHTML = robots.map((robot) => `
    <article class="robot-card ${robot.id === selectedRobotId ? "selected" : ""}" data-robot-id="${escapeAttr(robot.id)}" tabindex="0">
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
  renderRobotWorkspace(robots.find((robot) => robot.id === selectedRobotId) || robots[0]);
}

function renderRobotWorkspace(robot) {
  if (!els.robotWorkspace) return;
  els.robotWorkspace.classList.toggle("hidden", !robot);
  if (!robot) return;
  const sources = dashboardState?.robotSources || [];
  els.robotWorkspaceTitle.textContent = robot.name;
  els.robotWorkspaceMeta.textContent = `${robot.season} season · ${Number(robot.counts.requirements)} requirement${Number(robot.counts.requirements) === 1 ? "" : "s"} · ${Number(robot.readiness)}% ready`;
  els.robotAssemblySelect.innerHTML = [
    `<option value="">Select synced Assembly BOM</option>`,
    ...sources.map((sourceItem) => `<option value="${escapeAttr(sourceItem.id)}">${escapeHtml(sourceItem.label)} · ${Number(sourceItem.partCount)} items</option>`)
  ].join("");
  const requirements = robot.requirements || [];
  if (!requirements.length) {
    els.robotRequirementList.innerHTML = `<p class="empty">No requirements yet. Select a synced Assembly BOM source above.</p>`;
    return;
  }
  els.robotRequirementList.innerHTML = requirements.map((requirement) => {
    const received = Number(requirement.quantityReceived || 0) >= Number(requirement.quantityNeeded || 1);
    const installed = Number(requirement.quantityInstalled || 0) >= Number(requirement.quantityNeeded || 1);
    return `
      <div class="requirement-row" data-requirement-id="${escapeAttr(requirement.id)}">
        <div>
          <strong>${escapeHtml(requirement.name)}</strong>
          <span>${escapeHtml(requirement.sourceDocument || "Assembly BOM")} · ${escapeHtml([requirement.vendor, requirement.vendorSku].filter(Boolean).join(" ") || "No vendor")} · qty ${Number(requirement.quantityNeeded || 1)}</span>
        </div>
        <label><input type="checkbox" data-field="received" ${received ? "checked" : ""}> Received</label>
        <label><input type="checkbox" data-field="installed" ${installed ? "checked" : ""}> Installed</label>
      </div>
    `;
  }).join("");
}

function renderFabrication(fabrication) {
  if (!els.fabricationJobs) return;
  if (!fabrication.jobs.length) {
    els.fabricationJobs.textContent = "No fabrication jobs yet.";
    return;
  }
  const columns = [
    { status: "todo", label: "To make", tone: "red" },
    { status: "in_progress", label: "Manufacturing", tone: "yellow" },
    { status: "completed", label: "Ready", tone: "green" }
  ];
  els.fabricationJobs.innerHTML = `
    <div class="kanban-board" aria-label="Fabrication kanban board">
      ${columns.map(({ status, label, tone }) => {
        const jobs = fabrication.jobs.filter((job) => displayFabricationStatus(job.status) === status);
        return `
          <section class="kanban-column ${escapeAttr(tone)}" data-status="${escapeAttr(status)}" aria-label="${escapeAttr(label)} fabrication parts">
            <div class="kanban-column-head">
              <h4>${escapeHtml(label)}</h4>
              <span>${jobs.length}</span>
            </div>
            <div class="kanban-cards">
              ${jobs.length ? jobs.map(renderFabricationCard).join("") : `<p class="kanban-empty">No jobs</p>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderFabricationCard(job) {
  const lines = Array.isArray(job.lines) ? job.lines : [];
  const line = lines[0] || {};
  const grouping = Array.isArray(job.grouping) ? job.grouping : [];
  const status = displayFabricationStatus(job.status);
  const material = [line.material, line.thickness].filter(Boolean).join(" / ") || grouping[0]?.key || "Material unknown";
  const route = [line.stock, line.machine || line.process].filter(Boolean).join(" · ") || "Route not set";
  return `
    <article class="kanban-card ${escapeAttr(status)}" draggable="true" data-job-id="${escapeAttr(job.id)}">
      <div>
        <strong>${escapeHtml(line.name || job.name || job.id)}</strong>
        <small>${escapeHtml(material)}</small>
      </div>
      <p>${escapeHtml(route)}</p>
      <span class="kanban-line">${escapeHtml(line.subsystem || "No subsystem")} · qty ${Number(line.quantityNeeded || 1)}</span>
      <button class="ghost small danger" type="button" data-action="delete-fab-job" data-job-id="${escapeAttr(job.id)}">Delete</button>
    </article>
  `;
}

function replaceDashboardFabrication(fabrication) {
  if (!dashboardState) return;
  dashboardState = { ...dashboardState, fabrication };
}

function updateLocalFabricationJob(jobId, status) {
  const jobs = dashboardState?.fabrication?.jobs;
  if (!Array.isArray(jobs)) return null;
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return null;
  const previousStatus = job.status;
  if (displayFabricationStatus(previousStatus) === status) return { changed: false, previousStatus };
  job.status = status;
  job.updatedAt = new Date().toISOString();
  if (Array.isArray(job.lines)) {
    job.lines = job.lines.map((line) => ({ ...line, status }));
  }
  return { changed: true, previousStatus };
}

function moveFabricationCardElement(card, column, status) {
  const cards = column.querySelector(".kanban-cards");
  if (!card || !cards) return;
  cards.querySelector(".kanban-empty")?.remove();
  card.classList.remove("todo", "in_progress", "completed", "dragging");
  card.classList.add(status);
  cards.append(card);
  refreshFabricationCounts();
}

function refreshFabricationCounts() {
  for (const column of els.fabricationJobs.querySelectorAll(".kanban-column[data-status]")) {
    const cards = column.querySelector(".kanban-cards");
    const count = cards?.querySelectorAll(".kanban-card").length || 0;
    const badge = column.querySelector(".kanban-column-head span");
    if (badge) badge.textContent = String(count);
    if (cards && count === 0 && !cards.querySelector(".kanban-empty")) {
      cards.innerHTML = `<p class="kanban-empty">No jobs</p>`;
    }
  }
}

function displayFabricationStatus(status) {
  if (status === "in_progress") return "in_progress";
  if (["completed", "received", "installed"].includes(status)) return "completed";
  return "todo";
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
    <div class="queue-row">
      <span>
        <strong>${escapeHtml(order.id)}</strong>
        <small>${lines.length} COTS line${lines.length === 1 ? "" : "s"} · ${groups.map((group) => `${group.vendor} (${group.count})`).join(", ") || "Ungrouped"}</small>
      </span>
      <label class="inline-select">
        <span>Status</span>
        <select data-order-id="${escapeAttr(order.id)}">
          ${procurementStatuses.map((status) => `<option value="${escapeAttr(status)}"${status === order.status ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </label>
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

async function onInventoryAdd(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(els.inventoryForm).entries());
  if (!String(form.name || "").trim()) {
    setMessage("Part name is required.", "error");
    return;
  }
  try {
    const result = await api("/api/inventory/items", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        onHand: Number(form.onHand || 0),
        quantityNeeded: 0
      })
    });
    applyInventoryMutation(result);
    els.inventoryForm.reset();
    els.inventoryForm.elements.sourceType.value = "cots";
    els.inventoryForm.elements.onHand.value = "1";
    setMessage("Inventory item added.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onInventoryAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest("tr[data-item-key]");
  if (!row) return;
  const itemKey = row.dataset.itemKey;
  if (button.dataset.action === "delete-inventory") {
    const name = row.querySelector("[data-field='name']")?.value || "this item";
    const confirmed = await confirmAction({
      title: "Delete inventory item?",
      body: `Delete ${name} from inventory? This removes the catalog row and related queue card.`,
      confirmLabel: "Delete item",
      danger: true
    });
    if (!confirmed) return;
    try {
      const result = await api(`/api/inventory/items/${encodeURIComponent(itemKey)}`, { method: "DELETE" });
      applyInventoryMutation(result);
      setMessage("Inventory item deleted.", "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
    return;
  }
  if (button.dataset.action !== "save-inventory") return;
  const payload = Object.fromEntries([...row.querySelectorAll("[data-field]")].map((input) => [input.dataset.field, input.value]));
  payload.quantityNeeded = Number(row.querySelector(".needed-tooltip")?.dataset.quantity || 1);
  payload.onHand = Number(payload.onHand || 0);
  try {
    const result = await api(`/api/inventory/items/${encodeURIComponent(itemKey)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    applyInventoryMutation(result);
    setMessage("Inventory item saved.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function applyInventoryMutation(result) {
  dashboardState = {
    ...(dashboardState || {}),
    inventory: result.inventory,
    fabrication: result.fabrication || dashboardState?.fabrication,
    procurement: result.procurement || dashboardState?.procurement,
    robots: result.robots || dashboardState?.robots,
    robotSources: result.robotSources || dashboardState?.robotSources
  };
  renderInventory(result.inventory);
  renderInventoryTable(result.inventory.parts);
  if (result.fabrication) renderFabrication(result.fabrication);
  if (result.procurement) renderProcurement(result.procurement);
  if (result.robots) renderRobots(result.robots);
  renderDocumentFilter(result.inventory);
}

async function onSettingsSave(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(els.settingsForm).entries());
  try {
    const result = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        partNumber: {
          template: form.template,
          prefix: form.prefix,
          sourceLength: Number(form.sourceLength),
          subsystemLength: Number(form.subsystemLength),
          partLength: Number(form.partLength)
        }
      })
    });
    dashboardState = { ...(dashboardState || {}), settings: result.settings };
    renderSettings(result.settings);
    onGeneratePartNumber();
    setMessage("Settings saved for all users.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function onRobotSelect(event) {
  const card = event.target.closest("[data-robot-id]");
  if (!card) return;
  selectedRobotId = card.dataset.robotId;
  renderRobots(dashboardState?.robots || []);
}

async function onRobotCreate(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(els.robotForm).entries());
  try {
    const result = await api("/api/robots", {
      method: "POST",
      body: JSON.stringify(body)
    });
    dashboardState = { ...(dashboardState || {}), robots: result.robots, robotSources: result.robotSources };
    selectedRobotId = result.robots[0]?.id || "";
    els.robotForm.reset();
    await loadDashboard();
    location.hash = "#robots";
    setMessage("Robot added.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onRobotDelete() {
  if (!selectedRobotId) return;
  const robot = (dashboardState?.robots || []).find((item) => item.id === selectedRobotId);
  if (!robot) return;
  const confirmed = await confirmAction({
    title: "Remove robot?",
    body: `Remove ${robot.name} and its requirements from PlateFlow? Inventory stays in the global catalog.`,
    confirmLabel: "Remove robot",
    danger: true
  });
  if (!confirmed) return;
  try {
    const result = await api(`/api/robots/${encodeURIComponent(selectedRobotId)}`, { method: "DELETE" });
    dashboardState = { ...(dashboardState || {}), robots: result.robots, robotSources: result.robotSources };
    selectedRobotId = result.robots[0]?.id || "";
    await loadDashboard();
    setMessage("Robot removed.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onRobotAttachAssembly() {
  if (!selectedRobotId) return;
  const inventoryRecordId = els.robotAssemblySelect?.value || "";
  try {
    const result = await api(`/api/robots/${encodeURIComponent(selectedRobotId)}/requirements`, {
      method: "POST",
      body: JSON.stringify({ inventoryRecordId })
    });
    dashboardState = { ...(dashboardState || {}), robots: result.robots, robotSources: result.robotSources };
    await loadDashboard();
    setMessage(`Added ${Number(result.added || 0)} robot requirement${Number(result.added || 0) === 1 ? "" : "s"}.`, "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onRobotRequirementChange(event) {
  const checkbox = event.target.closest("input[type='checkbox'][data-field]");
  const row = event.target.closest("[data-requirement-id]");
  if (!checkbox || !row || !selectedRobotId) return;
  try {
    const result = await api(`/api/robots/${encodeURIComponent(selectedRobotId)}/requirements/${encodeURIComponent(row.dataset.requirementId)}`, {
      method: "PATCH",
      body: JSON.stringify({ [checkbox.dataset.field]: checkbox.checked })
    });
    dashboardState = { ...(dashboardState || {}), robots: result.robots, robotSources: result.robotSources };
    renderRobots(result.robots);
    setMessage("Robot requirement updated.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
    await loadDashboard();
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
      const confirmed = await confirmAction({
        title: "Delete account?",
        body: "Delete this PlateFlow account? This user will no longer be able to sign in.",
        confirmLabel: "Delete account",
        danger: true
      });
      if (!confirmed) return;
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
    replaceDashboardFabrication(result.fabrication);
    renderFabrication(result.fabrication);
    setMessage("Fabrication job status updated.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
    await loadDashboard();
  }
}

async function onFabricationJobAction(event) {
  const button = event.target.closest("button[data-action='delete-fab-job']");
  if (!button) return;
  const jobId = button.dataset.jobId;
  if (!jobId) return;
  const confirmed = await confirmAction({
    title: "Delete fabrication card?",
    body: "Delete this custom fabrication card from the board?",
    confirmLabel: "Delete card",
    danger: true
  });
  if (!confirmed) return;
  try {
    const result = await api(`/api/fabrication/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    replaceDashboardFabrication(result.fabrication);
    renderFabrication(result.fabrication);
    setMessage("Fabrication card deleted.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
    await loadDashboard();
  }
}

function onFabricationDragStart(event) {
  const card = event.target.closest(".kanban-card[data-job-id]");
  if (!card) return;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.jobId);
}

function onFabricationDragOver(event) {
  const column = event.target.closest(".kanban-column[data-status]");
  if (!column) return;
  event.preventDefault();
  column.classList.add("drag-over");
  for (const other of els.fabricationJobs.querySelectorAll(".kanban-column.drag-over")) {
    if (other !== column) other.classList.remove("drag-over");
  }
}

function onFabricationDragEnd() {
  els.fabricationJobs.querySelectorAll(".dragging, .drag-over").forEach((item) => item.classList.remove("dragging", "drag-over"));
}

async function onFabricationDrop(event) {
  const column = event.target.closest(".kanban-column[data-status]");
  if (!column) return;
  event.preventDefault();
  const jobId = event.dataTransfer.getData("text/plain");
  const status = column.dataset.status;
  const card = els.fabricationJobs.querySelector(".kanban-card.dragging");
  els.fabricationJobs.querySelectorAll(".dragging, .drag-over").forEach((item) => item.classList.remove("dragging", "drag-over"));
  if (!jobId || !status) return;
  const localUpdate = updateLocalFabricationJob(jobId, status);
  if (localUpdate?.changed === false) return;
  if (card) moveFabricationCardElement(card, column, status);
  else if (dashboardState?.fabrication) renderFabrication(dashboardState.fabrication);
  try {
    const result = await api(`/api/fabrication/jobs/${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    replaceDashboardFabrication(result.fabrication);
    renderFabrication(result.fabrication);
    setMessage("Fabrication card moved.", "ok");
  } catch (error) {
    if (localUpdate?.previousStatus) {
      updateLocalFabricationJob(jobId, localUpdate.previousStatus);
      renderFabrication(dashboardState.fabrication);
    }
    setMessage(error.message, "error");
    if (!localUpdate?.previousStatus) await loadDashboard();
  }
}

async function onProcurementOrderChange(event) {
  const select = event.target.closest("select[data-order-id]");
  if (!select) return;
  try {
    const result = await api(`/api/procurement/orders/${encodeURIComponent(select.dataset.orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value })
    });
    renderProcurement(result.procurement);
    setMessage("Procurement status updated.", "ok");
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
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  if (type === "ok") {
    messageTimer = setTimeout(() => {
      els.message.classList.add("fade-out");
      messageTimer = setTimeout(() => {
        els.message.textContent = "";
        els.message.className = "message";
        messageTimer = null;
      }, 850);
    }, 2000);
  }
}

function confirmAction(options = {}) {
  return openDialog({
    kicker: "Confirm action",
    title: options.title || "Confirm action",
    body: options.body || "Continue?",
    confirmLabel: options.confirmLabel || "Confirm",
    cancelLabel: options.cancelLabel || "Cancel",
    danger: Boolean(options.danger)
  });
}

function openDialog(options) {
  if (!els.dialogBackdrop || !els.dialogConfirm || !els.dialogCancel) return Promise.resolve(false);
  if (dialogResolver) closeDialog(false);
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  els.dialogKicker.textContent = options.kicker || "PlateFlow";
  els.dialogTitle.textContent = options.title || "Confirm action";
  els.dialogBody.textContent = options.body || "";
  els.dialogConfirm.textContent = options.confirmLabel || "Confirm";
  els.dialogCancel.textContent = options.cancelLabel || "Cancel";
  els.dialogConfirm.classList.toggle("danger", Boolean(options.danger));
  els.dialogInputWrap.classList.toggle("hidden", !options.inputLabel);
  if (options.inputLabel) {
    els.dialogInputLabel.textContent = options.inputLabel;
    els.dialogInput.value = options.defaultValue || "";
  }
  els.dialogBackdrop.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  requestAnimationFrame(() => (options.inputLabel ? els.dialogInput : els.dialogConfirm).focus());
  return new Promise((resolve) => {
    dialogResolver = resolve;
  });
}

function closeDialog(result) {
  if (!dialogResolver) return;
  const resolve = dialogResolver;
  dialogResolver = null;
  els.dialogBackdrop.classList.add("hidden");
  document.body.classList.remove("dialog-open");
  const value = result && !els.dialogInputWrap.classList.contains("hidden") ? els.dialogInput.value : Boolean(result);
  resolve(value);
  lastFocusedElement?.focus?.();
  lastFocusedElement = null;
}

function onDialogKeydown(event) {
  if (!dialogResolver || els.dialogBackdrop?.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeDialog(false);
    return;
  }
  if (event.key !== "Tab") return;
  const focusables = [els.dialogCancel, els.dialogConfirm, els.dialogInput].filter((item) => item && !item.closest(".hidden"));
  if (!focusables.length) return;
  const currentIndex = focusables.indexOf(document.activeElement);
  if (event.shiftKey && currentIndex <= 0) {
    event.preventDefault();
    focusables[focusables.length - 1].focus();
  } else if (!event.shiftKey && currentIndex === focusables.length - 1) {
    event.preventDefault();
    focusables[0].focus();
  }
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
