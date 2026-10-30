import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import type { GameView, Feedback } from '../server/types';
const port=3197, base=`http://127.0.0.1:${port}`;
let child:ChildProcess;
async function request(path:string,body?:unknown,headers:Record<string,string>={}) {
 const r=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
}
before(async()=>{
 child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:String(port),NODE_ENV:'test',SQLITE_PATH:':memory:',DATABASE_URL:'',SESSION_SECRET:'test-only-secret-for-automated-checks'},stdio:'pipe'});
 let diagnostics=''; child.stderr?.on('data',d=>{diagnostics+=d;});
 const started=Date.now();
 while(Date.now()-started<15000){
  if(child.exitCode!==null) throw new Error(diagnostics);
  try{if((await request('health')).status===200)return;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw new Error('Test server did not start: '+diagnostics);
});
after(()=>{child?.kill('SIGTERM');});
test('API validates requests, rejects cross-origin writes and tampered progress',async()=>{
 assert.equal((await request('start',{mode:'invalid'})).status,400);
 assert.equal((await request('start',{mode:'demo'},{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await request('restore',{token:'bogus-token'})).status,400);
 const first=await request('start',{mode:'demo'}); assert.equal(first.status,200);
 const game=first.data.game as GameView;
 assert.equal(game.rounds.length,1); assert.equal(game.rounds[0].reveal,undefined);
 assert.equal((await request('answer',{token:game.token,answer:'a'.repeat(81)})).status,400);
 const altered=game.token.slice(0,-5)+'xxxxx'; assert.equal((await request('restore',{token:altered})).status,400);
});
test('API plays and restores a complete game, keeps aliases canonical and records reports',async()=>{
 let game=(await request('start',{mode:'demo'})).data.game as GameView;
 async function answer(text:string){const r=await request('answer',{token:game.token,answer:text});assert.equal(r.status,200);game=r.data.game;return r.data.feedback as Feedback;}
 assert.equal((await answer('colourful')).kind,'accepted');
 assert.equal((await answer('colorful')).kind,'duplicate');assert.equal(game.rounds[0].remaining,4);
 assert.equal((await answer('luminouus')).kind,'accepted');assert.equal(game.rounds[0].attempts[1].text,'luminous');
 assert.equal((await answer('potato')).kind,'incorrect');
 assert.equal((await request('report',{token:game.token,roundIndex:0,attemptIndex:2})).status,200);
 const restored=await request('restore',{token:game.token});assert.equal(restored.data.game.total,game.total);
 await answer('astute');await answer('resplendent');assert.equal(game.rounds[0].score,250);assert.equal(game.rounds[0].ended,true);
 assert.ok(game.rounds[0].reveal);assert.equal(game.currentRound,1);
 await answer('hefty');assert.equal(game.rounds[1].attempts[0].accepted,false);
 game=(await request('end-round',{token:game.token})).data.game;
 await answer('serene');game=(await request('end-round',{token:game.token})).data.game;
 assert.equal(game.complete,true);assert.equal(game.total,325);
 assert.equal((await request('answer',{token:game.token,answer:'peaceful'})).status,400);
});
