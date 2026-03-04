// Icon and badge management for per-tab visual state

export async function setIconActive(tabId: number): Promise<void> {
  await chrome.action.setIcon({
    tabId,
    path: {
      16: '/icons/icon-active-16.png',
      32: '/icons/icon-active-32.png',
      48: '/icons/icon-active-48.png',
      128: '/icons/icon-active-128.png',
    },
  });
}

export async function setIconInactive(tabId: number): Promise<void> {
  await chrome.action.setIcon({
    tabId,
    path: {
      16: '/icons/icon-inactive-16.png',
      32: '/icons/icon-inactive-32.png',
      48: '/icons/icon-inactive-48.png',
      128: '/icons/icon-inactive-128.png',
    },
  });
}

export async function setBadge(
  tabId: number,
  count: number
): Promise<void> {
  const text = count > 0 ? String(count) : '';
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: '#10B981',
  });
}

/** Extract hostname from a URL, returns null for non-http URLs. */
export function getHostname(url: string | undefined): string | null {
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
