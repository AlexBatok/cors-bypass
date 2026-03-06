import { isBlocked } from '../lib/blocklist.js';
import type { CorsProState } from '../lib/constants.js';
import { sanitizeHostname } from '../lib/validate.js';

// ── DOM refs ────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const versionEl = $('version');
const hostnameEl = $('hostname');
const statusDot = $('statusDot');
const toggleBtn = $<HTMLButtonElement>('toggleBtn');
const toggleLabel = $('toggleLabel');
const warningEl = $('warning');
const warningText = $('warningText');
const overrideBtn = $<HTMLButtonElement>('overrideBtn');
const debugToggle = $<HTMLButtonElement>('debugToggle');
const debugDetails = $('debugDetails');
const matchedCount = $('matchedCount');
const domainsList = $('domainsList');
const domainsEmpty = $('domainsEmpty');
const disableAllBtn = $<HTMLButtonElement>('disableAllBtn');
const optionsLink = $<HTMLAnchorElement>('optionsLink');

let currentHostname: string | null = null;

// ── Init ────────────────────────────────────────────────────────
async function init() {
  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

  // Get current tab hostname
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  currentHostname = getHostname(tab?.url);
  hostnameEl.textContent = sanitizeHostname(currentHostname);

  if (!currentHostname) {
    toggleBtn.disabled = true;
    toggleLabel.textContent = 'Enable';
    return;
  }

  toggleBtn.disabled = false;
  await refreshState();

  // Event listeners
  toggleBtn.addEventListener('click', handleToggle);
  overrideBtn.addEventListener('click', handleForceEnable);
  disableAllBtn.addEventListener('click', handleDisableAll);
  debugToggle.addEventListener('click', toggleDebugDetails);
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Matched rules count
  const count = await sendMessage({ type: 'getMatchedCount' });
  matchedCount.textContent = String(count ?? 0);
}

// ── State refresh ───────────────────────────────────────────────
async function refreshState() {
  const state: CorsProState = await sendMessage({ type: 'getState' });
  if (!state) return;

  const isActive = currentHostname
    ? state.enabledHosts.includes(currentHostname)
    : false;

  // Status dot
  statusDot.classList.toggle('status-dot--active', isActive);

  // Toggle button
  toggleBtn.classList.toggle('toggle-btn--active', isActive);
  toggleLabel.textContent = isActive ? 'Disable' : 'Enable';

  // Warning (hidden if not blocked or already active)
  warningEl.hidden = true;

  // Domain list
  renderDomainList(state.enabledHosts);
}

// ── Handlers ────────────────────────────────────────────────────
async function handleToggle() {
  if (!currentHostname) return;

  // Check blocklist before enabling
  const state: CorsProState = await sendMessage({ type: 'getState' });
  const isActive = state.enabledHosts.includes(currentHostname);

  if (!isActive && isBlocked(currentHostname, state.settings.customBlocklist)) {
    warningText.textContent =
      `"${currentHostname}" is on the protection list. ` +
      `Enabling CORS here may break the site.`;
    warningEl.hidden = false;
    return;
  }

  await sendMessage({ type: 'toggle', hostname: currentHostname });
  warningEl.hidden = true;
  await refreshState();
}

async function handleForceEnable() {
  if (!currentHostname) return;
  await sendMessage({ type: 'forceEnable', hostname: currentHostname });
  warningEl.hidden = true;
  await refreshState();
}

async function handleDisableAll() {
  await sendMessage({ type: 'disableAll' });
  await refreshState();
}

async function handleRemoveHost(hostname: string) {
  await sendMessage({ type: 'removeHost', hostname });
  await refreshState();
}

function toggleDebugDetails() {
  debugDetails.hidden = !debugDetails.hidden;
}

// ── Render domain list ──────────────────────────────────────────
function renderDomainList(hosts: string[]) {
  domainsList.innerHTML = '';
  domainsEmpty.hidden = hosts.length > 0;
  disableAllBtn.hidden = hosts.length === 0;

  for (const host of hosts) {
    const li = document.createElement('li');
    li.className = 'domains__item';

    const name = document.createElement('span');
    name.className = 'domains__item-name';
    name.textContent = host;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'domains__item-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = `Remove ${host}`;
    removeBtn.addEventListener('click', () => handleRemoveHost(host));

    li.appendChild(name);
    li.appendChild(removeBtn);
    domainsList.appendChild(li);
  }
}

// ── Helpers ─────────────────────────────────────────────────────
function getHostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
}

function sendMessage(message: unknown): Promise<any> {
  return chrome.runtime.sendMessage(message);
}

// ── Footer links ────────────────────────────────────────────────
$('link-rate').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews` });
});
$('link-coffee').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://alexbatok.github.io/cors-bypass/#donate' });
});

// ── Start ───────────────────────────────────────────────────────
init().catch(console.error);
