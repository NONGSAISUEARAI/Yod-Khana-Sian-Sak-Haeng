      function updateCheckedSummary() {
        const checkedCount = state.files.filter((entry) => entry.checked).length;
        checkedSummary.textContent = `ติ๊กเพื่อรวม ${checkedCount} / ${state.files.length} ไฟล์`;
        checkAll.checked = state.files.length > 0 && checkedCount === state.files.length;
        checkAll.indeterminate = checkedCount > 0 && checkedCount < state.files.length;
        mergeButton.disabled = state.busy || checkedCount === 0;
      }

      function loadPdf(data) {
        if (!window.pdfjsLib) throw new Error("PDF_RENDERER_UNAVAILABLE");
        return window.pdfjsLib.getDocument({
          data: new Uint8Array(data), isEvalSupported: false,
          useSystemFonts: true, useWasm: false, isOffscreenCanvasSupported: false,
          stopAtErrors: true
        });
      }

      async function appendRasterPages(target, data, filename) {
        const task = loadPdf(data);
        let source;
        try {
          source = await task.promise;
          const high = qualityMode.value === "high";
          for (let pageIndex = 1; pageIndex <= source.numPages; pageIndex++) {
            progressLabel.textContent = `กำลังปรับคุณภาพ: ${filename} — หน้า ${pageIndex}/${source.numPages}`;
            const page = await source.getPage(pageIndex);
            const natural = page.getViewport({ scale: 1 });
            const scale = Math.min((high ? 200 : 96) / 72, Math.sqrt(20000000 / (natural.width * natural.height)), 10000 / Math.max(natural.width, natural.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            try {
              await page.render({ canvasContext: canvas.getContext("2d"), viewport, background: "rgb(255,255,255)" }).promise;
              const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("IMAGE_ENCODE_FAILED")), "image/jpeg", high ? .9 : .6));
              const image = await target.embedJpg(await blob.arrayBuffer());
              const outputPage = target.addPage([natural.width, natural.height]);
              outputPage.drawImage(image, { x: 0, y: 0, width: natural.width, height: natural.height });
            } finally {
              canvas.width = canvas.height = 0;
              page.cleanup();
            }
          }
          return source.numPages;
        } finally {
          await task.destroy();
        }
      }

      function previewMessage(message) {
        const text = document.createElement("p");
        text.className = "preview-placeholder";
        text.setAttribute("role", "status");
        text.textContent = message;
        previewBody.replaceChildren(text);
      }

      function resetPreview() {
        previewToken++;
        if (previewRender) previewRender.cancel();
        previewRender = null;
        if (previewTask) previewTask.destroy().catch(() => {});
        previewTask = null;
        previewDoc = null;
        previewId = null;
        previewControls.hidden = true;
        closePreview.hidden = true;
        previewName.textContent = 'กด “ดู” ที่ไฟล์ในรายการเพื่อเปิดพรีวิว';
        previewMessage("ยังไม่ได้เปิดไฟล์");
      }

      async function openPreview(file, name, id) {
        resetPreview();
        const token = previewToken;
        previewId = id;
        previewName.textContent = name;
        closePreview.hidden = false;
        previewMessage("กำลังเปิดไฟล์…");
        pageNumber = 1;
        previewZoom = 1;
        try {
          const bytes = await file.arrayBuffer();
          if (token !== previewToken) return;
          previewTask = loadPdf(bytes);
          const doc = await previewTask.promise;
          if (token !== previewToken) return;
          previewDoc = doc;
          previewControls.hidden = false;
          await renderPreview();
        } catch (error) {
          if (token !== previewToken) return;
          previewControls.hidden = true;
          previewMessage(/password|encrypted/i.test(String(error)) ? "ไฟล์มีรหัสผ่าน กรุณาปลดรหัสก่อนดู" : "เปิดพรีวิวไม่ได้ ไฟล์อาจเสียหายหรือไม่รองรับ");
        }
      }

      async function renderPreview() {
        if (!previewDoc) return;
        const doc = previewDoc;
        const token = ++previewToken;
        if (previewRender) previewRender.cancel();
        prevPage.disabled = pageNumber <= 1;
        nextPage.disabled = pageNumber >= doc.numPages;
        previewPage.textContent = `หน้า ${pageNumber} / ${doc.numPages} · ${Math.round(previewZoom * 100)}%`;
        try {
          const page = await doc.getPage(pageNumber);
          if (token !== previewToken) return;
          const natural = page.getViewport({ scale: 1 });
          const fit = Math.max(160, previewBody.clientWidth - 30) / natural.width;
          const scale = Math.min(fit * previewZoom * Math.min(window.devicePixelRatio || 1, 2), Math.sqrt(16000000 / (natural.width * natural.height)));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.setAttribute("aria-label", `พรีวิวหน้า ${pageNumber}`);
          canvas.setAttribute("role", "img");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = `${natural.width * fit * previewZoom}px`;
          canvas.style.height = `${natural.height * fit * previewZoom}px`;
          previewBody.replaceChildren(canvas);
          previewRender = page.render({ canvasContext: canvas.getContext("2d"), viewport, background: "rgb(255,255,255)" });
          await previewRender.promise;
          if (token === previewToken) previewRender = null;
        } catch (error) {
          if (token === previewToken && error.name !== "RenderingCancelledException") previewMessage("แสดงหน้านี้ไม่ได้ กรุณาลองหน้าอื่น");
        }
      }

      async function copyPdf(blob, name) {
        try {
          if (!navigator.clipboard?.write || !window.ClipboardItem || (ClipboardItem.supports && !ClipboardItem.supports("application/pdf"))) {
            announce("เบราว์เซอร์นี้ไม่รองรับการคัดลอกไฟล์ PDF เข้า Clipboard กรุณาดาวน์โหลดไฟล์ แล้วใช้ Ctrl+C ที่ไฟล์ในโฟลเดอร์ Downloads", "error");
            return;
          }
          await navigator.clipboard.write([new ClipboardItem({ "application/pdf": blob })]);
          announce(`คัดลอก PDF “${name}” เข้า Clipboard แล้ว`, "success");
        } catch (error) {
          announce("คัดลอกไฟล์ไม่ได้ เบราว์เซอร์อาจไม่รองรับหรือไม่อนุญาต กรุณาดาวน์โหลดแล้วคัดลอกไฟล์จากโฟลเดอร์ Downloads", "error");
        }
      }

      checkAll.addEventListener("change", () => {
        if (state.busy) return;
        state.files.forEach((entry) => { entry.checked = checkAll.checked; });
        invalidateResult();
        clearStatus();
        renderList();
      });
      fileList.addEventListener("change", (event) => {
        if (state.busy || !event.target.matches("input[data-check-id]")) return;
        const entry = state.files.find((entry) => entry.id === Number(event.target.dataset.checkId));
        if (!entry) return;
        entry.checked = event.target.checked;
        invalidateResult();
        clearStatus();
        updateCheckedSummary();
      });
      qualityMode.addEventListener("change", () => {
        invalidateResult();
        clearStatus();
        qualityHelp.textContent = qualityMode.value === "original"
          ? "รวมเฉพาะไฟล์ที่ติ๊กถูก ตามลำดับในรายการ โดยรักษาคุณภาพต้นฉบับ"
          : "โหมดสูง/ต่ำจะแปลงทุกหน้าเป็นภาพ ข้อความจะค้นหาหรือคัดลอกไม่ได้ และลิงก์/ฟอร์มจะใช้ไม่ได้ ขนาดไฟล์อาจใหญ่กว่าต้นฉบับ โดยเฉพาะเอกสารข้อความ";
      });
      closePreview.addEventListener("click", resetPreview);
      prevPage.addEventListener("click", () => { if (previewDoc && pageNumber > 1) { pageNumber--; renderPreview(); } });
      nextPage.addEventListener("click", () => { if (previewDoc && pageNumber < previewDoc.numPages) { pageNumber++; renderPreview(); } });
      document.getElementById("zoomIn").addEventListener("click", () => { previewZoom = Math.min(3, previewZoom + .25); renderPreview(); });
      document.getElementById("zoomOut").addEventListener("click", () => { previewZoom = Math.max(.5, previewZoom - .25); renderPreview(); });
      copyResult.addEventListener("click", () => { if (state.resultBlob) copyPdf(state.resultBlob, safeOutputName(outputName.value)); });
      previewResult.addEventListener("click", () => { if (state.resultBlob) openPreview(state.resultBlob, safeOutputName(outputName.value), "result"); });
      let previewResize;
      window.addEventListener("resize", () => { window.clearTimeout(previewResize); previewResize = window.setTimeout(() => renderPreview(), 150); });
      window.addEventListener("pagehide", () => { resetPreview(); });
