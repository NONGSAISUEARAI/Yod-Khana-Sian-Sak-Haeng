const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'../server.mjs')],{env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4174');await page.waitForSelector('.area-select');
  const project=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('facade-studio-areas-v1')));
  await page.locator('.area-select').nth(1).click({modifiers:['Control']});
  await page.locator('#cw-enabled').check();
  const before=await project();
  await page.locator('#view-preset').selectOption('front');
  await page.locator('#snap-toggle').uncheck();
  assert.equal(await page.locator('#cw-pick-origin').isDisabled(),false);
  await page.locator('#cw-pick-origin').click();
  // The primary selection is RETURN, but FRONT is the visible face here.
  const box=await page.locator('#viewport canvas').boundingBox();
  await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);
  assert.match(await page.locator('#status').textContent(),/Curtain origin updated/);
  const picked=await project();
  assert.equal(picked.selectedIds.length,2);assert.equal(picked.selectedId,before.selectedId);
  const projection=await page.evaluate(async()=>{
   const {worldPoint,localPoint}=await import('/geometry.js');
   const p=JSON.parse(localStorage.getItem('facade-studio-areas-v1'));
   return localPoint(p.areas[1],worldPoint(p.areas[0],p.areas[0].curtain.origin));
  });
  for(let i=0;i<2;i++)assert.ok(Math.abs(picked.areas[1].curtain.origin[i]-projection[i])<.002);
  assert.ok(Math.abs(picked.areas[0].curtain.origin[0])>100);
  assert.equal(picked.areas[0].curtain.origin[1],picked.areas[1].curtain.origin[1]);
  assert.deepEqual(picked.areas.map(a=>a.pattern),before.areas.map(a=>a.pattern));
  assert.deepEqual(picked.areas[2],before.areas[2]);
  await page.locator('#undo').click();
  const undone=await project();
  assert.deepEqual(undone.areas.map(a=>a.curtain),before.areas.map(a=>a.curtain));
  await page.locator('#cw-pick-origin').click();
  await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);
  const saved=await project();await page.reload();await page.waitForSelector('.area-select');
  assert.deepEqual((await project()).areas,saved.areas);
  assert.equal(await page.locator('#selected-area-count').textContent(),'2 selected');
  assert.deepEqual(errors,[]);
  console.log('PASS: shared Curtain Origin from non-primary face, world projection across corner, group Undo, unchanged patterns/unselected area, reload.');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
