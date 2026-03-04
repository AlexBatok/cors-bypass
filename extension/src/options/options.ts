import {
  getState, updateSettings, setState, validateImportedState,
} from '../lib/storage.js';
import { DEFAULT_STATE, type CorsProState } from '../lib/constants.js';
import { disableAllRules, enableRulesForHost } from '../lib/rules.js';
import { isValidDomain } from '../lib/validate.js';

// ── DOM refs ────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const headerOrigin = $<HTMLInputElement>('headerOrigin');
const headerMethods = $<HTMLInputElement>('headerMethods');
const headerHeaders = $<HTMLInputElement>('headerHeaders');
const headerCredentials = $<HTMLInputElement>('headerCredentials');
const headerExpose = $<HTMLInputElement>('headerExpose');
const newDomainInput = $<HTMLInputElement>('newDomain');
const addDomainBtn = $<HTMLButtonElement>('addDomainBtn');
const blocklistEl = $('customBlocklist');
const blocklistEmpty = $('blocklistEmpty');
const exportBtn = $<HTMLButtonElement>('exportBtn');
const importBtn = $<HTMLButtonElement>('importBtn');
const importFile = $<HTMLInputElement>('importFile');
const resetBtn = $<HTMLButtonElement>('resetBtn');
const toast = $('toast');
const toastText = $('toastText');

// ── Init ────────────────────────────────────────────────────────
async function init() {
  const state = await getState();
  loadHeaderCheckboxes(state);
  renderBlocklist(state.settings.customBlocklist);

  const checkboxes = [
    headerOrigin, headerMethods, headerHeaders,
    headerCredentials, headerExpose,
  ];
  for (const cb of checkboxes) {
    cb.addEventListener('change', saveHeaders);
  }

  addDomainBtn.addEventListener('click', addDomain);
  newDomainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain();
  });
  exportBtn.addEventListener('click', exportSettings);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importSettings);
  resetBtn.addEventListener('click', resetToDefaults);
}

// ── Header checkboxes ───────────────────────────────────────────
function loadHeaderCheckboxes(state: CorsProState) {
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
    headerExpose: headerExpose.checked,
  });
  await rebuildAllRules(state);
  showToast('Headers updated');
}

// ── Blocklist ───────────────────────────────────────────────────
function renderBlocklist(domains: string[]) {
  blocklistEl.innerHTML = '';
  blocklistEmpty.hidden = domains.length > 0;

  for (const domain of domains) {
    const li = document.createElement('li');
    li.className = 'domain-list__item';

    const span = document.createElement('span');
    span.textContent = domain;

    const btn = document.createElement('button');
    btn.className = 'domain-list__remove';
    btn.textContent = '\u00d7';
    btn.addEventListener('click', () => removeDomain(domain));

    li.appendChild(span);
    li.appendChild(btn);
    blocklistEl.appendChild(li);
  }
}

async function addDomain() {
  const raw = newDomainInput.value.trim().toLowerCase();
  if (!raw) return;

  const domain = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!isValidDomain(domain)) {
    showToast('Invalid domain format');
    return;
  }

  const state = await getState();
  if (state.settings.customBlocklist.includes(domain)) {
    showToast('Domain already in list');
    return;
  }
  if (state.settings.customBlocklist.length >= 500) {
    showToast('Blocklist limit reached (500)');
    return;
  }

  state.settings.customBlocklist.push(domain);
  await updateSettings({ customBlocklist: state.settings.customBlocklist });
  newDomainInput.value = '';
  renderBlocklist(state.settings.customBlocklist);
  showToast(`Added ${domain}`);
}

async function removeDomain(domain: string) {
  const state = await getState();
  state.settings.customBlocklist = state.settings.customBlocklist.filter(
    (d) => d !== domain
  );
  await updateSettings({ customBlocklist: state.settings.customBlocklist });
  renderBlocklist(state.settings.customBlocklist);
  showToast(`Removed ${domain}`);
}

// ── Export / Import ─────────────────────────────────────────────
async function exportSettings() {
  const state = await getState();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cors-pro-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Settings exported');
}

async function importSettings() {
  const file = importFile.files?.[0];
  if (!file) return;

  try {
    if (file.size > 1024 * 100) { // 100 KB max
      showToast('File too large');
      importFile.value = '';
      return;
    }

    const text = await file.text();
    const raw = JSON.parse(text);
    const validated = validateImportedState(raw);

    if (!validated) {
      showToast('Invalid settings file');
      importFile.value = '';
      return;
    }

    await setState(validated);
    await rebuildAllRules(validated);

    loadHeaderCheckboxes(validated);
    renderBlocklist(validated.settings.customBlocklist);
    showToast('Settings imported');
  } catch {
    showToast('Failed to import');
  }

  importFile.value = '';
}

async function resetToDefaults() {
  await setState({ ...DEFAULT_STATE });
  await disableAllRules();

  const state = await getState();
  loadHeaderCheckboxes(state);
  renderBlocklist(state.settings.customBlocklist);
  showToast('Reset to defaults');
}

// ── Helpers ─────────────────────────────────────────────────────
async function rebuildAllRules(state: CorsProState) {
  await disableAllRules();
  for (const host of state.enabledHosts) {
    await enableRulesForHost(host, state.settings);
  }
}

let toastTimer: ReturnType<typeof setTimeout>;
function showToast(message: string) {
  toastText.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
}

// ── Start ───────────────────────────────────────────────────────
init().catch(console.error);
