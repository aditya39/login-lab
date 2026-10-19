import express from 'express';
import {
  isValidEmail,
  type ApiResponse,
  type HealthStatus,
  type LoginRequest,
  type User,
} from '@login-lab/shared';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    const body: ApiResponse<HealthStatus> = {
      ok: true,
      data: { status: 'ok', uptime: process.uptime() },
    };
    res.json(body);
  });

  app.post('/login', (req, res) => {
    const { email, password } = (req.body ?? {}) as Partial<LoginRequest>;

    if (!email || !isValidEmail(email) || !password) {
      const body: ApiResponse<User> = { ok: false, error: 'Invalid email or password' };
      res.status(400).json(body);
      return;
    }

    // Placeholder: replace with real credential verification.
    const body: ApiResponse<User> = {
      ok: true,
      data: { id: '1', email, name: email.split('@')[0] },
    };
    res.json(body);
  });

  return app;
}
