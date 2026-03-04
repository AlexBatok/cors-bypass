// extension/src/lib/constants.ts
var BASE_RULE_ID = 1e3;
var RULES_PER_HOST = 6;
var MAX_DYNAMIC_RULES = 5e3;
var MAX_HOSTS = Math.floor(MAX_DYNAMIC_RULES / RULES_PER_HOST);
var CORS_HEADERS = {
  ALLOW_ORIGIN: "Access-Control-Allow-Origin",
  ALLOW_METHODS: "Access-Control-Allow-Methods",
  ALLOW_HEADERS: "Access-Control-Allow-Headers",
  ALLOW_CREDENTIALS: "Access-Control-Allow-Credentials",
  EXPOSE_HEADERS: "Access-Control-Expose-Headers",
  MAX_AGE: "Access-Control-Max-Age"
};
var DEFAULT_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD";
var STORAGE_KEY = "corsProState";
var DEFAULT_SETTINGS = {
  headerOrigin: true,
  headerMethods: true,
  headerHeaders: true,
  headerCredentials: true,
  headerExpose: true,
  customBlocklist: []
};
var DEFAULT_STATE = {
  enabledHosts: [],
  settings: { ...DEFAULT_SETTINGS }
};

// extension/src/lib/validate.ts
var HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
var MAX_HOSTNAME_LENGTH = 253;
var MAX_LABEL_LENGTH = 63;
function isValidHostname(hostname) {
  if (typeof hostname !== "string") return false;
  if (hostname.length === 0 || hostname.length > MAX_HOSTNAME_LENGTH) return false;
  if (!HOSTNAME_REGEX.test(hostname)) return false;
  if (hostname.includes("..")) return false;
  const labels = hostname.split(".");
  return labels.length >= 1 && labels.every(
    (l) => l.length > 0 && l.length <= MAX_LABEL_LENGTH
  );
}
function isValidDomain(domain) {
  if (!isValidHostname(domain)) return false;
  return domain.split(".").length >= 2;
}

// extension/src/lib/storage.ts
async function getState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  if (!stored) return { ...DEFAULT_STATE };
  return {
    enabledHosts: Array.isArray(stored.enabledHosts) ? stored.enabledHosts.filter(isValidHostname) : [],
    settings: { ...DEFAULT_STATE.settings, ...stored.settings }
  };
}
async function setState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}
async function updateSettings(partial) {
  const state = await getState();
  state.settings = { ...state.settings, ...partial };
  await setState(state);
  return state;
}
function validateImportedState(data) {
  if (!data || typeof data !== "object") return null;
  const obj = data;
  if (!Array.isArray(obj.enabledHosts)) return null;
  if (obj.enabledHosts.length > MAX_HOSTS) return null;
  const hosts = obj.enabledHosts.filter(isValidHostname);
  if (!obj.settings || typeof obj.settings !== "object") return null;
  const s = obj.settings;
  const settings = {
    headerOrigin: typeof s.headerOrigin === "boolean" ? s.headerOrigin : DEFAULT_SETTINGS.headerOrigin,
    headerMethods: typeof s.headerMethods === "boolean" ? s.headerMethods : DEFAULT_SETTINGS.headerMethods,
    headerHeaders: typeof s.headerHeaders === "boolean" ? s.headerHeaders : DEFAULT_SETTINGS.headerHeaders,
    headerCredentials: typeof s.headerCredentials === "boolean" ? s.headerCredentials : DEFAULT_SETTINGS.headerCredentials,
    headerExpose: typeof s.headerExpose === "boolean" ? s.headerExpose : DEFAULT_SETTINGS.headerExpose,
    customBlocklist: Array.isArray(s.customBlocklist) ? s.customBlocklist.filter((d) => typeof d === "string").filter((d) => d.length > 0 && d.length <= 253).slice(0, 500) : []
  };
  return { enabledHosts: hosts, settings };
}

// extension/src/lib/rules.ts
var ALL_RESOURCE_TYPES = [
  "xmlhttprequest",
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "media",
  "other"
];
function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
var allocatedSlots = /* @__PURE__ */ new Map();
var MAX_SLOTS = Math.floor(
  (MAX_DYNAMIC_RULES - BASE_RULE_ID) / RULES_PER_HOST
);
function getRuleBaseId(hostname) {
  let slot = fnv1a(hostname) % MAX_SLOTS;
  for (let i = 0; i < MAX_SLOTS; i++) {
    const existing = allocatedSlots.get(slot);
    if (existing === void 0 || existing === hostname) {
      allocatedSlots.set(slot, hostname);
      return BASE_RULE_ID + slot * RULES_PER_HOST;
    }
    slot = (slot + 1) % MAX_SLOTS;
  }
  throw new Error("Rule ID space exhausted");
}
function clearAllSlots() {
  allocatedSlots.clear();
}
function buildRulesForHost(hostname, settings) {
  const baseId = getRuleBaseId(hostname);
  const rules = [];
  const urlFilter = `||${hostname}/`;
  let offset = 0;
  const responseHeaders = [];
  if (settings.headerOrigin) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_ORIGIN,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: "*"
    });
  }
  if (settings.headerMethods) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_METHODS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: DEFAULT_METHODS
    });
  }
  if (settings.headerHeaders) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_HEADERS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: "*"
    });
  }
  if (settings.headerCredentials) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_CREDENTIALS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: "true"
    });
  }
  if (settings.headerExpose) {
    responseHeaders.push({
      header: CORS_HEADERS.EXPOSE_HEADERS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: "*"
    });
  }
  if (responseHeaders.length > 0) {
    rules.push({
      id: baseId + offset++,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders
      },
      condition: {
        urlFilter,
        resourceTypes: ALL_RESOURCE_TYPES
      }
    });
  }
  rules.push({
    id: baseId + offset++,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        {
          header: CORS_HEADERS.MAX_AGE,
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: "86400"
        }
      ]
    },
    condition: {
      urlFilter,
      resourceTypes: ALL_RESOURCE_TYPES
    }
  });
  return rules;
}
function getRuleIdsForHost(hostname) {
  const baseId = getRuleBaseId(hostname);
  return Array.from({ length: RULES_PER_HOST }, (_, i) => baseId + i);
}
async function enableRulesForHost(hostname, settings) {
  const newRules = buildRulesForHost(hostname, settings);
  const removeRuleIds = getRuleIdsForHost(hostname);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: newRules
  });
}
async function disableAllRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);
  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
  clearAllSlots();
}

// extension/src/options/options.ts
var $ = (id) => document.getElementById(id);
var headerOrigin = $("headerOrigin");
var headerMethods = $("headerMethods");
var headerHeaders = $("headerHeaders");
var headerCredentials = $("headerCredentials");
var headerExpose = $("headerExpose");
var newDomainInput = $("newDomain");
var addDomainBtn = $("addDomainBtn");
var blocklistEl = $("customBlocklist");
var blocklistEmpty = $("blocklistEmpty");
var exportBtn = $("exportBtn");
var importBtn = $("importBtn");
var importFile = $("importFile");
var resetBtn = $("resetBtn");
var toast = $("toast");
var toastText = $("toastText");
async function init() {
  const state = await getState();
  loadHeaderCheckboxes(state);
  renderBlocklist(state.settings.customBlocklist);
  const checkboxes = [
    headerOrigin,
    headerMethods,
    headerHeaders,
    headerCredentials,
    headerExpose
  ];
  for (const cb of checkboxes) {
    cb.addEventListener("change", saveHeaders);
  }
  addDomainBtn.addEventListener("click", addDomain);
  newDomainInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain();
  });
  exportBtn.addEventListener("click", exportSettings);
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importSettings);
  resetBtn.addEventListener("click", resetToDefaults);
}
function loadHeaderCheckboxes(state) {
  headerOrigin.checked = state.settings.headerOrigin;
  headerMethods.checked = state.settings.headerMethods;
  headerHeaders.checked = state.settings.headerHeaders;
  headerCredentials.checked = state.settings.headerCredentials;
  headerExpose.checked = state.settings.headerExpose;
}
async function saveHeaders() {
  const state = await updateSettings({
    headerOrigin: headerOrigin.checked,
    headerMethods: headerMethods.checked,
    headerHeaders: headerHeaders.checked,
    headerCredentials: headerCredentials.checked,
    headerExpose: headerExpose.checked
  });
  await rebuildAllRules(state);
  showToast("Headers updated");
}
function renderBlocklist(domains) {
  blocklistEl.innerHTML = "";
  blocklistEmpty.hidden = domains.length > 0;
  for (const domain of domains) {
    const li = document.createElement("li");
    li.className = "domain-list__item";
    const span = document.createElement("span");
    span.textContent = domain;
    const btn = document.createElement("button");
    btn.className = "domain-list__remove";
    btn.textContent = "\xD7";
    btn.addEventListener("click", () => removeDomain(domain));
    li.appendChild(span);
    li.appendChild(btn);
    blocklistEl.appendChild(li);
  }
}
async function addDomain() {
  const raw = newDomainInput.value.trim().toLowerCase();
  if (!raw) return;
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!isValidDomain(domain)) {
    showToast("Invalid domain format");
    return;
  }
  const state = await getState();
  if (state.settings.customBlocklist.includes(domain)) {
    showToast("Domain already in list");
    return;
  }
  if (state.settings.customBlocklist.length >= 500) {
    showToast("Blocklist limit reached (500)");
    return;
  }
  state.settings.customBlocklist.push(domain);
  await updateSettings({ customBlocklist: state.settings.customBlocklist });
  newDomainInput.value = "";
  renderBlocklist(state.settings.customBlocklist);
  showToast(`Added ${domain}`);
}
async function removeDomain(domain) {
  const state = await getState();
  state.settings.customBlocklist = state.settings.customBlocklist.filter(
    (d) => d !== domain
  );
  await updateSettings({ customBlocklist: state.settings.customBlocklist });
  renderBlocklist(state.settings.customBlocklist);
  showToast(`Removed ${domain}`);
}
async function exportSettings() {
  const state = await getState();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cors-pro-settings.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Settings exported");
}
async function importSettings() {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 100) {
      showToast("File too large");
      importFile.value = "";
      return;
    }
    const text = await file.text();
    const raw = JSON.parse(text);
    const validated = validateImportedState(raw);
    if (!validated) {
      showToast("Invalid settings file");
      importFile.value = "";
      return;
    }
    await setState(validated);
    await rebuildAllRules(validated);
    loadHeaderCheckboxes(validated);
    renderBlocklist(validated.settings.customBlocklist);
    showToast("Settings imported");
  } catch {
    showToast("Failed to import");
  }
  importFile.value = "";
}
async function resetToDefaults() {
  await setState({ ...DEFAULT_STATE });
  await disableAllRules();
  const state = await getState();
  loadHeaderCheckboxes(state);
  renderBlocklist(state.settings.customBlocklist);
  showToast("Reset to defaults");
}
async function rebuildAllRules(state) {
  await disableAllRules();
  for (const host of state.enabledHosts) {
    await enableRulesForHost(host, state.settings);
  }
}
var toastTimer;
function showToast(message) {
  toastText.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2e3);
}
init().catch(console.error);
