import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Answer, Bank, Challenge, Feedback, GameView, Prompt, Round, ScoredAttempt, State } from './types';

export const banks = new Map<string, Bank>();
const bank = JSON.parse(readFileSync(new URL('../content/bank-v1.json', import.meta.url), 'utf8')) as Bank;
banks.set(bank.version, bank);
const revisedBank = JSON.parse(readFileSync(new URL('../content/bank-v2.json', import.meta.url), 'utf8')) as Bank;
banks.set(revisedBank.version, revisedBank);
export const schedule = JSON.parse(readFileSync(new URL('../content/schedule.json', import.meta.url), 'utf8')) as Challenge[];
export const demoV1: Challenge = { id: 'demo-v1', date: '', number: 0, promptIds: ['bright', 'light', 'calm'], version: bank.version };
export const demo: Challenge = { ...demoV1, id: 'demo-v2', version: revisedBank.version };
export const normalise = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[-–—]/g, ' ').replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/g, ' ').trim();
export function today(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function nextReset(now = new Date()) { return new Date(Date.parse(`${today(now)}T00:00:00+05:30`) + 86400000).toISOString(); }
export function getChallenge(mode: 'daily' | 'demo', date = today()) { return mode === 'demo' ? { ...demo, date } : schedule.find(c => c.date === date); }
export function challengeForState(state: State) {
 const c = state.mode === 'demo' ? [demo, demoV1].find(c => c.id === state.challengeId) : schedule.find(c => c.id === state.challengeId);
 if (!c || c.version !== state.version || !banks.has(state.version)) throw new Error('This challenge version is unavailable.');
 return c;
}
export function promptsFor(c: Challenge) { return c.promptIds.map(id => banks.get(c.version)!.prompts.find(p => p.id === id)!); }
export function fresh(c: Challenge, mode: 'daily' | 'demo'): State { return { challengeId: c.id, mode, version: c.version, rounds: c.promptIds.map(() => ({ attempts: [], ended: false })), revision: 0 }; }

// One edit (including transposition), intentionally conservative for short words.
export function editDistance(a: string, b: string): number {
 const d = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
 for (let i = 0; i <= a.length; i++) d[i][0] = i;
 for (let j = 0; j <= b.length; j++) d[0][j] = j;
 for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
   d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
   if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
 }
 return d[a.length][b.length];
}
// Known real words must not silently turn into a different valid synonym.
const knownWords = new Set<string>(JSON.parse(readFileSync(new URL('../content/known-words.json', import.meta.url), 'utf8')));
export function match(prompt: Prompt, raw: string): { answer?: Answer; corrected?: boolean; suggestions?: string[] } {
 const text = normalise(raw);
 const forms = (a: Answer) => [a.text, ...a.aliases].map(normalise);
 const exact = prompt.answers.find(a => forms(a).includes(text));
 if (exact) return { answer: exact };
 if (text.length < 5 || text.length > 60 || knownWords.has(text) || text === normalise(prompt.word)) return {};
 const candidates = prompt.answers.filter(a => forms(a).some(f => Math.abs(f.length - text.length) <= 1 && editDistance(text, f) === 1));
 if (candidates.length === 1) return { answer: candidates[0], corrected: true };
 if (candidates.length > 1) return { suggestions: candidates.map(a => a.text).slice(0, 4) };
 return {};
}
export function scored(prompt: Prompt, round: Round): ScoredAttempt[] {
 return round.attempts.map((a, index) => {
   const answer = prompt.answers.find(x => x.id === a.answerId);
   return { input: a.input, text: answer?.text ?? a.input, accepted: !!answer, corrected: !!a.corrected, points: answer?.points ?? 0, tier: answer?.tier, meaning: prompt.meanings.find(m => m.id === answer?.meaning)?.label, answerId: answer?.id, index };
 });
}
export const bestThree = (attempts: ScoredAttempt[]) => attempts.filter(a => a.accepted).sort((a, b) => b.points - a.points || a.index - b.index).slice(0, 3);
export function currentIndex(state: State) { const i = state.rounds.findIndex(r => !r.ended); return i === -1 ? state.rounds.length - 1 : i; }
export function submit(state: State, input: string): { state: State; feedback: Feedback } {
 const c = challengeForState(state), index = currentIndex(state), round = state.rounds[index], prompt = promptsFor(c)[index];
 if (round.ended) throw new Error('This game is complete.');
 const text = normalise(input);
 if (!text) throw new Error('Enter a word or phrase.');
 if (round.attempts.some(a => normalise(a.input) === text)) return { state, feedback: { kind: 'duplicate', message: 'Already tried. No attempt used.' } };
 const result = match(prompt, input);
 if (result.suggestions) return { state, feedback: { kind: 'suggestions', message: 'Did you mean one of these? Choose an answer to check it.', suggestions: result.suggestions } };
 if (result.answer && round.attempts.some(a => a.answerId === result.answer!.id)) return { state, feedback: { kind: 'duplicate', message: 'That expression already counts. No attempt used.' } };
 const previous = bestThree(scored(prompt, round)).reduce((n, a) => n + a.points, 0);
 const updated = structuredClone(state);
 updated.rounds[index].attempts.push({ input: text, ...(result.answer ? { answerId: result.answer.id, corrected: !!result.corrected } : {}) });
 updated.rounds[index].ended = updated.rounds[index].attempts.length >= 5;
 updated.revision++;
 const increase = bestThree(scored(prompt, updated.rounds[index])).reduce((n, a) => n + a.points, 0) - previous;
 const answer = result.answer;
 return { state: updated, feedback: answer ? { kind: 'accepted', tier: answer.tier, increase, message: `${result.corrected ? 'Accepted as ' : ''}${answer.text}${result.corrected ? '.' : ''} · ${answer.tier} · ${answer.points} points${increase === 0 ? '. Your best three stay unchanged.' : ''}` } : { kind: 'incorrect', message: 'Incorrect — try another synonym.' } };
}
export function endRound(state: State) {
 const copy = structuredClone(state); const i = currentIndex(copy);
 if (copy.rounds[i].ended) throw new Error('This game is complete.');
 copy.rounds[i].ended = true; copy.revision++; return copy;
}
export function signState(state: State, secret: string) {
 const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
 return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readToken(token: string, secret: string): State {
 const [payload, signature, extra] = token.split('.');
 if (!payload || !signature || extra) throw new Error('Invalid saved progress.');
 const expected = createHmac('sha256', secret).update(payload).digest(); const actual = Buffer.from(signature, 'base64url');
 if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid saved progress.');
 const state = JSON.parse(Buffer.from(payload, 'base64url').toString()) as State;
 const c = challengeForState(state);
 if (state.rounds.length !== c.promptIds.length || !Number.isInteger(state.revision)) throw new Error('Invalid saved progress.');
 return state;
}
export function view(state: State, secret: string): GameView {
 const c = challengeForState(state), prompts = promptsFor(c), currentRound = currentIndex(state);
 // Expose current and already completed rounds only. Reveal examples after ending.
 const rounds = state.rounds.slice(0, currentRound + 1).map((r, i) => {
  const prompt = prompts[i], attempts = scored(prompt, r), best = bestThree(attempts);
  return { word: prompt.word, attempts, best, score: best.reduce((n, a) => n + a.points, 0), ended: r.ended, remaining: 5 - attempts.length, discoveries: new Set(attempts.filter(a => a.accepted).map(a => a.meaning)).size,
   ...(r.ended ? { reveal: prompt.meanings.map(m => ({ meaning: m.label, examples: prompt.answers.filter(a => a.meaning === m.id).sort((a,b) => b.points - a.points).slice(0, 3).map(a => ({ text: a.text, tier: a.tier, points: a.points })) })) } : {}) };
 });
 return { mode: state.mode, date: c.date || today(), number: c.number, challengeId: c.id, revision: state.revision, rounds, currentRound, complete: state.rounds.every(r => r.ended), total: rounds.reduce((n, r) => n + r.score, 0), token: signState(state, secret), nextReset: nextReset() };
}
