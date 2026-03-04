import {
  STORAGE_KEY,
  DEFAULT_STATE,
  DEFAULT_SETTINGS,
  MAX_HOSTS,
  type CorsProState,
  type CorsProSettings,
} from './constants.js';
import { isValidHostname } from './validate.js';

export async function getState(): Promise<CorsProState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<CorsProState> | undefined;
  if (!stored) return { ...DEFAULT_STATE };
  return {
    enabledHosts: Array.isArray(stored.enabledHosts)
      ? stored.enabledHosts.filter(isValidHostname)
      : [],
    settings: { ...DEFAULT_STATE.settings, ...stored.settings },
  };
}

export async function setState(
  state: CorsProState
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function addHost(hostname: string): Promise<CorsProState> {
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

export async function removeHost(hostname: string): Promise<CorsProState> {
  const state = await getState();
  state.enabledHosts = state.enabledHosts.filter((h) => h !== hostname);
  await setState(state);
  return state;
}

export async function clearAllHosts(): Promise<CorsProState> {
  const state = await getState();
  state.enabledHosts = [];
  await setState(state);
  return state;
}

export async function updateSettings(
  partial: Partial<CorsProSettings>
): Promise<CorsProState> {
  const state = await getState();
  state.settings = { ...state.settings, ...partial };
  await setState(state);
  return state;
}

/**
 * Validate and sanitize an imported state object.
 * Returns null if the data is structurally invalid.
 */
export function validateImportedState(
  data: unknown,
): CorsProState | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  // Validate enabledHosts
  if (!Array.isArray(obj.enabledHosts)) return null;
  if (obj.enabledHosts.length > MAX_HOSTS) return null;
  const hosts = obj.enabledHosts.filter(isValidHostname);

  // Validate settings
  if (!obj.settings || typeof obj.settings !== 'object') return null;
  const s = obj.settings as Record<string, unknown>;

  const settings: CorsProSettings = {
    headerOrigin: typeof s.headerOrigin === 'boolean'
      ? s.headerOrigin : DEFAULT_SETTINGS.headerOrigin,
    headerMethods: typeof s.headerMethods === 'boolean'
      ? s.headerMethods : DEFAULT_SETTINGS.headerMethods,
    headerHeaders: typeof s.headerHeaders === 'boolean'
      ? s.headerHeaders : DEFAULT_SETTINGS.headerHeaders,
    headerCredentials: typeof s.headerCredentials === 'boolean'
      ? s.headerCredentials : DEFAULT_SETTINGS.headerCredentials,
    headerExpose: typeof s.headerExpose === 'boolean'
      ? s.headerExpose : DEFAULT_SETTINGS.headerExpose,
    customBlocklist: Array.isArray(s.customBlocklist)
      ? s.customBlocklist
          .filter((d): d is string => typeof d === 'string')
          .filter((d) => d.length > 0 && d.length <= 253)
          .slice(0, 500)
      : [],
  };

  return { enabledHosts: hosts, settings };
}
