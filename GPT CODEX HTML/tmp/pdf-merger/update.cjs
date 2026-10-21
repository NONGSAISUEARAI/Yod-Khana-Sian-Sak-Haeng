const fs = require('fs');
let html = fs.readFileSync('PDF_MERGER.html', 'utf8').replace(/\r\n/g, '\n');
function change(from, to) {
  if (!html.includes(from)) throw new Error('Missing replacement: ' + from.slice(0, 100));
  html = html.replace(from, () => to);
}
change("script-src 'unsafe-inline';", "script-src 'unsafe-inline' blob:; worker-src blob:;");
change("connect-src 'none';", "font-src blob: data:; connect-src blob:;");
change('button, input { font: inherit; }', 'button, input, select { font: inherit; }');
change('width: min(920px, calc(100% - 32px));', 'width: min(1500px, calc(100% - 32px));');
change('  </style>', `
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(340px, 1fr); align-items: start; gap: 20px; }
    .workspace-grid > * { min-width: 0; }
    .preview-panel { position: sticky; top: 16px; padding: 18px; }
    .preview-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .preview-head h2 { margin: 0; font-size: 17px; }
    .preview-name { margin: 0 0 12px; overflow-wrap: anywhere; font-size: 13px; color: var(--muted); }
    .preview-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
    .preview-controls button { min-height: 34px; padding: 5px 10px; }
    .preview-page { font-size: 13px; color: var(--muted); margin-right: auto; }
    .preview-body { display: grid; place-items: start center; overflow: auto; height: min(69vh, 850px); min-height: 240px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #e6edf6; }
    .preview-body canvas { display: block; max-width: none; box-shadow: 0 3px 16px #12233f20; }
    .preview-placeholder { align-self: center; text-align: center; color: var(--muted); font-size: 14px; }
    [hidden] { display: none !important; }
    .file-table th:first-child { width: 42px; text-align: center; }
    .file-table th:nth-child(2) { width: 72px; }
    .file-table th:nth-child(3) { width: auto; }
    .file-table th:nth-child(4) { width: 85px; }
    .file-table th:last-child { width: 116px; }
    .check-cell { text-align: center; }
    input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--blue); cursor: pointer; vertical-align: middle; }
    .row-actions .icon-button { width: auto; min-width: 28px; padding: 0 7px; font-size: 12px; }
    .quality-field { grid-column: 1 / -1; }
    .quality-field select { width: 100%; border: 1px solid #b9c7d9; border-radius: 10px; padding: 9px 12px; color: var(--ink); background: #fff; }
    .quality-help, .clipboard-help { margin: 7px 0 0; font-size: 12px; color: var(--muted); }
    .result-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
    .result-actions .download-again { margin: 0; }
    .selection-summary { font-size: 13px; color: var(--blue-dark); }
    @media (max-width: 1100px) { .workspace-grid { grid-template-columns: 1fr; } .preview-panel { position: static; } .preview-body { height: 65vh; } .page-shell { max-width: 920px; } }
    @media (max-width: 680px) { .preview-panel { padding: 14px; } .file-table { min-width: 520px; } }
  </style>`);
change('    <section class="card" id="app"', '    <div class="workspace-grid">\n    <section class="card" id="app"');
change('    <p class="footer-note">', `    <aside class="card preview-panel" aria-labelledby="previewTitle">
      <div class="preview-head"><h2 id="previewTitle">พรีวิวไฟล์ PDF</h2><button class="clear-button" id="closePreview" type="button" hidden>ปิดพรีวิว</button></div>
      <p class="preview-name" id="previewName">กด “ดู” ที่ไฟล์ในรายการเพื่อเปิดพรีวิว</p>
      <div class="preview-controls" id="previewControls" hidden>
        <button class="button button-secondary" id="prevPage" type="button" aria-label="หน้าก่อนหน้า">‹</button>
        <span class="preview-page" id="previewPage" aria-live="polite"></span>
        <button class="button button-secondary" id="nextPage" type="button" aria-label="หน้าถัดไป">›</button>
        <button class="button button-secondary" id="zoomOut" type="button" aria-label="ย่อพรีวิว">−</button>
        <button class="button button-secondary" id="zoomIn" type="button" aria-label="ขยายพรีวิว">＋</button>
      </div>
      <div class="preview-body" id="previewBody"><p class="preview-placeholder" id="previewMessage" role="status">ยังไม่ได้เปิดไฟล์</p></div>
    </aside>
    </div>
    <p class="footer-note">`);
change('              <span class="selection-label"', '              <span class="selection-summary" id="checkedSummary"></span>\n              <span class="selection-label"');
change('                  <th scope="col"><button class="sort-button"', '                  <th scope="col"><input type="checkbox" id="checkAll" aria-label="เลือกไฟล์ทั้งหมดเพื่อรวม" checked></th>\n                  <th scope="col"><button class="sort-button"');
change('        <div class="output-panel">', `        <div class="output-panel">
          <div class="quality-field">
            <label class="field-label" for="qualityMode">คุณภาพไฟล์ผลลัพธ์</label>
            <select id="qualityMode">
              <option value="original">ต้นฉบับ — รักษาคุณภาพและข้อความเดิม</option>
              <option value="high">สูง — ภาพ 200 DPI / JPEG 90%</option>
              <option value="low">ต่ำ — ภาพ 96 DPI / JPEG 60%</option>
            </select>
            <p class="quality-help" id="qualityHelp">รวมเฉพาะไฟล์ที่ติ๊กถูก ตามลำดับในรายการ โดยรักษาคุณภาพต้นฉบับ</p>
          </div>`);
change('        <button class="button button-secondary download-again" id="downloadAgain" type="button">ดาวน์โหลดอีกครั้ง</button>', `        <div class="result-actions">
          <button class="button button-secondary download-again" id="downloadAgain" type="button">ดาวน์โหลดอีกครั้ง</button>
          <button class="button button-secondary" id="copyResult" type="button" disabled>คัดลอกไฟล์ผลลัพธ์</button>
          <button class="button button-secondary" id="previewResult" type="button" disabled>ดูไฟล์ผลลัพธ์</button>
        </div>
        <p class="clipboard-help">การคัดลอกไฟล์ PDF เข้า Clipboard ขึ้นอยู่กับการรองรับของเบราว์เซอร์ หากไม่รองรับให้ดาวน์โหลด แล้วคัดลอกไฟล์จากโฟลเดอร์ Downloads</p>`);
change('      const state = {', `      const qualityMode = document.getElementById("qualityMode");
      const qualityHelp = document.getElementById("qualityHelp");
      const checkAll = document.getElementById("checkAll");
      const checkedSummary = document.getElementById("checkedSummary");
      const copyResult = document.getElementById("copyResult");
      const previewResult = document.getElementById("previewResult");
      const previewBody = document.getElementById("previewBody");
      const previewName = document.getElementById("previewName");
      const previewControls = document.getElementById("previewControls");
      const previewPage = document.getElementById("previewPage");
      const prevPage = document.getElementById("prevPage");
      const nextPage = document.getElementById("nextPage");
      const closePreview = document.getElementById("closePreview");
      let previewDoc = null, previewTask = null, previewRender = null, previewToken = 0;
      let previewId = null, pageNumber = 1, previewZoom = 1;

      const state = {`);
change('        state.resultBlob = null;', `        state.resultBlob = null;
        copyResult.disabled = true;
        previewResult.disabled = true;
        if (previewId === "result") resetPreview();`);
change('        mergeButton.disabled = busy || state.files.length === 0;', `        qualityMode.disabled = busy;
        checkAll.disabled = busy;
        mergeButton.disabled = busy || !state.files.some((entry) => entry.checked);
        copyResult.disabled = busy || !state.resultBlob;
        previewResult.disabled = busy || !state.resultBlob;
        fileList.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.disabled = busy; });`);
change('          const number = document.createElement("td");', `          const checkCell = document.createElement("td");
          checkCell.className = "check-cell";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = entry.checked;
          checkbox.disabled = state.busy;
          checkbox.dataset.checkId = String(entry.id);
          checkbox.setAttribute("aria-label", "รวม " + entry.file.name);
          checkCell.append(checkbox);

          const number = document.createElement("td");`);
change('          actionGroup.append(remove);', `          const view = createRowButton("ดู", "ดู " + entry.file.name, "preview", entry.id, false);
          const copy = createRowButton("คัดลอก", "คัดลอกไฟล์ " + entry.file.name, "copy", entry.id, false);
          actionGroup.append(view, copy, remove);`);
change('          item.append(number, details, size, actions);', '          item.append(checkCell, number, details, size, actions);');
change('        mergeButton.disabled = state.busy || count === 0;', '        updateCheckedSummary();');
change('state.files.push({ id: state.nextId++, file });', 'state.files.push({ id: state.nextId++, file, checked: true });');
change('        state.files.splice(index, 1);', '        if (previewId === id) resetPreview();\n        state.files.splice(index, 1);');
change('        if (!state.files.length) {', '        const filesToMerge = state.files.filter((entry) => entry.checked);\n        if (!filesToMerge.length) {');
change('กรุณาเลือกไฟล์ PDF อย่างน้อย 1 ไฟล์', 'กรุณาติ๊กเลือกไฟล์ PDF อย่างน้อย 1 ไฟล์');
change('progressBar.max = state.files.length;', 'progressBar.max = filesToMerge.length;');
change('index < state.files.length; index += 1', 'index < filesToMerge.length; index += 1');
change('const entry = state.files[index];', 'const entry = filesToMerge[index];');
change('จาก ${state.files.length}:', 'จาก ${filesToMerge.length}:');
change(`            const sourcePdf = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
            const sourceIndices = sourcePdf.getPageIndices();
            const copiedPages = await mergedPdf.copyPages(sourcePdf, sourceIndices);
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            totalPages += copiedPages.length;`, `            if (qualityMode.value === "original") {
              const sourcePdf = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
              const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));
              totalPages += copiedPages.length;
            } else {
              totalPages += await appendRasterPages(mergedPdf, bytes, entry.file.name);
            }`);
change('          downloadAgain.disabled = false;', '          copyResult.disabled = false;\n          previewResult.disabled = false;\n          downloadAgain.disabled = false;');
change('        else if (button.dataset.action === "remove") removeEntry(id);', `        else if (button.dataset.action === "remove") removeEntry(id);
        else if (button.dataset.action === "preview") {
          const entry = state.files.find((entry) => entry.id === id);
          if (entry) openPreview(entry.file, entry.file.name, id);
        } else if (button.dataset.action === "copy") {
          const entry = state.files.find((entry) => entry.id === id);
          if (entry) copyPdf(entry.file, entry.file.name);
        }`);
change('        state.files = [];', '        resetPreview();\n        state.files = [];');
change('      fileInput.addEventListener("change",', fs.readFileSync('tmp/pdf-merger/features.js','utf8') + '\n      fileInput.addEventListener("change",');
const pdfjs = fs.readFileSync('tmp/pdf-merger/pdf.mjs','utf8').replace(/^export \{[^\n]+\};/m, 'window.pdfjsLib = { getDocument, GlobalWorkerOptions };').replace(/^\/\/# sourceMappingURL=.*$/mg, '');
const worker = fs.readFileSync('tmp/pdf-merger/pdf.worker.mjs','utf8').replace(/^\/\/# sourceMappingURL=.*$/mg, '');
change('  <script>\n/*! pdf-lib', `<script type="application/json" id="pdfWorkerSource">${JSON.stringify(worker).replace(/</g,'\\u003c')}</script>
<script type="module">
${pdfjs.replace(/<\/script/gi,'<\\/script')}
window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([JSON.parse(document.getElementById("pdfWorkerSource").textContent)], {type:"text/javascript"}));
</script>
  <script>\n/*! pdf-lib`);
fs.writeFileSync('PDF_MERGER.html', html);
fs.writeFileSync('PDF_MERGER/index.html', html);
console.log('Updated both PDF Merger pages');
