import { randomUUID } from 'node:crypto';
import { createApp } from './app';
import { LoginRateLimiter } from './auth/loginRateLimiter';
import { hashPassword } from './auth/password';
import { InMemorySessionStore } from './auth/sessionStore';
import { InMemoryUserStore } from './auth/userStore';
import { loadConfig } from './config';

const config = loadConfig();
const users = new InMemoryUserStore();
const sessions = new InMemorySessionStore({ ttlMs: config.sessionTtlMs });
const loginLimiter = new LoginRateLimiter(config.loginLimit);

const seedEmail = process.env.SEED_USER_EMAIL;
const seedPassword = process.env.SEED_USER_PASSWORD;

if (config.isProduction) {
  console.warn('Production mode: seed user disabled; in-memory user store is empty.');
} else if (seedEmail && seedPassword) {
  users.add({
    id: randomUUID(),
    email: seedEmail,
    name: seedEmail.split('@')[0],
    passwordHash: await hashPassword(seedPassword),
  });
  console.log(`Seeded dev user: ${seedEmail}`);
} else {
  console.warn('SEED_USER_EMAIL / SEED_USER_PASSWORD not set; no users can log in.');
}

createApp({ users, sessions, loginLimiter, config }).listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
