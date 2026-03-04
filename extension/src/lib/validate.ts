// Input validation utilities

const HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

/** Validate that a string is a plausible hostname. */
export function isValidHostname(hostname: unknown): hostname is string {
  if (typeof hostname !== 'string') return false;
  if (hostname.length === 0 || hostname.length > MAX_HOSTNAME_LENGTH) return false;
  if (!HOSTNAME_REGEX.test(hostname)) return false;
  if (hostname.includes('..')) return false;

  const labels = hostname.split('.');
  return labels.length >= 1 && labels.every(
    (l) => l.length > 0 && l.length <= MAX_LABEL_LENGTH,
  );
}

/** Validate a domain for the blocklist (stricter: requires TLD). */
export function isValidDomain(domain: unknown): domain is string {
  if (!isValidHostname(domain)) return false;
  return domain.split('.').length >= 2;
}

/** Sanitize hostname for safe display (truncate + strip). */
export function sanitizeHostname(hostname: string | null): string {
  if (!hostname) return 'No website';
  if (!isValidHostname(hostname)) return 'Invalid hostname';
  return hostname.length > 100 ? hostname.substring(0, 100) + '\u2026' : hostname;
}
