let csrfToken = "";
let source = null;
let parts = [];
let embeddedMode = false;
let bootstrapRequired = false;
let inviteToken = "";
let dashboardState = null;
let selectedRobotId = "";
let selectedSubassemblyId = "";
let messageTimer = null;
let importConfirmationTimer = null;
let dialogResolver = null;
let lastFocusedElement = null;
let dashboardRevision = 0;
let realtimeSource = null;
let realtimePollTimer = null;
let realtimeReconnectTimer = null;
let selectedInventoryItems = new Set();
let pointerFrame = 0;
let pointerX = 0;
let pointerY = 0;
let dashboardApplyFrame = 0;
let pendingDashboard = null;
let pendingDashboardOptions = {};

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
  syncRobotSelect: document.querySelector("#syncRobotSelect"),
  syncSubassemblyName: document.querySelector("#syncSubassemblyName"),
  customConfigurator: document.querySelector("#customConfigurator"),
  configPartSelect: document.querySelector("#configPartSelect"),
  configRobot: document.querySelector("#configRobot"),
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
  submitSelectedPartsButton: document.querySelector("#submitSelectedPartsButton"),
  submitAllPartsButton: document.querySelector("#submitAllPartsButton"),
  importSelectedRowsButton: document.querySelector("#importSelectedRowsButton"),
  importAllRowsButton: document.querySelector("#importAllRowsButton"),
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
  metricProjectBudget: document.querySelector("#metricProjectBudget"),
  dashboardGreeting: document.querySelector("#dashboardGreeting"),
  dashboardPage: document.querySelector("#dashboard"),
  overviewRobotPanel: document.querySelector("#overviewRobotPanel"),
  inventorySearch: document.querySelector("#inventorySearch"),
  inventoryTypeFilter: document.querySelector("#inventoryTypeFilter"),
  inventoryDocumentFilter: document.querySelector("#inventoryDocumentFilter"),
  inventorySort: document.querySelector("#inventorySort"),
  inventoryForm: document.querySelector("#inventoryForm"),
  inventoryBody: document.querySelector("#inventoryBody"),
  inventorySelectAll: document.querySelector("#inventorySelectAll"),
  inventorySelectedCount: document.querySelector("#inventorySelectedCount"),
  inventoryBulkDeleteButton: document.querySelector("#inventoryBulkDeleteButton"),
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
  fabricationTitle: document.querySelector("#fabricationTitle"),
  fabricationSwitcher: document.querySelector("#fabricationSwitcher"),
  backToRobotsButton: document.querySelector("#backToRobotsButton"),
  procQueueCount: document.querySelector("#procQueueCount"),
  fabricationJobs: document.querySelector("#fabricationJobs"),
  procurementOrders: document.querySelector("#procurementOrders"),
  procurementProjectFilter: document.querySelector("#procurementProjectFilter"),
  procurementSubassemblyFilter: document.querySelector("#procurementSubassemblyFilter"),
  procurementVendorFilter: document.querySelector("#procurementVendorFilter"),
  refreshProcurementButton: document.querySelector("#refreshProcurementButton"),
  procurementLineForm: document.querySelector("#procurementLineForm"),
  batchList: document.querySelector("#batchList"),
  rawMaterialForm: document.querySelector("#rawMaterialForm"),
  rawMaterialList: document.querySelector("#rawMaterialList"),
  inviteForm: document.querySelector("#inviteForm"),
  userList: document.querySelector("#userList"),
  auditLog: document.querySelector("#auditLog"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsSavedStatus: document.querySelector("#settingsSavedStatus"),
  storageAdminStatus: document.querySelector("#storageAdminStatus"),
  clearCatalogButton: document.querySelector("#clearCatalogButton"),
  summaryParts: document.querySelector("#summaryParts"),
  summaryQty: document.querySelector("#summaryQty"),
  summaryMaterials: document.querySelector("#summaryMaterials"),
  message: document.querySelector("#message"),
  importConfirmation: document.querySelector("#importConfirmation"),
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
let procurementMutationSeq = 0;

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
  if (params.get("documentName") && !isUnresolvedMacro(params.get("documentName"))) {
    els.importForm.dataset.documentName = params.get("documentName");
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

  renderSyncTargetOptions();
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
  if (els.procurementOrders) els.procurementOrders.addEventListener("click", onProcurementLineAction);
  if (els.procurementLineForm) els.procurementLineForm.addEventListener("submit", onProcurementLineCreate);
  if (els.procurementProjectFilter) els.procurementProjectFilter.addEventListener("change", () => {
    els.procurementProjectFilter.dataset.touched = "1";
    if (els.procurementSubassemblyFilter) els.procurementSubassemblyFilter.value = "";
    if (els.procurementVendorFilter) els.procurementVendorFilter.value = "__all";
    renderProcurement(dashboardState?.procurement || { orders: [], projectBuckets: [], vendorBuckets: [] });
  });
  if (els.procurementSubassemblyFilter) els.procurementSubassemblyFilter.addEventListener("change", () => {
    els.procurementSubassemblyFilter.dataset.touched = "1";
    if (els.procurementVendorFilter) els.procurementVendorFilter.value = "__all";
    renderProcurement(dashboardState?.procurement || { orders: [], projectBuckets: [], vendorBuckets: [] });
  });
  if (els.procurementVendorFilter) els.procurementVendorFilter.addEventListener("change", () => {
    els.procurementVendorFilter.dataset.touched = "1";
    renderProcurement(dashboardState?.procurement || { orders: [], projectBuckets: [], vendorBuckets: [] });
  });
  if (els.refreshProcurementButton) els.refreshProcurementButton.addEventListener("click", onProcurementRefresh);
  els.demoButton.addEventListener("click", loadDemo);
  els.syncRobotSelect?.addEventListener("change", onSyncRobotChange);
  els.configPartSelect?.addEventListener("change", onConfigPartChange);
  els.configRobot?.addEventListener("change", onConfigRobotChange);
  els.configSubsystem?.addEventListener("change", onGeneratePartNumber);
  els.autoPartNumberButton?.addEventListener("click", onGeneratePartNumber);
  els.clearConfigButton?.addEventListener("click", onClearConfig);
  els.submitConfiguredPartButton?.addEventListener("click", onSubmitConfiguredPart);
  els.submitSelectedPartsButton?.addEventListener("click", onSubmitSelectedParts);
  els.submitAllPartsButton?.addEventListener("click", onSubmitAllParts);
  els.importSelectedRowsButton?.addEventListener("click", onSubmitSelectedParts);
  els.importAllRowsButton?.addEventListener("click", onSubmitAllParts);
  els.partsBody.addEventListener("input", onPartEdit);
  els.partsBody.addEventListener("change", onPartEdit);
  els.partsBody.addEventListener("click", onPartsAction);
  els.selectAll.addEventListener("change", toggleAll);
  els.exportButton.addEventListener("click", onExport);
  if (els.orderForm) els.orderForm.addEventListener("submit", onOrder);
  if (els.rawMaterialForm) els.rawMaterialForm.addEventListener("submit", onRawMaterialAdd);
  if (els.inventoryForm) els.inventoryForm.addEventListener("submit", onInventoryAdd);
  if (els.settingsForm) {
    els.settingsForm.addEventListener("submit", onSettingsSave);
    els.settingsForm.addEventListener("click", onSettingsBuilderClick);
    els.settingsForm.addEventListener("input", onSettingsBuilderInput);
    els.settingsForm.addEventListener("change", onSettingsBuilderInput);
  }
  if (els.robotForm) els.robotForm.addEventListener("submit", onRobotCreate);
  if (els.robotList) els.robotList.addEventListener("click", onRobotSelect);
  if (els.overviewRobotPanel) els.overviewRobotPanel.addEventListener("click", onSubassemblyOpen);
  if (els.attachAssemblyButton) els.attachAssemblyButton.addEventListener("click", onRobotAttachAssembly);
  if (els.deleteRobotButton) els.deleteRobotButton.addEventListener("click", onRobotDelete);
  if (els.robotRequirementList) els.robotRequirementList.addEventListener("change", onRobotRequirementChange);
  if (els.robotRequirementList) els.robotRequirementList.addEventListener("click", onSubassemblyOpen);
  if (els.backToRobotsButton) els.backToRobotsButton.addEventListener("click", () => {
    selectedSubassemblyId = "";
    location.hash = "#robots";
  });
  if (els.fabricationSwitcher) els.fabricationSwitcher.addEventListener("change", onFabricationSwitcherChange);
  if (els.fabricationSwitcher) els.fabricationSwitcher.addEventListener("click", onFabricationSwitcherClick);
  if (els.inventorySearch) els.inventorySearch.addEventListener("input", renderCurrentInventoryTable);
  if (els.inventoryTypeFilter) els.inventoryTypeFilter.addEventListener("change", renderCurrentInventoryTable);
  if (els.inventoryDocumentFilter) els.inventoryDocumentFilter.addEventListener("change", renderCurrentInventoryTable);
  if (els.inventorySort) els.inventorySort.addEventListener("change", renderCurrentInventoryTable);
  if (els.inventoryBody) els.inventoryBody.addEventListener("click", onInventoryAction);
  if (els.inventoryBody) els.inventoryBody.addEventListener("change", onInventorySelectionChange);
  if (els.inventoryBody) els.inventoryBody.addEventListener("input", onInventoryCellInput);
  if (els.inventorySelectAll) els.inventorySelectAll.addEventListener("change", onInventorySelectAllChange);
  if (els.inventoryBulkDeleteButton) els.inventoryBulkDeleteButton.addEventListener("click", onInventoryBulkDelete);
  if (els.clearCatalogButton) els.clearCatalogButton.addEventListener("click", onClearCatalog);
  if (window.matchMedia?.("(pointer: fine)")?.matches && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    window.addEventListener("pointermove", onPagePointerMove, { passive: true });
  }
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
  if (dashboardState) renderActiveDashboardPage();
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
  renderDashboardGreeting(session.appUser);
  if (allowApp) startRealtime();
  else stopRealtime();
}

function renderDashboardGreeting(user) {
  if (!els.dashboardGreeting) return;
  const name = String(user?.name || user?.email || "").split("@")[0].trim();
  els.dashboardGreeting.textContent = name ? `Hello, ${name}` : "Hello";
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
  const previewOnly = embeddedMode;
  source.configuration = isUnresolvedMacro(source.configuration) ? "" : source.configuration;
  source.robotId = els.syncRobotSelect?.value || selectedRobotId || "";
  if (els.importForm.dataset.baseUrl) source.baseUrl = els.importForm.dataset.baseUrl;
  if (els.importForm.dataset.documentName) source.documentName = els.importForm.dataset.documentName;
  if (els.importForm.dataset.workspaceOrVersion) source.workspaceOrVersion = els.importForm.dataset.workspaceOrVersion;
  setMessage(mode === "cots" ? "Submitting Assembly BOM rows to procurement..." : "Reading custom parts, assigned material, and part metadata from Onshape...");
  try {
    const result = await api(mode === "cots" ? "/api/onshape/import-cots" : "/api/onshape/import", {
      method: "POST",
      body: JSON.stringify({ ...source, previewOnly })
    });
    parts = result.parts.map((part) => normalizePreviewPart(part, mode));
    source = { ...result.source, syncMode: mode, robotId: source.robotId || selectedRobotId || "" };
    renderSyncTargetOptions();
    renderParts();
    if (previewOnly) {
      const cotsDetected = mode === "custom" ? parts.filter(likelyCotsPart).length : 0;
      setMessage(mode === "cots"
        ? `Loaded ${parts.length} Assembly BOM row${parts.length === 1 ? "" : "s"}. Deselect anything you do not want, then import.`
        : `Loaded ${parts.length} Onshape custom part${parts.length === 1 ? "" : "s"}. ${cotsDetected ? `${cotsDetected} belt/COTS-like row${cotsDetected === 1 ? " was" : "s were"} left deselected.` : "Deselect reference geometry, then import selected or all."}`, "ok");
      return;
    }
    if (!embeddedMode) await loadDashboard();
    const noun = parts.length === 1 ? "part" : "parts";
    setMessage(embeddedMode ? `Sent ${parts.length} ${noun} to the PlateFlow dashboard.` : `Imported ${parts.length} ${noun} into ${mode === "cots" ? "procurement" : "fabrication"} inventory.`, "ok");
    showImportConfirmation(mode === "cots" ? "COTS rows imported" : "Custom parts imported", `${parts.length} ${noun} updated on the dashboard.`);
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function setSyncMode(mode) {
  const selected = mode === "cots" ? "cots" : "custom";
  const previous = els.importForm.elements.syncMode.value || "custom";
  els.importForm.elements.syncMode.value = selected;
  els.modeTabs.forEach((button) => button.classList.toggle("active", button.dataset.mode === selected));
  if (els.syncTitle) els.syncTitle.textContent = selected === "cots" ? "Assembly BOM Sync" : "Part Studio custom sync";
  if (els.importSubmitButton) {
    if (embeddedMode && selected === "custom") els.importSubmitButton.textContent = "Load parts from Onshape";
    else if (embeddedMode && selected === "cots") els.importSubmitButton.textContent = "Load BOM from Onshape";
    else if (selected === "cots") els.importSubmitButton.textContent = "Submit Assembly BOM";
    else els.importSubmitButton.textContent = "Submit sync batch";
  }
  if (previous !== selected) {
    source = null;
    parts = [];
    renderParts();
  }
  renderSyncTargetOptions();
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

function onPagePointerMove(event) {
  pointerX = Math.max(0, Math.min(window.innerWidth, event.clientX));
  pointerY = Math.max(0, Math.min(window.innerHeight, event.clientY));
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    document.body.style.setProperty("--page-glow-x", `${pointerX}px`);
    document.body.style.setProperty("--page-glow-y", `${pointerY}px`);
  });
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

function normalizePreviewPart(part, mode) {
  const sourceType = mode === "cots" ? part.sourceType || part.type || "cots" : likelyCotsPart(part) ? "cots" : "custom";
  return {
    ...part,
    type: sourceType,
    sourceType,
    selected: mode === "cots" || sourceType === "custom",
    status: sourceType === "cots" && mode === "custom" ? "COTS detected" : part.status || part.procurementStatus || "needed"
  };
}

function likelyCotsPart(part) {
  if (likelyManufacturedPart(part)) return false;
  const text = [
    part?.name,
    part?.partNumber,
    part?.vendorSku,
    part?.manufacturerSku,
    part?.category,
    part?.description
  ].filter(Boolean).join(" ").toLowerCase();
  return [
    /\b\d+\s*t\s*5m\b/i,
    /#\s*t\s*\d*\s*5m/i,
    /\bwide\s+belt\b/i,
    /\b\d+\s*mm\s+wide\s+belt\b/i,
    /\bbelt\b/i
  ].some((pattern) => pattern.test(text));
}

function likelyManufacturedPart(part) {
  const text = [
    part?.name,
    part?.partNumber,
    part?.vendorSku,
    part?.manufacturerSku,
    part?.category,
    part?.description
  ].filter(Boolean).join(" ").toLowerCase();
  if (!text || /\bshaft\s+collar\b/.test(text)) return false;
  return [
    /\bcustom\b.*\bpulley\b/,
    /\bcustom\s+htd\s*5\b.*\bpulley\b/,
    /\bshaft\s+lengths?\b/,
    /\b(?:hex|rounded|round)?\s*shaft\b/,
    /\b\d+(?:\.\d+)?\s*(?:in|inch|")\s+(?:hex\s+|round\s+|rounded\s+)?shaft\b/
  ].some((pattern) => pattern.test(text));
}

function syncMode() {
  return els.importForm?.elements.syncMode?.value === "cots" ? "cots" : "custom";
}

function partImportBlocked(part) {
  return syncMode() === "custom" && likelyCotsPart(part);
}

function eligibleImportParts(items = parts) {
  return items.filter((part) => !partImportBlocked(part));
}

function renderParts() {
  els.exportButton.disabled = !source || !parts.length;
  els.partCount.textContent = parts.length ? `${parts.length} part${parts.length === 1 ? "" : "s"} loaded` : "No parts loaded";

  if (!parts.length) {
    els.partsBody.innerHTML = `<tr><td colspan="8" class="empty">Import from Onshape to populate inventory.</td></tr>`;
    els.selectAll.checked = false;
    els.selectAll.indeterminate = false;
    els.selectAll.disabled = true;
    updateSummary();
    renderCustomConfigurator();
    return;
  }

  els.partsBody.innerHTML = parts.map((part, index) => `
    <tr class="${partImportBlocked(part) ? "blocked-import-row" : ""}">
      <td><input type="checkbox" data-index="${index}" data-field="selected" ${part.selected && !partImportBlocked(part) ? "checked" : ""} ${partImportBlocked(part) ? "disabled" : ""} aria-label="select ${escapeHtml(part.name)}"></td>
      <td><span class="chip ${escapeAttr(part.sourceType || part.type || "custom")}">${escapeHtml((part.sourceType || part.type || "custom").toUpperCase())}</span></td>
      <td><span class="part-name">${escapeHtml(part.name)}</span><br><small>${escapeHtml(part.bodyType || part.id || "")}</small></td>
      <td><input data-index="${index}" data-field="material" value="${escapeAttr(part.material || "Unassigned")}" ${partImportBlocked(part) ? "disabled" : ""}></td>
      <td>${escapeHtml(part.vendor || part.process || part.thickness || "review")}</td>
      <td><input data-index="${index}" data-field="quantity" type="number" min="1" max="999" value="${Number(part.quantity || 1)}" ${partImportBlocked(part) ? "disabled" : ""}></td>
      <td><span class="status">${escapeHtml(partImportBlocked(part) ? "Assembly BOM only" : part.status || part.procurementStatus || "needed")}</span></td>
      <td><button class="ghost small" type="button" data-action="import-part" data-index="${index}" ${partImportBlocked(part) ? "disabled" : ""}>${partImportBlocked(part) ? "Assembly only" : "Import"}</button></td>
    </tr>
  `).join("");
  const eligible = eligibleImportParts();
  els.selectAll.checked = Boolean(eligible.length) && eligible.every((part) => part.selected);
  els.selectAll.indeterminate = eligible.some((part) => part.selected) && !els.selectAll.checked;
  els.selectAll.disabled = !eligible.length;
  updateSummary();
  renderCustomConfigurator();
}

function onPartEdit(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;
  if (!Number.isInteger(index) || !field) return;
  if (field === "selected" && event.target.checked && els.importForm?.elements.syncMode?.value !== "cots" && likelyCotsPart(parts[index])) {
    event.target.checked = false;
    parts[index].selected = false;
    setMessage("That row looks like COTS hardware, so PlateFlow keeps it out of the custom fabrication import.", "error");
    updateSummary();
    return;
  }
  parts[index][field] = field === "selected" ? event.target.checked : event.target.value;
  if (field === "quantity") parts[index][field] = Math.max(1, Number(event.target.value || 1));
  updateSummary();
}

function toggleAll(event) {
  parts = parts.map((part) => ({ ...part, selected: event.target.checked && !partImportBlocked(part) }));
  renderParts();
}

function renderCustomConfigurator() {
  if (!els.customConfigurator) return;
  const mode = syncMode();
  const configurableParts = eligibleImportParts();
  const visible = mode === "custom" && Boolean(source) && configurableParts.length > 0;
  els.customConfigurator.classList.toggle("hidden", !visible);
  if (!visible) return;

  const currentId = els.configPartSelect?.value || configurableParts[0]?.id || "";
  els.configPartSelect.innerHTML = configurableParts.map((part) => `
    <option value="${escapeAttr(part.id || part.name)}"${(part.id || part.name) === currentId ? " selected" : ""}>
      ${escapeHtml(part.name || part.id || "Unnamed part")}
    </option>
  `).join("");
  if (![...els.configPartSelect.options].some((option) => option.value === currentId) && els.configPartSelect.options.length) {
    els.configPartSelect.selectedIndex = 0;
  }
  renderRobotOptions();
  renderSubsystemOptions();
  fillConfigFromSelectedPart({ preservePartNumber: false });
}

function renderSyncTargetOptions() {
  const robots = dashboardState?.robots || [];
  const hasCurrent = robots.some((robot) => robot.id === selectedRobotId);
  if (!hasCurrent && robots.length) selectedRobotId = robots[0].id;
  if (!robots.length) selectedRobotId = "";

  if (els.syncRobotSelect) {
    const current = selectedRobotId || "";
    els.syncRobotSelect.innerHTML = robots.length
      ? [
          `<option value="">Select project</option>`,
          ...robots.map((robot) => `<option value="${escapeAttr(robot.id)}"${robot.id === current ? " selected" : ""}>${escapeHtml(robot.name)} · ${escapeHtml(targetLabel(robot))} · ${escapeHtml(robot.season)}</option>`)
        ].join("")
      : `<option value="">Add a project first</option>`;
    els.syncRobotSelect.disabled = !robots.length;
    if (current && robots.some((robot) => robot.id === current)) els.syncRobotSelect.value = current;
  }

  if (els.configRobot && els.configRobot.options.length && selectedRobotId) {
    els.configRobot.value = selectedRobotId;
  }
  if (source) source.robotId = selectedRobotId;
  renderSyncSubassemblyName();
}

function renderRobotOptions() {
  if (!els.configRobot) return;
  const robots = dashboardState?.robots || [];
  if (!selectedRobotId && robots.length) selectedRobotId = robots[0].id;
  const current = els.configRobot.value || els.syncRobotSelect?.value || selectedRobotId;
  els.configRobot.innerHTML = [
    `<option value="">Select project</option>`,
    ...robots.map((robot) => `<option value="${escapeAttr(robot.id)}"${robot.id === current ? " selected" : ""}>${escapeHtml(robot.name)} · ${escapeHtml(targetLabel(robot))} · ${escapeHtml(robot.season)}</option>`)
  ].join("");
  if (current && robots.some((robot) => robot.id === current)) {
    els.configRobot.value = current;
    selectedRobotId = current;
    if (els.syncRobotSelect) els.syncRobotSelect.value = current;
    if (source) source.robotId = current;
  }
  renderSyncSubassemblyName();
}

function renderSubsystemOptions() {
  if (!els.configSubsystem) return;
  const name = subassemblyNameFromSource();
  els.configSubsystem.innerHTML = `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`;
  renderSyncSubassemblyName();
}

function renderSyncSubassemblyName() {
  if (!els.syncSubassemblyName) return;
  els.syncSubassemblyName.value = subassemblyNameFromSource();
}

function subassemblyNameFromSource() {
  return String(source?.documentName || source?.sourceTag || els.importForm?.elements.sourceTag?.value || "Onshape document").trim() || "Onshape document";
}

function onConfigRobotChange() {
  selectedRobotId = els.configRobot?.value || "";
  if (els.syncRobotSelect) els.syncRobotSelect.value = selectedRobotId;
  if (source) source.robotId = selectedRobotId;
  onGeneratePartNumber();
  renderOverview(dashboardState);
}

function onSyncRobotChange() {
  selectedRobotId = els.syncRobotSelect?.value || "";
  if (els.configRobot && [...els.configRobot.options].some((option) => option.value === selectedRobotId)) {
    els.configRobot.value = selectedRobotId;
  }
  if (source) source.robotId = selectedRobotId;
  renderSubsystemOptions();
  onGeneratePartNumber();
  renderRobots(dashboardState?.robots || []);
  renderOverview(dashboardState);
  renderFabrication(dashboardState?.fabrication || { jobs: [] });
}

function selectedConfigPart() {
  const selectedId = els.configPartSelect?.value || "";
  const configurableParts = eligibleImportParts();
  return configurableParts.find((part) => (part.id || part.name) === selectedId) || configurableParts[0] || null;
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
  populateRoutingSelects(part, { preserve: true });
  if (!options.preservePartNumber || !els.configPartNumber?.value) onGeneratePartNumber();
}

function populateRoutingSelects(part, options = {}) {
  const routing = routingSettings();
  const materialRule = routingForMaterial(part?.material || "");
  const autoRule = autoRoutingForPart(part);
  const machines = [
    autoRule?.machine,
    ...(materialRule?.machines?.length ? materialRule.machines : routing.machines)
  ].filter(Boolean);
  const stocks = [
    autoRule?.stock,
    ...(materialRule?.stockTypes?.length ? materialRule.stockTypes : routing.stockTypes)
  ].filter(Boolean);
  fillSelect(els.configMachine, machines, autoRule?.machine || (options.preserve ? els.configMachine?.value : ""));
  fillSelect(els.configStock, stocks, autoRule?.stock || (options.preserve ? els.configStock?.value : ""));
}

function fillSelect(select, values, current = "") {
  if (!select) return;
  const clean = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  const placeholder = select.id === "configStock" ? `<option value="">Select stock</option>` : "";
  select.innerHTML = `${placeholder}${clean.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (current && clean.includes(current)) select.value = current;
  else if (placeholder && clean.length) select.value = clean[0];
  else if (!placeholder && clean.length) select.value = clean[0];
}

function routingSettings() {
  const routing = dashboardState?.settings?.routing || defaultRoutingSettings();
  const defaults = defaultRoutingSettings();
  return {
    materials: Array.isArray(routing.materials) && routing.materials.length ? routing.materials : defaults.materials,
    stockTypes: Array.isArray(routing.stockTypes) && routing.stockTypes.length ? routing.stockTypes : defaults.stockTypes,
    machines: Array.isArray(routing.machines) && routing.machines.length ? routing.machines : defaults.machines,
    rules: Array.isArray(routing.rules) && routing.rules.length ? routing.rules : defaults.rules,
    autoRules: Array.isArray(routing.autoRules) && routing.autoRules.length ? routing.autoRules : defaults.autoRules
  };
}

function routingForMaterial(material) {
  const normalized = String(material || "").toLowerCase();
  if (!normalized) return null;
  return routingSettings().rules.find((rule) => {
    return routingRuleMatches(rule.match, normalized);
  }) || null;
}

function autoRoutingForPart(part) {
  const text = [
    part?.name,
    part?.partNumber,
    part?.category,
    part?.material,
    part?.stock,
    part?.bodyType
  ].filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;
  return routingSettings().autoRules.find((rule) => routingRuleMatches(rule.match, text)) || null;
}

function routingRuleMatches(match, text) {
  const normalized = String(text || "").toLowerCase();
  return String(match || "").toLowerCase().split(/[,|]/).map((item) => item.trim()).filter(Boolean).some((matcher) => {
    if (matcher.startsWith("/") && matcher.lastIndexOf("/") > 0) {
      try {
        const pattern = matcher.slice(1, matcher.lastIndexOf("/"));
        return new RegExp(pattern, "i").test(normalized);
      } catch {
        return false;
      }
    }
    return normalized.includes(matcher);
  });
}

function defaultRoutingSettings() {
  return {
    materials: ["Polycarbonate Smoked", "Polycarbonate Clear", "Aluminum", "Aluminium", "6061 Aluminum", "5052 Aluminum"],
    stockTypes: ["Sheet/Plate", "Tube 1x1", "Tube 1x2", "Tube 2x2", "Spacer Stock", "Churro", "Rounded Hex"],
    machines: ["Router", "Fabworks", "Manual fabrication"],
    rules: [
      { match: "polycarbonate", machines: ["Router"], stockTypes: ["Sheet/Plate"] },
      { match: "aluminum,aluminium", machines: ["Fabworks"], stockTypes: ["Sheet/Plate", "Tube 1x1", "Tube 1x2", "Tube 2x2", "Spacer Stock", "Churro", "Rounded Hex"] }
    ],
    autoRules: [
      { match: "round spacer", stock: "Spacer Stock", machine: "Manual fabrication", category: "stock", fabricationIntent: "make_now" }
    ]
  };
}

function onGeneratePartNumber() {
  const part = selectedConfigPart();
  if (!part || !els.configPartNumber) return;
  els.configPartNumber.value = generateClientPartNumber(part);
}

function generateClientPartNumber(part) {
  const settings = dashboardState?.settings?.partNumber || defaultPartNumberSettings();
  const context = clientPartNumberContext(part);
  return formatPartNumber(settings, {
    prefix: settings.prefix || "4999",
    year: context.year,
    kind: "P",
    number: context.number,
    subsystem: context.acronym,
    source: partNumberCode(source?.sourceTag || source?.documentName || "SRC", settings.sourceLength),
    part: partNumberCode(part.name || part.id || "part", settings.partLength)
  });
}

function clientPartNumberContext(part) {
  const robot = (dashboardState?.robots || []).find((item) => item.id === (els.configRobot?.value || selectedRobotId));
  const name = subassemblyNameFromSource();
  const existing = robotSubassemblies(robot).find((item) => (
    item.sourceDocumentId && source?.documentId && item.sourceDocumentId === source.documentId
  )) || robotSubassemblies(robot).find((item) => item.name === name);
  const block = Number(existing?.numberBlock || (robotSubassemblies(robot).length + 1) * 10 || 10);
  const configurable = eligibleImportParts();
  const partIndex = Math.max(0, configurable.findIndex((item) => (item.id || item.name) === (part?.id || part?.name)));
  return {
    year: shortSeason(robot?.season || new Date().getFullYear()),
    acronym: existing?.acronym || subassemblyAcronym(name),
    number: String(block * 100 + partIndex + 1).padStart(4, "0")
  };
}

function shortSeason(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return (digits.slice(-2) || String(new Date().getFullYear()).slice(-2)).padStart(2, "0");
}

function subassemblyAcronym(value) {
  const text = String(value || "").toLowerCase();
  const known = [
    [/drive|drivetrain/, "DT"],
    [/shooter/, "ST"],
    [/intake/, "IT"],
    [/indexer|index/, "IN"],
    [/climber|climb/, "CR"],
    [/bumper/, "BR"],
    [/main|robot/, "MA"]
  ];
  const match = known.find(([pattern]) => pattern.test(text));
  if (match) return match[1];
  const words = String(value || "assembly").trim().toUpperCase().match(/[A-Z0-9]+/g) || ["AS"];
  return words.map((word) => word[0]).join("").slice(0, 2).padEnd(2, "X");
}

function partNumberCode(value, length) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return (normalized || "X").slice(0, length).padEnd(length, "X");
}

function defaultPartNumberSettings() {
  return {
    template: "{prefix}-{year}-{kind}-{number}-{subsystem}",
    prefix: "4999",
    sourceLength: 3,
    subsystemLength: 3,
    partLength: 4
  };
}

function formatPartNumber(settings, tokens) {
  return String(settings.template || "{prefix}-{year}-{kind}-{number}-{subsystem}")
    .replace(/\{prefix\}/g, tokens.prefix || "4999")
    .replace(/\{year\}/g, tokens.year || "26")
    .replace(/\{kind\}/g, tokens.kind || "P")
    .replace(/\{number\}/g, tokens.number || "0001")
    .replace(/\{source\}/g, tokens.source || "SRC")
    .replace(/\{subsystem\}/g, tokens.subsystem || "GEN")
    .replace(/\{part\}/g, tokens.part || "PART")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function onClearConfig() {
  const part = selectedConfigPart();
  populateRoutingSelects(part, { preserve: false });
  if (els.configQuantity) els.configQuantity.value = selectedConfigPart()?.quantity || 1;
  onGeneratePartNumber();
  setMessage("Cleared routing fields. Onshape material and thickness stay attached to the selected part.", "");
}

function onPartsAction(event) {
  const button = event.target.closest("button[data-action='import-part']");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || !parts[index]) return;
  if (partImportBlocked(parts[index])) {
    setMessage("Belts and other COTS rows must come from the Assembly BOM import.", "error");
    return;
  }
  submitCurrentParts([parts[index]], { forceQuantityFromConfigurator: false });
}

async function onSubmitConfiguredPart() {
  const part = selectedConfigPart();
  await submitCurrentParts(part ? [part] : [], { forceQuantityFromConfigurator: true });
}

async function onSubmitSelectedParts() {
  await submitCurrentParts(parts.filter((part) => part.selected), { forceQuantityFromConfigurator: false });
}

async function onSubmitAllParts() {
  const selected = syncMode() === "cots"
    ? parts.filter(Boolean)
    : parts.filter((part) => part.selected && !partImportBlocked(part));
  await submitCurrentParts(selected, { forceQuantityFromConfigurator: false });
}

async function submitCurrentParts(selectedParts, options = {}) {
  const mode = els.importForm?.elements.syncMode?.value === "cots" ? "cots" : "custom";
  if (mode === "cots") return submitCotsParts(selectedParts);
  return submitConfiguredParts(selectedParts, options);
}

async function submitConfiguredParts(selectedParts, options = {}) {
  if (!source) {
    setMessage("Load Onshape parts before submitting custom parts.", "error");
    return;
  }
  const incoming = selectedParts.filter(Boolean);
  const cotsLike = incoming.filter(likelyCotsPart);
  const selected = incoming.filter((part) => !likelyCotsPart(part));
  if (!selected.length) {
    setMessage(cotsLike.length ? "The selected row looks like COTS hardware. Import it from an Assembly BOM instead of the custom Part Studio flow." : "Select at least one part to import.", "error");
    return;
  }
  const robotId = els.configRobot?.value || selectedRobotId || "";
  if ((dashboardState?.robots || []).length && !robotId) {
    setMessage("Choose the robot or project this Onshape document belongs to.", "error");
    els.configRobot?.focus();
    return;
  }
  const stock = els.configStock?.value || "";
  const missingStock = selected.find((part) => !(autoRoutingForPart(part)?.stock || stock || part.stock));
  if (missingStock) {
    setMessage(`Choose a stock type before submitting ${missingStock.name || "this part"}.`, "error");
    els.configStock?.focus();
    return;
  }
  const configuredParts = selected.map((item) => {
    const autoRule = autoRoutingForPart(item);
    const configuredStock = autoRule?.stock || item.stock || stock;
    const configuredMachine = autoRule?.machine || item.machine || els.configMachine?.value || "Router";
    const generated = generateClientPartNumber(item);
    const typed = selected.length === 1 ? String(els.configPartNumber?.value || "").trim() : "";
    return {
      id: item.id || "",
      partKey: item.id || item.name || "",
      name: item.name || "",
      robotId,
      subsystem: subassemblyNameFromSource(),
      thickness: item.thickness || "",
      materialType: item.material || "",
      stock: configuredStock,
      machine: configuredMachine,
      category: autoRule?.category || "",
      fabricationIntent: autoRule?.fabricationIntent || "",
      partNumber: typed && typed !== generated ? typed : "",
      quantity: Math.max(1, Number(options.forceQuantityFromConfigurator ? els.configQuantity?.value || item.quantity || 1 : item.quantity || 1))
    };
  });
  const confirmed = await confirmAction({
    title: selected.length === 1 ? "Import custom part?" : "Import custom parts?",
    body: `Send ${selected.length} checked custom part${selected.length === 1 ? "" : "s"} to ${subassemblyNameFromSource()} as a new revision.${cotsLike.length ? ` ${cotsLike.length} belt/COTS-like row${cotsLike.length === 1 ? "" : "s"} will stay out of fabrication.` : ""}`,
    confirmLabel: selected.length === 1 ? "Import part" : "Import parts"
  });
  if (!confirmed) return;
  const previousParts = parts;
  setMessage(`Importing ${selected.length} custom part${selected.length === 1 ? "" : "s"} into ${subassemblyNameFromSource()}...${cotsLike.length ? ` Skipping ${cotsLike.length} COTS-like row${cotsLike.length === 1 ? "" : "s"}.` : ""}`);
  try {
    const result = await api("/api/onshape/import", {
      method: "POST",
      body: JSON.stringify({ ...source, robotId, configuredParts })
    });
    const savedByKey = new Map((result.parts || []).map((savedPart) => [savedPart.id || savedPart.name, savedPart]));
    source = result.source;
    parts = previousParts.map((item) => {
      const savedPart = savedByKey.get(item.id || item.name);
      return savedPart ? { ...item, ...savedPart, selected: true } : item;
    });
    renderParts();
    await loadDashboard({ preserveParts: true, quiet: true });
    const revision = Number(result.inventory?.revision || 1);
    setMessage(`Imported ${selected.length} custom part${selected.length === 1 ? "" : "s"} into ${subassemblyNameFromSource()} · revision ${revision}.`, "ok");
    showImportConfirmation("Custom import complete", `${selected.length} part${selected.length === 1 ? "" : "s"} synced to ${subassemblyNameFromSource()}${cotsLike.length ? `; ${cotsLike.length} COTS-like row${cotsLike.length === 1 ? "" : "s"} skipped.` : "."}`);
  } catch (error) {
    parts = previousParts;
    renderParts();
    setMessage(error.message, "error");
  }
}

async function submitCotsParts(selectedParts) {
  if (!source) {
    setMessage("Load the Assembly BOM before importing COTS rows.", "error");
    return;
  }
  const selected = selectedParts.filter(Boolean);
  if (!selected.length) {
    setMessage("Select at least one BOM row to import.", "error");
    return;
  }
  const robotId = els.syncRobotSelect?.value || selectedRobotId || "";
  if ((dashboardState?.robots || []).length && !robotId) {
    setMessage("Choose the robot or project this Assembly BOM belongs to.", "error");
    els.syncRobotSelect?.focus();
    return;
  }
  const target = (dashboardState?.robots || []).find((robot) => robot.id === robotId);
  const confirmed = await confirmAction({
    title: selected.length === 1 ? "Import COTS row?" : "Import COTS rows?",
    body: `Send ${selected.length} checked Assembly BOM row${selected.length === 1 ? "" : "s"} to ${target?.name || "this project"} / ${subassemblyNameFromSource()} as a new revision.`,
    confirmLabel: selected.length === 1 ? "Import row" : "Import rows"
  });
  if (!confirmed) return;
  const previousParts = parts;
  setMessage(`Importing ${selected.length} COTS row${selected.length === 1 ? "" : "s"} into procurement...`);
  try {
    const result = await api("/api/onshape/import-cots", {
      method: "POST",
      body: JSON.stringify({ ...source, robotId, rows: selected })
    });
    source = result.source;
    parts = previousParts.map((item) => ({ ...item, selected: selected.some((part) => (part.id || part.name) === (item.id || item.name)) }));
    renderParts();
    await loadDashboard({ preserveParts: true, quiet: true });
    const revision = Number(result.inventory?.revision || 1);
    const customCount = (result.parts || []).filter((part) => part.sourceType === "custom").length;
    const cotsCount = Math.max(0, selected.length - customCount);
    setMessage(`Imported ${cotsCount} COTS row${cotsCount === 1 ? "" : "s"} into procurement${customCount ? ` and ${customCount} custom row${customCount === 1 ? "" : "s"} into manufacturing` : ""} · revision ${revision}.`, "ok");
    showImportConfirmation("BOM import complete", `${cotsCount} procurement row${cotsCount === 1 ? "" : "s"}${customCount ? `; ${customCount} custom manufacturing row${customCount === 1 ? "" : "s"}` : ""}.`);
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
}

async function loadDashboard(options = {}) {
  const dashboard = await api("/api/dashboard");
  applyDashboardState(dashboard, options);
}

function applyDashboardState(dashboard, options = {}) {
  dashboardState = dashboard;
  normalizeSelectedTarget();
  renderDashboardChrome(dashboard);
  renderActiveDashboardPage(options);
  if (!options.preserveParts) {
    parts = dashboard.inventory.parts.map((part) => ({ ...part, selected: true }));
    source = null;
    renderParts();
  } else {
    renderCustomConfigurator();
  }
}

function renderDashboardChrome(dashboard) {
  renderInventory(dashboard.inventory);
  renderSyncTargetOptions();
  renderSubsystemOptions();
}

function activePageId() {
  if (embeddedMode) return "parts";
  const active = [...els.pages].find((page) => page.classList.contains("active-page") && !page.hidden);
  if (active) return active.id;
  return (location.hash || "#dashboard").slice(1) || "dashboard";
}

function renderActiveDashboardPage(options = {}) {
  if (!dashboardState) return;
  const page = activePageId();
  if (page === "inventory") {
    renderInventoryTable(dashboardState.inventory.parts);
    return;
  }
  if (page === "robots") {
    renderRobots(dashboardState.robots);
    return;
  }
  if (page === "fabrication") {
    renderFabrication(dashboardState.fabrication);
    return;
  }
  if (page === "procurement") {
    renderProcurement(dashboardState.procurement);
    return;
  }
  if (page === "settings") {
    renderSettings(dashboardState.settings);
    return;
  }
  if (page === "admin") {
    renderAudit(dashboardState.admin.auditLogs);
    if (!options.skipAdminUsers) loadAdminUsers();
    return;
  }
  if (page === "raw") {
    renderRawMaterials(dashboardState.rawMaterials);
    return;
  }
  renderOverview(dashboardState);
}

function normalizeSelectedTarget() {
  const robots = dashboardState?.robots || [];
  if (!robots.length) {
    selectedRobotId = "";
    selectedSubassemblyId = "";
    return;
  }
  let robot = robots.find((item) => item.id === selectedRobotId);
  if (!robot) {
    robot = robots[0];
    selectedRobotId = robot.id;
  }
  const subassemblies = robotSubassemblies(robot);
  if (!subassemblies.length) {
    selectedSubassemblyId = "";
    return;
  }
  if (!subassemblies.some((item) => item.id === selectedSubassemblyId)) {
    selectedSubassemblyId = subassemblies[0].id;
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
  const routing = settings?.routing || defaultRoutingSettings();
  els.settingsForm.elements.template.value = partNumber.template || "";
  els.settingsForm.elements.prefix.value = partNumber.prefix || "4999";
  els.settingsForm.elements.sourceLength.value = Number(partNumber.sourceLength || 3);
  els.settingsForm.elements.subsystemLength.value = Number(partNumber.subsystemLength || 3);
  els.settingsForm.elements.partLength.value = Number(partNumber.partLength || 4);
  if (els.settingsForm.elements.materials) els.settingsForm.elements.materials.value = (routing.materials || []).join("\n");
  if (els.settingsForm.elements.stockTypes) els.settingsForm.elements.stockTypes.value = (routing.stockTypes || []).join("\n");
  if (els.settingsForm.elements.machines) els.settingsForm.elements.machines.value = (routing.machines || []).join("\n");
  if (els.settingsForm.elements.routingRules) {
    els.settingsForm.elements.routingRules.value = (routing.rules || []).map((rule) => `${rule.match || ""} | ${(rule.machines || []).join(", ")} | ${(rule.stockTypes || []).join(", ")}`).join("\n");
  }
  if (els.settingsForm.elements.autoRules) {
    els.settingsForm.elements.autoRules.value = (routing.autoRules || []).map((rule) => [
      rule.match || "",
      rule.stock || "",
      rule.machine || "",
      rule.category || "",
      rule.fabricationIntent || ""
    ].join(" | ")).join("\n");
  }
  renderSettingsList("materials", routing.materials || []);
  renderSettingsList("stockTypes", routing.stockTypes || []);
  renderSettingsList("machines", routing.machines || []);
  renderSettingsRoutingRules(routing.rules || []);
  renderSettingsAutoRules(routing.autoRules || []);
  syncSettingsBuilderToFields();
  if (els.settingsSavedStatus) {
    els.settingsSavedStatus.textContent = settings?.updatedAt ? `Last saved ${formatDateTime(settings.updatedAt)}` : "Not saved yet";
  }
}

function settingsListConfig(name) {
  return {
    materials: { id: "settingsMaterialsList", label: "Material" },
    stockTypes: { id: "settingsStockTypesList", label: "Stock type" },
    machines: { id: "settingsMachinesList", label: "Machine/process" }
  }[name];
}

function renderSettingsList(name, values) {
  const config = settingsListConfig(name);
  const container = config ? document.querySelector(`#${config.id}`) : null;
  if (!container) return;
  const rows = (Array.isArray(values) ? values : []).filter(Boolean);
  container.innerHTML = rows.length
    ? rows.map((value) => settingsListRow(name, value, config.label)).join("")
    : settingsListRow(name, "", config.label);
}

function settingsListRow(name, value, label) {
  return `
    <div class="settings-list-row" data-settings-list="${escapeAttr(name)}">
      <input data-settings-list-value="${escapeAttr(name)}" value="${escapeAttr(value)}" aria-label="${escapeAttr(label)}">
      <button class="ghost small" type="button" data-settings-action="remove-settings-row">Remove</button>
    </div>
  `;
}

function renderSettingsRoutingRules(rules) {
  const container = document.querySelector("#settingsRoutingRulesList");
  if (!container) return;
  const rows = Array.isArray(rules) && rules.length ? rules : [{ match: "", machines: [], stockTypes: [] }];
  container.innerHTML = rows.map(renderSettingsRoutingRuleFragment).join("");
}

function renderSettingsRoutingRuleFragment(rule) {
  return `
    <article class="settings-rule-card" data-settings-rule="routing">
      <label>
        <span>When material contains</span>
        <input data-rule-field="match" value="${escapeAttr(rule.match || "")}" placeholder="polycarbonate, aluminum">
      </label>
      <label>
        <span>Machines allowed</span>
        <input data-rule-field="machines" value="${escapeAttr((rule.machines || []).join(", "))}" placeholder="Router, Fabworks">
      </label>
      <label>
        <span>Stock allowed</span>
        <input data-rule-field="stockTypes" value="${escapeAttr((rule.stockTypes || []).join(", "))}" placeholder="Sheet/Plate, Tube 1x1">
      </label>
      <button class="ghost small" type="button" data-settings-action="remove-settings-row">Remove</button>
    </article>
  `;
}

function renderSettingsAutoRules(rules) {
  const container = document.querySelector("#settingsAutoRulesList");
  if (!container) return;
  const rows = Array.isArray(rules) && rules.length ? rules : [{ match: "", stock: "", machine: "", category: "", fabricationIntent: "make_now" }];
  container.innerHTML = rows.map(renderSettingsAutoRuleFragment).join("");
}

function renderSettingsAutoRuleFragment(rule) {
  return `
    <article class="settings-rule-card auto" data-settings-rule="auto">
      <label>
        <span>When part name contains</span>
        <input data-rule-field="match" value="${escapeAttr(rule.match || "")}" placeholder="round spacer">
      </label>
      <label>
        <span>Stock</span>
        <input data-rule-field="stock" value="${escapeAttr(rule.stock || "")}" placeholder="Spacer Stock">
      </label>
      <label>
        <span>Machine/process</span>
        <input data-rule-field="machine" value="${escapeAttr(rule.machine || "")}" placeholder="Manual fabrication">
      </label>
      <label>
        <span>Category</span>
        <input data-rule-field="category" value="${escapeAttr(rule.category || "")}" placeholder="stock">
      </label>
      <label>
        <span>Intent</span>
        <select data-rule-field="fabricationIntent">
          ${["make_now", "send_out", "defer", "review_needed"].map((intent) => `<option value="${intent}"${intent === (rule.fabricationIntent || "make_now") ? " selected" : ""}>${intent.replace(/_/g, " ")}</option>`).join("")}
        </select>
      </label>
      <button class="ghost small" type="button" data-settings-action="remove-settings-row">Remove</button>
    </article>
  `;
}

function renderOverview(dashboard) {
  if (!els.overviewRobotPanel || !dashboard) return;
  const robots = dashboard.robots || [];
  if (!robots.length) {
    els.overviewRobotPanel.innerHTML = `<article class="overview-empty">Add a robot or project to start tracking sub-assembly progress.</article>`;
    return;
  }
  const robot = robots.find((item) => item.id === selectedRobotId) || robots[0];
  selectedRobotId = robot.id;
  const robotCounts = readinessCounts(robot);
  const procurementSummary = projectProcurementSummary(robot.id);
  if (els.metricProjectBudget) els.metricProjectBudget.textContent = formatMoney(procurementSummary.estimatedTotalCents || 0);
  const subassemblies = robotSubassemblies(robot);
  els.overviewRobotPanel.innerHTML = `
    <article class="overview-robot-card">
      <div class="card-head">
        <div>
          <span class="eyebrow">Selected ${escapeHtml(targetLabel(robot))}</span>
          <h3>${escapeHtml(robot.name)}</h3>
          <p>${escapeHtml(robot.season)} · ${Number(robot.counts.requirements)} parts · ${robotCounts.label} ready</p>
        </div>
        <strong>${escapeHtml(robotCounts.label)}</strong>
      </div>
      <div class="progress"><span style="width:${Math.max(0, Math.min(100, Number(robot.readiness)))}%"></span></div>
      <div class="overview-budget">
        <span>COTS budget</span>
        <strong>${formatMoney(procurementSummary.estimatedTotalCents || 0)}</strong>
        <small>${Number(procurementSummary.quantity || 0)} needed · ${Number(procurementSummary.lines || 0)} order line${Number(procurementSummary.lines || 0) === 1 ? "" : "s"}</small>
      </div>
    </article>
    <div class="subassembly-grid">
      ${subassemblies.length ? subassemblies.map((subassembly) => renderSubassemblyCard(robot, subassembly)).join("") : `<article class="overview-empty">No Onshape sub-assemblies have been imported for this project yet.</article>`}
    </div>
  `;
}

function renderInventory(inventory) {
  if (!inventory || !els.metricImports) return;
  renderDocumentFilter(inventory);
  els.metricImports.textContent = String(inventory.totals.records);
  els.metricParts.textContent = String(inventory.totals.parts);
  els.metricCustom.textContent = String(inventory.totals.custom || 0);
  els.metricCots.textContent = String(inventory.totals.cots || 0);
  els.metricFabrication.textContent = String(inventory.totals.fabrication || 0);
  if (els.metricProjectBudget && !selectedRobotId) els.metricProjectBudget.textContent = "$0.00";
  if (els.procQueueCount) els.procQueueCount.textContent = inventory.totals.procurement ? `${inventory.totals.procurement} COTS item${inventory.totals.procurement === 1 ? "" : "s"} awaiting procurement review.` : "No COTS parts queued.";
}

function projectProcurementSummary(robotId) {
  const project = (dashboardState?.procurement?.projectBuckets || []).find((item) => item.robotId === robotId);
  const lines = project
    ? (project.subassemblies || []).flatMap((subassembly) => subassembly.vendorBuckets || []).flatMap((bucket) => bucket.lines || [])
    : [];
  return procurementTotals([], lines);
}

function subassemblyProcurementSummary(robotId, subassembly) {
  const project = (dashboardState?.procurement?.projectBuckets || []).find((item) => item.robotId === robotId);
  const subassemblyKey = stableClientKey(subassembly?.name || "");
  const bucket = (project?.subassemblies || []).find((item) => {
    if (item.id && subassembly?.id && String(item.id) === String(subassembly.id)) return true;
    return stableClientKey(item.name || "") === subassemblyKey;
  });
  const lines = bucket
    ? (bucket.vendorBuckets || []).flatMap((vendorBucket) => vendorBucket.lines || [])
    : [];
  const totals = procurementTotals([], lines);
  const needed = lines.reduce((sum, line) => sum + Number(line.quantityNeeded || line.quantity || 0), 0);
  const ordered = lines.reduce((sum, line) => sum + orderedQuantityForLine(line), 0);
  const clampedOrdered = needed ? Math.min(needed, ordered) : ordered;
  return {
    ...totals,
    needed,
    ordered: clampedOrdered,
    percent: needed ? Math.round((clampedOrdered / needed) * 100) : 0
  };
}

function orderedQuantityForLine(line) {
  const needed = Number(line.quantityNeeded || line.quantity || 0);
  const tracked = Math.max(Number(line.quantityOrdered || 0), Number(line.quantityReceived || 0));
  const status = String(line.status || "").toLowerCase();
  if (["ordered", "partially_received", "received", "arrived", "backordered"].includes(status)) {
    return tracked > 0 ? Math.min(needed || tracked, tracked) : needed;
  }
  return Math.min(needed || tracked, tracked);
}

function stableClientKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function targetLabel(target) {
  return target?.targetType === "project" ? "project" : "robot";
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
  syncInventorySelection(items);
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
    part.sourceDocument,
    part.sourceDocumentName
  ].join(" ").toLowerCase().includes(query))
    .sort(inventorySorter(sortMode))
    .slice(0, 200);

  if (!visible.length) {
    els.inventoryBody.innerHTML = `<tr><td colspan="10" class="empty">No matching inventory.</td></tr>`;
    updateInventorySelectionControls([]);
    return;
  }

  els.inventoryBody.innerHTML = visible.map((part) => `
    <tr data-item-key="${escapeAttr(part.itemKey)}" data-source-type="${escapeAttr(part.sourceType || part.type || "custom")}">
      <td><input type="checkbox" data-action="select-inventory" data-item-key="${escapeAttr(part.itemKey)}" aria-label="Select ${escapeAttr(part.name || "catalog item")}" ${selectedInventoryItems.has(part.itemKey) ? "checked" : ""}></td>
      <td><span class="chip ${escapeAttr(part.sourceType || part.type || "custom")}">${escapeHtml((part.sourceType || part.type || "custom").toUpperCase())}</span></td>
      <td><span class="status">${escapeHtml(part.sourceDocument || "Unassigned")}</span><small class="revision-note" title="${escapeAttr(revisionTooltip(part))}">${escapeHtml(revisionLabel(part))}</small></td>
      <td><input class="part-name-input" data-field="name" size="${partNameInputSize(part.name)}" value="${escapeAttr(part.name || "")}" aria-label="Part name"></td>
      <td><input data-field="partNumber" value="${escapeAttr(inventoryPartNumber(part))}" aria-label="Part number or SKU"></td>
      <td><input data-field="category" value="${escapeAttr(part.category || "uncategorized")}" aria-label="Category"></td>
      <td><input data-field="${part.sourceType === "cots" ? "vendor" : "material"}" value="${escapeAttr(part.sourceType === "cots" ? part.vendor || "" : [part.material, part.thickness].filter(Boolean).join(" "))}" aria-label="${part.sourceType === "cots" ? "Vendor" : "Material"}"></td>
      <td>${neededCell(part)}</td>
      <td><input class="number-input" data-field="onHand" type="number" min="0" value="${Number(part.onHand || 0)}" aria-label="On hand"></td>
      <td class="row-actions">
        <button class="ghost small" type="button" data-action="save-inventory">Save</button>
        <button class="ghost small danger" type="button" data-action="delete-inventory">Delete</button>
      </td>
    </tr>
  `).join("");
  updateInventorySelectionControls(visible);
}

function onInventoryCellInput(event) {
  const input = event.target.closest(".part-name-input");
  if (!input) return;
  input.size = partNameInputSize(input.value);
}

function syncInventorySelection(items = []) {
  const valid = new Set(items.map((item) => item.itemKey).filter(Boolean));
  selectedInventoryItems = new Set([...selectedInventoryItems].filter((key) => valid.has(key)));
}

function updateInventorySelectionControls(visible = []) {
  const visibleKeys = visible.map((item) => item.itemKey).filter(Boolean);
  const selectedVisible = visibleKeys.filter((key) => selectedInventoryItems.has(key));
  if (els.inventorySelectAll) {
    els.inventorySelectAll.checked = Boolean(visibleKeys.length && selectedVisible.length === visibleKeys.length);
    els.inventorySelectAll.indeterminate = Boolean(selectedVisible.length && selectedVisible.length < visibleKeys.length);
    els.inventorySelectAll.disabled = !visibleKeys.length;
  }
  if (els.inventorySelectedCount) {
    els.inventorySelectedCount.textContent = `${selectedInventoryItems.size} selected`;
  }
  if (els.inventoryBulkDeleteButton) {
    els.inventoryBulkDeleteButton.disabled = selectedInventoryItems.size === 0;
  }
}

function onInventorySelectionChange(event) {
  const input = event.target.closest("input[data-action='select-inventory']");
  if (!input) return;
  const key = input.dataset.itemKey || "";
  if (!key) return;
  if (input.checked) selectedInventoryItems.add(key);
  else selectedInventoryItems.delete(key);
  updateInventorySelectionControls(visibleInventoryItemsFromDom());
}

function onInventorySelectAllChange(event) {
  const keys = [...els.inventoryBody.querySelectorAll("tr[data-item-key]")].map((row) => row.dataset.itemKey).filter(Boolean);
  if (event.target.checked) keys.forEach((key) => selectedInventoryItems.add(key));
  else keys.forEach((key) => selectedInventoryItems.delete(key));
  els.inventoryBody.querySelectorAll("input[data-action='select-inventory']").forEach((input) => {
    input.checked = event.target.checked;
  });
  updateInventorySelectionControls(visibleInventoryItemsFromDom());
}

function visibleInventoryItemsFromDom() {
  return [...els.inventoryBody.querySelectorAll("tr[data-item-key]")]
    .map((row) => ({ itemKey: row.dataset.itemKey }))
    .filter((item) => item.itemKey);
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

function revisionLabel(part) {
  const diff = part.lastDiff || {};
  const added = Array.isArray(diff.added) ? diff.added.length : 0;
  const changed = Array.isArray(diff.changed) ? diff.changed.length : 0;
  const removed = Array.isArray(diff.removed) ? diff.removed.length : 0;
  return `rev ${Number(part.revision || 1)} · +${added} Δ${changed} -${removed}`;
}

function revisionTooltip(part) {
  const diff = part.lastDiff || {};
  const lines = [
    `Revision ${Number(part.revision || 1)}`,
    `Added: ${(diff.added || []).join(", ") || "none"}`,
    `Changed: ${(diff.changed || []).join(", ") || "none"}`,
    `Removed: ${(diff.removed || []).join(", ") || "none"}`
  ];
  return lines.join("\n");
}

function neededCell(part) {
  const neededBy = Array.isArray(part.neededBy) ? part.neededBy : [];
  const total = neededBy.length ? neededBy.reduce((sum, item) => sum + Number(item.quantityNeeded || 0), 0) : Number(part.quantityNeeded ?? part.quantity ?? 0);
  const details = neededBy.length ? neededBy.map((item) => {
    const owner = [item.robot, item.subsystem].filter(Boolean).join(" / ") || "Inventory";
    return `${owner}: ${Number(item.quantityNeeded || 1)} ${item.status || "needed"}`;
  }).join("\n") : "No project requirement is currently attached.";
  return `<span class="needed-tooltip" tabindex="0" data-quantity="${Number(total)}">${Number(total)}<span role="tooltip">${escapeHtml(details).replace(/\n/g, "<br>")}</span></span>`;
}

function renderRobots(robots) {
  if (!els.robotList) return;
  if (!robots.length) {
    els.robotList.innerHTML = `<article><p>No projects configured.</p></article>`;
    renderRobotWorkspace(null);
    return;
  }
  if (!selectedRobotId || !robots.some((robot) => robot.id === selectedRobotId)) selectedRobotId = robots[0].id;
  els.robotList.innerHTML = robots.map((robot) => `
    <article class="robot-card ${robot.id === selectedRobotId ? "selected" : ""}" data-robot-id="${escapeAttr(robot.id)}" tabindex="0">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(robot.name)}</h3>
          <p>${escapeHtml(targetLabel(robot))} · ${escapeHtml(robot.season)} · ${Number(robot.counts.requirements)} parts</p>
        </div>
        <strong>${escapeHtml(readinessCounts(robot).label)}</strong>
      </div>
      <div class="progress"><span style="width:${Math.max(0, Math.min(100, Number(robot.readiness)))}%"></span></div>
      <dl class="mini-stats">
        <div><dt>Procurement</dt><dd>${Number(robot.progress.procurement)}%</dd></div>
        <div><dt>Fabrication</dt><dd>${Number(robot.progress.fabrication)}%</dd></div>
        <div><dt>Install</dt><dd>${Number(robot.progress.receivedInstalled)}%</dd></div>
      </dl>
      <div class="subsystem-list">
        ${robotSubassemblies(robot).slice(0, 4).map((subsystem) => `
          <span>${escapeHtml(subsystem.name)} <b>${escapeHtml(readinessCounts(subsystem).label)}</b></span>
        `).join("") || `<span>No sub-assemblies yet</span>`}
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
  els.robotWorkspaceMeta.textContent = `${targetLabel(robot)} · ${robot.season} · ${Number(robot.counts.requirements)} part${Number(robot.counts.requirements) === 1 ? "" : "s"} · ${readinessCounts(robot).label} ready`;
  els.robotAssemblySelect.innerHTML = [
    `<option value="">Select synced Assembly BOM</option>`,
    ...sources.map((sourceItem) => `<option value="${escapeAttr(sourceItem.id)}">${escapeHtml(sourceItem.label)} · ${Number(sourceItem.partCount)} items</option>`)
  ].join("");
  const requirements = robot.requirements || [];
  const subassemblies = robotSubassemblies(robot);
  const requirementRows = requirements.map((requirement) => {
    return `
      <div class="requirement-row compact" data-requirement-id="${escapeAttr(requirement.id)}">
        <div>
          <strong>${escapeHtml(requirement.name)}</strong>
          <span>${escapeHtml(requirement.sourceDocument || "Onshape")}</span>
        </div>
        <strong>qty ${Number(requirement.quantityNeeded || 1)}</strong>
      </div>
    `;
  }).join("");
  els.robotRequirementList.innerHTML = `
    <div class="robot-subassemblies">
      <h4>Sub-assemblies</h4>
      <div class="subassembly-grid">
        ${subassemblies.length ? subassemblies.map((subassembly) => renderSubassemblyCard(robot, subassembly)).join("") : `<article class="overview-empty">No Onshape documents attached yet. Import from the Onshape panel with this project selected.</article>`}
      </div>
    </div>
    <div class="robot-requirements">
      <h4>Parts</h4>
      ${requirementRows || `<p class="empty">No requirements yet. Import from Onshape or select a synced Assembly BOM source above.</p>`}
    </div>
  `;
}

function robotSubassemblies(robot) {
  return (robot?.subsystems || []).filter((subsystem) => subsystem.type === "subassembly" || Number(subsystem.counts?.requirements || subsystem.partsNeeded || 0) > 0);
}

function renderSubassemblyCard(robot, subassembly) {
  const counts = readinessCounts(subassembly);
  const procurement = subassemblyProcurementSummary(robot.id, subassembly);
  const orderedLabel = `${Number(procurement.ordered || 0)}/${Number(procurement.needed || 0)}`;
  return `
    <article class="subassembly-card" data-robot-id="${escapeAttr(robot.id)}" data-subassembly-id="${escapeAttr(subassembly.id)}" tabindex="0">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(subassembly.name)}</h3>
          <p>${escapeHtml(subassembly.assemblyPartNumber || "")}${subassembly.assemblyPartNumber ? " · " : ""}${Number(subassembly.counts?.requirements || subassembly.partsNeeded || 0)} part${Number(subassembly.counts?.requirements || subassembly.partsNeeded || 0) === 1 ? "" : "s"} · ${Number(subassembly.counts?.fabricationJobs || 0)} fab</p>
        </div>
        <strong>${escapeHtml(counts.label)}</strong>
      </div>
      <div class="progress"><span style="width:${Math.max(0, Math.min(100, Number(subassembly.readiness || 0)))}%"></span></div>
      <div class="subassembly-dial-row">
        <div class="order-dial" style="--dial-value:${Math.max(0, Math.min(100, Number(procurement.percent || 0)))}" aria-label="${escapeAttr(`${orderedLabel} COTS items ordered`)}">
          <strong>${Number(procurement.percent || 0)}%</strong>
        </div>
        <div class="order-dial-copy">
          <span>COTS ordered</span>
          <strong>${escapeHtml(orderedLabel)}</strong>
          <small>${Number(procurement.lines || 0)} line${Number(procurement.lines || 0) === 1 ? "" : "s"} · ${formatMoney(procurement.estimatedTotalCents || 0)}</small>
        </div>
      </div>
      <div class="subassembly-actions">
        <button class="ghost small" type="button" data-action="open-subassembly">Open workspace</button>
        <button class="ghost small danger" type="button" data-action="delete-subassembly" data-robot-id="${escapeAttr(robot.id)}" data-subassembly-id="${escapeAttr(subassembly.id)}">Remove</button>
      </div>
    </article>
  `;
}

function readinessCounts(item) {
  const counts = item?.counts || {};
  const needed = Number(counts.requirements ?? item?.partsNeeded ?? counts.quantityNeeded ?? item?.quantityNeeded ?? 0);
  const ready = Number(counts.ready ?? item?.ready ?? counts.quantityReady ?? item?.quantityReady ?? 0);
  return {
    needed,
    ready,
    label: `${ready}/${needed}`
  };
}

function onSubassemblyOpen(event) {
  const deleteButton = event.target.closest("button[data-action='delete-subassembly']");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    deleteSubassembly(deleteButton.dataset.robotId, deleteButton.dataset.subassemblyId);
    return;
  }
  const card = event.target.closest("[data-subassembly-id]");
  if (!card) return;
  selectedRobotId = card.dataset.robotId || selectedRobotId;
  selectedSubassemblyId = card.dataset.subassemblyId || "";
  renderFabrication(dashboardState?.fabrication || { jobs: [] });
  location.hash = "#fabrication";
}

async function deleteSubassembly(robotId, subassemblyId) {
  const robot = (dashboardState?.robots || []).find((item) => item.id === robotId);
  const subassembly = robotSubassemblies(robot).find((item) => item.id === subassemblyId);
  if (!robot || !subassembly) return;
  const confirmed = await confirmAction({
    title: "Remove sub-assembly?",
    body: `Remove ${subassembly.name} from ${robot.name}? This removes its project requirements and fabrication cards, but leaves the global inventory catalog alone.`,
    confirmLabel: "Remove sub-assembly",
    danger: true
  });
  if (!confirmed) return;
  try {
    const result = await api(`/api/robots/${encodeURIComponent(robotId)}/subassemblies/${encodeURIComponent(subassemblyId)}`, { method: "DELETE" });
    applyInventoryMutation(result);
    if (selectedSubassemblyId === subassemblyId) selectedSubassemblyId = robotSubassemblies((result.robots || []).find((item) => item.id === robotId))[0]?.id || "";
    renderOverview(dashboardState);
    renderFabrication(dashboardState?.fabrication || { jobs: [] });
    setMessage("Sub-assembly removed.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function selectedSubassemblyContext() {
  const robot = (dashboardState?.robots || []).find((item) => item.id === selectedRobotId) || (dashboardState?.robots || [])[0] || null;
  const subassemblies = robotSubassemblies(robot);
  const subassembly = robot ? (subassemblies.find((item) => item.id === selectedSubassemblyId) || subassemblies[0] || null) : null;
  if (robot && selectedRobotId !== robot.id) selectedRobotId = robot.id;
  if (robot && subassembly && selectedSubassemblyId !== subassembly.id) selectedSubassemblyId = subassembly.id;
  if (robot && !subassembly) selectedSubassemblyId = "";
  return { robot, subassembly };
}

function renderFabrication(fabrication) {
  if (!els.fabricationJobs) return;
  const { robot, subassembly } = selectedSubassemblyContext();
  renderFabricationSwitcher(robot, subassembly);
  const jobs = filterFabricationJobs(fabrication?.jobs || [], robot, subassembly);
  if (els.fabricationTitle) els.fabricationTitle.textContent = subassembly ? subassembly.name : "Custom part queue";
  if (els.fabQueueCount) {
    els.fabQueueCount.textContent = subassembly
      ? `${robot?.name || "Robot"} / ${subassembly.name} · ${jobs.length} custom fabrication card${jobs.length === 1 ? "" : "s"}.`
      : `${jobs.length} custom fabrication card${jobs.length === 1 ? "" : "s"}.`;
  }
  const columns = [
    { status: "todo", label: "To make", tone: "red" },
    { status: "in_progress", label: "Manufacturing", tone: "yellow" },
    { status: "completed", label: "Ready", tone: "green" }
  ];
  els.fabricationJobs.innerHTML = `
    <div class="kanban-board" aria-label="Fabrication kanban board">
      ${columns.map(({ status, label, tone }) => {
        const columnJobs = jobs.filter((job) => displayFabricationStatus(job.status) === status);
        return `
          <section class="kanban-column ${escapeAttr(tone)}" data-status="${escapeAttr(status)}" aria-label="${escapeAttr(label)} fabrication parts">
            <div class="kanban-column-head">
              <h4>${escapeHtml(label)}</h4>
              <span>${columnJobs.length}</span>
            </div>
            <div class="kanban-cards">
              ${columnJobs.length ? columnJobs.map(renderFabricationCard).join("") : `<p class="kanban-empty">No jobs</p>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderFabricationSwitcher(robot, subassembly) {
  if (!els.fabricationSwitcher) return;
  const robots = dashboardState?.robots || [];
  if (!robots.length) {
    els.fabricationSwitcher.classList.add("hidden");
    els.fabricationSwitcher.innerHTML = "";
    return;
  }
  els.fabricationSwitcher.classList.remove("hidden");
  const subassemblies = robotSubassemblies(robot);
  els.fabricationSwitcher.innerHTML = `
    <label>
      <span>Project</span>
      <select data-action="fab-target">
        ${robots.map((item) => `<option value="${escapeAttr(item.id)}"${item.id === robot?.id ? " selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(targetLabel(item))}</option>`).join("")}
      </select>
    </label>
    <div class="fab-switcher-pills" aria-label="Sub-assembly boards">
      ${subassemblies.length ? subassemblies.map((item) => `
        <button class="ghost small ${item.id === subassembly?.id ? "active" : ""}" type="button" data-subassembly-id="${escapeAttr(item.id)}">
          ${escapeHtml(item.name)} <span>${escapeHtml(readinessCounts(item).label)}</span>
        </button>
      `).join("") : `<span class="empty">No sub-assemblies for this project yet.</span>`}
    </div>
  `;
}

function onFabricationSwitcherChange(event) {
  const select = event.target.closest("select[data-action='fab-target']");
  if (!select) return;
  selectedRobotId = select.value;
  const robot = (dashboardState?.robots || []).find((item) => item.id === selectedRobotId);
  selectedSubassemblyId = robotSubassemblies(robot)[0]?.id || "";
  renderRobots(dashboardState?.robots || []);
  renderOverview(dashboardState);
  renderFabrication(dashboardState?.fabrication || { jobs: [] });
}

function onFabricationSwitcherClick(event) {
  const button = event.target.closest("button[data-subassembly-id]");
  if (!button) return;
  selectedSubassemblyId = button.dataset.subassemblyId || "";
  renderRobots(dashboardState?.robots || []);
  renderOverview(dashboardState);
  renderFabrication(dashboardState?.fabrication || { jobs: [] });
}

function filterFabricationJobs(jobs, robot, subassembly) {
  if (!robot || !subassembly) return jobs;
  return jobs.filter((job) => {
    const line = Array.isArray(job.lines) ? job.lines[0] : {};
    const jobRobotId = job.robotId || line.robotId || "";
    const jobSubsystemId = job.subsystemId || line.subsystemId || "";
    return (!jobRobotId || jobRobotId === robot.id) && (jobSubsystemId === subassembly.id || line.subsystem === subassembly.name || job.subassemblyName === subassembly.name);
  });
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
  const safe = procurement || {};
  const projects = Array.isArray(safe.projectBuckets) ? safe.projectBuckets : [];
  const availableProjects = Array.isArray(safe.availableProjects) && safe.availableProjects.length
    ? safe.availableProjects
    : (dashboardState?.robots || []).map((robot) => ({ robotId: robot.id, name: robot.name, targetType: robot.targetType, season: robot.season, quantity: 0, estimatedTotalCents: 0 }));
  const orders = Array.isArray(safe.orders) ? safe.orders : [];
  renderProcurementProjectFilter(availableProjects, projects);
  const selectedProject = els.procurementProjectFilter?.value || "__all";
  const allProjects = selectedProject === "__all";
  let scopedProjects = !allProjects && selectedProject
    ? projects.filter((project) => procurementProjectValue(project) === selectedProject)
    : projects;
  if (!allProjects && selectedProject && !scopedProjects.length) {
    const emptyProject = availableProjects.find((project) => procurementProjectValue(project) === selectedProject);
    if (emptyProject) scopedProjects.push({ ...emptyProject, subassemblies: [] });
  }
  renderProcurementSubassemblyFilter(scopedProjects, allProjects);
  const selectedSubassembly = els.procurementSubassemblyFilter?.value || "__all";
  if (!allProjects && selectedSubassembly !== "__all") scopedProjects = filterProcurementSubassemblies(scopedProjects, selectedSubassembly);
  let baseVendorBuckets = vendorBucketsFromProjects(scopedProjects);
  renderProcurementVendorFilter(baseVendorBuckets);
  const selectedVendor = els.procurementVendorFilter?.value || "__all";
  if (selectedVendor !== "__all") {
    baseVendorBuckets = baseVendorBuckets.filter((bucket) => procurementVendorValue(bucket.vendor) === selectedVendor);
    scopedProjects = filterProcurementVendors(scopedProjects, selectedVendor);
  }
  const scopedVendorBuckets = baseVendorBuckets;
  const scopedLines = scopedProjects.flatMap((project) => project.subassemblies || []).flatMap((subassembly) => subassembly.vendorBuckets || []).flatMap((bucket) => bucket.lines || []);
  const totals = procurementTotals(scopedVendorBuckets, scopedLines);
  const selectedProjectName = !allProjects ? (availableProjects.find((project) => procurementProjectValue(project) === selectedProject)?.name || scopedProjects[0]?.name || "Selected project") : "All projects";
  const selectedSubassemblyName = selectedSubassembly !== "__all" ? (scopedProjects.flatMap((project) => project.subassemblies || []).find((subassembly) => procurementSubassemblyValue(subassembly) === selectedSubassembly)?.name || "Selected sub-assembly") : "All sub-assemblies";
  if (els.procQueueCount) {
    els.procQueueCount.textContent = totals.lines
      ? `${selectedProjectName} · ${selectedSubassemblyName} · ${totals.quantity} needed · ${totals.matched}/${totals.lines} matched · ${formatMoney(totals.estimatedTotalCents)} estimated`
      : "No COTS parts queued.";
  }
  if (!totals.lines) {
    els.procurementOrders.innerHTML = `
      <div class="empty-panel">
        <strong>No procurement lines in this view.</strong>
        <span>Pick another project, sub-assembly, or vendor, or import an Assembly BOM from the Onshape panel.</span>
      </div>
    `;
    return;
  }
  els.procurementOrders.innerHTML = `
    <div class="procurement-summary-grid">
      <div><strong>${Number(totals.lines)}</strong><span>order lines</span></div>
      <div><strong>${Number(scopedVendorBuckets.length)}</strong><span>vendors</span></div>
      <div><strong>${formatMoney(totals.estimatedTotalCents)}</strong><span>estimated total</span></div>
      <div><strong>${Number(totals.unmatched)}</strong><span>need review</span></div>
    </div>
    <div class="vendor-order-grid">
      ${scopedVendorBuckets.map(renderVendorBucket).join("")}
    </div>
    <div class="procurement-scope-note">
      ${allProjects
        ? "Showing vendor totals across projects. Choose a project and sub-assembly above for the detailed purchasing workspace."
        : `Showing ${escapeHtml(selectedProjectName)} / ${escapeHtml(selectedSubassemblyName)} COTS BOM grouped by vendor.`}
    </div>
    ${orders.length ? `
      <details class="procurement-sync-list">
        <summary>Sync batches and status</summary>
        ${orders.slice(0, 12).map(renderProcurementOrderStatus).join("")}
      </details>
    ` : ""}
  `;
}

function renderProcurementProjectFilter(availableProjects, projectBuckets = []) {
  if (!els.procurementProjectFilter) return;
  const current = els.procurementProjectFilter.value;
  const options = procurementProjectOptions(availableProjects, projectBuckets).map((project) => ({
    value: procurementProjectValue(project),
    label: `${project.name || "Project"}${Number(project.quantity || 0) ? ` · ${Number(project.quantity)} needed` : ""}`
  }));
  const preferred = current === "__all" && els.procurementProjectFilter.dataset.touched === "1"
    ? "__all"
    : options.some((option) => option.value === current)
      ? current
      : options.find((option) => option.value === selectedRobotId)?.value || options[0]?.value || "__all";
  els.procurementProjectFilter.innerHTML = [
    `<option value="__all"${preferred === "__all" ? " selected" : ""}>All projects</option>`,
    ...options.map((option) => `<option value="${escapeAttr(option.value)}"${option.value === preferred ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
  ].join("");
  els.procurementProjectFilter.value = preferred;
}

function procurementProjectValue(project) {
  return project?.robotId || "";
}

function procurementSubassemblyValue(subassembly) {
  return subassembly?.id || subassembly?.name || "";
}

function procurementVendorValue(vendor) {
  return String(vendor || "Unassigned").trim().toLowerCase();
}

function renderProcurementSubassemblyFilter(projects = [], allProjects = false) {
  if (!els.procurementSubassemblyFilter) return;
  const current = els.procurementSubassemblyFilter.value;
  const subassemblies = allProjects ? [] : projects.flatMap((project) => project.subassemblies || []);
  const options = subassemblies.map((subassembly) => ({
    value: procurementSubassemblyValue(subassembly),
    label: `${subassembly.name || "Sub-assembly"}${Number(subassembly.quantity || 0) ? ` · ${Number(subassembly.quantity)} needed` : ""}`
  })).filter((option, index, list) => option.value && list.findIndex((item) => item.value === option.value) === index);
  const preferred = current === "__all" && els.procurementSubassemblyFilter.dataset.touched === "1"
    ? "__all"
    : options.some((option) => option.value === current)
      ? current
      : options[0]?.value || "__all";
  els.procurementSubassemblyFilter.innerHTML = [
    `<option value="__all"${preferred === "__all" ? " selected" : ""}>${allProjects ? "Choose a project for sub-assemblies" : "All sub-assemblies"}</option>`,
    ...options.map((option) => `<option value="${escapeAttr(option.value)}"${option.value === preferred ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
  ].join("");
  els.procurementSubassemblyFilter.disabled = allProjects || !options.length;
  els.procurementSubassemblyFilter.value = preferred;
}

function renderProcurementVendorFilter(vendorBuckets = []) {
  if (!els.procurementVendorFilter) return;
  const current = els.procurementVendorFilter.value || "__all";
  const options = vendorBuckets.map((bucket) => ({
    value: procurementVendorValue(bucket.vendor),
    label: `${bucket.vendor || "Unassigned"}${Number(bucket.quantity || 0) ? ` · qty ${Number(bucket.quantity)}` : ""}`
  })).filter((option, index, list) => option.value && list.findIndex((item) => item.value === option.value) === index)
    .sort((a, b) => a.label.localeCompare(b.label));
  const preferred = options.some((option) => option.value === current) ? current : "__all";
  els.procurementVendorFilter.innerHTML = [
    `<option value="__all"${preferred === "__all" ? " selected" : ""}>All vendors</option>`,
    ...options.map((option) => `<option value="${escapeAttr(option.value)}"${option.value === preferred ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
  ].join("");
  els.procurementVendorFilter.disabled = !options.length;
  els.procurementVendorFilter.value = preferred;
}

function filterProcurementSubassemblies(projects = [], selectedSubassembly) {
  return projects.map((project) => recalculateProcurementProject({
    ...project,
    subassemblies: (project.subassemblies || []).filter((subassembly) => procurementSubassemblyValue(subassembly) === selectedSubassembly)
  })).filter((project) => (project.subassemblies || []).length);
}

function filterProcurementVendors(projects = [], selectedVendor) {
  return projects.map((project) => recalculateProcurementProject({
    ...project,
    subassemblies: (project.subassemblies || []).map((subassembly) => ({
      ...subassembly,
      vendorBuckets: (subassembly.vendorBuckets || []).filter((bucket) => procurementVendorValue(bucket.vendor) === selectedVendor)
    })).filter((subassembly) => (subassembly.vendorBuckets || []).length)
  })).filter((project) => (project.subassemblies || []).length);
}

function recalculateProcurementProject(project) {
  const subassemblies = (project.subassemblies || []).map((subassembly) => {
    const lines = (subassembly.vendorBuckets || []).flatMap((bucket) => bucket.lines || []);
    return {
      ...subassembly,
      quantity: lines.reduce((sum, line) => sum + Number(line.quantityNeeded || 0), 0),
      estimatedTotalCents: lines.reduce((sum, line) => sum + Number(line.totalPriceCents || 0), 0)
    };
  });
  return {
    ...project,
    subassemblies,
    quantity: subassemblies.reduce((sum, subassembly) => sum + Number(subassembly.quantity || 0), 0),
    estimatedTotalCents: subassemblies.reduce((sum, subassembly) => sum + Number(subassembly.estimatedTotalCents || 0), 0)
  };
}

function procurementProjectOptions(availableProjects = [], projectBuckets = []) {
  const options = new Map();
  for (const project of projectBuckets) {
    if (!project?.robotId || project.unassigned) continue;
    options.set(project.robotId, project);
  }
  for (const project of availableProjects) {
    if (!project?.robotId) continue;
    options.set(project.robotId, {
      ...(options.get(project.robotId) || {}),
      ...project,
      quantity: Number(options.get(project.robotId)?.quantity || project.quantity || 0),
      estimatedTotalCents: Number(options.get(project.robotId)?.estimatedTotalCents || project.estimatedTotalCents || 0)
    });
  }
  return [...options.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function procurementTotals(vendorBuckets, lines) {
  const allLines = lines.length ? lines : vendorBuckets.flatMap((bucket) => bucket.lines || []);
  const quantity = allLines.reduce((sum, line) => sum + Number(line.quantityNeeded || 0), 0);
  const estimatedTotalCents = allLines.reduce((sum, line) => sum + Number(line.totalPriceCents || 0), 0);
  const matched = allLines.filter((line) => line.matchStatus && !["unmatched", "lookup_failed"].includes(line.matchStatus)).length;
  return {
    lines: allLines.length,
    quantity,
    matched,
    unmatched: Math.max(0, allLines.length - matched),
    estimatedTotalCents
  };
}

function vendorBucketsFromProjects(projects) {
  const vendors = new Map();
  for (const project of projects) {
    for (const subassembly of project.subassemblies || []) {
      for (const bucket of subassembly.vendorBuckets || []) {
        const vendor = bucket.vendor || "Unassigned";
        if (!vendors.has(vendor)) vendors.set(vendor, { vendor, quantity: 0, estimatedTotalCents: 0, matched: 0, lines: [] });
        const target = vendors.get(vendor);
        target.quantity += Number(bucket.quantity || 0);
        target.estimatedTotalCents += Number(bucket.estimatedTotalCents || 0);
        target.lines.push(...(bucket.lines || []));
      }
    }
  }
  return [...vendors.values()].map((bucket) => ({
    ...bucket,
    lines: aggregateClientProcurementLines(bucket.lines)
  })).sort((a, b) => a.vendor.localeCompare(b.vendor));
}

function aggregateClientProcurementLines(lines) {
  const grouped = new Map();
  for (const line of lines || []) {
    const key = [line.vendor || "Unassigned", line.vendorSku || line.partNumber || line.productUrl || line.name].join(":").toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { ...line, quantityNeeded: 0, totalPriceCents: 0, neededBy: [] });
    const existing = grouped.get(key);
    existing.quantityNeeded += Number(line.quantityNeeded || 0);
    existing.totalPriceCents += Number(line.totalPriceCents || 0);
    existing.neededBy.push(...(Array.isArray(line.neededBy) ? line.neededBy : []));
  }
  return [...grouped.values()].sort((a, b) => (a.vendorSku || a.name || "").localeCompare(b.vendorSku || b.name || ""));
}

function renderVendorBucket(bucket) {
  const lines = Array.isArray(bucket.lines) ? bucket.lines : [];
  const total = lines.reduce((sum, line) => sum + Number(line.totalPriceCents || 0), 0);
  const lineKeys = procurementBucketLineKeys(lines);
  return `
    <section class="vendor-bucket" data-line-keys="${escapeAttr(JSON.stringify(lineKeys))}">
      <header>
        <div>
          <h4>${escapeHtml(bucket.vendor || "Unassigned")}</h4>
          <span>${Number(lines.length)} part${lines.length === 1 ? "" : "s"} · qty ${Number(bucket.quantity || 0)}</span>
        </div>
        <span class="vendor-bucket-actions">
          <strong>${formatMoney(total)}</strong>
          <button class="ghost small" type="button" data-action="vendor-procurement-status" data-status="ordered">All bought</button>
          <button class="ghost small" type="button" data-action="vendor-procurement-status" data-status="received">All arrived</button>
          <button class="ghost small danger" type="button" data-action="delete-procurement-vendor">Delete vendor</button>
        </span>
      </header>
      <div class="vendor-lines">
        ${lines.map(renderProcurementLine).join("")}
      </div>
    </section>
  `;
}

function renderProcurementProject(project) {
  const unassigned = Boolean(project.unassigned);
  return `
    <article class="procurement-project${unassigned ? " unassigned" : ""}">
      <header>
        <div>
          <span class="eyebrow">${escapeHtml(unassigned ? "Needs project assignment" : targetLabel(project))}</span>
          <h3>${escapeHtml(project.name || "Project")}</h3>
        </div>
        <strong>${formatMoney(project.estimatedTotalCents || 0)}</strong>
      </header>
      ${(project.subassemblies || []).map(renderProcurementSubassembly).join("")}
    </article>
  `;
}

function renderProcurementSubassembly(subassembly) {
  return `
    <details class="procurement-subassembly" open>
      <summary>
        <span>${escapeHtml(subassembly.name || "No subassembly selected")}</span>
        <b>${Number(subassembly.quantity || 0)} needed · ${formatMoney(subassembly.estimatedTotalCents || 0)}</b>
      </summary>
      ${(subassembly.vendorBuckets || []).map((bucket) => `
        <section class="subassembly-vendor-group">
          <h4>${escapeHtml(bucket.vendor || "Unassigned")}</h4>
          ${(bucket.lines || []).map(renderProcurementLine).join("")}
        </section>
      `).join("")}
    </details>
  `;
}

function renderProcurementLine(line) {
  const exact = line.matchStatus === "sku_exact" || line.matchStatus === "manual";
  const name = exact ? line.matchedTitle || line.name || "Purchased item" : line.name || "Purchased item";
  const sku = line.vendorSku || line.partNumber || line.manufacturerSku || "No SKU";
  const quantity = Number(line.quantityNeeded || 0);
  const unit = line.unitPriceCents == null ? "price n/a" : formatMoney(line.unitPriceCents);
  const total = line.totalPriceCents == null ? "n/a" : formatMoney(line.totalPriceCents);
  const neededBy = Array.isArray(line.neededBy) ? line.neededBy.map((item) => `${item.robotName || "No project"} / ${item.subassemblyName || "No subassembly"} x${Number(item.quantityNeeded || 0)}`).join("\n") : "";
  const fallbackUrl = procurementFallbackUrl(line.vendor, sku, name);
  const actionUrl = line.productUrl || line.vendorUrl || line.searchUrl || fallbackUrl;
  const actionLabel = line.productUrl || line.vendorUrl ? "Open" : "Find";
  const keys = line.lineKeys || (line.lineKey ? [line.lineKey] : []);
  const lineKeys = JSON.stringify(keys);
  const aggregate = keys.length > 1;
  const vendorOptions = procurementVendors();
  const selectedVendor = vendorOptions.includes(line.vendor) ? line.vendor : "Unassigned";
  const status = line.status || "needed";
  return `
    <div class="procurement-line ${escapeAttr(status)}" data-line-keys="${escapeAttr(lineKeys)}" data-quantity="${quantity}">
      <div class="procurement-line-top">
        <div class="procurement-line-main">
          <strong>${escapeHtml(name)}</strong>
          <small>${escapeHtml([line.vendor || "", sku === "No SKU" ? "" : sku, line.variantTitle || ""].filter(Boolean).join(" · ") || "Vendor/SKU needed")}</small>
          ${neededBy ? `<span class="needed-tooltip compact" tabindex="0">Needed by<span role="tooltip">${escapeHtml(neededBy).replace(/\n/g, "<br>")}</span></span>` : ""}
        </div>
        <span class="match-chip ${escapeAttr(line.matchStatus || "unmatched")}">${escapeHtml(procurementMatchLabel(line.matchStatus))}</span>
        <span class="procurement-status ${escapeAttr(status)}">${escapeHtml(procurementStatusLabel(status))}</span>
        <span class="price-pack">
          <span class="quantity-control${aggregate ? " aggregate" : ""}" title="${escapeAttr(aggregate ? `Total across ${keys.length} matching BOM lines` : "Quantity needed")}">
            <button class="ghost micro" type="button" data-action="adjust-procurement-quantity" data-delta="-1" aria-label="Decrease quantity">-</button>
            <input data-procurement-quantity type="number" min="0" max="9999" value="${quantity}" aria-label="Quantity needed">
            <button class="ghost micro" type="button" data-action="adjust-procurement-quantity" data-delta="1" aria-label="Increase quantity">+</button>
          </span>
          <b><span>${escapeHtml(unit)}</span><small>/ea</small></b>
          <strong><span>${escapeHtml(total)}</span><small>total</small></strong>
        </span>
        <span class="procurement-line-actions">
          ${actionUrl ? `<a class="ghost small" href="${escapeAttr(actionUrl)}" target="_blank" rel="noreferrer">${escapeHtml(actionLabel)}</a>` : `<span class="ghost small disabled">No link</span>`}
          <button class="ghost small" type="button" data-action="quick-procurement-status" data-status="ordered">Bought</button>
          <button class="ghost small" type="button" data-action="quick-procurement-status" data-status="received">Arrived</button>
          <button class="ghost small" type="button" data-action="toggle-procurement-edit">Edit</button>
          <button class="ghost small danger" type="button" data-action="delete-procurement-line">Delete</button>
        </span>
      </div>
      <div class="procurement-editor hidden">
        <div class="procurement-editor-head">
          <strong>Edit line</strong>
          <button class="button small" type="button" data-action="save-procurement-line">Save line</button>
        </div>
        <div class="procurement-edit-grid">
          <label class="span-2">
            <span>Name</span>
            <input data-field="name" value="${escapeAttr(name)}">
          </label>
          <label>
            <span>Vendor</span>
            <select data-field="vendor">
              ${vendorOptions.map((vendor) => `<option value="${escapeAttr(vendor)}"${vendor === selectedVendor ? " selected" : ""}>${escapeHtml(vendor)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>SKU</span>
            <input data-field="vendorSku" value="${escapeAttr(sku === "No SKU" ? "" : sku)}">
          </label>
          <label>
            <span>Qty</span>
            <input data-field="quantityNeeded" type="number" min="0" max="9999" value="${quantity}">
            ${aggregate ? `<small class="field-hint">Total across ${keys.length} matching BOM lines</small>` : ""}
          </label>
          <label>
            <span>Unit</span>
            <input data-field="unitPriceDollars" inputmode="decimal" value="${escapeAttr(line.unitPriceCents == null ? "" : (Number(line.unitPriceCents || 0) / 100).toFixed(2))}">
          </label>
          <label>
            <span>Status</span>
            <select data-field="status">
              ${procurementStatuses.map((status) => `<option value="${escapeAttr(status)}"${status === (line.status || "needed") ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}
            </select>
          </label>
          <label class="span-2">
            <span>Link</span>
            <input data-field="productUrl" value="${escapeAttr(actionUrl)}">
          </label>
          <button class="primary small" type="button" data-action="save-procurement-line">Save line</button>
        </div>
      </div>
    </div>
  `;
}

function procurementBucketLineKeys(lines = []) {
  return [...new Set(lines.flatMap((line) => line.lineKeys || (line.lineKey ? [line.lineKey] : [])).filter(Boolean))];
}

function procurementVendors() {
  const vendors = ["REV", "The Thrifty Bot", "WCP", "Andymark", "McMaster-Carr", "V-Belt Guys", "Unassigned"];
  return vendors;
}

function procurementFallbackUrl(vendor, sku, name = "") {
  const query = String(sku && sku !== "No SKU" ? sku : name || "").trim();
  if (!query) return "";
  const encoded = encodeURIComponent(query);
  const normalized = String(vendor || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalized.includes("rev")) return `https://www.revrobotics.com/search.php?search_query=${encoded}`;
  if (normalized.includes("wcp") || normalized.includes("westcoast")) return wcpProductUrl(query) || `https://wcproducts.com/search?q=${encoded}`;
  if (normalized.includes("thrifty") || normalized.includes("ttb")) return `https://www.thethriftybot.com/search?q=${encoded}`;
  if (normalized.includes("andy")) return `https://www.andymark.com/search?q=${encoded}`;
  if (normalized.includes("mcmaster")) return `https://www.mcmaster.com/${encoded}`;
  if (normalized.includes("vbelt") || normalized.includes("beltguys")) return `https://www.vbeltguys.com/search?q=${encoded}`;
  return "";
}

function normalizeWcpSku(value) {
  const text = String(value || "").trim();
  const explicit = text.match(/\bWCP[-_\s]*(\d{3,5}[A-Z]?)\b/i);
  if (explicit) return `WCP-${explicit[1].toUpperCase()}`;
  const bare = text.match(/^\d{3,5}[A-Z]?$/i);
  if (bare) return `WCP-${bare[0].toUpperCase()}`;
  return "";
}

function wcpProductUrl(value) {
  const sku = normalizeWcpSku(value);
  return sku ? `https://wcproducts.com/products/${sku.toLowerCase()}` : "";
}

function renderProcurementOrderStatus(order) {
  const lines = Array.isArray(order.lines) ? order.lines : [];
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
}

function procurementMatchLabel(status) {
  if (status === "sku_exact") return "Exact SKU";
  if (status === "manual") return "Manual";
  if (status === "lookup_failed") return "Lookup failed";
  return "Needs review";
}

function procurementStatusLabel(status) {
  return String(status || "needed").replace(/_/g, " ");
}

function formatMoney(cents) {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
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

async function onInventoryBulkDelete() {
  const itemKeys = [...selectedInventoryItems];
  if (!itemKeys.length) return;
  const confirmed = await confirmAction({
    title: "Delete selected catalog items?",
    body: `Delete ${itemKeys.length} selected catalog item${itemKeys.length === 1 ? "" : "s"}? This removes their inventory rows, queue cards, and project requirements.`,
    confirmLabel: "Delete selected",
    danger: true
  });
  if (!confirmed) return;
  try {
    const result = await api("/api/inventory/items/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ itemKeys })
    });
    selectedInventoryItems.clear();
    applyInventoryMutation(result);
    setMessage(`Deleted ${Number(result.deleted || itemKeys.length)} catalog item${Number(result.deleted || itemKeys.length) === 1 ? "" : "s"}.`, "ok");
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

async function onClearCatalog() {
  const typed = await openDialog({
    kicker: "Admin action",
    title: "Clear catalog?",
    body: "This permanently clears all catalog items, inventory records, queue cards, procurement groups, sync batches, and project requirements. Users, projects, settings, and audit history stay.",
    inputLabel: "Type CLEAR to continue",
    confirmLabel: "Clear catalog",
    danger: true
  });
  if (typed !== "CLEAR") {
    if (typed) setMessage("Catalog clear canceled. Type CLEAR exactly to confirm.", "error");
    return;
  }
  try {
    const result = await api("/api/admin/clear-catalog", {
      method: "POST",
      body: JSON.stringify({ confirm: typed })
    });
    selectedInventoryItems.clear();
    applyInventoryMutation(result);
    setMessage("Catalog cleared.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onSettingsSave(event) {
  event.preventDefault();
  syncSettingsBuilderToFields();
  const form = Object.fromEntries(new FormData(els.settingsForm).entries());
  try {
    const result = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        partNumber: {
          template: form.template,
          prefix: form.prefix || "4999",
          sourceLength: Number(form.sourceLength),
          subsystemLength: Number(form.subsystemLength),
          partLength: Number(form.partLength)
        },
        routing: {
          materials: parseLines(form.materials),
          stockTypes: parseLines(form.stockTypes),
          machines: parseLines(form.machines),
          rules: parseRoutingRules(form.routingRules),
          autoRules: parseAutoRoutingRules(form.autoRules)
        }
      })
    });
    dashboardState = { ...(dashboardState || {}), settings: result.settings };
    renderSettings(result.settings);
    populateRoutingSelects(selectedConfigPart(), { preserve: true });
    onGeneratePartNumber();
    setMessage("Settings saved for all users.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function onSettingsBuilderClick(event) {
  const button = event.target.closest("[data-settings-action]");
  if (!button || !els.settingsForm?.contains(button)) return;
  const action = button.dataset.settingsAction;
  if (action === "template") {
    const template = button.dataset.template || "";
    if (els.settingsForm.elements.template) els.settingsForm.elements.template.value = template;
    syncSettingsBuilderToFields();
    return;
  }
  if (action === "add-list-item") {
    const name = button.dataset.list || "";
    const config = settingsListConfig(name);
    const container = config ? document.querySelector(`#${config.id}`) : null;
    if (container) {
      container.insertAdjacentHTML("beforeend", settingsListRow(name, "", config.label));
      container.lastElementChild?.querySelector("input")?.focus();
    }
    syncSettingsBuilderToFields();
    return;
  }
  if (action === "add-routing-rule") {
    const container = document.querySelector("#settingsRoutingRulesList");
    if (container) {
      container.insertAdjacentHTML("beforeend", renderSettingsRoutingRuleFragment({ match: "", machines: [], stockTypes: [] }));
      container.querySelector(".settings-rule-card:last-child input")?.focus();
    }
    syncSettingsBuilderToFields();
    return;
  }
  if (action === "add-auto-rule") {
    const container = document.querySelector("#settingsAutoRulesList");
    if (container) {
      container.insertAdjacentHTML("beforeend", renderSettingsAutoRuleFragment({ match: "", stock: "", machine: "", category: "", fabricationIntent: "make_now" }));
      container.querySelector(".settings-rule-card:last-child input")?.focus();
    }
    syncSettingsBuilderToFields();
    return;
  }
  if (action === "remove-settings-row") {
    const row = button.closest(".settings-list-row, .settings-rule-card");
    row?.remove();
    syncSettingsBuilderToFields();
  }
}

function onSettingsBuilderInput(event) {
  if (!event.target.closest(".settings-card")) return;
  syncSettingsBuilderToFields();
}

function syncSettingsBuilderToFields() {
  if (!els.settingsForm) return;
  const setField = (name, value) => {
    if (els.settingsForm.elements[name]) els.settingsForm.elements[name].value = value;
  };
  setField("materials", settingsListValues("materials").join("\n"));
  setField("stockTypes", settingsListValues("stockTypes").join("\n"));
  setField("machines", settingsListValues("machines").join("\n"));
  setField("routingRules", settingsRoutingRuleValues().map((rule) => `${rule.match} | ${rule.machines.join(", ")} | ${rule.stockTypes.join(", ")}`).join("\n"));
  setField("autoRules", settingsAutoRuleValues().map((rule) => [
    rule.match,
    rule.stock,
    rule.machine,
    rule.category,
    rule.fabricationIntent
  ].join(" | ")).join("\n"));
}

function settingsListValues(name) {
  return [...document.querySelectorAll(`[data-settings-list-value="${name}"]`)]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function settingsRoutingRuleValues() {
  return [...document.querySelectorAll('[data-settings-rule="routing"]')].map((row) => ({
    match: row.querySelector('[data-rule-field="match"]')?.value.trim() || "",
    machines: csvValues(row.querySelector('[data-rule-field="machines"]')?.value),
    stockTypes: csvValues(row.querySelector('[data-rule-field="stockTypes"]')?.value)
  })).filter((rule) => rule.match);
}

function settingsAutoRuleValues() {
  return [...document.querySelectorAll('[data-settings-rule="auto"]')].map((row) => ({
    match: row.querySelector('[data-rule-field="match"]')?.value.trim() || "",
    stock: row.querySelector('[data-rule-field="stock"]')?.value.trim() || "",
    machine: row.querySelector('[data-rule-field="machine"]')?.value.trim() || "",
    category: row.querySelector('[data-rule-field="category"]')?.value.trim() || "",
    fabricationIntent: row.querySelector('[data-rule-field="fabricationIntent"]')?.value.trim() || ""
  })).filter((rule) => rule.match);
}

function csvValues(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function parseLines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseRoutingRules(value) {
  return String(value || "").split(/\r?\n/).map((line) => {
    const [match = "", machines = "", stockTypes = ""] = line.split("|").map((part) => part.trim());
    return {
      match,
      machines: machines.split(",").map((item) => item.trim()).filter(Boolean),
      stockTypes: stockTypes.split(",").map((item) => item.trim()).filter(Boolean)
    };
  }).filter((rule) => rule.match);
}

function parseAutoRoutingRules(value) {
  return String(value || "").split(/\r?\n/).map((line) => {
    const [match = "", stock = "", machine = "", category = "", fabricationIntent = ""] = line.split("|").map((part) => part.trim());
    return { match, stock, machine, category, fabricationIntent };
  }).filter((rule) => rule.match);
}

function onRobotSelect(event) {
  const card = event.target.closest("[data-robot-id]");
  if (!card) return;
  selectedRobotId = card.dataset.robotId;
  const robot = (dashboardState?.robots || []).find((item) => item.id === selectedRobotId);
  selectedSubassemblyId = robotSubassemblies(robot)[0]?.id || "";
  renderRobots(dashboardState?.robots || []);
  renderOverview(dashboardState);
  renderFabrication(dashboardState?.fabrication || { jobs: [] });
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
    setMessage("Project added.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onRobotDelete() {
  if (!selectedRobotId) return;
  const robot = (dashboardState?.robots || []).find((item) => item.id === selectedRobotId);
  if (!robot) return;
  const confirmed = await confirmAction({
    title: "Remove project?",
    body: `Remove ${robot.name} and its requirements from PlateFlow? Inventory stays in the global catalog.`,
    confirmLabel: "Remove project",
    danger: true
  });
  if (!confirmed) return;
  try {
    const result = await api(`/api/robots/${encodeURIComponent(selectedRobotId)}`, { method: "DELETE" });
    dashboardState = { ...(dashboardState || {}), robots: result.robots, robotSources: result.robotSources };
    selectedRobotId = result.robots[0]?.id || "";
    await loadDashboard();
    setMessage("Project removed.", "ok");
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
    setMessage(`Added ${Number(result.added || 0)} project requirement${Number(result.added || 0) === 1 ? "" : "s"}.`, "ok");
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
    setMessage("Project requirement updated.", "ok");
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
  const quantityInput = event.target.closest("input[data-procurement-quantity]");
  if (quantityInput) {
    const row = quantityInput.closest(".procurement-line");
    const lineKeys = parseLineKeys(row?.dataset.lineKeys);
    if (!row || !lineKeys.length) {
      setMessage("This procurement row is missing an edit key. Refresh and try again.", "error");
      return;
    }
    await updateProcurementLineQuantity(row, lineKeys, quantityInput.value);
    return;
  }
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

async function onProcurementLineCreate(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(els.procurementLineForm).entries());
  try {
    const result = await api("/api/procurement/lines", {
      method: "POST",
      body: JSON.stringify(body)
    });
    dashboardState = { ...(dashboardState || {}), procurement: result.procurement };
    els.procurementLineForm.reset();
    renderProcurement(result.procurement);
    setMessage("Procurement line added.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function onProcurementLineAction(event) {
  const button = event.target.closest("button[data-action='save-procurement-line'], button[data-action='delete-procurement-line'], button[data-action='delete-procurement-vendor'], button[data-action='toggle-procurement-edit'], button[data-action='quick-procurement-status'], button[data-action='vendor-procurement-status'], button[data-action='adjust-procurement-quantity']");
  if (!button) return;
  if (button.dataset.action === "vendor-procurement-status" || button.dataset.action === "delete-procurement-vendor") {
    const bucket = button.closest(".vendor-bucket");
    const lineKeys = parseLineKeys(bucket?.dataset.lineKeys);
    if (!bucket || !lineKeys.length) {
      setMessage("This vendor bucket is missing edit keys. Refresh and try again.", "error");
      return;
    }
    if (button.dataset.action === "vendor-procurement-status") {
      await updateProcurementVendorStatus(bucket, lineKeys, button.dataset.status || "needed");
      return;
    }
    await deleteProcurementLines(bucket, lineKeys, "vendor");
    return;
  }
  const row = button.closest(".procurement-line");
  if (!row) return;
  const lineKeys = parseLineKeys(row.dataset.lineKeys);
  if (!lineKeys.length) {
    setMessage("This procurement row is missing an edit key. Refresh and try again.", "error");
    return;
  }
  if (button.dataset.action === "toggle-procurement-edit") {
    const editor = row.querySelector(".procurement-editor");
    if (!editor) return;
    const open = editor.classList.toggle("hidden");
    button.textContent = open ? "Edit" : "Close";
    return;
  }
  if (button.dataset.action === "quick-procurement-status") {
    const status = button.dataset.status || "needed";
    await updateProcurementLineStatus(row, lineKeys, status);
    return;
  }
  if (button.dataset.action === "adjust-procurement-quantity") {
    const input = row.querySelector("input[data-procurement-quantity]");
    const current = Number(input?.value || row.dataset.quantity || 0);
    const delta = Number(button.dataset.delta || 0);
    const next = Math.max(0, Math.min(9999, current + delta));
    if (input) input.value = next;
    await updateProcurementLineQuantity(row, lineKeys, next);
    return;
  }
  if (button.dataset.action === "delete-procurement-line") {
    await deleteProcurementLines(row, lineKeys, "line");
    return;
  }
  try {
    const mutationSeq = nextProcurementMutationSeq();
    const body = procurementLineFormData(row);
    setProcurementPending(row, true);
    const result = await api("/api/procurement/lines", {
      method: "PATCH",
      body: JSON.stringify({ lineKeys, ...body })
    });
    applyProcurementResult(result, mutationSeq);
    if (isCurrentProcurementMutation(mutationSeq)) setMessage("Procurement line saved.", "ok");
    else setProcurementPending(row, false);
  } catch (error) {
    setProcurementPending(row, false);
    setMessage(error.message, "error");
  }
}

async function updateProcurementLineQuantity(row, lineKeys, quantity) {
  const previous = Number(row.dataset.quantity || row.querySelector("input[data-procurement-quantity]")?.value || 0);
  const next = Math.max(0, Math.min(9999, Math.round(Number(quantity || 0))));
  const mutationSeq = nextProcurementMutationSeq();
  row.dataset.quantity = String(next);
  row.querySelectorAll("input[data-procurement-quantity], input[data-field='quantityNeeded']").forEach((input) => {
    input.value = String(next);
  });
  setProcurementPending(row, true, "quantity");
  try {
    const result = await api("/api/procurement/lines", {
      method: "PATCH",
      body: JSON.stringify({ lineKeys, quantityNeeded: next })
    });
    applyProcurementResult(result, mutationSeq);
    if (isCurrentProcurementMutation(mutationSeq)) setMessage(`Quantity updated to ${next}.`, "ok");
    else setProcurementPending(row, false, "quantity");
  } catch (error) {
    row.dataset.quantity = String(previous);
    row.querySelectorAll("input[data-procurement-quantity], input[data-field='quantityNeeded']").forEach((input) => {
      input.value = String(previous);
    });
    setProcurementPending(row, false, "quantity");
    setMessage(error.message, "error");
  }
}

async function updateProcurementLineStatus(row, lineKeys, status) {
  const previous = row.querySelector("[data-field='status']")?.value || "";
  const mutationSeq = nextProcurementMutationSeq();
  setProcurementPending(row, true, "status");
  row.querySelectorAll(".procurement-status").forEach((badge) => {
    badge.textContent = procurementStatusLabel(status);
    badge.className = `procurement-status ${status}`;
  });
  row.classList.remove(...procurementStatuses);
  row.classList.add(status);
  row.querySelectorAll("[data-field='status']").forEach((select) => {
    select.value = status;
  });
  try {
    const result = await api("/api/procurement/lines", {
      method: "PATCH",
      body: JSON.stringify({ lineKeys, status })
    });
    applyProcurementResult(result, mutationSeq);
    if (isCurrentProcurementMutation(mutationSeq)) setMessage(status === "received" ? "Procurement line marked arrived." : "Procurement line marked bought.", "ok");
    else setProcurementPending(row, false, "status");
  } catch (error) {
    if (previous) {
      row.querySelectorAll("[data-field='status']").forEach((select) => {
        select.value = previous;
      });
    }
    setMessage(error.message, "error");
    await loadDashboard();
  }
}

async function updateProcurementVendorStatus(bucket, lineKeys, status) {
  const mutationSeq = nextProcurementMutationSeq();
  setProcurementPending(bucket, true, "status");
  bucket.querySelectorAll(".procurement-line").forEach((row) => {
    row.classList.remove(...procurementStatuses);
    row.classList.add(status);
    row.querySelectorAll(".procurement-status").forEach((badge) => {
      badge.textContent = procurementStatusLabel(status);
      badge.className = `procurement-status ${status}`;
    });
    row.querySelectorAll("[data-field='status']").forEach((select) => {
      select.value = status;
    });
  });
  setMessage(status === "received" ? "Marking vendor arrived..." : "Marking vendor bought...");
  try {
    const result = await api("/api/procurement/lines", {
      method: "PATCH",
      body: JSON.stringify({ lineKeys, status })
    });
    applyProcurementResult(result, mutationSeq);
    if (isCurrentProcurementMutation(mutationSeq)) setMessage(status === "received" ? "Vendor lines marked arrived." : "Vendor lines marked bought.", "ok");
    else setProcurementPending(bucket, false, "status");
  } catch (error) {
    setMessage(error.message, "error");
    await loadDashboard();
  }
}

async function deleteProcurementLines(source, lineKeys, scope = "line") {
  const mutationSeq = nextProcurementMutationSeq();
  const selector = scope === "vendor" ? ".vendor-bucket" : ".procurement-line";
  const targets = scope === "vendor"
    ? [source.closest(selector)].filter(Boolean)
    : [...els.procurementOrders.querySelectorAll(selector)].filter((item) => item.dataset.lineKeys === source.dataset.lineKeys);
  for (const item of targets) {
    item.classList.add("removing");
    setProcurementPending(item, true);
  }
  setTimeout(() => targets.forEach((item) => item.remove()), 70);
  setMessage(scope === "vendor" ? "Deleting vendor bucket..." : "Deleting procurement line...");
  try {
    const result = await api("/api/procurement/lines", {
      method: "DELETE",
      body: JSON.stringify({ lineKeys })
    });
    applyProcurementResult(result, mutationSeq);
    if (isCurrentProcurementMutation(mutationSeq)) setMessage(scope === "vendor" ? "Vendor bucket deleted." : "Procurement line deleted.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
    await loadDashboard();
  }
}

function nextProcurementMutationSeq() {
  procurementMutationSeq += 1;
  return procurementMutationSeq;
}

function isCurrentProcurementMutation(mutationSeq) {
  return mutationSeq === procurementMutationSeq;
}

function applyProcurementResult(result, mutationSeq) {
  if (!result?.procurement || !isCurrentProcurementMutation(mutationSeq)) return false;
  dashboardState = { ...(dashboardState || {}), procurement: result.procurement };
  renderProcurement(result.procurement);
  return true;
}

function setProcurementPending(container, pending, mode = "") {
  if (!container) return;
  container.classList.toggle("pending", pending);
  const controls = mode === "status"
    ? container.querySelectorAll("button[data-action='quick-procurement-status'], button[data-action='vendor-procurement-status'], button[data-action='delete-procurement-line'], button[data-action='delete-procurement-vendor']")
    : mode === "quantity"
      ? container.querySelectorAll("button[data-action='adjust-procurement-quantity'], input[data-procurement-quantity]")
      : container.querySelectorAll("button, input, select");
  controls.forEach((control) => {
    control.disabled = pending;
  });
}

function parseLineKeys(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function procurementLineFormData(row) {
  const data = {};
  row.querySelectorAll("[data-field]").forEach((input) => {
    if (input.disabled) return;
    data[input.dataset.field] = input.value;
  });
  return data;
}

async function onProcurementRefresh() {
  if (!els.refreshProcurementButton) return;
  const previous = els.refreshProcurementButton.textContent;
  els.refreshProcurementButton.disabled = true;
  els.refreshProcurementButton.textContent = "Matching...";
  try {
    const result = await api("/api/procurement/refresh", {
      method: "POST",
      body: JSON.stringify({
        robotId: els.procurementProjectFilter?.value && !["__all", "__unassigned"].includes(els.procurementProjectFilter.value) ? els.procurementProjectFilter.value : ""
      })
    });
    dashboardState = {
      ...(dashboardState || {}),
      procurement: result.procurement
    };
    renderProcurement(result.procurement);
    const stats = result.stats || {};
    setMessage(`Procurement matches updated: ${Number(stats.matched || 0)} matched, ${Number(stats.cached || 0)} cached.`, "ok");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    els.refreshProcurementButton.disabled = false;
    els.refreshProcurementButton.textContent = previous;
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

function startRealtime() {
  if (embeddedMode || realtimeSource || !window.EventSource || realtimeReconnectTimer) return;
  if (realtimePollTimer) {
    clearInterval(realtimePollTimer);
    realtimePollTimer = null;
  }
  realtimeSource = new EventSource("/api/events");
  realtimeSource.addEventListener("dashboard", onRealtimeDashboard);
  realtimeSource.addEventListener("auth", onRealtimeAuth);
  realtimeSource.addEventListener("open", () => {
    if (realtimePollTimer) {
      clearInterval(realtimePollTimer);
      realtimePollTimer = null;
    }
  });
  realtimeSource.addEventListener("error", () => {
    stopRealtimeSourceOnly();
    if (!realtimePollTimer) realtimePollTimer = setInterval(refreshDashboardRealtimeFallback, 2500);
    realtimeReconnectTimer = setTimeout(() => {
      realtimeReconnectTimer = null;
      startRealtime();
    }, 2500);
  });
}

function stopRealtime() {
  stopRealtimeSourceOnly();
  if (realtimePollTimer) {
    clearInterval(realtimePollTimer);
    realtimePollTimer = null;
  }
  if (realtimeReconnectTimer) {
    clearTimeout(realtimeReconnectTimer);
    realtimeReconnectTimer = null;
  }
}

function stopRealtimeSourceOnly() {
  if (!realtimeSource) return;
  realtimeSource.close();
  realtimeSource = null;
}

function onRealtimeDashboard(event) {
  try {
    const payload = JSON.parse(event.data || "{}");
    if (!payload.dashboard) return;
    const revision = Number(payload.revision || 0);
    if (revision && revision <= dashboardRevision) return;
    dashboardRevision = revision;
    scheduleDashboardApply(payload.dashboard, { preserveParts: true, quiet: true, skipAdminUsers: true });
  } catch {
    // Ignore malformed realtime frames; the polling fallback will recover if needed.
  }
}

function scheduleDashboardApply(dashboard, options = {}) {
  pendingDashboard = dashboard;
  pendingDashboardOptions = { ...pendingDashboardOptions, ...options };
  if (dashboardApplyFrame) return;
  dashboardApplyFrame = requestAnimationFrame(() => {
    dashboardApplyFrame = 0;
    const nextDashboard = pendingDashboard;
    const nextOptions = pendingDashboardOptions;
    pendingDashboard = null;
    pendingDashboardOptions = {};
    if (nextDashboard) applyDashboardState(nextDashboard, nextOptions);
  });
}

function onRealtimeAuth(event) {
  try {
    const payload = JSON.parse(event.data || "{}");
    if (payload.authenticated === false) stopRealtime();
  } catch {
    stopRealtime();
  }
}

async function refreshDashboardRealtimeFallback() {
  if (embeddedMode || !dashboardState) return;
  try {
    const dashboard = await api("/api/dashboard");
    scheduleDashboardApply(dashboard, { preserveParts: true, quiet: true, skipAdminUsers: true });
  } catch {
    // Keep the retry loop quiet; visible errors belong to direct user actions.
  }
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

function showImportConfirmation(title, detail = "") {
  if (!els.importConfirmation) return;
  if (importConfirmationTimer) {
    clearTimeout(importConfirmationTimer);
    importConfirmationTimer = null;
  }
  els.importConfirmation.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
  `;
  els.importConfirmation.classList.remove("hidden", "fade-out");
  importConfirmationTimer = setTimeout(() => {
    els.importConfirmation.classList.add("fade-out");
    importConfirmationTimer = setTimeout(() => {
      els.importConfirmation.classList.add("hidden");
      els.importConfirmation.classList.remove("fade-out");
      els.importConfirmation.textContent = "";
      importConfirmationTimer = null;
    }, 700);
  }, 3200);
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
  requestAnimationFrame(() => {
    els.dialogBackdrop.classList.add("open");
    (options.inputLabel ? els.dialogInput : els.dialogConfirm).focus();
  });
  return new Promise((resolve) => {
    dialogResolver = resolve;
  });
}

function closeDialog(result) {
  if (!dialogResolver) return;
  const resolve = dialogResolver;
  dialogResolver = null;
  els.dialogBackdrop.classList.remove("open");
  setTimeout(() => {
    if (!dialogResolver) els.dialogBackdrop.classList.add("hidden");
  }, 180);
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
