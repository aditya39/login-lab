import { describe, expect, it } from 'vitest';
import { getDummyHash, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the original password', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    await expect(verifyPassword('correct horse', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse');
    await expect(verifyPassword('wrong horse', hash)).resolves.toBe(false);
  });

  it('salts each hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  });

  it.each([
    '',
    'plain-text',
    'bcrypt$1$2$3$4$5',
    'scrypt$abc$8$1$c2FsdA==$aGFzaA==',
    'scrypt$1000$8$1$c2FsdA==$aGFzaA==', // N not a power of two
    `scrypt$${2 ** 30}$8$1$c2FsdA==$aGFzaA==`, // N too large
    'scrypt$16384$8$1$$aGFzaA==', // empty salt
    'scrypt$16384$8$1$c2FsdA==$aGFzaA==', // wrong key length
  ])('returns false for malformed hash %j', async (stored) => {
    await expect(verifyPassword('anything', stored)).resolves.toBe(false);
  });

  it('dummy hash is stable and never matches an empty password', async () => {
    const dummy = await getDummyHash();
    expect(await getDummyHash()).toBe(dummy);
    await expect(verifyPassword('', dummy)).resolves.toBe(false);
  });
});
