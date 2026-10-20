export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface HealthStatus {
  status: 'ok';
  uptime: number;
}

export const EMAIL_MAX_LENGTH = 254;
// Upper bound keeps password hashing cost bounded (DoS guard).
export const PASSWORD_MAX_LENGTH = 1024;

export const AUTH_ERRORS = {
  emailRequired: 'Email wajib diisi',
  emailInvalid: 'Format email tidak valid',
  passwordRequired: 'Password wajib diisi',
  passwordTooLong: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter`,
  invalidRequest: 'Permintaan tidak valid',
  invalidCredentials: 'Email atau password salah',
  unauthenticated: 'Belum login',
  network: 'Tidak dapat terhubung ke server',
  tooManyAttempts: 'Terlalu banyak percobaan login gagal. Coba lagi nanti.',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validates an untrusted login payload. Email is normalized; password is kept as-is. */
export function validateLoginRequest(input: unknown): ApiResponse<LoginRequest> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: AUTH_ERRORS.invalidRequest };
  }
  const { email, password } = input as Record<string, unknown>;

  if (typeof email !== 'string' || email.trim() === '') {
    return { ok: false, error: AUTH_ERRORS.emailRequired };
  }
  const normalized = normalizeEmail(email);
  if (normalized.length > EMAIL_MAX_LENGTH || !isValidEmail(normalized)) {
    return { ok: false, error: AUTH_ERRORS.emailInvalid };
  }

  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: AUTH_ERRORS.passwordRequired };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: AUTH_ERRORS.passwordTooLong };
  }

  return { ok: true, data: { email: normalized, password } };
}
