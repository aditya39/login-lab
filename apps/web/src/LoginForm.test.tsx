import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_ERRORS } from '@login-lab/shared';
import { LoginForm } from './LoginForm';
import { jsonResponse, mockFetch } from './testUtils';

const ALICE = { id: 'u1', email: 'alice@example.com', name: 'Alice' };

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
}

describe('LoginForm', () => {
  it('posts normalized credentials and reports the user', async () => {
    const fetchMock = mockFetch({
      'POST /api/auth/login': async () => jsonResponse(200, { ok: true, data: ALICE }),
    });
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    fill(' Alice@Example.com ', 'secret');

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(ALICE));
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'alice@example.com', password: 'secret' });
  });

  it('uses a masked password field', () => {
    render(<LoginForm onLogin={vi.fn()} />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('shows the server error and clears the password on 401', async () => {
    mockFetch({
      'POST /api/auth/login': async () =>
        jsonResponse(401, { ok: false, error: AUTH_ERRORS.invalidCredentials }),
    });
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    fill('alice@example.com', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH_ERRORS.invalidCredentials);
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('alice@example.com');
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('shows the lockout message on 429', async () => {
    mockFetch({
      'POST /api/auth/login': async () =>
        jsonResponse(429, { ok: false, error: AUTH_ERRORS.tooManyAttempts }),
    });
    render(<LoginForm onLogin={vi.fn()} />);

    fill('alice@example.com', 'secret');

    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH_ERRORS.tooManyAttempts);
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it.each([
    ['', 'secret', AUTH_ERRORS.emailRequired],
    ['nope', 'secret', AUTH_ERRORS.emailInvalid],
    ['alice@example.com', '', AUTH_ERRORS.passwordRequired],
  ])('validates %j / %j without calling the API', (email, password, error) => {
    const fetchMock = mockFetch({});
    render(<LoginForm onLogin={vi.fn()} />);

    fill(email, password);

    expect(screen.getByRole('alert')).toHaveTextContent(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables the button while the request is pending', async () => {
    let resolve!: (res: Response) => void;
    const fetchMock = mockFetch({
      'POST /api/auth/login': () => new Promise((r) => (resolve = r)),
    });
    render(<LoginForm onLogin={vi.fn()} />);

    fill('alice@example.com', 'secret');

    const button = await screen.findByRole('button', { name: 'Memproses…' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve(jsonResponse(200, { ok: true, data: ALICE }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled());
  });

  it('shows a friendly message on network failure', async () => {
    mockFetch({
      'POST /api/auth/login': async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<LoginForm onLogin={vi.fn()} />);

    fill('alice@example.com', 'secret');

    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH_ERRORS.network);
  });
});
