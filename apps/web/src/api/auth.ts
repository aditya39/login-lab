import { AUTH_ERRORS, type ApiResponse, type LoginRequest, type User } from '@login-lab/shared';

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    return { ok: false, error: AUTH_ERRORS.network };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return { ok: false, error: AUTH_ERRORS.network };
  }
}

export function login(credentials: LoginRequest): Promise<ApiResponse<User>> {
  return request<User>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

export function logout(): Promise<ApiResponse<void>> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function me(): Promise<ApiResponse<User>> {
  return request<User>('/api/auth/me');
}
