import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Isolated local audit server: never uses the production database or OAuth credentials.
const port = 3194;
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    SESSION_SECRET: 'lighthouse-local-audit-secret-at-least-32-chars',
    DATABASE_URL: '',
    SQLITE_PATH: ':memory:',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
  },
  stdio: 'ignore',
});
let chrome;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready)
    throw new Error('Audit server did not start. Build the project first.');
  chrome = await launch({
    chromePath: process.env.BROWSER_PATH || '/usr/bin/brave-browser',
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  await mkdir('test-results/lighthouse', { recursive: true });
  const summary = [];
  for (const [name, path] of [
    ['home', '/'],
    ['about', '/about'],
    ['login', '/login'],
    ['history', '/history'],
    ['demo', '/demo'],
  ]) {
    const result = await lighthouse(`http://localhost:${port}${path}`, {
      port: chrome.port,
      output: ['html', 'json'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    await writeFile(`test-results/lighthouse/${name}.html`, result.report[0]);
    await writeFile(`test-results/lighthouse/${name}.json`, result.report[1]);
    const row = {
      page: name,
      ...Object.fromEntries(
        Object.entries(result.lhr.categories).map(([k, v]) => [
          k,
          Math.round(v.score * 100),
        ]),
      ),
    };
    summary.push(row);
    console.log(row);
  }
  await writeFile(
    'test-results/lighthouse/summary.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        lighthouseVersion: summary.length
          ? JSON.parse(
              await (
                await import('node:fs/promises')
              ).readFile('test-results/lighthouse/home.json', 'utf8'),
            ).lighthouseVersion
          : null,
        results: summary,
      },
      null,
      2,
    ),
  );
} finally {
  await chrome?.kill();
  server.kill('SIGTERM');
}
