import { useEffect, useState } from 'react';
import type { User } from '@login-lab/shared';
import { logout, me } from './api/auth';
import { LoginForm } from './LoginForm';

export function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    me().then((result) => {
      if (cancelled) return;
      setUser(result.ok ? result.data : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  return (
    <main>
      <h1>Login Lab</h1>
      {loading ? (
        <p>Memuat…</p>
      ) : user ? (
        <section>
          <p>Halo, {user.name}</p>
          <button type="button" onClick={handleLogout}>
            Keluar
          </button>
        </section>
      ) : (
        <LoginForm onLogin={setUser} />
      )}
    </main>
  );
}
