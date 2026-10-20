const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'../server.mjs')],{env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Server exit '+c)))});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4174');await page.waitForSelector('#command-input');
 const input=page.locator('#command-input');async function command(s){await input.fill(s);await input.press('Enter')}
 await command('SELECT 2');assert.match(await page.locator('#area-name').inputValue(),/RETURN/);
 await command('M');await command('');await command('@1000,0,0');assert.equal(await page.locator('#world-x').inputValue(),'9000');
 await command('U');assert.equal(await page.locator('#world-x').inputValue(),'8000');
 await command('UCS LOCAL');await command('M');await command('');await command('@1000,500');assert.equal(await page.locator('#world-y').inputValue(),'1000');assert.equal(await page.locator('#world-z').inputValue(),'500');await command('U');
 await command('ORIGIN');await command('600,900');assert.equal(await page.locator('#origin-x').inputValue(),'600');assert.equal(await page.locator('#origin-y').inputValue(),'900');
 await command('ORIGIN');await command('@100,200');assert.equal(await page.locator('#origin-x').inputValue(),'700');assert.equal(await page.locator('#origin-y').inputValue(),'1100');
 await command('ORIGIN');await command('1,2,3');assert.equal(await page.locator('#origin-x').inputValue(),'700');assert.match(await page.locator('#command-log').textContent(),/Local Z = 0/);await input.press('Escape');
 await command('UCS WORLD');await command('DI');await command('0,0,0');await command('3000,4000,0');assert.match(await page.locator('#command-log').textContent(),/Distance = 5000.000/);
 await command('RO');await command('');await command('90');assert.match(await page.locator('#command-log').textContent(),/Rotated 90/);await command('U');
 await command('M');await command('');await command('1,,2');assert.match(await page.locator('#command-prompt').textContent(),/second point/);await input.press('Escape');assert.equal(await page.locator('#command-prompt').textContent(),'Command:');
 await input.press('F8');assert.match(await page.locator('#cmd-ortho').getAttribute('class'),/active/);await input.press('F3');assert.equal(await page.locator('#snap-toggle').isChecked(),false);await input.press('F3');
 await command('Z E');await command('SELECT');await command('1');assert.match(await page.locator('#area-name').inputValue(),/FRONT/);
 await page.locator('#view-area').click();await page.waitForTimeout(120);await command('ORIGIN');const box=await page.locator('#viewport canvas').boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);assert.equal(await page.locator('#command-prompt').textContent(),'Command:');assert.notEqual(await page.locator('#origin-x').inputValue(),'0');
 await command('MOVE');await command('');await input.press('Escape');await input.press('Enter');assert.match(await page.locator('#command-prompt').textContent(),/base point/);await input.press('Escape');
 await command('AREA');await page.waitForSelector('#new-dialog[open]');await page.locator('#new-dialog [data-close]').click();
 const fileChooserPromise=page.waitForEvent('filechooser');await command('IMPORT');await (await fileChooserPromise).setFiles(path.join(__dirname,'../samples/facade-boundaries.dxf'));await page.waitForSelector('#import-dialog[open]');await page.locator('#import-dialog [data-close]').click();
 await command('Z E');await page.waitForTimeout(200);const canvas=page.locator('#viewport canvas'),beforeOrbit=await canvas.screenshot();const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down({button:'middle'});await page.mouse.move(b.x+b.width*.65,b.y+b.height*.6,{steps:8});await page.mouse.up({button:'middle'});await page.waitForTimeout(200);assert.equal(beforeOrbit.equals(await canvas.screenshot()),false);
 await command('HELP');await page.screenshot({path:path.join(__dirname,'../preview-commands.png')});
 await page.reload();await page.waitForSelector('#command-input');assert.notEqual(await page.locator('#origin-x').inputValue(),'0');
 assert.deepEqual(errors,[]);console.log('PASS: selection, world/local move, undo, origin, relative points, invalid coordinates, distance, rotation, Esc, Enter repeat, F3/F8, surface picking, persistence.');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});



