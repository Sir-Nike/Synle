import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { Accounts, type Query } from './accounts';

export interface Storage {
  accounts: Accounts;
  secret(): Promise<string>;
  report(challenge: string, word: string, answer: string): Promise<void>;
  event(challenge: string, event: string, eventId: string): Promise<void>;
  close(): Promise<void>;
}

export async function openStorage(): Promise<Storage> {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
    await pool.query(
      'CREATE TABLE IF NOT EXISTS synle_reports (id BIGSERIAL PRIMARY KEY, challenge TEXT NOT NULL, word TEXT NOT NULL, answer TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()); CREATE TABLE IF NOT EXISTS synle_events (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, event TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
    );
    const query: Query = async (sql, args = []) => {
      let i = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++i}`),
          args,
        )
      ).rows;
    };
    const accounts = new Accounts(query);
    await accounts.init();
    return {
      accounts,
      secret: async () => process.env.SESSION_SECRET!,
      report: async (c, w, a) => {
        await pool.query(
          'INSERT INTO synle_reports (challenge,word,answer) VALUES ($1,$2,$3)',
          [c, w, a],
        );
      },
      event: async (c, e, id) => {
        await pool.query(
          'INSERT INTO synle_events (id,challenge,event) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [id, c, e],
        );
      },
      close: () => pool.end(),
    };
  }
  const { DatabaseSync } = await import('node:sqlite');
  const path = process.env.SQLITE_PATH || 'data/synle.db';
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY,challenge TEXT,word TEXT,answer TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,challenge TEXT,event TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
  );
  const query: Query = async (sql, args = []) =>
    db.prepare(sql).all(...args) as Record<string, any>[];
  const accounts = new Accounts(query);
  await accounts.init();
  return {
    accounts,
    secret: async () => {
      if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
      const existing = db
        .prepare("SELECT value FROM settings WHERE key='secret'")
        .get() as { value: string } | undefined;
      if (existing) return existing.value;
      const secret = randomBytes(32).toString('hex');
      db.prepare("INSERT INTO settings (key,value) VALUES ('secret',?)").run(
        secret,
      );
      return secret;
    },
    report: async (c, w, a) => {
      db.prepare(
        'INSERT INTO reports (challenge,word,answer) VALUES (?,?,?)',
      ).run(c, w, a);
    },
    event: async (c, e, id) => {
      db.prepare(
        'INSERT OR IGNORE INTO events (id,challenge,event) VALUES (?,?,?)',
      ).run(id, c, e);
    },
    close: async () => {
      db.close();
    },
  };
}
