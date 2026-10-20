const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'../server.mjs')],{env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)))});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1400,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4174');await page.waitForSelector('.area-row');
 const chooserPromise=page.waitForEvent('filechooser');await page.locator('#import-dxf').click();const chooser=await chooserPromise;
 await chooser.setFiles(path.join(__dirname,'../samples/facade-boundaries.dxf'));await page.waitForSelector('#import-dialog[open]');assert.equal(await page.locator('#selected-dxf-name').textContent(),'facade-boundaries.dxf');
 await page.locator('#process-dxf').click();await page.waitForSelector('#report-dialog[open]');await page.locator('#confirm-import').click();assert.equal(await page.locator('.area-row').count(),6);
 const text=fs.readFileSync(path.join(__dirname,'../samples/facade-boundaries.dxf'),'utf8');
 async function drop(name,content,count=1){const transfer=await page.evaluateHandle(({name,content,count})=>{const dt=new DataTransfer();for(let i=0;i<count;i++)dt.items.add(new File([content],name,{type:'application/dxf'}));return dt},{name,content,count});await page.dispatchEvent('body','dragenter',{dataTransfer:transfer});assert.equal(await page.locator('#dxf-drop-overlay').isVisible(),true);await page.dispatchEvent('body','drop',{dataTransfer:transfer});await transfer.dispose();assert.equal(await page.locator('#dxf-drop-overlay').isVisible(),false)}
 await drop('dropped.DXF',text);await page.waitForSelector('#import-dialog[open]');assert.equal(await page.locator('#selected-dxf-name').textContent(),'dropped.DXF');await page.locator('#process-dxf').click();await page.waitForSelector('#report-dialog[open]');await page.locator('#confirm-import').click();assert.equal(await page.locator('.area-row').count(),9);
 await drop('not-a-dxf.txt','hello');assert.equal(await page.locator('#import-dialog').isVisible(),false);assert.match(await page.locator('#toast').textContent(),/\.dxf/);
 await drop('too-many.dxf',text,2);assert.equal(await page.locator('#import-dialog').isVisible(),false);assert.match(await page.locator('#toast').textContent(),/ครั้งละ 1/);
 await drop('no-units.dxf',text.replace('70\n4\n','70\n0\n'));await page.locator('#process-dxf').click();assert.equal(await page.locator('#import-dialog').isVisible(),true);await page.locator('#dxf-units').selectOption('1');await page.locator('#process-dxf').click();await page.waitForSelector('#report-dialog[open]');assert.match(await page.locator('#import-summary').textContent(),/3 areas/);
 assert.deepEqual(errors,[]);console.log('PASS: native file chooser, drag-and-drop, uppercase DXF, multiple/invalid file rejection, units retry.');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
