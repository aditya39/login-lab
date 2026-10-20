export interface LoginLimitConfig {
  windowMs: number;
  maxFailuresPerEmail: number;
  maxFailuresPerIp: number;
}

export interface AppConfig {
  port: number;
  sessionTtlMs: number;
  isProduction: boolean;
  secureCookie: boolean;
  loginLimit: LoginLimitConfig;
  /** Value for Express `trust proxy`. False unless explicitly configured. */
  trustProxy: boolean | number | string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_SESSION_TTL_MINUTES = 60;
const DEFAULT_LOGIN_WINDOW_MINUTES = 15;
const DEFAULT_MAX_FAILURES_PER_EMAIL = 5;
const DEFAULT_MAX_FAILURES_PER_IP = 20;

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = positiveNumber(value, fallback);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '' || trimmed === 'false') return false;
  if (trimmed === 'true') return true;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed; // e.g. "loopback" or a comma-separated list of subnets
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  return {
    port: positiveNumber(env.PORT, DEFAULT_PORT),
    sessionTtlMs:
      positiveNumber(env.SESSION_TTL_MINUTES, DEFAULT_SESSION_TTL_MINUTES) * 60 * 1000,
    isProduction,
    secureCookie: isProduction,
    loginLimit: {
      windowMs:
        positiveNumber(env.LOGIN_LOCK_WINDOW_MINUTES, DEFAULT_LOGIN_WINDOW_MINUTES) * 60 * 1000,
      maxFailuresPerEmail: positiveInteger(
        env.LOGIN_MAX_FAILURES_PER_EMAIL,
        DEFAULT_MAX_FAILURES_PER_EMAIL,
      ),
      maxFailuresPerIp: positiveInteger(env.LOGIN_MAX_FAILURES_PER_IP, DEFAULT_MAX_FAILURES_PER_IP),
    },
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
  };
}
