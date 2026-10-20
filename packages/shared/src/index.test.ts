import { describe, expect, it } from 'vitest';
import {
  AUTH_ERRORS,
  PASSWORD_MAX_LENGTH,
  isValidEmail,
  normalizeEmail,
  validateLoginRequest,
} from './index';

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

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Dev@Example.COM ')).toBe('dev@example.com');
  });
});

describe('validateLoginRequest', () => {
  it('accepts valid input and normalizes the email', () => {
    expect(validateLoginRequest({ email: ' Dev@Example.com ', password: ' secret ' })).toEqual({
      ok: true,
      data: { email: 'dev@example.com', password: ' secret ' },
    });
  });

  it.each([null, undefined, 'str', 42, []])('rejects non-object input %j', (input) => {
    expect(validateLoginRequest(input)).toEqual({ ok: false, error: AUTH_ERRORS.invalidRequest });
  });

  it.each([{}, { email: '' }, { email: '   ' }, { email: 123 }])(
    'requires email: %j',
    (input) => {
      expect(validateLoginRequest({ password: 'x', ...input })).toEqual({
        ok: false,
        error: AUTH_ERRORS.emailRequired,
      });
    },
  );

  it('rejects a malformed email', () => {
    expect(validateLoginRequest({ email: 'nope', password: 'x' })).toEqual({
      ok: false,
      error: AUTH_ERRORS.emailInvalid,
    });
  });

  it('rejects an overly long email', () => {
    const email = `${'a'.repeat(250)}@example.com`;
    expect(validateLoginRequest({ email, password: 'x' })).toEqual({
      ok: false,
      error: AUTH_ERRORS.emailInvalid,
    });
  });

  it.each([undefined, '', 123])('requires password: %j', (password) => {
    expect(validateLoginRequest({ email: 'a@b.co', password })).toEqual({
      ok: false,
      error: AUTH_ERRORS.passwordRequired,
    });
  });

  it('rejects a password over the max length', () => {
    const password = 'x'.repeat(PASSWORD_MAX_LENGTH + 1);
    expect(validateLoginRequest({ email: 'a@b.co', password })).toEqual({
      ok: false,
      error: AUTH_ERRORS.passwordTooLong,
    });
  });

  it('accepts a password at exactly the max length', () => {
    const password = 'x'.repeat(PASSWORD_MAX_LENGTH);
    expect(validateLoginRequest({ email: 'a@b.co', password }).ok).toBe(true);
  });
});
