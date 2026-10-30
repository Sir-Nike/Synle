import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banks, demoV1 as demo, fresh, submit, endRound, bestThree, scored, match, signState, readToken, view, today, nextReset } from '../server/game';

const bright = banks.get('v1')!.prompts.find(p=>p.id==='bright')!;
test('different meanings and distinct synonyms each qualify', () => {
 let s = fresh(demo,'demo');
 for (const answer of ['astute','radiant','vibrant']) { const r = submit(s,answer); assert.equal(r.feedback.kind,'accepted'); s = r.state; }
 assert.equal(s.rounds[0].attempts.length,3);
 assert.equal(new Set(scored(bright,s.rounds[0]).map(a=>a.meaning)).size,3);
});
test('five attempts, best three scores, automatic round end', () => {
 let s = fresh(demo,'demo');
 for (const answer of ['smart','radiant','astute','luminous','resplendent']) s = submit(s,answer).state;
 assert.equal(s.rounds[0].ended,true); assert.equal(s.rounds[0].attempts.length,5);
 assert.equal(bestThree(scored(bright,s.rounds[0])).reduce((n,a)=>n+a.points,0),300);
 assert.equal(view(s,'secret').currentRound,1);
});
test('duplicate input and spelling aliases cost no attempt', () => {
 let s = submit(fresh(demo,'demo'),'colourful').state;
 const r = submit(s,'COLORFUL'); assert.equal(r.feedback.kind,'duplicate'); assert.deepEqual(r.state,s);
 const repeated = submit(s,'colourful'); assert.equal(repeated.feedback.kind,'duplicate');
});
test('invalid association and opposite consume attempts', () => {
 let s = fresh(demo,'demo');
 for (const answer of ['dark','celebration','potato']) { const r = submit(s,answer); assert.equal(r.feedback.kind,'incorrect'); s=r.state; }
 assert.equal(s.rounds[0].attempts.length,3);
 assert.equal(view(s,'secret').total,0);
});
test('clear typo corrects, real word does not silently change', () => {
 assert.equal(match(bright,'luminouus').answer?.text,'luminous');
 assert.equal(match(bright,'luminouus').corrected,true);
 assert.equal(match(bright,'brain').answer,undefined); // Near brainy, but a real word.
 assert.equal(match(bright,'start').answer,undefined); // Near smart.
});
test('ambiguous spelling correction consumes no attempt', () => {
 const prompt = { ...bright, answers: [ { ...bright.answers[0],id:'a',text:'gleamy',aliases:[] },{ ...bright.answers[0],id:'b',text:'gleams',aliases:[] } ] };
 const r = match(prompt,'gleamz'); assert.deepEqual(r.suggestions,['gleamy','gleams']);
});
test('prompt itself and punctuation-only inputs do not score', () => {
 assert.equal(match(bright,'bright').answer,undefined);
 assert.throws(()=>submit(fresh(demo,'demo'),'!!!'),/Enter a word/);
});
test('signed progress restores and rejects tampering', () => {
 const s=submit(fresh(demo,'demo'),'astute').state, token=signState(s,'test-secret');
 assert.deepEqual(readToken(token,'test-secret'),s);
 assert.throws(()=>readToken(token,'different-secret'),/Invalid saved/);
 const [payload,sig]=token.split('.'); const changed=JSON.parse(Buffer.from(payload,'base64url').toString()); changed.revision=999;
 assert.throws(()=>readToken(Buffer.from(JSON.stringify(changed)).toString('base64url')+'.'+sig,'test-secret'),/Invalid saved/);
});
test('unrevealed answers stay server-side; round end reveals examples', () => {
 let s=fresh(demo,'demo'); const initial=view(s,'secret');
 assert.equal(initial.rounds.length,1); assert.equal(initial.rounds[0].reveal,undefined);
 assert.ok(!JSON.stringify(initial).includes('resplendent'));
 s=endRound(s); assert.ok(view(s,'secret').rounds[0].reveal?.length);
});
test('early finish retains earned scores and complete game blocks submissions', () => {
 let s=submit(fresh(demo,'demo'),'astute').state;
 s=endRound(s); assert.equal(view(s,'secret').total,100);
 s=endRound(s); s=endRound(s); assert.equal(view(s,'secret').complete,true);
 assert.throws(()=>submit(s,'calm'),/complete/);
});
test('IST reset is correct on either side of midnight', () => {
 assert.equal(today(new Date('2026-10-30T18:29:59Z')),'2026-10-30');
 assert.equal(today(new Date('2026-10-30T18:30:00Z')),'2026-10-31');
 assert.equal(nextReset(new Date('2026-10-30T18:29:59Z')),'2026-10-30T18:30:00.000Z');
});
