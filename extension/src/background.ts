// CORS Bypass — Background Service Worker
import { getState } from './lib/storage.js';
import {
  enableRulesForHost,
  disableRulesForHost,
  disableAllRules,
} from './lib/rules.js';
import {
  setIconActive,
  setIconInactive,
  setBadge,
  getHostname,
} from './lib/icon.js';
import { isValidHostname } from './lib/validate.js';

// ── Restore rules on service worker start ─────────────────────────
async function restoreRules(): Promise<void> {
  const state = await getState();
  await disableAllRules();
  for (const host of state.enabledHosts) {
    await enableRulesForHost(host, state.settings);
  }
}

// ── Update icon/badge for a specific tab ──────────────────────────
async function updateTabIcon(tabId: number, url?: string): Promise<void> {
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

// ── Debounced icon updates to avoid excessive calls ───────────────
const pendingUpdates = new Map<number, ReturnType<typeof setTimeout>>();

function debouncedUpdateTabIcon(tabId: number, url?: string): void {
  const existing = pendingUpdates.get(tabId);
  if (existing) clearTimeout(existing);

  pendingUpdates.set(
    tabId,
    setTimeout(() => {
      pendingUpdates.delete(tabId);
      updateTabIcon(tabId, url).catch(() => {});
    }, 80),
  );
}

// ── Update icons for all tabs ─────────────────────────────────────
async function updateAllTabIcons(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) {
      await updateTabIcon(tab.id, tab.url).catch(() => {});
    }
  }
}

// ── Tab navigation → refresh icon ─────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    debouncedUpdateTabIcon(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    debouncedUpdateTabIcon(activeInfo.tabId, tab.url);
  } catch {
    // Tab may have been closed between event and handler
  }
});

// Clean up debounce map when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = pendingUpdates.get(tabId);
  if (timer) {
    clearTimeout(timer);
    pendingUpdates.delete(tabId);
  }
});

// ── Message handler for popup/options communication ───────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from our own extension
  if (sender.id !== chrome.runtime.id) {
    sendResponse(null);
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((err) => {
      console.error('[CORS Bypass] Message error:', err);
      sendResponse(null);
    });
  return true; // async response
});

interface ToggleMessage {
  type: 'toggle';
  hostname: string;
}
interface GetStateMessage {
  type: 'getState';
}
interface DisableAllMessage {
  type: 'disableAll';
}
interface RemoveHostMessage {
  type: 'removeHost';
  hostname: string;
}
interface GetMatchedCountMessage {
  type: 'getMatchedCount';
}
interface ForceEnableMessage {
  type: 'forceEnable';
  hostname: string;
}

type Message =
  | ToggleMessage
  | GetStateMessage
  | DisableAllMessage
  | RemoveHostMessage
  | GetMatchedCountMessage
  | ForceEnableMessage;

async function handleMessage(message: Message) {
  const { addHost, removeHost, clearAllHosts, getState: loadState } =
    await import('./lib/storage.js');

  switch (message.type) {
    case 'toggle': {
      if (!isValidHostname(message.hostname)) return null;
      const state = await loadState();
      const isEnabled = state.enabledHosts.includes(message.hostname);
      if (isEnabled) {
        await removeHost(message.hostname);
        await disableRulesForHost(message.hostname);
      } else {
        await addHost(message.hostname);
        const updated = await loadState();
        await enableRulesForHost(message.hostname, updated.settings);
      }
      await updateAllTabIcons();
      return await loadState();
    }

    case 'forceEnable': {
      if (!isValidHostname(message.hostname)) return null;
      await addHost(message.hostname);
      const updated = await loadState();
      await enableRulesForHost(message.hostname, updated.settings);
      await updateAllTabIcons();
      return updated;
    }

    case 'removeHost': {
      if (!isValidHostname(message.hostname)) return null;
      await removeHost(message.hostname);
      await disableRulesForHost(message.hostname);
      await updateAllTabIcons();
      return await loadState();
    }

    case 'disableAll': {
      await clearAllHosts();
      await disableAllRules();
      await updateAllTabIcons();
      return await loadState();
    }

    case 'getState':
      return await loadState();

    case 'getMatchedCount': {
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

// ── Init ──────────────────────────────────────────────────────────
// Restore on service worker start (covers most cases)
restoreRules().catch((err) =>
  console.error('[CORS Bypass] Restore failed:', err),
);

// Also restore on browser startup (fixes Brave startup bug where
// declarativeNetRequest rules don't persist across browser restarts)
chrome.runtime.onStartup.addListener(() => {
  restoreRules().catch((err) =>
    console.error('[CORS Bypass] Startup restore failed:', err),
  );
});

// Restore on extension install/update
chrome.runtime.onInstalled.addListener(() => {
  restoreRules().catch((err) =>
    console.error('[CORS Bypass] Install restore failed:', err),
  );
});
