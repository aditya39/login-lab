import { describe, expect, it } from 'vitest';
import { isValidEmail } from './index';

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it.each(['', 'user', 'user@', '@example.com', 'a b@example.com'])(
    'rejects %j',
    (input) => {
      expect(isValidEmail(input)).toBe(false);
    },
  );
});
