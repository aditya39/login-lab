import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import { AUTH_ERRORS, type ApiResponse, type HealthStatus } from '@login-lab/shared';
import { createAuthRouter, type AuthDeps } from './auth/routes';

export interface AppDeps extends AuthDeps {
  config: AuthDeps['config'] & { trustProxy?: boolean | number | string };
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ ok: false, error: AUTH_ERRORS.invalidRequest } satisfies ApiResponse<never>);
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ ok: false, error: AUTH_ERRORS.invalidRequest } satisfies ApiResponse<never>);
    return;
  }
  console.error(err);
  res.status(500).json({ ok: false, error: 'Terjadi kesalahan pada server' } satisfies ApiResponse<never>);
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  // Only honour X-Forwarded-For when explicitly configured; otherwise clients could spoof their IP.
  app.set('trust proxy', deps.config.trustProxy ?? false);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    const body: ApiResponse<HealthStatus> = {
      ok: true,
      data: { status: 'ok', uptime: process.uptime() },
    };
    res.json(body);
  });

  app.use('/api/auth', createAuthRouter(deps));
  app.use(errorHandler);

  return app;
}
