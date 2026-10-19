import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const app = createApp();

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, data: { status: 'ok' } });
  });
});

describe('POST /login', () => {
  it('returns the user for valid input', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'alice@example.com', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: { id: '1', email: 'alice@example.com', name: 'alice' },
    });
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'not-an-email', password: 'secret' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
