import { randomBytes } from 'node:crypto';

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}

export interface SessionStore {
  create(userId: string): Session;
  get(id: string): Session | undefined;
  delete(id: string): void;
}

export interface InMemorySessionStoreOptions {
  ttlMs: number;
  now?: () => number;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({ ttlMs, now = Date.now }: InMemorySessionStoreOptions) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  create(userId: string): Session {
    const session: Session = {
      id: randomBytes(32).toString('base64url'),
      userId,
      expiresAt: this.now() + this.ttlMs,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }
}
