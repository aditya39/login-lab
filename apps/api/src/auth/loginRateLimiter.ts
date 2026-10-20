import type { LoginLimitConfig } from '../config';

interface Counter {
  failures: number;
  resetAt: number;
}

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface LoginRateLimiterOptions extends LoginLimitConfig {
  now?: () => number;
  /** Expired entries are swept once the map grows beyond this size. */
  sweepThreshold?: number;
}

/**
 * Fixed-window counter of FAILED logins, keyed per IP+email and per IP.
 * Unknown emails are counted exactly like known ones so lockouts reveal nothing.
 */
export class LoginRateLimiter {
  private readonly counters = new Map<string, Counter>();
  private readonly options: Required<Omit<LoginRateLimiterOptions, keyof LoginLimitConfig>> &
    LoginLimitConfig;

  constructor({ now = Date.now, sweepThreshold = 10_000, ...limits }: LoginRateLimiterOptions) {
    this.options = { now, sweepThreshold, ...limits };
  }

  check(ip: string, email: string): LimitResult {
    const now = this.options.now();
    const blockedUntil = Math.max(
      this.blockedUntil(emailKey(ip, email), this.options.maxFailuresPerEmail, now),
      this.blockedUntil(ipKey(ip), this.options.maxFailuresPerIp, now),
    );
    if (blockedUntil === 0) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)) };
  }

  recordFailure(ip: string, email: string): void {
    const now = this.options.now();
    this.increment(emailKey(ip, email), now);
    this.increment(ipKey(ip), now);
    if (this.counters.size > this.options.sweepThreshold) this.sweep(now);
  }

  /**
   * Called after a successful login whose attempt was already counted via recordFailure:
   * clears the IP+email counter and refunds that one attempt from the per-IP counter.
   */
  recordSuccess(ip: string, email: string): void {
    this.counters.delete(emailKey(ip, email));
    const counter = this.counters.get(ipKey(ip));
    if (counter && --counter.failures <= 0) this.counters.delete(ipKey(ip));
  }

  get size(): number {
    return this.counters.size;
  }

  private blockedUntil(key: string, max: number, now: number): number {
    const counter = this.live(key, now);
    return counter && counter.failures >= max ? counter.resetAt : 0;
  }

  private increment(key: string, now: number): void {
    const counter = this.live(key, now);
    if (counter) {
      counter.failures += 1;
    } else {
      this.counters.set(key, { failures: 1, resetAt: now + this.options.windowMs });
    }
  }

  private live(key: string, now: number): Counter | undefined {
    const counter = this.counters.get(key);
    if (counter && counter.resetAt <= now) {
      this.counters.delete(key);
      return undefined;
    }
    return counter;
  }

  private sweep(now: number): void {
    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) this.counters.delete(key);
    }
  }
}

function emailKey(ip: string, email: string) {
  return `ip+email:${ip}\u0000${email}`;
}

function ipKey(ip: string) {
  return `ip:${ip}`;
}
