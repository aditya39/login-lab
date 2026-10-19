import { useState, type FormEvent } from 'react';
import { isValidEmail } from '@login-lab/shared';

export function App() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(isValidEmail(email) ? null : 'Email tidak valid');
  }

  return (
    <main>
      <h1>Login Lab</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">Masuk</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
