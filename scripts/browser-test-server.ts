// Test-only launcher, never imported by the production server. No test login route.
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { openStorage } from '../server/storage';
if (process.env.SYNLE_BROWSER_TEST !== 'yes')
  throw new Error('This launcher is only for isolated browser tests.');
mkdirSync('test-results', { recursive: true });
process.env.SQLITE_PATH = resolve(`test-results/browser-${randomUUID()}.db`);
process.env.DATABASE_URL = '';
const storage = await openStorage();
const user = await storage.accounts.user(
  'browser-test-fixture',
  'Test explorer',
);
const session = await storage.accounts.session(user);
await storage.close();
writeFileSync(
  'test-results/browser-auth.json',
  JSON.stringify({
    cookies: [
      {
        name: 'synle_session',
        value: session,
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  }),
  { mode: 0o600 },
);
await import('../server/index');
