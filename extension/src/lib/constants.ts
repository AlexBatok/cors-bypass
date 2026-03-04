// Rule IDs: each hostname gets a block of IDs starting from BASE_RULE_ID
// We use a hash of the hostname to generate unique rule IDs
export const BASE_RULE_ID = 1000;
export const RULES_PER_HOST = 6; // 5 CORS headers + 1 preflight max-age
export const MAX_DYNAMIC_RULES = 5000;
export const MAX_HOSTS = Math.floor(MAX_DYNAMIC_RULES / RULES_PER_HOST);

export const CORS_HEADERS = {
  ALLOW_ORIGIN: 'Access-Control-Allow-Origin',
  ALLOW_METHODS: 'Access-Control-Allow-Methods',
  ALLOW_HEADERS: 'Access-Control-Allow-Headers',
  ALLOW_CREDENTIALS: 'Access-Control-Allow-Credentials',
  EXPOSE_HEADERS: 'Access-Control-Expose-Headers',
  MAX_AGE: 'Access-Control-Max-Age',
} as const;

export const DEFAULT_METHODS =
  'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD';

export const STORAGE_KEY = 'corsProState';

export interface CorsProState {
  enabledHosts: string[];
  settings: CorsProSettings;
}

export interface CorsProSettings {
  headerOrigin: boolean;
  headerMethods: boolean;
  headerHeaders: boolean;
  headerCredentials: boolean;
  headerExpose: boolean;
  customBlocklist: string[];
}

export const DEFAULT_SETTINGS: CorsProSettings = {
  headerOrigin: true,
  headerMethods: true,
  headerHeaders: true,
  headerCredentials: true,
  headerExpose: true,
  customBlocklist: [],
};

export const DEFAULT_STATE: CorsProState = {
  enabledHosts: [],
  settings: { ...DEFAULT_SETTINGS },
};
