import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AUTH_ERRORS } from '@login-lab/shared';
import { App } from './App';
import { jsonResponse, mockFetch } from './testUtils';

const ALICE = { id: 'u1', email: 'alice@example.com', name: 'Alice' };
const unauthenticated = async () =>
  jsonResponse(401, { ok: false, error: AUTH_ERRORS.unauthenticated });

describe('App', () => {
  it('shows the login form when not signed in', async () => {
    mockFetch({ 'GET /api/auth/me': unauthenticated });
    render(<App />);

    expect(screen.getByText('Memuat…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  });

  it('shows the user when a session exists', async () => {
    mockFetch({ 'GET /api/auth/me': async () => jsonResponse(200, { ok: true, data: ALICE }) });
    render(<App />);

    expect(await screen.findByText('Halo, Alice')).toBeInTheDocument();
  });

  it('falls back to the login form if /me cannot be reached', async () => {
    mockFetch({
      'GET /api/auth/me': async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);

    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  });

  it('logs in and then logs out', async () => {
    const fetchMock = mockFetch({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/login': async () => jsonResponse(200, { ok: true, data: ALICE }),
      'POST /api/auth/logout': async () => new Response(null, { status: 204 }),
    });
    render(<App />);

    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: ALICE.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Keluar' }));

    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)).toEqual([
      'GET /api/auth/me',
      'POST /api/auth/login',
      'POST /api/auth/logout',
    ]);
  });
});
