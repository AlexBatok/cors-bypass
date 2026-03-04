import {
  BASE_RULE_ID,
  RULES_PER_HOST,
  MAX_DYNAMIC_RULES,
  CORS_HEADERS,
  DEFAULT_METHODS,
  type CorsProSettings,
} from './constants.js';

const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  'xmlhttprequest',
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'media',
  'other',
];

/** FNV-1a hash — better distribution than simple multiply-add. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Track allocated slots to detect and resolve hash collisions.
const allocatedSlots = new Map<number, string>();

const MAX_SLOTS = Math.floor(
  (MAX_DYNAMIC_RULES - BASE_RULE_ID) / RULES_PER_HOST,
);

/** Get the base rule ID for a hostname, with collision-safe linear probing. */
export function getRuleBaseId(hostname: string): number {
  let slot = fnv1a(hostname) % MAX_SLOTS;

  for (let i = 0; i < MAX_SLOTS; i++) {
    const existing = allocatedSlots.get(slot);
    if (existing === undefined || existing === hostname) {
      allocatedSlots.set(slot, hostname);
      return BASE_RULE_ID + slot * RULES_PER_HOST;
    }
    slot = (slot + 1) % MAX_SLOTS;
  }
  throw new Error('Rule ID space exhausted');
}

/** Release a slot when a hostname is removed. */
export function releaseRuleSlot(hostname: string): void {
  for (const [slot, h] of allocatedSlots) {
    if (h === hostname) {
      allocatedSlots.delete(slot);
      return;
    }
  }
}

/** Clear all tracked slots (used on disableAll). */
export function clearAllSlots(): void {
  allocatedSlots.clear();
}

/** Build the set of declarativeNetRequest rules for a hostname. */
export function buildRulesForHost(
  hostname: string,
  settings: CorsProSettings
): chrome.declarativeNetRequest.Rule[] {
  const baseId = getRuleBaseId(hostname);
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  const urlFilter = `||${hostname}/`;
  let offset = 0;

  const responseHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];

  if (settings.headerOrigin) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_ORIGIN,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: '*',
    });
  }

  if (settings.headerMethods) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_METHODS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: DEFAULT_METHODS,
    });
  }

  if (settings.headerHeaders) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_HEADERS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: '*',
    });
  }

  if (settings.headerCredentials) {
    responseHeaders.push({
      header: CORS_HEADERS.ALLOW_CREDENTIALS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: 'true',
    });
  }

  if (settings.headerExpose) {
    responseHeaders.push({
      header: CORS_HEADERS.EXPOSE_HEADERS,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: '*',
    });
  }

  // Main CORS rule — modify response headers
  if (responseHeaders.length > 0) {
    rules.push({
      id: baseId + offset++,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders,
      },
      condition: {
        urlFilter,
        resourceTypes: ALL_RESOURCE_TYPES,
      },
    });
  }

  // Preflight max-age rule — reduce preflight frequency
  rules.push({
    id: baseId + offset++,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        {
          header: CORS_HEADERS.MAX_AGE,
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: '86400',
        },
      ],
    },
    condition: {
      urlFilter,
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  });

  return rules;
}

/** Get all rule IDs associated with a hostname. */
export function getRuleIdsForHost(hostname: string): number[] {
  const baseId = getRuleBaseId(hostname);
  return Array.from({ length: RULES_PER_HOST }, (_, i) => baseId + i);
}

/** Apply rules for a hostname: add declarativeNetRequest dynamic rules. */
export async function enableRulesForHost(
  hostname: string,
  settings: CorsProSettings
): Promise<void> {
  const newRules = buildRulesForHost(hostname, settings);
  const removeRuleIds = getRuleIdsForHost(hostname);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: newRules,
  });
}

/** Remove all rules for a hostname. */
export async function disableRulesForHost(
  hostname: string
): Promise<void> {
  const removeRuleIds = getRuleIdsForHost(hostname);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
  });
  releaseRuleSlot(hostname);
}

/** Remove all dynamic CORS rules. */
export async function disableAllRules(): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);
  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
  clearAllSlots();
}
