// extension/src/lib/blocklist.ts
var DEFAULT_BLOCKLIST = [
  "youtube.com",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "googlevideo.com",
  "cloudflare.com",
  "github.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "microsoft.com",
  "live.com",
  "office.com",
  "apple.com",
  "icloud.com",
  "amazon.com",
  "netflix.com"
];
function isBlocked(hostname, customBlocklist = []) {
  const allBlocked = [...DEFAULT_BLOCKLIST, ...customBlocklist];
  const lower = hostname.toLowerCase();
  return allBlocked.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`)
  );
}

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
function sanitizeHostname(hostname) {
  if (!hostname) return "No website";
  if (!isValidHostname(hostname)) return "Invalid hostname";
  return hostname.length > 100 ? hostname.substring(0, 100) + "\u2026" : hostname;
}

// extension/src/popup/popup.ts
var $ = (id) => document.getElementById(id);
var versionEl = $("version");
var hostnameEl = $("hostname");
var statusDot = $("statusDot");
var toggleBtn = $("toggleBtn");
var toggleLabel = $("toggleLabel");
var warningEl = $("warning");
var warningText = $("warningText");
var overrideBtn = $("overrideBtn");
var debugToggle = $("debugToggle");
var debugDetails = $("debugDetails");
var matchedCount = $("matchedCount");
var domainsList = $("domainsList");
var domainsEmpty = $("domainsEmpty");
var disableAllBtn = $("disableAllBtn");
var optionsLink = $("optionsLink");
var currentHostname = null;
async function init() {
  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  currentHostname = getHostname(tab?.url);
  hostnameEl.textContent = sanitizeHostname(currentHostname);
  if (!currentHostname) {
    toggleBtn.disabled = true;
    toggleLabel.textContent = "Enable";
    return;
  }
  toggleBtn.disabled = false;
  await refreshState();
  toggleBtn.addEventListener("click", handleToggle);
  overrideBtn.addEventListener("click", handleForceEnable);
  disableAllBtn.addEventListener("click", handleDisableAll);
  debugToggle.addEventListener("click", toggleDebugDetails);
  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  const count = await sendMessage({ type: "getMatchedCount" });
  matchedCount.textContent = String(count ?? 0);
}
async function refreshState() {
  const state = await sendMessage({ type: "getState" });
  if (!state) return;
  const isActive = currentHostname ? state.enabledHosts.includes(currentHostname) : false;
  statusDot.classList.toggle("status-dot--active", isActive);
  toggleBtn.classList.toggle("toggle-btn--active", isActive);
  toggleLabel.textContent = isActive ? "Disable" : "Enable";
  warningEl.hidden = true;
  renderDomainList(state.enabledHosts);
}
async function handleToggle() {
  if (!currentHostname) return;
  const state = await sendMessage({ type: "getState" });
  const isActive = state.enabledHosts.includes(currentHostname);
  if (!isActive && isBlocked(currentHostname, state.settings.customBlocklist)) {
    warningText.textContent = `"${currentHostname}" is on the protection list. Enabling CORS here may break the site.`;
    warningEl.hidden = false;
    return;
  }
  await sendMessage({ type: "toggle", hostname: currentHostname });
  warningEl.hidden = true;
  await refreshState();
}
async function handleForceEnable() {
  if (!currentHostname) return;
  await sendMessage({ type: "forceEnable", hostname: currentHostname });
  warningEl.hidden = true;
  await refreshState();
}
async function handleDisableAll() {
  await sendMessage({ type: "disableAll" });
  await refreshState();
}
async function handleRemoveHost(hostname) {
  await sendMessage({ type: "removeHost", hostname });
  await refreshState();
}
function toggleDebugDetails() {
  debugDetails.hidden = !debugDetails.hidden;
}
function renderDomainList(hosts) {
  domainsList.innerHTML = "";
  domainsEmpty.hidden = hosts.length > 0;
  disableAllBtn.hidden = hosts.length === 0;
  for (const host of hosts) {
    const li = document.createElement("li");
    li.className = "domains__item";
    const name = document.createElement("span");
    name.className = "domains__item-name";
    name.textContent = host;
    const removeBtn = document.createElement("button");
    removeBtn.className = "domains__item-remove";
    removeBtn.textContent = "\xD7";
    removeBtn.title = `Remove ${host}`;
    removeBtn.addEventListener("click", () => handleRemoveHost(host));
    li.appendChild(name);
    li.appendChild(removeBtn);
    domainsList.appendChild(li);
  }
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
function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}
init().catch(console.error);
