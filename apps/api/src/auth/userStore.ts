import { normalizeEmail, type User } from '@login-lab/shared';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface UserStore {
  findByEmail(email: string): StoredUser | undefined;
  findById(id: string): StoredUser | undefined;
}

export class InMemoryUserStore implements UserStore {
  private readonly byId = new Map<string, StoredUser>();

  add(user: StoredUser): void {
    this.byId.set(user.id, { ...user, email: normalizeEmail(user.email) });
  }

  remove(id: string): void {
    this.byId.delete(id);
  }

  findByEmail(email: string): StoredUser | undefined {
    const target = normalizeEmail(email);
    for (const user of this.byId.values()) {
      if (user.email === target) return user;
    }
    return undefined;
  }

  findById(id: string): StoredUser | undefined {
    return this.byId.get(id);
  }
}

export function toPublicUser({ id, email, name }: StoredUser): User {
  return { id, email, name };
}
