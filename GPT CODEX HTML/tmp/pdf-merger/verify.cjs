const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const {pathToFileURL} = require('url');
const {chromium} = require('C:/Users/popul/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const html=fs.readFileSync('PDF_MERGER.html','utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const ctx=vm.createContext({Uint8Array,ArrayBuffer,Array,setTimeout});
  vm.runInContext(scripts.find(s=>s.includes('pdf-lib v')),ctx);
  const PDFDocument=ctx.PDFLib.PDFDocument;
  for(const [name,count] of [['A',2],['B',1],['C',1]]) {
    const doc=await PDFDocument.create();
    for(let i=0;i<count;i++){ const p=doc.addPage([400,500]); p.drawText(name+' page '+(i+1),{x:40,y:400,size:24}); }
    fs.writeFileSync(`tmp/pdf-merger/${name}.pdf`,await doc.save());
  }
  const browser=await chromium.launch({headless:true,downloadsPath:path.resolve('tmp/pdf-merger/downloads'),executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.addInitScript(()=>{const create=URL.createObjectURL.bind(URL);window.testBlobs=[];URL.createObjectURL=(blob)=>{window.testBlobs.push(blob);return create(blob);};}); const errors=[];
    page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e));});
    page.on('console',m=>{ if(m.type()==='error') console.log('Browser:',m.text().slice(0,600)); });
    const javaMode=process.argv.includes('--java');
    const helperSession=javaMode ? JSON.parse(fs.readFileSync('PDF_MERGER/java-helper/session.json','utf8')) : null;
    await page.goto(javaMode ? helperSession.url : pathToFileURL(path.resolve('PDF_MERGER.html')).href);
    if(javaMode) await page.waitForFunction(()=>document.querySelector('#helperStatus').classList.contains('is-ready'));
    console.log('Loaded',await page.title()); await page.waitForFunction(()=>!!window.pdfjsLib);
    await page.locator('#fileInput').setInputFiles(['A','B','C'].map(n=>path.resolve(`tmp/pdf-merger/${n}.pdf`)));
    assert.equal(await page.locator('.file-row').count(),3);
    await page.locator('.file-row').nth(1).locator('input[type=checkbox]').uncheck();
    assert.equal(await page.locator('#checkedSummary').innerText(),'ติ๊กเพื่อรวม 2 / 3 ไฟล์');
    const movedown=page.locator('#moveDownButton');
    const start=await movedown.boundingBox();
    await page.locator('.file-row').first().locator('.file-name').click();
    await movedown.click(); await movedown.click();
    assert.equal(await page.locator('.file-row').last().locator('.file-name').innerText(),'A.pdf');
    assert.deepEqual(await movedown.boundingBox(),start);
    await page.locator('.file-row').last().locator('[data-action=preview]').click();
    await page.waitForFunction(()=>document.querySelector('#previewBody canvas')?.width>0);
    await page.waitForTimeout(1000);
    assert.match(await page.locator('#previewPage').innerText(),/1 \/ 2/);
    await page.locator('#nextPage').click();
    await page.waitForFunction(()=>document.querySelector('#previewPage').textContent.includes('2 / 2'));
    await page.screenshot({path:'tmp/pdf-merger/desktop.png',fullPage:true});
    const listBox=await page.locator('#app').boundingBox(), previewBox=await page.locator('.preview-panel').boundingBox();
    assert(listBox.x<=10,'File list starts at left edge');
    assert(previewBox.width>listBox.width,'Right preview is wider than left list');
    for(const mode of ['original','high','low']) {
      await page.selectOption('#qualityMode',mode);
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#mergeButton').click();
      const download=await downloadPromise;
      const output=path.resolve(`tmp/pdf-merger/result-${mode}.pdf`);
      console.log('Download failure:',await download.failure()); fs.writeFileSync(output,Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.testBlobs.findLast(b=>b.type==='application/pdf').arrayBuffer())))));
      const result=await PDFDocument.load(fs.readFileSync(output));
      assert.equal(result.getPageCount(),3);
      assert.equal(await page.locator('#copyResult').isEnabled(),true);
      console.log(mode,'PASS:',result.getPageCount(),'pages,',fs.statSync(output).size,'bytes');
    }
    await page.locator('#previewResult').click();
    await page.waitForFunction(()=>document.querySelector('#previewPage').textContent.includes('/ 3'));
    await page.waitForTimeout(500);
    await page.locator('#copyResult').click();
    if(javaMode) await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('แล้ว — กด Ctrl+V'));
    const copyStatus=await page.locator('#status').innerText();
    assert.match(copyStatus,/Clipboard|คัดลอก/);
    console.log('Clipboard:',copyStatus);
    if(javaMode) {
      const cp=require('child_process');
      const copiedFile=cp.execFileSync('powershell.exe',['-NoProfile','-STA','-Command','Add-Type -AssemblyName System.Windows.Forms; $files=[System.Windows.Forms.Clipboard]::GetFileDropList(); if($files.Count -ne 1){throw "Expected one real clipboard file"}; [Console]::Write($files[0])'],{encoding:'utf8',windowsHide:true});
      assert(copiedFile.includes('clipboard-files'));
      assert.deepEqual(fs.readFileSync(copiedFile),fs.readFileSync('tmp/pdf-merger/result-low.pdf'));
      const rejected=await fetch(new URL('clipboard?name=test.pdf',helperSession.url),{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/pdf','X-PDF-Merger':'1'},body:fs.readFileSync('tmp/pdf-merger/A.pdf')});
      assert.equal(rejected.status,403);
      const missingHeader=await fetch(new URL('clipboard',helperSession.url),{method:'POST',headers:{Origin:new URL(helperSession.url).origin,'Content-Type':'application/pdf'},body:fs.readFileSync('tmp/pdf-merger/A.pdf')});
      assert.equal(missingHeader.status,403);
      console.log('PASS: actual Windows file Clipboard matches merged PDF bytes; foreign origin and missing request header rejected');
      await page.locator('.file-row').first().locator('[data-action=copy]').click();
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('แล้ว — กด Ctrl+V'));
      const copiedRowFile=cp.execFileSync('powershell.exe',['-NoProfile','-STA','-Command','Add-Type -AssemblyName System.Windows.Forms; [Console]::Write([System.Windows.Forms.Clipboard]::GetFileDropList()[0])'],{encoding:'utf8',windowsHide:true});
      assert.deepEqual(fs.readFileSync(copiedRowFile),fs.readFileSync('tmp/pdf-merger/B.pdf'));
      console.log('PASS: row Copy button copies the original file');
    }
    await page.locator('#checkAll').check(); await page.locator('#checkAll').uncheck();
    assert.equal(await page.locator('#mergeButton').isDisabled(),true);
    assert.equal(await page.locator('#copyResult').isDisabled(),true);
    await page.locator('#checkAll').check();
    assert.equal(await page.locator('.file-row input:checked').count(),3);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'tmp/pdf-merger/mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#clearButton').click();
    assert.equal(await page.locator('.file-row').count(),0);
    assert.match(await page.locator('#previewBody').innerText(),/ยังไม่ได้เปิด/);
    assert.deepEqual(errors,[]);
    assert.equal(fs.readFileSync('PDF_MERGER/index.html','utf8'),html);
    console.log('PASS: checked merge, order, fixed controls, preview navigation, result preview, empty selection, mobile overflow, clear, matching files, no JS errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});





