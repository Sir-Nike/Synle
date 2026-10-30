import assert from 'node:assert/strict';
import { Filter } from 'bad-words';
import { banks, schedule, normalise } from '../server/game';
const filter = new Filter(); let count=0;
for (const bank of banks.values()) {
 const ids = new Set<string>();
 for (const prompt of bank.prompts) {
  assert.ok(!ids.has(prompt.id),`Duplicate prompt ${prompt.id}`); ids.add(prompt.id);
  assert.ok(prompt.answers.length>=12,`Too few answers for ${prompt.word}`);
  const forms=new Set<string>(), answerIds=new Set<string>();
  for (const a of prompt.answers) {
   assert.ok(!answerIds.has(a.id),`Duplicate ID ${a.id}`); answerIds.add(a.id);
   assert.equal(a.points,{familiar:50,uncommon:75,rare:100}[a.tier]);
   assert.ok(prompt.meanings.some(m=>m.id===a.meaning),`Missing meaning ${a.id}`);
   assert.ok(a.source.length>0 && a.review,`Missing evidence ${a.id}`);
   for (const form of [a.text,...a.aliases]) {
    const n=normalise(form); assert.ok(n && n!==normalise(prompt.word));
    assert.ok(!forms.has(n),`Ambiguous alias ${prompt.word}: ${form}`); forms.add(n);
    assert.ok(!filter.isProfane(form),`Excluded expression ${a.id}`);
   }
   count++;
  }
 }
}
const dates=new Set<string>(), challengeIds=new Set<string>();
for (const c of schedule) {
 assert.ok(!dates.has(c.date)); dates.add(c.date); assert.ok(!challengeIds.has(c.id)); challengeIds.add(c.id);
 assert.ok(banks.has(c.version)); assert.equal(c.promptIds.length,3); assert.equal(new Set(c.promptIds).size,3);
 for (const id of c.promptIds) assert.ok(banks.get(c.version)!.prompts.some(p=>p.id===id));
 assert.match(c.date,/^\d{4}-\d{2}-\d{2}$/);
}
console.log(`Content validated: ${count} answers, ${dates.size} daily challenges.`);
