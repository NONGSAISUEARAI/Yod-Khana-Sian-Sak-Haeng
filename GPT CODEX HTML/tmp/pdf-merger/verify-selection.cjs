const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/popul/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const html=fs.readFileSync('PDF_MERGER.html','utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const ctx=vm.createContext({Uint8Array,ArrayBuffer,Array,setTimeout});
 vm.runInContext(scripts.find(s=>s.includes('pdf-lib v')),ctx);
 const {PDFDocument}=ctx.PDFLib;
 const doc=await PDFDocument.create();
 for(let i=1;i<=5;i++){const page=doc.addPage([400,500]);page.drawText('D page '+i,{x:40,y:400,size:24});}
 fs.writeFileSync('tmp/pdf-merger/D.pdf',await doc.save());
 fs.writeFileSync('tmp/pdf-merger/broken.pdf','%PDF-1.7\nnot a valid pdf');
 fs.copyFileSync('tmp/pdf-merger/B.pdf','tmp/pdf-merger/renamed-copy.pdf');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',downloadsPath:path.resolve('tmp/pdf-merger/downloads')});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e));});
  await page.addInitScript(()=>{const create=URL.createObjectURL.bind(URL);window.testBlobs=[];URL.createObjectURL=blob=>{window.testBlobs.push(blob);return create(blob);};});
  await page.goto(pathToFileURL(path.resolve('PDF_MERGER.html')).href);
  await page.waitForFunction(()=>!!window.pdfjsLib);
  assert.equal(await page.locator('[data-action=copy],#copyResult,#helperStatus').count(),0);
  const row=name=>page.locator('.file-row').filter({has:page.locator('.file-name',{hasText:new RegExp('^'+name.replaceAll('.','\\.')+'$')})});
  async function add(names,expected){await page.locator('#fileInput').setInputFiles(names.map(n=>path.resolve('tmp/pdf-merger/'+n)));await page.waitForFunction(n=>document.querySelectorAll('.file-row').length===n&&document.querySelector('#app').getAttribute('aria-busy')==='false',expected);}
  await add(['D.pdf','A.pdf','B.pdf','locked.pdf','broken.pdf'],5);
  assert.match(await row('D.pdf').locator('.page-count').innerText(),/5 หน้า/);
  assert.match(await row('locked.pdf').innerText(),/มีรหัสผ่าน/);
  assert.match(await row('broken.pdf').innerText(),/ไฟล์เสียหาย|อ่านไม่ได้/);
  assert.equal(await row('locked.pdf').locator('input[type=checkbox]').isDisabled(),true);
  assert.equal(await row('broken.pdf').locator('input[type=checkbox]').isChecked(),false);
  assert.match(await page.locator('#checkedSummary').innerText(),/3 \/ 5 ไฟล์ · 8 \/ 8 หน้า/);
  await row('B.pdf').locator('input[type=checkbox]').uncheck();
  await row('D.pdf').locator('.page-range').fill('2-3, 5');
  await row('A.pdf').locator('.page-range').fill('2');
  assert.match(await page.locator('#checkedSummary').innerText(),/2 \/ 5 ไฟล์ · 4 \/ 8 หน้า/);
  await row('D.pdf').locator('.page-range').fill('6');
  assert.equal(await row('D.pdf').locator('.page-range').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#mergeButton').isDisabled(),true);
  await row('D.pdf').locator('.page-range').fill('3-1');
  assert.equal(await page.locator('#mergeButton').isDisabled(),true);
  await row('D.pdf').locator('.page-range').fill('2-3, 5');
  await row('D.pdf').locator('[data-action=preview]').click();
  await page.waitForFunction(()=>!document.querySelector('#previewSelection').hidden);
  assert.equal(await page.locator('#previewPageCheck').isChecked(),false);
  await page.locator('#previewPageCheck').check();
  assert.equal(await row('D.pdf').locator('.page-range').inputValue(),'1-3, 5');
  await page.locator('#nextPage').click();
  await page.locator('#previewPageCheck').uncheck();
  assert.equal(await row('D.pdf').locator('.page-range').inputValue(),'1, 3, 5');
  assert.match(await page.locator('#checkedSummary').innerText(),/4 \/ 8 หน้า/);
  await page.screenshot({path:'tmp/pdf-merger/selection-desktop.png',fullPage:true});
  for(const mode of ['original','high','low']){
   await page.selectOption('#qualityMode',mode);
   const downloading=page.waitForEvent('download');await page.locator('#mergeButton').click();
   const download=await downloading;assert.equal(await download.failure(),null);
   const output=path.resolve('tmp/pdf-merger/selected-'+mode+'.pdf');await download.saveAs(output);
   const merged=await PDFDocument.load(fs.readFileSync(output));assert.equal(merged.getPageCount(),4);
   if(mode==='original'){
    const texts=await page.evaluate(async()=>{
     const blob=window.testBlobs.findLast(blob=>blob.type==='application/pdf');
     const task=window.pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useWasm:false});
     const pdf=await task.promise;const text=[];
     try{for(let i=1;i<=pdf.numPages;i++)text.push((await (await pdf.getPage(i)).getTextContent()).items.map(x=>x.str).join(''));return text;}finally{await task.destroy();}
    });
    assert.deepEqual(texts,['D page 1','D page 3','D page 5','A page 2']);
   }
   console.log('PASS',mode,'merges the selected 4 pages only');
  }
  await page.locator('#previewResult').click();
  await page.waitForFunction(()=>document.querySelector('#previewPage').textContent.includes('/ 4'));
  assert.equal(await page.locator('#previewSelection').isHidden(),true);
  await row('D.pdf').locator('[data-action=remove]').click();
  assert.equal(await row('D.pdf').count(),0);
  await page.locator('#undoDelete').click();
  assert.equal(await row('D.pdf').locator('.page-range').inputValue(),'1, 3, 5');
  assert.equal(await page.locator('.file-name').first().innerText(),'D.pdf');
  assert.equal(await row('B.pdf').locator('input[type=checkbox]').isChecked(),false);
  await row('A.pdf').locator('[data-action=remove]').click();
  await row('D.pdf').locator('[data-action=remove]').click();
  await page.locator('#undoDelete').click();await page.locator('#undoDelete').click();
  assert.deepEqual(await page.locator('.file-name').allInnerTexts(),['D.pdf','A.pdf','B.pdf','locked.pdf','broken.pdf']);
  await page.locator('#clearButton').click();
  assert.equal(await page.locator('.file-row').count(),0);
  assert.equal(await page.locator('#undoDelete').isVisible(),true);
  await page.locator('#undoDelete').click();
  assert.equal(await page.locator('.file-row').count(),5);
  assert.equal(await row('D.pdf').locator('.page-range').inputValue(),'1, 3, 5');
  // Identical contents with a different filename must still trigger a duplicate warning.
  await page.locator('#fileInput').setInputFiles(path.resolve('tmp/pdf-merger/renamed-copy.pdf'));
  await page.waitForFunction(()=>document.querySelector('#duplicateDialog').open);
  assert.equal(await page.locator('#duplicateOriginal').innerText(),'B.pdf');
  await page.locator('#skipDuplicate').click();
  await page.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('.file-row').count(),5);
  await page.locator('#fileInput').setInputFiles(path.resolve('tmp/pdf-merger/renamed-copy.pdf'));
  await page.waitForFunction(()=>document.querySelector('#duplicateDialog').open);
  await page.locator('#addDuplicate').click();
  await page.waitForFunction(()=>document.querySelectorAll('.file-row').length===6&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  // A duplicate inside the same newly added batch is caught too; Escape skips it.
  await page.locator('#fileInput').setInputFiles(['C.pdf','C.pdf'].map(n=>path.resolve('tmp/pdf-merger/'+n)));
  await page.waitForFunction(()=>document.querySelector('#duplicateDialog').open);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');
  assert.equal(await row('C.pdf').count(),1);
  // Drop uses the same validation/duplicate path as the picker.
  await page.evaluate(async()=>{
   const inputFile=new File([await window.testBlobs.findLast(blob=>blob.type==='application/pdf').arrayBuffer()],'dropped.pdf',{type:'application/pdf'});
   const data=new DataTransfer();data.items.add(inputFile);
   document.querySelector('#dropZone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
  });
  await page.waitForFunction(()=>document.querySelectorAll('.file-row').length===8&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  assert.match(await row('dropped.pdf').locator('.page-count').innerText(),/4 หน้า/);
  await page.locator('#checkAll').check();await page.locator('#checkAll').uncheck();
  assert.equal(await page.locator('#mergeButton').isDisabled(),true);
  await page.locator('#checkAll').check();
  assert.equal(await row('locked.pdf').locator('input[type=checkbox]').isChecked(),false);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tmp/pdf-merger/selection-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  assert.equal(html,fs.readFileSync('PDF_MERGER/index.html','utf8'));
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>Object.defineProperty(Crypto.prototype,'subtle',{get:()=>undefined}));
  await fallback.goto(pathToFileURL(path.resolve('PDF_MERGER.html')).href);
  await fallback.waitForFunction(()=>!!window.pdfjsLib);
  await fallback.locator('#fileInput').setInputFiles(path.resolve('tmp/pdf-merger/B.pdf'));
  await fallback.waitForFunction(()=>document.querySelectorAll('.file-row').length===1&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  await fallback.locator('#fileInput').setInputFiles(path.resolve('tmp/pdf-merger/renamed-copy.pdf'));
  await fallback.waitForFunction(()=>document.querySelector('#duplicateDialog').open);
  await fallback.locator('#skipDuplicate').click();
  await fallback.close();
  console.log('PASS: duplicate checks also work without crypto.subtle (non-secure hosting)');
  console.log('PASS: file validation, password/corrupt skip, counts, ranges, preview selection, undo remove/clear, exact duplicates, duplicate choices/Escape, drag drop, mobile, no Java dependency');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
