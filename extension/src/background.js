var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// extension/src/lib/constants.ts
var BASE_RULE_ID, RULES_PER_HOST, MAX_DYNAMIC_RULES, MAX_HOSTS, CORS_HEADERS, DEFAULT_METHODS, STORAGE_KEY, DEFAULT_SETTINGS, DEFAULT_STATE;
var init_constants = __esm({
  "extension/src/lib/constants.ts"() {
    "use strict";
    BASE_RULE_ID = 1e3;
    RULES_PER_HOST = 6;
    MAX_DYNAMIC_RULES = 5e3;
    MAX_HOSTS = Math.floor(MAX_DYNAMIC_RULES / RULES_PER_HOST);
    CORS_HEADERS = {
      ALLOW_ORIGIN: "Access-Control-Allow-Origin",
      ALLOW_METHODS: "Access-Control-Allow-Methods",
      ALLOW_HEADERS: "Access-Control-Allow-Headers",
      ALLOW_CREDENTIALS: "Access-Control-Allow-Credentials",
      EXPOSE_HEADERS: "Access-Control-Expose-Headers",
      MAX_AGE: "Access-Control-Max-Age"
    };
    DEFAULT_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD";
    STORAGE_KEY = "corsProState";
    DEFAULT_SETTINGS = {
      headerOrigin: true,
      headerMethods: true,
      headerHeaders: true,
      headerCredentials: true,
      headerExpose: true,
      customBlocklist: []
    };
    DEFAULT_STATE = {
      enabledHosts: [],
      settings: { ...DEFAULT_SETTINGS }
    };
  }
});

// extension/src/lib/validate.ts
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
var HOSTNAME_REGEX, MAX_HOSTNAME_LENGTH, MAX_LABEL_LENGTH;
var init_validate = __esm({
  "extension/src/lib/validate.ts"() {
    "use strict";
    HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
    MAX_HOSTNAME_LENGTH = 253;
    MAX_LABEL_LENGTH = 63;
  }
});

// extension/src/lib/storage.ts
var storage_exports = {};
__export(storage_exports, {
  addHost: () => addHost,
  clearAllHosts: () => clearAllHosts,
  getState: () => getState,
  removeHost: () => removeHost,
  setState: () => setState,
  updateSettings: () => updateSettings,
  validateImportedState: () => validateImportedState
});
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
async function addHost(hostname) {
  if (!isValidHostname(hostname)) return await getState();
  const state = await getState();
  if (state.enabledHosts.length >= MAX_HOSTS) {
    throw new Error(`Maximum of ${MAX_HOSTS} hosts reached`);
  }
  if (!state.enabledHosts.includes(hostname)) {
    state.enabledHosts.push(hostname);
    await setState(state);
  }
  return state;
}
async function removeHost(hostname) {
  const state = await getState();
  state.enabledHosts = state.enabledHosts.filter((h) => h !== hostname);
  await setState(state);
  return state;
}
async function clearAllHosts() {
  const state = await getState();
  state.enabledHosts = [];
  await setState(state);
  return state;
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
var init_storage = __esm({
  "extension/src/lib/storage.ts"() {
    "use strict";
    init_constants();
    init_validate();
  }
});

// extension/src/background.ts
init_storage();

// extension/src/lib/rules.ts
init_constants();
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
function releaseRuleSlot(hostname) {
  for (const [slot, h] of allocatedSlots) {
    if (h === hostname) {
      allocatedSlots.delete(slot);
      return;
    }
  }
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
async function disableRulesForHost(hostname) {
  const removeRuleIds = getRuleIdsForHost(hostname);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds
  });
  releaseRuleSlot(hostname);
}
async function disableAllRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);
  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
  clearAllSlots();
}

// extension/src/lib/icon.ts
async function setIconActive(tabId) {
  await chrome.action.setIcon({
    tabId,
    path: {
      16: "/icons/icon-active-16.png",
      32: "/icons/icon-active-32.png",
      48: "/icons/icon-active-48.png",
      128: "/icons/icon-active-128.png"
    }
  });
}
async function setIconInactive(tabId) {
  await chrome.action.setIcon({
    tabId,
    path: {
      16: "/icons/icon-inactive-16.png",
      32: "/icons/icon-inactive-32.png",
      48: "/icons/icon-inactive-48.png",
      128: "/icons/icon-inactive-128.png"
    }
  });
}
async function setBadge(tabId, count) {
  const text = count > 0 ? String(count) : "";
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: "#10B981"
  });
}
function getHostname(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
}

// extension/src/background.ts
init_validate();
async function restoreRules() {
  const state = await getState();
  await disableAllRules();
  for (const host of state.enabledHosts) {
    await enableRulesForHost(host, state.settings);
  }
}
async function updateTabIcon(tabId, url) {
  const hostname = getHostname(url);
  if (!hostname) {
    await setIconInactive(tabId);
    await setBadge(tabId, 0);
    return;
  }
  const state = await getState();
  const isActive = state.enabledHosts.includes(hostname);
  if (isActive) {
    await setIconActive(tabId);
  } else {
    await setIconInactive(tabId);
  }
  await setBadge(tabId, state.enabledHosts.length);
}
var pendingUpdates = /* @__PURE__ */ new Map();
function debouncedUpdateTabIcon(tabId, url) {
  const existing = pendingUpdates.get(tabId);
  if (existing) clearTimeout(existing);
  pendingUpdates.set(
    tabId,
    setTimeout(() => {
      pendingUpdates.delete(tabId);
      updateTabIcon(tabId, url).catch(() => {
      });
    }, 80)
  );
}
async function updateAllTabIcons() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) {
      await updateTabIcon(tab.id, tab.url).catch(() => {
      });
    }
  }
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    debouncedUpdateTabIcon(tabId, tab.url);
  }
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    debouncedUpdateTabIcon(activeInfo.tabId, tab.url);
  } catch {
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = pendingUpdates.get(tabId);
  if (timer) {
    clearTimeout(timer);
    pendingUpdates.delete(tabId);
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse(null);
    return false;
  }
  handleMessage(message).then(sendResponse).catch((err) => {
    console.error("[CORS Bypass] Message error:", err);
    sendResponse(null);
  });
  return true;
});
async function handleMessage(message) {
  const { addHost: addHost2, removeHost: removeHost2, clearAllHosts: clearAllHosts2, getState: loadState } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  switch (message.type) {
    case "toggle": {
      if (!isValidHostname(message.hostname)) return null;
      const state = await loadState();
      const isEnabled = state.enabledHosts.includes(message.hostname);
      if (isEnabled) {
        await removeHost2(message.hostname);
        await disableRulesForHost(message.hostname);
      } else {
        await addHost2(message.hostname);
        const updated = await loadState();
        await enableRulesForHost(message.hostname, updated.settings);
      }
      await updateAllTabIcons();
      return await loadState();
    }
    case "forceEnable": {
      if (!isValidHostname(message.hostname)) return null;
      await addHost2(message.hostname);
      const updated = await loadState();
      await enableRulesForHost(message.hostname, updated.settings);
      await updateAllTabIcons();
      return updated;
    }
    case "removeHost": {
      if (!isValidHostname(message.hostname)) return null;
      await removeHost2(message.hostname);
      await disableRulesForHost(message.hostname);
      await updateAllTabIcons();
      return await loadState();
    }
    case "disableAll": {
      await clearAllHosts2();
      await disableAllRules();
      await updateAllTabIcons();
      return await loadState();
    }
    case "getState":
      return await loadState();
    case "getMatchedCount": {
      try {
        const info = await chrome.declarativeNetRequest.getMatchedRules();
        return info.rulesMatchedInfo.length;
      } catch {
        return 0;
      }
    }
    default:
      return null;
  }
}
restoreRules().catch(
  (err) => console.error("[CORS Bypass] Restore failed:", err)
);
chrome.runtime.onStartup.addListener(() => {
  restoreRules().catch(
    (err) => console.error("[CORS Bypass] Startup restore failed:", err)
  );
});
chrome.runtime.onInstalled.addListener(() => {
  restoreRules().catch(
    (err) => console.error("[CORS Bypass] Install restore failed:", err)
  );
});
