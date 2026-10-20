import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('uses defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      sessionTtlMs: 60 * 60 * 1000,
      isProduction: false,
      secureCookie: false,
      loginLimit: { windowMs: 15 * 60 * 1000, maxFailuresPerEmail: 5, maxFailuresPerIp: 20 },
      trustProxy: false,
    });
  });

  it('reads values and enables secure cookies in production', () => {
    expect(
      loadConfig({
        PORT: '4000',
        SESSION_TTL_MINUTES: '5',
        NODE_ENV: 'production',
        LOGIN_LOCK_WINDOW_MINUTES: '1',
        LOGIN_MAX_FAILURES_PER_EMAIL: '3',
        LOGIN_MAX_FAILURES_PER_IP: '10',
        TRUST_PROXY: '1',
      }),
    ).toEqual({
      port: 4000,
      sessionTtlMs: 5 * 60 * 1000,
      isProduction: true,
      secureCookie: true,
      loginLimit: { windowMs: 60 * 1000, maxFailuresPerEmail: 3, maxFailuresPerIp: 10 },
      trustProxy: 1,
    });
  });

  it.each(['abc', '-1', '0', ''])('falls back on invalid SESSION_TTL_MINUTES %j', (value) => {
    expect(loadConfig({ SESSION_TTL_MINUTES: value }).sessionTtlMs).toBe(60 * 60 * 1000);
  });

  it.each(['abc', '0', '2.5', '-3'])('falls back on invalid failure limits %j', (value) => {
    const { loginLimit } = loadConfig({
      LOGIN_MAX_FAILURES_PER_EMAIL: value,
      LOGIN_MAX_FAILURES_PER_IP: value,
    });
    expect(loginLimit.maxFailuresPerEmail).toBe(5);
    expect(loginLimit.maxFailuresPerIp).toBe(20);
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
    ['2', 2],
    ['loopback', 'loopback'],
  ])('parses TRUST_PROXY %j', (value, expected) => {
    expect(loadConfig({ TRUST_PROXY: value }).trustProxy).toBe(expected);
  });
});
