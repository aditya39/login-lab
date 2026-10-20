import { Router, type CookieOptions } from 'express';
import { AUTH_ERRORS, validateLoginRequest, type ApiResponse, type User } from '@login-lab/shared';
import type { AppConfig } from '../config';
import type { LoginRateLimiter } from './loginRateLimiter';
import { getDummyHash, verifyPassword } from './password';
import type { SessionStore } from './sessionStore';
import { toPublicUser, type UserStore } from './userStore';

export const SESSION_COOKIE = 'sid';

export interface AuthDeps {
  users: UserStore;
  sessions: SessionStore;
  loginLimiter: LoginRateLimiter;
  config: Pick<AppConfig, 'sessionTtlMs' | 'secureCookie'>;
}

export function createAuthRouter({ users, sessions, loginLimiter, config }: AuthDeps) {
  const router = Router();

  const baseCookie: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookie,
    path: '/',
  };

  router.post('/login', async (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({ ok: false, error: AUTH_ERRORS.invalidRequest } satisfies ApiResponse<User>);
      return;
    }

    const parsed = validateLoginRequest(req.body);
    if (!parsed.ok) {
      res.status(400).json(parsed);
      return;
    }

    const { email, password } = parsed.data;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    // Checked before hashing so locked-out attempts cost no scrypt work.
    const limit = loginLimiter.check(ip, email);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      res.status(429).json({ ok: false, error: AUTH_ERRORS.tooManyAttempts } satisfies ApiResponse<User>);
      return;
    }
    // Count the attempt as failed *before* awaiting scrypt so parallel requests
    // cannot all pass the check; refunded below on success.
    loginLimiter.recordFailure(ip, email);

    const user = users.findByEmail(email);
    // Always run scrypt so response time does not reveal whether the email exists.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !passwordOk) {
      res.status(401).json({ ok: false, error: AUTH_ERRORS.invalidCredentials } satisfies ApiResponse<User>);
      return;
    }

    loginLimiter.recordSuccess(ip, email);

    // Rotate the session ID on login to prevent session fixation.
    const previous: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof previous === 'string') sessions.delete(previous);

    const session = sessions.create(user.id);
    res.cookie(SESSION_COOKIE, session.id, { ...baseCookie, maxAge: config.sessionTtlMs });
    res.json({ ok: true, data: toPublicUser(user) } satisfies ApiResponse<User>);
  });

  router.post('/logout', (req, res) => {
    const sid: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof sid === 'string') sessions.delete(sid);
    res.clearCookie(SESSION_COOKIE, baseCookie);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    const sid: unknown = req.cookies?.[SESSION_COOKIE];
    const session = typeof sid === 'string' ? sessions.get(sid) : undefined;
    const user = session && users.findById(session.userId);

    if (!session || !user) {
      if (session) sessions.delete(session.id);
      res.status(401).json({ ok: false, error: AUTH_ERRORS.unauthenticated } satisfies ApiResponse<User>);
      return;
    }

    res.json({ ok: true, data: toPublicUser(user) } satisfies ApiResponse<User>);
  });

  return router;
}
