import { chromium, firefox } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const port=3193,base=`http://localhost:${port}`,out='test-results/report-qa';
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['--import','tsx','scripts/browser-test-server.ts'],{env:{...process.env,SYNLE_BROWSER_TEST:'yes',PORT:String(port),NODE_ENV:'production',SESSION_SECRET:'extended-qa-isolated-session-secret-32-chars',DATABASE_URL:'',GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only-not-real',PUBLIC_URL:base},stdio:'ignore'});
let chrome,ff;const results=[];
try{
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw new Error('QA server did not start');
 const state=JSON.parse(await readFile('test-results/browser-auth.json','utf8'));
 chrome=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/brave-browser',headless:true});
 const guest=await chrome.newContext({viewport:{width:1280,height:900}});const g=await guest.newPage();await g.goto(base);await g.waitForLoadState('networkidle');await g.screenshot({path:`${out}/home.png`,fullPage:true});
 await g.goto(base+'/login');await g.waitForLoadState('networkidle');await g.screenshot({path:`${out}/login.png`,fullPage:true});
 // Reflow at a 320 CSS-pixel viewport is the WCAG 400%-zoom equivalent for a 1280px viewport.
 for(const path of ['/','/login','/about']){
  await g.setViewportSize({width:320,height:800});await g.goto(base+path);await g.waitForLoadState('networkidle');const overflow=await g.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw new Error('320px overflow on '+path);results.push({check:'320 CSS px reflow',path,passed:true});
 }
 await g.setViewportSize({width:1280,height:900});await g.goto(base+'/login');await g.evaluate(()=>{document.documentElement.style.zoom='4';});await g.screenshot({path:`${out}/login-400-percent-css-zoom.png`,fullPage:true});
 const overflow=await g.evaluate(()=>document.documentElement.scrollWidth>innerWidth);results.push({check:'400% CSS zoom (not browser-native zoom)',path:'/login',passed:!overflow});if(overflow)throw new Error('400% CSS zoom overflow');
 const context=await chrome.newContext({viewport:{width:1100,height:900}});await context.addCookies(state.cookies);const page=await context.newPage();
 await page.goto(base+'/demo');await page.getByRole('textbox',{name:'Your answer'}).waitFor();await page.getByRole('textbox').fill('astute');await page.getByRole('button',{name:'Check',exact:true}).click();await page.getByRole('status').filter({hasText:/astute/}).waitFor();await page.screenshot({path:`${out}/game.png`,fullPage:true});
 await writeFile(`${out}/game-accessibility-tree.txt`,await page.locator('body').ariaSnapshot());results.push({check:'semantic accessibility tree includes labelled input and status feedback',passed:true});
 const meta=await page.request.get(base+'/api/challenge').then(r=>r.json());
 if(meta.available){
  const schedule=JSON.parse(await readFile('content/schedule.json','utf8'));const c=schedule.find(c=>c.id===meta.challengeId);const bank=JSON.parse(await readFile(`content/bank-${c.version}.json`,'utf8'));
  await page.goto(base+'/play');await page.getByRole('textbox').waitFor();
  for(let i=0;i<3;i++){
   const p=bank.prompts.find(p=>p.id===c.promptIds[i]);
   for(const a of p.answers.slice(0,3)){await page.getByRole('textbox').fill(a.text);await page.getByRole('button',{name:'Check',exact:true}).click();await page.getByRole('status').filter({hasText:a.text}).waitFor();}
   await page.getByRole('button',{name:'End this round'}).click();await page.getByRole('button',{name:'End round',exact:true}).click();await page.getByRole('button',{name:i===2?'See your results':'Next word',exact:true}).click();
  }
  await page.screenshot({path:`${out}/results.png`,fullPage:true});await page.goto(base+'/history');await page.locator('.score-history summary').waitFor();await page.locator('.score-history summary').click();await page.screenshot({path:`${out}/history.png`,fullPage:true});
  results.push({check:'server-computed daily score appears in private history with round breakdown',passed:true});
 }
 ff=await firefox.launch({headless:true});const f=await ff.newPage({viewport:{width:390,height:844}});await f.context().addCookies(state.cookies);await f.goto(base+'/demo');await f.getByRole('textbox').waitFor();await f.getByRole('textbox').fill('clever');await f.getByRole('button',{name:'Check',exact:true}).click();await f.getByText('4 attempts remaining').waitFor();await f.reload();await f.getByText('4 attempts remaining').waitFor();await f.goto(base+'/history');await f.locator('.score-history summary').waitFor();results.push({check:'Firefox mobile viewport: scoring, refresh restoration and account history',passed:true});await f.screenshot({path:`${out}/firefox-mobile-history.png`,fullPage:true});
 console.log(JSON.stringify(results,null,2));
}finally{await ff?.close();await chrome?.close();server.kill('SIGTERM');await writeFile(`${out}/summary.json`,JSON.stringify({date:new Date().toISOString(),results},null,2));}
