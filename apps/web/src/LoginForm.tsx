import { useState, type FormEvent } from 'react';
import { validateLoginRequest, type User } from '@login-lab/shared';
import { login } from './api/auth';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const parsed = validateLoginRequest({ email, password });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    setPending(true);
    const result = await login(parsed.data);
    setPending(false);

    if (result.ok) {
      onLogin(result.data);
    } else {
      setError(result.error);
      setPassword('');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Memproses…' : 'Masuk'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
