const fs=require('fs'),path=require('path'),assert=require('assert');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/popul/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(pathToFileURL(path.resolve('PDF_MERGER.html')).href);
  await page.locator('#fileInput').setInputFiles(['D','A','B','C'].map(name=>path.resolve('tmp/pdf-merger/'+name+'.pdf')));
  await page.waitForFunction(()=>document.querySelectorAll('.file-row').length===4&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  await page.locator('.file-row').first().locator('[data-action=preview]').click();
  await page.waitForSelector('#previewBody canvas');
  await page.waitForTimeout(150);
  const geometry=await page.evaluate(()=>{
   const box=element=>element.getBoundingClientRect();
   const toolbar=document.querySelector('.preview-toolbar');
   const elements=[...toolbar.querySelectorAll('h2,p,button,label,#previewSelectionCount,#previewPage')].filter(element=>element.getClientRects().length);
   const list=document.querySelector('.table-wrap'), preview=document.querySelector('#previewBody');
   return {heading:box(document.querySelector('.masthead')).height,centers:elements.map(element=>box(element).y+box(element).height/2),
    toolbarOverflow:toolbar.scrollWidth>toolbar.clientWidth,listScroll:list.scrollHeight>list.clientHeight,
    listHeight:list.clientHeight,listOverflow:getComputedStyle(list).overflowY,previewHeight:preview.clientHeight};
  });
  assert(geometry.heading<=32);assert(Math.max(...geometry.centers)-Math.min(...geometry.centers)<2);
  assert.equal(geometry.toolbarOverflow,false);assert.equal(geometry.listOverflow,'scroll');assert(geometry.listScroll);assert(geometry.previewHeight>850);
  await page.locator('.table-wrap').evaluate(element=>{element.scrollTop=element.scrollHeight;});
  assert(await page.locator('.table-wrap').evaluate(element=>element.scrollTop>0));
  await page.screenshot({path:'tmp/pdf-merger/compact-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const mobileCenters=await page.locator('.preview-toolbar').evaluate(toolbar=>[...toolbar.querySelectorAll('h2,p,button,label,#previewSelectionCount,#previewPage')].filter(element=>element.getClientRects().length).map(element=>{const box=element.getBoundingClientRect();return box.y+box.height/2;}));
  assert(Math.max(...mobileCenters)-Math.min(...mobileCenters)<2);
  assert.deepEqual(errors,[]);
  console.log('PASS: compact single-line masthead and preview toolbar; scrollable file list; larger preview; mobile no page overflow; no JS errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
