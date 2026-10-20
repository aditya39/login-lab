import { describe, expect, it } from 'vitest';
import { LoginRateLimiter } from './loginRateLimiter';

const WINDOW = 60_000;

function setup(overrides: { maxFailuresPerEmail?: number; maxFailuresPerIp?: number } = {}) {
  let clock = 0;
  const limiter = new LoginRateLimiter({
    windowMs: WINDOW,
    maxFailuresPerEmail: 3,
    maxFailuresPerIp: 5,
    now: () => clock,
    ...overrides,
  });
  return {
    limiter,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

function fail(limiter: LoginRateLimiter, times: number, ip = '1.1.1.1', email = 'a@b.co') {
  for (let i = 0; i < times; i++) limiter.recordFailure(ip, email);
}

describe('LoginRateLimiter', () => {
  it('allows attempts below the per-email limit', () => {
    const { limiter } = setup();
    fail(limiter, 2);
    expect(limiter.check('1.1.1.1', 'a@b.co')).toEqual({ allowed: true });
  });

  it('blocks the IP+email pair at the limit with a Retry-After', () => {
    const { limiter, advance } = setup();
    fail(limiter, 3);
    advance(15_500);
    expect(limiter.check('1.1.1.1', 'a@b.co')).toEqual({ allowed: false, retryAfterSeconds: 45 });
  });

  it('does not block the same email from another IP or another email from the same IP', () => {
    const { limiter } = setup();
    fail(limiter, 3);
    expect(limiter.check('2.2.2.2', 'a@b.co').allowed).toBe(true);
    expect(limiter.check('1.1.1.1', 'other@b.co').allowed).toBe(true);
  });

  it('blocks the whole IP once the per-IP limit is reached across emails', () => {
    const { limiter } = setup();
    ['a', 'b', 'c', 'd', 'e'].forEach((u) => fail(limiter, 1, '1.1.1.1', `${u}@b.co`));
    expect(limiter.check('1.1.1.1', 'fresh@b.co').allowed).toBe(false);
    expect(limiter.check('2.2.2.2', 'fresh@b.co').allowed).toBe(true);
  });

  it('unblocks after the window expires', () => {
    const { limiter, advance } = setup();
    fail(limiter, 3);
    advance(WINDOW - 1);
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(false);
    advance(1);
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true);
  });

  it('starts a fresh window after expiry', () => {
    const { limiter, advance } = setup();
    fail(limiter, 2);
    advance(WINDOW);
    fail(limiter, 2);
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true);
  });

  it('recordSuccess clears the IP+email counter and refunds one per-IP attempt', () => {
    const { limiter } = setup({ maxFailuresPerEmail: 2, maxFailuresPerIp: 3 });
    fail(limiter, 2); // IP+email = 2 (blocked), IP = 2
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(false);

    fail(limiter, 1, '1.1.1.1', 'a@b.co'); // the successful attempt, counted up-front: IP = 3
    limiter.recordSuccess('1.1.1.1', 'a@b.co'); // IP back to 2

    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true);
    fail(limiter, 1, '1.1.1.1', 'x@b.co'); // IP = 3
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(false);
  });

  it('recordSuccess drops the per-IP entry when it reaches zero', () => {
    const { limiter } = setup();
    fail(limiter, 1);
    limiter.recordSuccess('1.1.1.1', 'a@b.co');
    expect(limiter.size).toBe(0);
  });

  it('sweeps expired entries once the map grows past the threshold', () => {
    let clock = 0;
    const limiter = new LoginRateLimiter({
      windowMs: WINDOW,
      maxFailuresPerEmail: 3,
      maxFailuresPerIp: 5,
      now: () => clock,
      sweepThreshold: 4,
    });
    limiter.recordFailure('1.1.1.1', 'a@b.co');
    limiter.recordFailure('2.2.2.2', 'a@b.co');
    expect(limiter.size).toBe(4);
    clock = WINDOW;
    limiter.recordFailure('3.3.3.3', 'a@b.co');
    expect(limiter.size).toBe(2);
  });
});
