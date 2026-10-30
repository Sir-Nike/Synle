import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Filter } from 'bad-words';
import { getChallenge, fresh, nextReset, readToken, view, submit, endRound, today, currentIndex, promptsFor, challengeForState, normalise } from './game';
import { openStorage } from './storage';

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error('Set a stable SESSION_SECRET of at least 32 characters before production startup.');
if (process.env.DATABASE_URL && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required with PostgreSQL.');
const storage = await openStorage(), secret = await storage.secret();
const app = express(), filter = new Filter();
// Render terminates TLS at its reverse proxy. Do not trust arbitrary forwarded IPs.
if (process.env.RENDER) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
app.use('/api', express.json({ limit: '12kb' }), (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', rateLimit({ windowMs: 60000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Wait a minute and try again.' } }));
app.use('/api', (req, res, next) => {
 if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}` && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(req.headers.origin))) { res.status(403).json({ error: 'This request must come from Synle.' }); return; }
 next();
});
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/challenge', (_req, res) => {
 const c = getChallenge('daily'); res.json({ available: !!c, date: today(), number: c?.number, challengeId: c?.id, nextReset: nextReset() });
});
app.post('/api/start', (req, res) => {
 const data = z.object({ mode: z.enum(['daily','demo']) }).parse(req.body);
 const c = getChallenge(data.mode);
 if (!c) { res.status(404).json({ error: 'No challenge is scheduled for today. You can still play the demo.' }); return; }
 storage.event(c.id, 'started', randomUUID()).catch(() => console.warn('Metrics storage unavailable.'));
 res.json({ game: view(fresh(c, data.mode), secret) });
});
const tokenBody = z.object({ token: z.string().min(10).max(10000) });
app.post('/api/restore', (req, res) => {
 const { token } = tokenBody.parse(req.body); const state = readToken(token, secret);
 if (state.mode === 'daily' && state.challengeId !== getChallenge('daily')?.id) { res.status(410).json({ error: 'A new day has started. Your previous challenge is finished.' }); return; }
 res.json({ game: view(state, secret) });
});
app.post('/api/answer', async (req, res) => {
 const { token, answer } = tokenBody.extend({ answer: z.string().trim().min(1).max(80) }).parse(req.body);
 const state = readToken(token, secret);
 if (state.mode === 'daily' && state.challengeId !== getChallenge('daily')?.id) { res.status(410).json({ error: 'A new daily challenge is ready. Reload to play.' }); return; }
 const safeAnswer = filter.isProfane(answer) ? '[excluded expression]' : answer;
 const result = submit(state, safeAnswer);
 const game = view(result.state, secret);
 if (result.state.revision !== state.revision) {
  const id = createHash('sha256').update(token + result.state.revision).digest('hex');
  // Metrics failure must never invalidate a successfully checked answer.
  storage.event(state.challengeId, game.complete ? 'completed' : result.feedback.kind, id).catch(() => console.warn('Metrics storage unavailable.'));
 }
 res.json({ game, feedback: result.feedback });
});
app.post('/api/end-round', async (req, res) => {
 const { token } = tokenBody.parse(req.body); const state = readToken(token, secret);
 if (state.mode === 'daily' && state.challengeId !== getChallenge('daily')?.id) { res.status(410).json({ error: 'A new daily challenge is ready. Reload to play.' }); return; }
 const game = view(endRound(state), secret);
 if (game.complete) storage.event(state.challengeId, 'completed', createHash('sha256').update(token + 'end').digest('hex')).catch(() => console.warn('Metrics storage unavailable.'));
 res.json({ game, feedback: { kind: 'ended', message: 'Round ended. Your earned points are saved.' } });
});
app.post('/api/report', rateLimit({ windowMs: 60000, limit: 5, message: { error: 'Report limit reached. Please try again later.' } }), async (req, res) => {
 const { token, roundIndex, attemptIndex } = tokenBody.extend({ roundIndex: z.number().int().min(0).max(2), attemptIndex: z.number().int().min(0).max(4) }).parse(req.body);
 const state = readToken(token, secret), attempt = state.rounds[roundIndex]?.attempts[attemptIndex];
 if (!attempt || attempt.answerId || filter.isProfane(attempt.input) || attempt.input === 'excluded expression') { res.status(400).json({ error: 'This answer cannot be reported.' }); return; }
 const word = promptsFor(challengeForState(state))[roundIndex].word;
 await storage.report(state.challengeId, word, normalise(attempt.input));
 res.json({ message: 'Reported for review. Today’s scores stay fixed.' });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'That endpoint does not exist.' }));
const dist = resolve('dist');
if (existsSync(dist)) { app.use(express.static(dist, { index: false })); app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist,'index.html'))); }
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
 if (err instanceof z.ZodError) { res.status(400).json({ error: 'Please check your input and try again.' }); return; }
 if (err instanceof SyntaxError) { res.status(400).json({ error: 'Invalid request.' }); return; }
 const message = err instanceof Error ? err.message : '';
 if (/saved progress|challenge version|game is complete|Enter a word/.test(message)) { res.status(400).json({ error: message }); return; }
 if (typeof err === 'object' && err && 'status' in err && err.status === 413) { res.status(413).json({ error: 'Request too large.' }); return; }
 console.error('Request failed:', err instanceof Error ? err.name : 'unknown');
 res.status(500).json({ error: 'Something went wrong. Your attempt was not used. Please try again.' });
});
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '0.0.0.0', () => console.log(`Synle API${existsSync(dist) ? ' + app' : ''} listening on http://localhost:${port}`));
process.on('SIGTERM', () => { server.close(() => { storage.close().finally(() => process.exit(0)); }); });
