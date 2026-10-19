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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
