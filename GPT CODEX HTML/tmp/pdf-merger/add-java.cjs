const fs=require('fs');
let html=fs.readFileSync('PDF_MERGER.html','utf8');
function replace(a,b){if(!html.includes(a))throw Error('Missing '+a.slice(0,60));html=html.replace(a,()=>b);}
replace('connect-src blob:;',"connect-src 'self' blob:;");
replace('  </style>',`
    .page-shell { width: calc(100% - 16px); max-width: none; margin: 0 8px; padding: 20px 0 24px; }
    .workspace-grid { grid-template-columns: clamp(440px, 34vw, 560px) minmax(0, 1fr); gap: 14px; }
    .content { padding: 16px; }
    .privacy { padding: 12px 16px; font-size: 12px; }
    .output-panel { grid-template-columns: 1fr; gap: 10px; }
    .merge-button { width: 100%; min-width: 0; }
    .preview-panel { padding: 14px; top: 8px; }
    .preview-body { height: calc(100vh - 250px); min-height: 420px; }
    .drop-zone { padding: 12px; min-height: 90px; }
    .drop-zone > div { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; }
    .drop-zone .upload-icon { display: none; }
    .drop-zone .drop-title, .drop-zone .drop-help { grid-column: 1; }
    .drop-zone .drop-title { font-size: 15px; }
    .drop-zone .drop-help { font-size: 12px; }
    .drop-zone .button { grid-column: 2; font-size: 13px; padding: 8px 10px; }
    .file-table th:nth-child(2) { width: 55px; }
    .file-table th:nth-child(4) { width: 68px; }
    .file-table th:last-child { width: 138px; }
    .file-table td { padding-inline: 6px; }
    .sort-button { padding-inline: 6px; }
    .helper-status { margin: 10px 0 0; padding: 9px 11px; border-radius: 9px; color: var(--muted); background: var(--surface-soft); font-size: 12px; }
    .helper-status.is-ready { color: var(--green); background: var(--green-soft); }
    @media (max-width: 1000px) { .workspace-grid { grid-template-columns: minmax(0,1fr); } .preview-panel { position: static; } .preview-body { height: 70vh; min-height: 300px; } }
    @media (min-width: 1001px) and (max-width: 1100px) { .workspace-grid { grid-template-columns: 440px minmax(0,1fr); } .preview-panel { position: sticky; } }
  </style>`);
replace('        <p class="clipboard-help">การคัดลอกไฟล์ PDF เข้า Clipboard ขึ้นอยู่กับการรองรับของเบราว์เซอร์ หากไม่รองรับให้ดาวน์โหลด แล้วคัดลอกไฟล์จากโฟลเดอร์ Downloads</p>',`        <p class="helper-status" id="helperStatus" role="status">ตรวจสอบตัวช่วยคัดลอกไฟล์ Java…</p>
        <p class="clipboard-help">เปิดด้วย START_PDF_MERGER.cmd เพื่อใช้ Java คัดลอกไฟล์จริง แล้วกด Ctrl+V ในโฟลเดอร์หรือแอปที่รับไฟล์ได้ ไฟล์ที่คัดลอกเก็บไว้ใน PDF_MERGER/java-helper/clipboard-files</p>`);
const start=html.indexOf('      async function copyPdf(blob, name) {');
const end=html.indexOf('      checkAll.addEventListener',start);
if(start<0||end<0)throw Error('Copy function missing');
html=html.slice(0,start)+`
      const helperStatus = document.getElementById("helperStatus");
      const javaHelperBase = location.protocol === "http:" && location.hostname === "127.0.0.1" && /^\\/[a-f0-9]{48}\\/$/.test(location.pathname)
        ? new URL(".", location.href) : null;
      let copyingFile = false;
      if (javaHelperBase) {
        fetch(new URL("health", javaHelperBase), { signal: AbortSignal.timeout(5000) })
          .then(async (response) => {
            if (!response.ok || await response.text() !== "PDF_MERGER_JAVA_READY") throw Error("not ready");
            helperStatus.textContent = "✓ Java พร้อมใช้งาน — คัดลอกเป็นไฟล์จริงแล้วกด Ctrl+V ได้";
            helperStatus.classList.add("is-ready");
          }).catch(() => { helperStatus.textContent = "ตัวช่วย Java ไม่ตอบสนอง กรุณาเปิด START_PDF_MERGER.cmd อีกครั้ง"; });
      } else {
        helperStatus.textContent = "ต้องการคัดลอกไฟล์: เปิด START_PDF_MERGER.cmd แล้วใช้งานจากหน้าที่เปิดขึ้น";
      }

      async function copyPdf(blob, name) {
        if (copyingFile) return;
        copyingFile = true;
        copyResult.disabled = true;
        fileList.querySelectorAll('[data-action="copy"]').forEach((button) => { button.disabled = true; });
        try {
          if (javaHelperBase) {
            announce("กำลังคัดลอกไฟล์ผ่าน Java…", "success");
            const endpoint = new URL("clipboard", javaHelperBase);
            endpoint.searchParams.set("name", safeOutputName(name));
            const response = await fetch(endpoint, {
              method: "POST", headers: { "Content-Type": "application/pdf", "X-PDF-Merger": "1" },
              body: blob, signal: AbortSignal.timeout(120000)
            });
            if (response.status === 413) throw Error("FILE_TOO_LARGE");
            if (!response.ok || await response.text() !== "PDF_FILE_COPIED") throw Error("HELPER_FAILED");
            announce("คัดลอกไฟล์ “" + name + "” แล้ว — กด Ctrl+V ในโฟลเดอร์หรือแอปที่รับไฟล์ได้", "success");
          } else if (navigator.clipboard?.write && window.ClipboardItem && ClipboardItem.supports?.("application/pdf")) {
            await navigator.clipboard.write([new ClipboardItem({ "application/pdf": blob })]);
            announce("คัดลอก PDF “" + name + "” เข้า Clipboard แล้ว", "success");
          } else {
            announce("กรุณาเปิด START_PDF_MERGER.cmd แล้วใช้ปุ่มคัดลอกจากหน้าที่เปิดขึ้น เพื่อให้ Java คัดลอกไฟล์เข้า Clipboard ของ Windows", "error");
          }
        } catch (error) {
          announce(error.message === "FILE_TOO_LARGE"
            ? "ตัวช่วย Java รองรับไฟล์ไม่เกิน 512 MB กรุณาลดขนาดหรือดาวน์โหลดแทน"
            : "คัดลอกไม่ได้ กรุณาเปิด START_PDF_MERGER.cmd อีกครั้ง แล้วลองใหม่ (Clipboard อาจถูกใช้งานโดยโปรแกรมอื่น)", "error");
        } finally {
          copyingFile = false;
          copyResult.disabled = state.busy || !state.resultBlob;
          fileList.querySelectorAll('[data-action="copy"]').forEach((button) => { button.disabled = state.busy; });
        }
      }

`+html.slice(end);
for(const file of ['PDF_MERGER.html','PDF_MERGER/index.html'])fs.writeFileSync(file,html);
