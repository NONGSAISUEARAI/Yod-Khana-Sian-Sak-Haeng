const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/popul/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const html=fs.readFileSync('PDF_MERGER.html','utf8');
 const library=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].find(x=>x[1].includes('pdf-lib v'))[1];
 const ctx=vm.createContext({Uint8Array,ArrayBuffer,Array,setTimeout});vm.runInContext(library,ctx);
 const pdf=await ctx.PDFLib.PDFDocument.create();
 pdf.addPage([400,800]).drawText('Portrait',{x:20,y:700});
 pdf.addPage([800,400]).drawText('Landscape',{x:20,y:300});
 fs.writeFileSync('tmp/pdf-merger/fit-fixture.pdf',await pdf.save());
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve('PDF_MERGER.html')).href);
  await page.locator('#fileInput').setInputFiles(path.resolve('tmp/pdf-merger/fit-fixture.pdf'));
  await page.waitForFunction(()=>document.querySelector('.file-row')&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  await page.locator('[data-action=preview]').click();
  await page.waitForSelector('#previewBody canvas');
  const size=()=>page.locator('#previewBody').evaluate(body=>{
   const canvas=body.querySelector('canvas'),style=getComputedStyle(body);
   return {width:canvas.getBoundingClientRect().width,height:canvas.getBoundingClientRect().height,
    availableWidth:body.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),
    availableHeight:body.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)};
  });
  await page.waitForTimeout(150);
  let box=await size();assert(Math.abs(box.width-box.availableWidth)<=4);assert(box.height>box.availableHeight);
  await page.locator('#fitPage').click();await page.waitForTimeout(150);
  box=await size();assert(box.width<=box.availableWidth);assert(box.height<=box.availableHeight);
  assert.equal(await page.locator('#fitPage').getAttribute('aria-pressed'),'true');
  await page.locator('#nextPage').click();await page.waitForTimeout(150);
  box=await size();assert(box.width<=box.availableWidth);assert(box.height<=box.availableHeight);assert(box.width>box.height);
  await page.setViewportSize({width:1100,height:700});await page.waitForTimeout(400);
  box=await size();assert(box.width<=box.availableWidth);assert(box.height<=box.availableHeight);
  await page.locator('#zoomIn').click();await page.waitForTimeout(150);
  const zoomed=await size();assert(zoomed.width>box.width);assert.equal(await page.locator('#fitPage').getAttribute('aria-pressed'),'false');
  await page.locator('#fitWidth').click();await page.waitForTimeout(150);
  box=await size();assert(Math.abs(box.width-box.availableWidth)<=4);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
  await page.locator('#fitPage').click();await page.waitForTimeout(150);
  box=await size();assert(box.width<=box.availableWidth);assert(box.height<=box.availableHeight);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.equal(html,fs.readFileSync('PDF_MERGER/index.html','utf8'));
  console.log('PASS: fit width, fit page, portrait/landscape navigation, window resize, manual zoom, mobile, identical pages, no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
