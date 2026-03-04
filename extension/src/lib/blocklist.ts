// Protected domains that should not be modified by default.
// Users can override via "Enable anyway" in the popup.

export const DEFAULT_BLOCKLIST: readonly string[] = [
  'youtube.com',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'googlevideo.com',
  'cloudflare.com',
  'github.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'microsoft.com',
  'live.com',
  'office.com',
  'apple.com',
  'icloud.com',
  'amazon.com',
  'netflix.com',
];

/**
 * Check if a hostname matches any entry in the blocklist.
 * Matches both exact domain and subdomains (e.g. "mail.google.com" matches "google.com").
 */
export function isBlocked(
  hostname: string,
  customBlocklist: string[] = []
): boolean {
  const allBlocked = [...DEFAULT_BLOCKLIST, ...customBlocklist];
  const lower = hostname.toLowerCase();
  return allBlocked.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`)
  );
}
