import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { openStorage } from '../server/storage';
import { banks, fresh, getChallenge, view } from '../server/game';
import type { GameView } from '../server/types';
const folder = mkdtempSync(join(tmpdir(), 'synle-accounts-'));
const path = join(folder, 'test.db');
const secret = 'account-tests-stable-secret-32-characters';
let child: ChildProcess, sessionA: string, sessionB: string;
const base = 'http://127.0.0.1:3196';
class Client {
  jar = new Map<string, string>();
  constructor(session?: string) {
    if (session) this.jar.set('synle_session', session);
  }
  async request(path: string, body?: unknown) {
    const r = await fetch(base + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: [...this.jar].map(([k, v]) => k + '=' + v).join(';'),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    for (const header of r.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const i = pair.indexOf('=');
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return {
      status: r.status,
      data: r.headers.get('content-type')?.includes('application/json')
        ? await r.json()
        : null,
      headers: r.headers,
    };
  }
}
before(async () => {
  process.env.SQLITE_PATH = path;
  process.env.DATABASE_URL = '';
  process.env.SESSION_SECRET = secret;
  const storage = await openStorage();
  const a = await storage.accounts.user('test-google-a', 'Alice');
  const b = await storage.accounts.user('test-google-b', 'Bob');
  sessionA = await storage.accounts.session(a);
  sessionB = await storage.accounts.session(b);
  await storage.close();
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      PORT: '3196',
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: 'test-id',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      PUBLIC_URL: base,
    },
    stdio: 'pipe',
  });
  let log = '';
  child.stderr?.on('data', (b) => (log += b));
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(log);
    try {
      if ((await fetch(base + '/api/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(log);
});
after(async () => {
  if (child) {
    child.kill('SIGTERM');
    await new Promise<void>((r) => child.once('exit', () => r()));
  }
  rmSync(folder, { recursive: true, force: true });
});
test('history requires a valid session and ignores caller-supplied user identity', async () => {
  const guest = new Client();
  assert.equal((await guest.request('history')).status, 401);
  const a = new Client(sessionA);
  const me = await a.request('auth/me');
  assert.equal(me.data.user.name, 'Alice');
  const h = await a.request('history?user=someone-else');
  assert.equal(h.status, 200);
  assert.equal(h.data.days, 0);
  assert.equal((await a.request('history?offset=-1')).status, 400);
  const invalid = new Client('expired-session-token-xxxxxxxxxxxx');
  assert.equal((await invalid.request('history')).status, 401);
});
test('OAuth uses one-use state, nonce and PKCE; cancellation keeps guest play intact', async () => {
  const guest = new Client();
  const start = await guest.request('auth/google');
  assert.equal(start.status, 302);
  const url = new URL(start.headers.get('location')!);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('nonce'));
  assert.equal(url.searchParams.get('scope'), 'openid profile');
  const state = url.searchParams.get('state')!;
  const cancelled = await guest.request(
    'auth/callback?error=access_denied&state=' + state,
  );
  assert.match(cancelled.headers.get('location')!, /auth=cancelled/);
  const replay = await guest.request('auth/callback?code=fake&state=' + state);
  assert.match(replay.headers.get('location')!, /auth=expired/);
  assert.equal((await guest.request('start', { mode: 'demo' })).status, 401);
});
test('daily games cannot restart, replay stale revisions, cross accounts, or count demos in history', async (t) => {
  const a = new Client(sessionA),
    b = new Client(sessionB);
  if (!(await a.request('challenge')).data.available) {
    t.skip('No daily scheduled for current date');
    return;
  }
  let game: GameView = (await a.request('start', { mode: 'daily' })).data.game;
  const original = game.token;
  const outcomes = await Promise.all([
    a.request('answer', { token: original, answer: 'potato' }),
    a.request('answer', { token: original, answer: 'banana' }),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  game = outcomes.find((r) => r.status === 200)!.data.game;
  assert.equal(
    (await a.request('start', { mode: 'daily' })).data.game.revision,
    1,
  );
  assert.equal((await b.request('restore', { token: game.token })).status, 403);
  assert.equal((await a.request('end-round', { token: original })).status, 409);
  const prompt = banks
    .get('v2')!
    .prompts.find((p) => p.word === game.rounds[0].word)!;
  const accepted = await a.request('answer', {
    token: game.token,
    answer: prompt.answers[0].text,
    total: 900,
  });
  assert.equal(accepted.status, 200);
  game = accepted.data.game;
  const expected = prompt.answers[0].points;
  for (let i = 0; i < 3; i++) {
    const r = await a.request('end-round', { token: game.token });
    assert.equal(r.status, 200);
    game = r.data.game;
  }
  assert.equal(game.complete, true);
  assert.equal(game.total, expected);
  const h = await a.request('history');
  assert.equal(h.data.days, 1);
  assert.equal(h.data.best, expected);
  assert.equal(h.data.entries[0].total, expected);
  assert.equal(h.data.entries[0].rounds.length, 3);
  assert.ok(h.data.entries[0].version);
  assert.equal((await b.request('history')).data.days, 0);
  assert.equal(
    (await a.request('start', { mode: 'daily' })).data.game.complete,
    true,
  );
  const demo = (await a.request('start', { mode: 'demo' })).data.game;
  await a.request('end-round', { token: demo.token });
  assert.equal((await a.request('history')).data.days, 1);
  assert.equal((await a.request('auth/logout', {})).status, 200);
  assert.equal((await a.request('history')).status, 401);
  assert.equal(
    (await a.request('start', { mode: 'daily' })).data.game.complete,
    true,
    'logout must not grant another daily game',
  );
});
test('guest migration preserves canonical account game and session revocation is persistent', async () => {
  const db = await openStorage();
  try {
    const user = await db.accounts.user('test-merge', 'Merge');
    // Use a real scheduled challenge when available; demo state suffices for storage-only tests.
    const state = fresh(getChallenge('demo')!, 'demo');
    state.challengeId = 'demo-v2';
    const game = view(state, secret);
    await db.accounts.create('g:merge-guest', state, game);
    const existing = { ...state, revision: 7 };
    await db.accounts.create('u:' + user.id, existing, game);
    await db.accounts.attach('merge-guest', user);
    assert.equal(
      (await db.accounts.load('u:' + user.id, state.challengeId))?.revision,
      7,
    );
    const newUser = await db.accounts.user('test-first-merge', 'First merge');
    await db.accounts.create('g:new-guest', state, game);
    await db.accounts.attach('new-guest', newUser);
    assert.equal(
      (await db.accounts.load('u:' + newUser.id, state.challengeId))?.owner,
      'u:' + newUser.id,
    );
    assert.equal(
      await db.accounts.owner('merge-guest', null, state.challengeId),
      'u:' + user.id,
    );
    const token = await db.accounts.session(user);
    assert.ok(await db.accounts.authenticate(token));
    await db.accounts.logout(token);
    assert.equal(await db.accounts.authenticate(token), null);
  } finally {
    await db.close();
  }
});

test('database write failure is recoverable and does not consume a daily attempt', async (t) => {
  if (!getChallenge('daily')) {
    t.skip('No daily scheduled');
    return;
  }
  const db = await openStorage();
  const user = await db.accounts.user('failure-test', 'Failure test');
  const session = await db.accounts.session(user);
  await db.close();
  const client = new Client(session);
  const initial = (await client.request('start', { mode: 'daily' })).data
    .game as GameView;
  const { DatabaseSync } = await import('node:sqlite');
  const lock = new DatabaseSync(path);
  lock.exec('BEGIN IMMEDIATE');
  try {
    assert.equal(
      (
        await client.request('answer', {
          token: initial.token,
          answer: 'potato',
        })
      ).status,
      503,
    );
  } finally {
    lock.exec('ROLLBACK');
    lock.close();
  }
  const restored = await client.request('restore', { token: initial.token });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.game.revision, initial.revision);
  assert.equal(
    (await client.request('answer', { token: initial.token, answer: 'potato' }))
      .status,
    200,
  );
});
