import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_ERRORS } from '@login-lab/shared';
import { createApp } from './app';
import { LoginRateLimiter } from './auth/loginRateLimiter';
import { hashPassword } from './auth/password';
import { SESSION_COOKIE } from './auth/routes';
import { InMemorySessionStore } from './auth/sessionStore';
import { InMemoryUserStore } from './auth/userStore';

const PASSWORD = 'correct horse battery';
const TTL_MS = 60_000;
const LOCK_WINDOW_MS = 15 * 60_000;
const ALICE = { id: 'u1', email: 'alice@example.com', name: 'Alice' };

let passwordHash: string;
let clock: number;
let users: InMemoryUserStore;
let sessions: InMemorySessionStore;
let loginLimiter: LoginRateLimiter;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  clock = 1_000_000;
  users = new InMemoryUserStore();
  users.add({ ...ALICE, passwordHash });
  sessions = new InMemorySessionStore({ ttlMs: TTL_MS, now: () => clock });
  loginLimiter = makeLimiter();
});

function makeLimiter(maxFailuresPerEmail = 100, maxFailuresPerIp = 100) {
  return new LoginRateLimiter({
    windowMs: LOCK_WINDOW_MS,
    maxFailuresPerEmail,
    maxFailuresPerIp,
    now: () => clock,
  });
}

function makeApp(secureCookie = false, trustProxy: boolean | number = false) {
  return createApp({
    users,
    sessions,
    loginLimiter,
    config: { sessionTtlMs: TTL_MS, secureCookie, trustProxy },
  });
}

function setCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header ?? [];
}

function sidFrom(res: request.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0].slice(SESSION_COOKIE.length + 1);
}

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, data: { status: 'ok' } });
  });
});

describe('POST /api/auth/login', () => {
  it('logs in and sets a hardened session cookie', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: ALICE });
    expect(JSON.stringify(res.body)).not.toContain('scrypt');

    const cookie = setCookies(res).find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=60/);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('adds the Secure flag when configured', async () => {
    const res = await request(makeApp(true))
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: PASSWORD });
    expect(setCookies(res)[0]).toMatch(/Secure/);
  });

  it('normalizes the email', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: '  ALICE@Example.com ', password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('returns identical 401s for wrong password and unknown email', async () => {
    const app = makeApp();
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: 'nope' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: PASSWORD });

    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ ok: false, error: AUTH_ERRORS.invalidCredentials });
      expect(setCookies(res)).toHaveLength(0);
    }
  });

  it('does not trim the password', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: ` ${PASSWORD} ` });
    expect(res.status).toBe(401);
  });

  it('returns 401 when the stored hash is corrupt', async () => {
    users.add({ ...ALICE, passwordHash: 'garbage' });
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it.each([
    [{}, AUTH_ERRORS.emailRequired],
    [{ email: ALICE.email }, AUTH_ERRORS.passwordRequired],
    [{ email: 'nope', password: 'x' }, AUTH_ERRORS.emailInvalid],
    [[], AUTH_ERRORS.invalidRequest],
  ])('returns 400 for %j', async (body, error) => {
    const res = await request(makeApp()).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error });
  });

  it('returns 415 for non-JSON bodies', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .type('form')
      .send({ email: ALICE.email, password: PASSWORD });
    expect(res.status).toBe(415);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: AUTH_ERRORS.invalidRequest });
  });

  it('returns 413 for oversized bodies', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: ALICE.email, password: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it('rotates the session ID and revokes the old one on re-login', async () => {
    const agent = request.agent(makeApp());
    const first = sidFrom(
      await agent.post('/api/auth/login').send({ email: ALICE.email, password: PASSWORD }),
    );
    const second = sidFrom(
      await agent.post('/api/auth/login').send({ email: ALICE.email, password: PASSWORD }),
    );

    expect(second).not.toBe(first);
    expect(sessions.get(first)).toBeUndefined();
    expect(sessions.get(second)).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a session', async () => {
    const res = await request(makeApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: AUTH_ERRORS.unauthenticated });
  });

  it('returns 401 for an unknown session ID', async () => {
    const res = await request(makeApp()).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=bogus`);
    expect(res.status).toBe(401);
  });

  it('returns the user for a valid session', async () => {
    const agent = request.agent(makeApp());
    await agent.post('/api/auth/login').send({ email: ALICE.email, password: PASSWORD });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: ALICE });
  });

  it('returns 401 once the session expires', async () => {
    const agent = request.agent(makeApp());
    await agent.post('/api/auth/login').send({ email: ALICE.email, password: PASSWORD });
    clock += TTL_MS;
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('returns 401 and drops the session if the user was removed', async () => {
    const agent = request.agent(makeApp());
    const sid = sidFrom(
      await agent.post('/api/auth/login').send({ email: ALICE.email, password: PASSWORD }),
    );
    users.remove(ALICE.id);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(sessions.get(sid)).toBeUndefined();
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session and clears the cookie', async () => {
    const agent = request.agent(makeApp());
    const sid = sidFrom(
      await agent.post('/api/auth/login').send({ email: ALICE.email, password: PASSWORD }),
    );

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(setCookies(res)[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Expires=Thu, 01 Jan 1970`));
    expect(sessions.get(sid)).toBeUndefined();

    // Even replaying the old cookie must fail.
    const replay = await request(makeApp()).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${sid}`);
    expect(replay.status).toBe(401);
  });

  it('is idempotent without a session', async () => {
    const res = await request(makeApp()).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});

describe('login rate limiting', () => {
  const login = (app: ReturnType<typeof makeApp>, email: string, password: string, forwardedFor?: string) => {
    const req = request(app).post('/api/auth/login');
    if (forwardedFor) req.set('X-Forwarded-For', forwardedFor);
    return req.send({ email, password });
  };

  it('locks the email after N failures, even for the correct password', async () => {
    loginLimiter = makeLimiter(3);
    const app = makeApp();
    for (let i = 0; i < 3; i++) {
      expect((await login(app, ALICE.email, 'wrong')).status).toBe(401);
    }

    clock += 30_000;
    const locked = await login(app, ALICE.email, PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body).toEqual({ ok: false, error: AUTH_ERRORS.tooManyAttempts });
    expect(locked.headers['retry-after']).toBe(String(15 * 60 - 30));
    expect(setCookies(locked)).toHaveLength(0);
  });

  it('counts the normalized email, so case/whitespace variants share a counter', async () => {
    loginLimiter = makeLimiter(2);
    const app = makeApp();
    await login(app, 'ALICE@example.com', 'wrong');
    await login(app, ' alice@EXAMPLE.com ', 'wrong');
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(429);
  });

  it('treats unknown emails exactly like known ones', async () => {
    loginLimiter = makeLimiter(2);
    const app = makeApp();
    const responses = [];
    for (const email of [ALICE.email, 'ghost@example.com']) {
      for (let i = 0; i < 3; i++) responses.push(await login(app, email, 'wrong'));
    }
    const shape = (r: request.Response) => [r.status, r.body.error, r.headers['retry-after']];
    expect(responses.slice(0, 3).map(shape)).toEqual(responses.slice(3).map(shape));
    expect(responses[2].status).toBe(429);
  });

  it('unlocks after the window', async () => {
    loginLimiter = makeLimiter(1);
    const app = makeApp();
    await login(app, ALICE.email, 'wrong');
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(429);
    clock += LOCK_WINDOW_MS;
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(200);
  });

  it('resets the email counter after a successful login', async () => {
    loginLimiter = makeLimiter(3);
    const app = makeApp();
    await login(app, ALICE.email, 'wrong');
    await login(app, ALICE.email, 'wrong');
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(200);
    await login(app, ALICE.email, 'wrong');
    await login(app, ALICE.email, 'wrong');
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(200);
  });

  it('locks the IP after N failures across different emails', async () => {
    loginLimiter = makeLimiter(100, 3);
    const app = makeApp();
    for (const user of ['a', 'b', 'c']) await login(app, `${user}@example.com`, 'wrong');
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(429);
  });

  it('does not count validation errors', async () => {
    loginLimiter = makeLimiter(1);
    const app = makeApp();
    await request(app).post('/api/auth/login').send({ email: ALICE.email });
    expect((await login(app, ALICE.email, PASSWORD)).status).toBe(200);
  });

  it('cannot be bypassed by firing attempts in parallel', async () => {
    loginLimiter = makeLimiter(3);
    const app = makeApp();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => login(app, ALICE.email, 'wrong')),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 401)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(7);
  });

  it('ignores X-Forwarded-For unless trust proxy is configured', async () => {
    loginLimiter = makeLimiter(1);
    const app = makeApp();
    await login(app, ALICE.email, 'wrong', '9.9.9.9');
    // Spoofing a new forwarded IP must not escape the lock.
    expect((await login(app, ALICE.email, PASSWORD, '8.8.8.8')).status).toBe(429);
  });

  it('keys by the forwarded client IP when trust proxy is configured', async () => {
    loginLimiter = makeLimiter(1);
    const app = makeApp(false, 1);
    await login(app, ALICE.email, 'wrong', '9.9.9.9');
    expect((await login(app, ALICE.email, PASSWORD, '9.9.9.9')).status).toBe(429);
    expect((await login(app, ALICE.email, PASSWORD, '8.8.8.8')).status).toBe(200);
  });
});
