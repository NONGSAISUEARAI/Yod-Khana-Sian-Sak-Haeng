const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'../server.mjs')],{env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
  await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j)});
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4174');await page.waitForSelector('#command-input');
  const command=async value=>{await page.locator('#command-input').fill(value);await page.locator('#command-input').press('Enter')};
  const value=()=>page.evaluate(()=>localStorage.getItem('facade-studio-osmode-v1'));
  await command('OSMODE 3');assert.equal(await value(),'3');
  await page.locator('#osnap-settings').evaluate(e=>e.open=true);
  assert.equal(await page.locator('[data-osmode="2"]').isChecked(),true);
  await page.locator('[data-osmode="512"]').check();assert.equal(await value(),'515');
  await page.locator('#command-input').press('F3');assert.equal(await value(),'16899');assert.equal(await page.locator('#snap-toggle').isChecked(),false);
  await page.locator('#command-input').press('F3');assert.equal(await value(),'515');
  await command('OSMODE');assert.match(await page.locator('#command-prompt').textContent(),/OSMODE/);await command('1024');assert.equal(await value(),'1024');
  await command('OSMODE 4');assert.equal(await value(),'1024');assert.match(await page.locator('#command-log').textContent(),/รองรับ OSMODE/);await page.keyboard.press('Escape');
  await page.locator('#view-area').click();await page.locator('#pick-origin').click();
  const box=await page.locator('#viewport canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5+2,box.y+box.height*.5+2);
  assert.match(await page.locator('#osnap-feedback').textContent(),/Geometric Center/);
  await page.mouse.click(box.x+box.width*.5+2,box.y+box.height*.5+2);
  assert.equal(await page.locator('#origin-x').inputValue(),'4000');assert.equal(await page.locator('#origin-y').inputValue(),'2100');
  await command('DI');await page.mouse.move(box.x+box.width*.5+2,box.y+box.height*.5+2);
  assert.match(await page.locator('#command-hint').textContent(),/Geometric Center/);await page.keyboard.press('Escape');
  await page.reload();await page.waitForSelector('#command-input');assert.match(await page.locator('#osmode-value').textContent(),/1024/);
  await command('OSMODE 0');assert.equal(await page.locator('#snap-toggle').isChecked(),false);
  assert.deepEqual(errors,[]);console.log('PASS: OSMODE numeric and prompted input, checkbox modes, F3 bit preservation, invalid values, visual snap preview, exact origin pick, command snapping and persistence.');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
