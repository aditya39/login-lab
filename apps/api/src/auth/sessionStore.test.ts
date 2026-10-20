import { describe, expect, it } from 'vitest';
import { InMemorySessionStore } from './sessionStore';

describe('InMemorySessionStore', () => {
  it('creates, gets and deletes sessions', () => {
    const store = new InMemorySessionStore({ ttlMs: 1000, now: () => 0 });
    const session = store.create('u1');
    expect(store.get(session.id)).toEqual({ id: session.id, userId: 'u1', expiresAt: 1000 });
    store.delete(session.id);
    expect(store.get(session.id)).toBeUndefined();
  });

  it('expires sessions after the TTL', () => {
    let clock = 0;
    const store = new InMemorySessionStore({ ttlMs: 1000, now: () => clock });
    const session = store.create('u1');
    clock = 999;
    expect(store.get(session.id)).toBeDefined();
    clock = 1000;
    expect(store.get(session.id)).toBeUndefined();
    clock = 0; // expired entry was evicted, not just hidden
    expect(store.get(session.id)).toBeUndefined();
  });

  it('generates unique 256-bit base64url IDs', () => {
    const store = new InMemorySessionStore({ ttlMs: 1000 });
    const ids = new Set(Array.from({ length: 100 }, () => store.create('u').id));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('returns undefined for unknown IDs', () => {
    expect(new InMemorySessionStore({ ttlMs: 1000 }).get('nope')).toBeUndefined();
  });
});
