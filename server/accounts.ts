import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { State, GameView } from './types';

export type Query = (
  sql: string,
  args?: (string | number | null)[],
) => Promise<Record<string, any>[]>;
export const opaque = () => randomBytes(32).toString('base64url');
export const digest = (s: string) =>
  createHash('sha256').update(s).digest('hex');
export type User = { id: string; name: string };
export class Accounts {
  constructor(private query: Query) {}
  async init() {
    for (const sql of [
      'CREATE TABLE IF NOT EXISTS synle_users (id TEXT PRIMARY KEY, google_sub TEXT UNIQUE NOT NULL, name TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS synle_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES synle_users(id), expires BIGINT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS synle_oauth (hash TEXT PRIMARY KEY, payload TEXT NOT NULL, expires BIGINT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS synle_plays (owner TEXT NOT NULL, challenge TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL, complete INTEGER NOT NULL, total INTEGER NOT NULL, date TEXT NOT NULL, number INTEGER NOT NULL, version TEXT NOT NULL, summary TEXT NOT NULL, PRIMARY KEY (owner,challenge))',
      'CREATE TABLE IF NOT EXISTS synle_guest_links (guest TEXT NOT NULL, challenge TEXT NOT NULL, owner TEXT NOT NULL, PRIMARY KEY (guest,challenge))',
      'CREATE INDEX IF NOT EXISTS synle_history ON synle_plays(owner,complete,date)',
    ])
      await this.query(sql);
  }
  async user(sub: string, name: string): Promise<User> {
    const [r] = await this.query(
      'INSERT INTO synle_users(id,google_sub,name) VALUES (?,?,?) ON CONFLICT(google_sub) DO UPDATE SET name=excluded.name RETURNING id,name',
      [randomUUID(), sub, name.slice(0, 80)],
    );
    return { id: r.id, name: r.name };
  }
  async session(user: User) {
    const token = opaque();
    await this.query('DELETE FROM synle_sessions WHERE expires < ?', [
      Date.now(),
    ]);
    await this.query(
      'INSERT INTO synle_sessions(hash,user_id,expires) VALUES (?,?,?)',
      [digest(token), user.id, Date.now() + 7 * 86400000],
    );
    return token;
  }
  async authenticate(token: string): Promise<User | null> {
    const [r] = await this.query(
      'SELECT u.id,u.name FROM synle_sessions s JOIN synle_users u ON s.user_id=u.id WHERE s.hash=? AND s.expires>?',
      [digest(token), Date.now()],
    );
    return r ? { id: r.id, name: r.name } : null;
  }
  async logout(token: string) {
    await this.query('DELETE FROM synle_sessions WHERE hash=?', [
      digest(token),
    ]);
  }
  async flow(payload: object) {
    const token = opaque();
    await this.query('DELETE FROM synle_oauth WHERE expires < ?', [Date.now()]);
    await this.query(
      'INSERT INTO synle_oauth(hash,payload,expires) VALUES (?,?,?)',
      [digest(token), JSON.stringify(payload), Date.now() + 600000],
    );
    return token;
  }
  async consumeFlow(token: string) {
    const [r] = await this.query(
      'DELETE FROM synle_oauth WHERE hash=? RETURNING payload,expires',
      [digest(token)],
    );
    return r && Number(r.expires) > Date.now() ? JSON.parse(r.payload) : null;
  }
  async owner(
    guest: string,
    user: User | null,
    challenge: string,
  ): Promise<string> {
    if (user) {
      const owner = `u:${user.id}`;
      await this.query(
        'INSERT INTO synle_guest_links(guest,challenge,owner) VALUES (?,?,?) ON CONFLICT(guest,challenge) DO UPDATE SET owner=excluded.owner',
        [guest, challenge, owner],
      );
      return owner;
    }
    const [link] = await this.query(
      'SELECT owner FROM synle_guest_links WHERE guest=? AND challenge=?',
      [guest, challenge],
    );
    return link?.owner ?? `g:${guest}`;
  }
  async load(owner: string, challenge: string): Promise<State | null> {
    const [r] = await this.query(
      'SELECT state FROM synle_plays WHERE owner=? AND challenge=?',
      [owner, challenge],
    );
    return r ? JSON.parse(r.state) : null;
  }
  async create(owner: string, state: State, game: GameView) {
    await this.query(
      'INSERT INTO synle_plays(owner,challenge,state,revision,complete,total,date,number,version,summary) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,challenge) DO NOTHING',
      [
        owner,
        state.challengeId,
        JSON.stringify(state),
        state.revision,
        Number(game.complete),
        game.total,
        game.date,
        game.number,
        state.version,
        JSON.stringify(
          game.rounds.map((r) => ({ word: r.word, score: r.score })),
        ),
      ],
    );
    return (await this.load(owner, state.challengeId))!;
  }
  async save(owner: string, previous: State, state: State, game: GameView) {
    const rows = await this.query(
      'UPDATE synle_plays SET state=?,revision=?,complete=?,total=?,summary=? WHERE owner=? AND challenge=? AND revision=? RETURNING revision',
      [
        JSON.stringify(state),
        state.revision,
        Number(game.complete),
        game.total,
        JSON.stringify(
          game.rounds.map((r) => ({ word: r.word, score: r.score })),
        ),
        owner,
        state.challengeId,
        previous.revision,
      ],
    );
    return rows.length === 1;
  }
  // First account game wins. Login never replaces an existing account game with a guest replay.
  async attach(guest: string, user: User) {
    const owner = `u:${user.id}`;
    const plays = await this.query('SELECT * FROM synle_plays WHERE owner=?', [
      `g:${guest}`,
    ]);
    for (const p of plays) {
      const state = JSON.parse(p.state);
      state.owner = owner;
      await this.query(
        'INSERT INTO synle_plays(owner,challenge,state,revision,complete,total,date,number,version,summary) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,challenge) DO NOTHING',
        [
          owner,
          p.challenge,
          JSON.stringify(state),
          p.revision,
          p.complete,
          p.total,
          p.date,
          p.number,
          p.version,
          p.summary,
        ],
      );
      await this.query(
        'INSERT INTO synle_guest_links(guest,challenge,owner) VALUES (?,?,?) ON CONFLICT(guest,challenge) DO UPDATE SET owner=excluded.owner',
        [guest, p.challenge, owner],
      );
    }
    // Link existing account challenges to this browser even when it had no guest game.
    const existing = await this.query(
      'SELECT challenge FROM synle_plays WHERE owner=?',
      [owner],
    );
    for (const p of existing)
      await this.query(
        'INSERT INTO synle_guest_links(guest,challenge,owner) VALUES (?,?,?) ON CONFLICT(guest,challenge) DO UPDATE SET owner=excluded.owner',
        [guest, p.challenge, owner],
      );
  }
  async history(user: User, offset: number) {
    const owner = `u:${user.id}`;
    const rows = await this.query(
      'SELECT challenge,date,number,version,total,summary FROM synle_plays WHERE owner=? AND complete=1 ORDER BY date DESC LIMIT 31 OFFSET ?',
      [owner, offset],
    );
    const [stats] = await this.query(
      'SELECT COUNT(*) AS days,COALESCE(MAX(total),0) AS best FROM synle_plays WHERE owner=? AND complete=1',
      [owner],
    );
    return {
      entries: rows
        .slice(0, 30)
        .map((r) => ({
          challengeId: r.challenge,
          date: r.date,
          number: r.number,
          version: r.version,
          total: r.total,
          rounds: JSON.parse(r.summary),
        })),
      hasMore: rows.length > 30,
      days: Number(stats.days),
      best: Number(stats.best),
    };
  }
}
