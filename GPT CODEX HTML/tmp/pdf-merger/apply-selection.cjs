const fs = require('fs');
let html = fs.readFileSync('PDF_MERGER.html', 'utf8');
let app = fs.readFileSync('tmp/pdf-merger/app-current.js','utf8').replace(/\r\n/g,'\n');
function edit(from,to){if(!app.includes(from))throw Error('Missing JS '+from.slice(0,80));app=app.replace(from,()=>to);}
function page(from,to){if(!html.includes(from))throw Error('Missing HTML '+from.slice(0,80));html=html.replace(from,()=>to);}
edit('      const copyResult = document.getElementById("copyResult");', `      const undoDelete = document.getElementById("undoDelete");
      const historyNote = document.getElementById("historyNote");
      const validationSummary = document.getElementById("validationSummary");
      const duplicateDialog = document.getElementById("duplicateDialog");
      const duplicateName = document.getElementById("duplicateName");
      const duplicateOriginal = document.getElementById("duplicateOriginal");
      const previewSelection = document.getElementById("previewSelection");
      const previewPageCheck = document.getElementById("previewPageCheck");
      const previewSelectionCount = document.getElementById("previewSelectionCount");
      const selectAllPages = document.getElementById("selectAllPages");`);
app=app.replace(/^.*copyResult[^\n]*\n/gm,'');
edit('        files: [],','        files: [],\n        deleted: [],');
edit('        fileList.querySelectorAll(\'input[type="checkbox"]\').forEach((input) => { input.disabled = busy; });', `        fileList.querySelectorAll("input").forEach((input) => {
          const entry = state.files.find((entry) => entry.id === Number(input.dataset.checkId || input.dataset.rangeId));
          input.disabled = busy || entry?.validation !== "ready";
        });`);
edit('        updateSelection();\n      }','        updateSelection();\n        updateCheckedSummary();\n        updatePreviewPageSelection();\n      }');
edit('          checkbox.disabled = state.busy;', '          checkbox.disabled = state.busy || entry.validation !== "ready";');
edit('          details.append(name);', `          const countLabel = document.createElement("p");
          countLabel.className = "page-count";
          countLabel.dataset.validation = entry.validation;
          details.append(name, countLabel);
          if (entry.validation === "ready") {
            const label = document.createElement("label");
            label.className = "page-range-label";
            label.htmlFor = "page-range-" + entry.id;
            label.textContent = "หน้าที่รวม";
            const range = document.createElement("input");
            range.type = "text";
            range.className = "page-range";
            range.id = label.htmlFor;
            range.dataset.rangeId = String(entry.id);
            range.value = entry.rangeText;
            range.placeholder = "ทุกหน้า หรือ 1-3, 7";
            range.disabled = state.busy;
            range.setAttribute("aria-label", "หน้าที่รวมจาก " + entry.file.name);
            range.setAttribute("aria-describedby", "range-error-" + entry.id + " pageRangeHelp");
            const error = document.createElement("p");
            error.className = "range-error";
            error.id = "range-error-" + entry.id;
            error.setAttribute("aria-live", "polite");
            details.append(label, range, error);
          }`);
edit('          const copy = createRowButton("คัดลอก", "คัดลอกไฟล์ " + entry.file.name, "copy", entry.id, false);\n          actionGroup.append(view, copy, remove);','          actionGroup.append(view, remove);');
edit('        fileList.append(fragment);','        fileList.append(fragment);\n        state.files.forEach(refreshPageRow);');
let start=app.indexOf('      function addFiles(fileCollection) {'), end=app.indexOf('      function moveEntry(',start);
if(start<0||end<0)throw Error('AddFiles markers');app=app.slice(0,start)+app.slice(end);
edit('        if (previewId === id) resetPreview();\n        state.files.splice(index, 1);', '        if (previewId === id) resetPreview();\n        rememberDeletion([{ entry: state.files[index], index }]);\n        state.files.splice(index, 1);');
edit('        const filesToMerge = state.files.filter((entry) => entry.checked);', `        if (state.files.some((entry) => entry.checked && entry.rangeError)) {
          announce("กรุณาแก้ไขช่วงหน้าที่เลือกให้ถูกต้องก่อนรวม", "error");
          return;
        }
        const filesToMerge = state.files.filter((entry) => entry.checked && entry.validation === "ready");`);
edit('mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())', 'mergedPdf.copyPages(sourcePdf, pageNumbers(entry).map((number) => number - 1))');
edit('appendRasterPages(mergedPdf, bytes, entry.file.name)', 'appendRasterPages(mergedPdf, bytes, entry.file.name, pageNumbers(entry))');
start=app.indexOf('      function updateCheckedSummary() {');end=app.indexOf('      function loadPdf(',start);
app=app.slice(0,start)+fs.readFileSync('tmp/pdf-merger/selection-features.js','utf8')+'\n'+app.slice(end);
edit('async function appendRasterPages(target, data, filename)', 'async function appendRasterPages(target, data, filename, pages)');
edit('for (let pageIndex = 1; pageIndex <= source.numPages; pageIndex++) {','for (const pageIndex of pages) {');
edit('          return source.numPages;', '          return pages.length;');
edit('        previewControls.hidden = true;', '        previewControls.hidden = true;\n        previewSelection.hidden = true;');
edit('        previewPage.textContent = `หน้า ${pageNumber} / ${doc.numPages} · ${Math.round(previewZoom * 100)}%`;', '        previewPage.textContent = `หน้า ${pageNumber} / ${doc.numPages} · ${Math.round(previewZoom * 100)}%`;\n        updatePreviewPageSelection();');
start=app.indexOf('      const helperStatus =');end=app.indexOf('      checkAll.addEventListener',start);
if(start<0||end<0)throw Error('Java code markers');app=app.slice(0,start)+app.slice(end);
edit('state.files.forEach((entry) => { entry.checked = checkAll.checked; });', 'state.files.forEach((entry) => { entry.checked = entry.validation === "ready" && checkAll.checked; });');
edit('        entry.checked = event.target.checked;', '        entry.checked = entry.validation === "ready" && event.target.checked;');
edit('        updateCheckedSummary();\n      });\n      qualityMode', '        updateCheckedSummary();\n        updatePreviewPageSelection();\n      });\n      qualityMode');
// Remove the row copy branch, retaining the preview branch closing brace.
edit(`        } else if (button.dataset.action === "copy") {
          const entry = state.files.find((entry) => entry.id === id);
          if (entry) copyPdf(entry.file, entry.file.name);
        }`, '        }');
edit('        resetPreview();\n        state.files = [];', '        resetPreview();\n        if (state.files.length) rememberDeletion(state.files.map((entry, index) => ({ entry, index })));\n        state.files = [];');
page('          <button class="button button-secondary" id="copyResult" type="button" disabled>คัดลอกไฟล์ผลลัพธ์</button>\n','');
page('        <p class="helper-status" id="helperStatus" role="status">ตรวจสอบตัวช่วยคัดลอกไฟล์ Java…</p>\n','');
const helpStart=html.indexOf('        <p class="clipboard-help">');
const helpEnd=html.indexOf('</p>',helpStart);
if(helpStart<0||helpEnd<0)throw Error('Clipboard help');html=html.slice(0,helpStart)+html.slice(helpEnd+4);
page('        <section class="list-section"', `        <div class="history-bar">
          <button class="button button-secondary" id="undoDelete" type="button" disabled>↶ กู้รายการที่ลบ</button>
          <span id="historyNote"></span>
        </div>
        <p class="warning" id="validationSummary" role="status" hidden></p>
        <section class="list-section"`);
page('          <p class="summary-line" id="orderHelp">', `          <p class="page-range-help" id="pageRangeHelp">เลือกหน้า: เว้นว่าง = ทุกหน้า หรือระบุเช่น 1-3, 7 · รวมตามลำดับหน้าต้นฉบับ</p>
          <p class="summary-line" id="orderHelp">`);
page('      <div class="preview-body" id="previewBody">', `      <div class="preview-selection" id="previewSelection" hidden>
        <label><input id="previewPageCheck" type="checkbox"> รวมหน้านี้</label>
        <span id="previewSelectionCount"></span>
        <button class="button button-secondary" id="selectAllPages" type="button">เลือกทุกหน้า</button>
      </div>
      <div class="preview-body" id="previewBody">`);
page('  </main>', `  </main>
  <dialog id="duplicateDialog" aria-labelledby="duplicateTitle">
    <form method="dialog">
      <h2 id="duplicateTitle">พบไฟล์ซ้ำ</h2>
      <p><strong id="duplicateName"></strong></p>
      <p>ข้อมูลในไฟล์เหมือนกับ <strong id="duplicateOriginal"></strong> ที่มีอยู่ในรายการแล้ว</p>
      <p>ต้องการเพิ่มอีกครั้งหรือข้ามไฟล์นี้?</p>
      <div class="duplicate-actions">
        <button class="button button-secondary" value="skip" id="skipDuplicate" autofocus>ข้ามไฟล์นี้</button>
        <button class="button button-primary" value="add" id="addDuplicate">เพิ่มซ้ำ</button>
      </div>
    </form>
  </dialog>`);
page('  </style>', `
    .file-table th:last-child { width: 80px; }
    .page-count { margin: 3px 0; font-size: 12px; color: var(--green); white-space: normal; }
    .page-count[data-validation="error"] { color: var(--red); }
    .page-count[data-validation="checking"] { color: var(--muted); }
    .page-range-label { display: block; margin-top: 6px; font-size: 11px; color: var(--muted); }
    .page-range { width: 100%; min-width: 0; min-height: 30px; border: 1px solid var(--line); border-radius: 6px; padding: 4px 6px; background: white; color: var(--ink); font-size: 12px; }
    .page-range[aria-invalid="true"] { border-color: var(--red); background: var(--red-soft); }
    .range-error { margin: 4px 0 0; color: var(--red); font-size: 11px; overflow-wrap: anywhere; }
    .page-range-help { margin: 10px 0 0; color: var(--muted); font-size: 12px; }
    .history-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
    .history-bar .button { min-height: 34px; padding: 6px 10px; font-size: 12px; }
    #historyNote { color: var(--muted); font-size: 11px; flex: 1 1 130px; }
    #validationSummary:not([hidden]) { display: block; }
    .selection-summary { flex: 1 1 100%; font-size: 14px; font-weight: 700; }
    .preview-selection { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 10px; font-size: 13px; }
    .preview-selection > span { color: var(--muted); margin-right: auto; }
    .preview-selection .button { padding: 5px 10px; min-height: 32px; font-size: 12px; }
    .preview-body { height: calc(100vh - 295px); }
    #duplicateDialog { width: min(460px, calc(100% - 32px)); border: 1px solid var(--line); border-radius: 18px; padding: 24px; color: var(--ink); box-shadow: var(--shadow); }
    #duplicateDialog::backdrop { background: #12233f70; }
    #duplicateDialog h2 { margin-top: 0; font-size: 22px; }
    #duplicateDialog p { overflow-wrap: anywhere; font-size: 14px; }
    .duplicate-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    @media (max-width: 680px) { .file-table { min-width: 440px; } .preview-body { height: 65vh; } }
  </style>`);
const appStart=html.lastIndexOf('<script>');
const appEnd=html.indexOf('</script>',appStart);
if(appStart<0||appEnd<0)throw Error('Script markers');
html=html.slice(0,appStart)+'<script>\n'+app+'\n  '+html.slice(appEnd);
for(const file of ['PDF_MERGER.html','PDF_MERGER/index.html']) fs.writeFileSync(file,html);
fs.writeFileSync('tmp/pdf-merger/app-selection.js',app);
console.log('Updated HTML pages with validation, page selection, undo and duplicate checks');
