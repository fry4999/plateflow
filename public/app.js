let csrfToken = "";
let source = null;
let parts = [];
let embeddedMode = false;

const els = {
  authStatus: document.querySelector("#authStatus"),
  loginLink: document.querySelector("#loginLink"),
  logoutLink: document.querySelector("#logoutLink"),
  importForm: document.querySelector("#importForm"),
  demoButton: document.querySelector("#demoButton"),
  partsBody: document.querySelector("#partsBody"),
  partCount: document.querySelector("#partCount"),
  exportButton: document.querySelector("#exportButton"),
  selectAll: document.querySelector("#selectAll"),
  orderForm: document.querySelector("#orderForm"),
  metricImports: document.querySelector("#metricImports"),
  metricParts: document.querySelector("#metricParts"),
  metricMaterials: document.querySelector("#metricMaterials"),
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

init();

async function init() {
  const params = new URLSearchParams(location.search);
  embeddedMode = location.pathname.startsWith("/onshape") || params.get("embedded") === "1";
  document.body.classList.toggle("embedded", embeddedMode);

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
    if (value) els.importForm.elements[formKey].value = value;
  }
  if (params.get("server")) {
    els.importForm.dataset.baseUrl = params.get("server");
  }
  if (params.get("workspaceOrVersion")) {
    els.importForm.dataset.workspaceOrVersion = params.get("workspaceOrVersion");
  }

  try {
    const session = await api("/api/session");
    csrfToken = session.csrfToken;
    renderAuth(session);
    if (embeddedMode && session.authenticated && hasOnshapeContext()) {
      els.importForm.requestSubmit();
    } else if (!embeddedMode) {
      await loadInventory();
    }
  } catch {
    setMessage("Could not initialize the session.", "error");
  }

  els.importForm.addEventListener("submit", onImport);
  els.demoButton.addEventListener("click", loadDemo);
  els.partsBody.addEventListener("input", onPartEdit);
  els.partsBody.addEventListener("change", onPartEdit);
  els.selectAll.addEventListener("change", toggleAll);
  els.exportButton.addEventListener("click", onExport);
  if (els.orderForm) els.orderForm.addEventListener("submit", onOrder);
  renderParts();
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

async function onImport(event) {
  event.preventDefault();
  const form = new FormData(els.importForm);
  source = Object.fromEntries(form.entries());
  if (els.importForm.dataset.baseUrl) source.baseUrl = els.importForm.dataset.baseUrl;
  if (els.importForm.dataset.workspaceOrVersion) source.workspaceOrVersion = els.importForm.dataset.workspaceOrVersion;
  setMessage("Reading parts and assigned materials from Onshape...");
  try {
    const result = await api("/api/onshape/import", {
      method: "POST",
      body: JSON.stringify(source)
    });
    parts = result.parts.map((part) => ({ ...part, selected: true }));
    source = result.source;
    renderParts();
    renderInventory(result.inventory ? {
      records: [result.inventory],
      parts: result.parts,
      totals: {
        records: 1,
        parts: result.parts.length,
        materials: new Set(result.parts.map((part) => part.material || "Unassigned")).size
      }
    } : null);
    const noun = parts.length === 1 ? "part" : "parts";
    setMessage(embeddedMode ? `Sent ${parts.length} ${noun} to the PlateFlow dashboard.` : `Imported ${parts.length} ${noun} into inventory.`, "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function hasOnshapeContext() {
  return ["documentId", "workspaceId", "elementId"].every((name) => els.importForm.elements[name].value.trim());
}

function loadDemo() {
  source = null;
  parts = demoParts.map((part) => ({ ...part }));
  renderParts();
  setMessage("Demo plates loaded. Connect Onshape to import a real robot document.", "ok");
}

function renderParts() {
  els.exportButton.disabled = !source || !parts.length;
  els.partCount.textContent = parts.length ? `${parts.length} part${parts.length === 1 ? "" : "s"} loaded` : "No parts loaded";

  if (!parts.length) {
    els.partsBody.innerHTML = `<tr><td colspan="6" class="empty">Import from Onshape to populate inventory.</td></tr>`;
    updateSummary();
    return;
  }

  els.partsBody.innerHTML = parts.map((part, index) => `
    <tr>
      <td><input type="checkbox" data-index="${index}" data-field="selected" ${part.selected ? "checked" : ""} aria-label="select ${escapeHtml(part.name)}"></td>
      <td><span class="part-name">${escapeHtml(part.name)}</span><br><small>${escapeHtml(part.bodyType || part.id || "")}</small></td>
      <td><input data-index="${index}" data-field="material" value="${escapeAttr(part.material || "Unassigned")}"></td>
      <td><input data-index="${index}" data-field="thickness" value="${escapeAttr(part.thickness || "")}" placeholder="0.125 in"></td>
      <td><input data-index="${index}" data-field="quantity" type="number" min="1" max="999" value="${Number(part.quantity || 1)}"></td>
      <td>
        <select data-index="${index}" data-field="finish">
          ${["Deburred", "Tumbled", "Raw", "Powder coat"].map((finish) => `<option ${finish === part.finish ? "selected" : ""}>${finish}</option>`).join("")}
        </select>
      </td>
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

function renderInventory(inventory) {
  if (!inventory || !els.metricImports) return;
  els.metricImports.textContent = String(inventory.totals.records);
  els.metricParts.textContent = String(inventory.totals.parts);
  els.metricMaterials.textContent = String(inventory.totals.materials);
}

function updateSummary() {
  const selected = parts.filter((part) => part.selected);
  const qty = selected.reduce((sum, part) => sum + Number(part.quantity || 1), 0);
  const materials = [...new Set(selected.map((part) => part.material || "Unassigned"))];
  els.summaryParts.textContent = String(selected.length);
  els.summaryQty.textContent = String(qty);
  els.summaryMaterials.textContent = materials.length ? materials.join(", ") : "None";
}

async function api(url, options = {}) {
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
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
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
