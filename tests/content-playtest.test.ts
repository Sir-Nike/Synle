import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banks, demo, demoV1, fresh, getChallenge, match, readToken, signState, view } from '../server/game';

// Independent semantic examples, selected before revising the bank. These are
// regression checks of editorial decisions, not evidence of exhaustive coverage.
const positive: Record<string,string[]> = {
 bright:['astute','radiant','vibrant','sunny','sparkling'],
 light:['lightweight','pale','illumination','kindle','lit'],
 calm:['serene','composed','cool','soothe','untroubled'],
 sharp:['pointed','keen','astute','cutting','pungent','shrill'],
 warm:['friendly','balmy','cordial','heat','cosy','cozy','enthusiastic'],
 cold:['chilly','aloof','dispassionate','frosty','wintry'],
 strong:['powerful','sturdy','resilient','potent','convincing'],
 quiet:['silent','reserved','tranquil','muted','subdued'],
 quick:['fast','swift','brief','nimble','prompt'],
 kind:['caring','sort','benevolent','considerate','humane'],
 clear:['transparent','lucid','obvious','unobstructed','distinct','cloudless'],
 bold:['brave','daring','vivid','brazen','confident']
};
const negative: Record<string,string[]> = {
 bright:['stupid','dark','lamp'], light:['hefty','heavy','torch'], calm:['furious','storm','worried'],
 sharp:['blunt','dull','knife'], warm:['freezing','blanket','summer'], cold:['hot','winter','ice'],
 strong:['weak','gym','weight'], quiet:['loud','library','music'], quick:['slow','race','clock'],
 kind:['cruel','friend','help'], clear:['opaque','fog','glass'], bold:['timid','font','risk']
};
test('v2 accepts 64 contextual synonym cases across all twelve prompts',()=>{
 for(const p of banks.get('v2')!.prompts) for(const answer of positive[p.id]) assert.ok(match(p,answer).answer,`${p.word} → ${answer}`);
});
test('v2 rejects 36 opposites and loose associations',()=>{
 for(const p of banks.get('v2')!.prompts) for(const answer of negative[p.id]) assert.equal(match(p,answer).answer,undefined,`${p.word} → ${answer}`);
});
test('v2 spelling variants share a canonical answer and score',()=>{
 const p=banks.get('v2')!.prompts.find(p=>p.id==='warm')!;
 assert.equal(match(p,'cosy').answer?.id,match(p,'cozy').answer?.id);
 assert.equal(match(p,'cosy').answer?.points,match(p,'cozy').answer?.points);
});
test('v2 rarity calibration distinguishes familiar, uncommon and rare words',()=>{
 const p=banks.get('v2')!.prompts[0];
 assert.equal(match(p,'clever').answer?.tier,'familiar');
 assert.equal(match(p,'astute').answer?.tier,'uncommon');
 assert.equal(match(p,'effulgent').answer?.tier,'rare');
});
test('published daily challenge and old demo tokens keep v1 scores',()=>{
 assert.equal(getChallenge('daily','2026-10-30')?.version,'v1');
 assert.equal(getChallenge('daily','2026-10-31')?.version,'v2');
 assert.equal(banks.get('v1')!.prompts[0].answers.find(a=>a.text==='astute')?.points,100);
 assert.equal(demo.version,'v2');
 const restored=readToken(signState(fresh(demoV1,'demo'),'test'),'test');
 assert.equal(restored.version,'v1'); assert.equal(view(restored,'test').challengeId,'demo-v1');
});
