
    (() => {
      "use strict";

      const app = document.getElementById("app");
      const dropZone = document.getElementById("dropZone");
      const fileInput = document.getElementById("fileInput");
      const chooseLabel = document.getElementById("chooseLabel");
      const listSection = document.getElementById("listSection");
      const listTitle = document.getElementById("listTitle");
      const fileList = document.getElementById("fileList");
      const moveUpButton = document.getElementById("moveUpButton");
      const moveDownButton = document.getElementById("moveDownButton");
      const selectionLabel = document.getElementById("selectionLabel");
      const sizeSummary = document.getElementById("sizeSummary");
      const sizeWarning = document.getElementById("sizeWarning");
      const clearButton = document.getElementById("clearButton");
      const outputName = document.getElementById("outputName");
      const mergeButton = document.getElementById("mergeButton");
      const progressWrap = document.getElementById("progressWrap");
      const progressBar = document.getElementById("progressBar");
      const progressLabel = document.getElementById("progressLabel");
      const status = document.getElementById("status");
      const downloadAgain = document.getElementById("downloadAgain");

      const qualityMode = document.getElementById("qualityMode");
      const qualityHelp = document.getElementById("qualityHelp");
      const checkAll = document.getElementById("checkAll");
      const checkedSummary = document.getElementById("checkedSummary");
      const undoDelete = document.getElementById("undoDelete");
      const historyNote = document.getElementById("historyNote");
      const validationSummary = document.getElementById("validationSummary");
      const duplicateDialog = document.getElementById("duplicateDialog");
      const duplicateName = document.getElementById("duplicateName");
      const duplicateOriginal = document.getElementById("duplicateOriginal");
      const previewSelection = document.getElementById("previewSelection");
      const previewPageCheck = document.getElementById("previewPageCheck");
      const previewSelectionCount = document.getElementById("previewSelectionCount");
      const selectAllPages = document.getElementById("selectAllPages");
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

      const state = {
        files: [],
        deleted: [],
        selectedId: null,
        nextId: 1,
        busy: false,
        draggedId: null,
        sortKey: null,
        sortDirection: 1,
        resultBlob: null,
        resultName: "merged.pdf"
      };

      const LARGE_FILE_WARNING_BYTES = 250 * 1024 * 1024;

      function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
        const units = ["B", "KB", "MB", "GB"];
        const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const value = bytes / Math.pow(1024, unitIndex);
        return `${value.toLocaleString("th-TH", { maximumFractionDigits: unitIndex > 1 ? 1 : 0 })} ${units[unitIndex]}`;
      }

      function safeOutputName(rawName) {
        let name = String(rawName || "").trim();
        name = name.replace(/[<>:\"/\\|?*\u0000-\u001F]/g, "_");
        name = name.replace(/[. ]+$/g, "").trim();
        name = name.replace(/\.pdf$/i, "");
        if (!name) name = "merged";
        if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
        return `${name.slice(0, 170)}.pdf`;
      }

      function isProbablyPdf(file) {
        return file && (/\.pdf$/i.test(file.name) || file.type === "application/pdf");
      }

      function announce(message, type) {
        status.textContent = message;
        status.className = `status is-visible ${type}`;
        if (type === "error") status.setAttribute("role", "alert");
        else status.removeAttribute("role");
      }

      function clearStatus() {
        status.textContent = "";
        status.className = "status";
        status.removeAttribute("role");
      }

      function invalidateResult() {
        state.resultBlob = null;
        previewResult.disabled = true;
        if (previewId === "result") resetPreview();
        downloadAgain.classList.remove("is-visible");
        downloadAgain.disabled = true;
      }

      function setBusy(busy) {
        state.busy = busy;
        app.setAttribute("aria-busy", String(busy));
        dropZone.classList.toggle("is-disabled", busy);
        fileInput.disabled = busy;
        outputName.disabled = busy;
        clearButton.disabled = busy;
        qualityMode.disabled = busy;
        checkAll.disabled = busy;
        mergeButton.disabled = busy || !state.files.some((entry) => entry.checked);
        previewResult.disabled = busy || !state.resultBlob;
        fileList.querySelectorAll("input").forEach((input) => {
          const entry = state.files.find((entry) => entry.id === Number(input.dataset.checkId || input.dataset.rangeId));
          input.disabled = busy || entry?.validation !== "ready";
        });
        chooseLabel.setAttribute("aria-disabled", String(busy));
        fileList.querySelectorAll("button").forEach((button) => { button.disabled = busy || button.dataset.boundary === "true"; });
        updateSelection();
        updateCheckedSummary();
        updatePreviewPageSelection();
      }

      function updateSelection() {
        const index = state.files.findIndex((entry) => entry.id === state.selectedId);
        fileList.querySelectorAll(".file-row").forEach((row) => {
          const selected = Number(row.dataset.id) === state.selectedId;
          row.classList.toggle("is-selected", selected);
          if (selected) row.setAttribute("aria-current", "true");
          else row.removeAttribute("aria-current");
        });
        moveUpButton.disabled = state.busy || index <= 0;
        moveDownButton.disabled = state.busy || index < 0 || index >= state.files.length - 1;
        selectionLabel.textContent = index < 0 ? "คลิกเลือกไฟล์ในรายการเพื่อเลื่อนลำดับ" : `เลือก: ${state.files[index].file.name}`;
        selectionLabel.title = index < 0 ? "" : state.files[index].file.name;
      }

      function renderList(focusId, focusAction) {
        if (!state.files.some((entry) => entry.id === state.selectedId)) state.selectedId = state.files[0]?.id ?? null;
        fileList.replaceChildren();
        const fragment = document.createDocumentFragment();

        state.files.forEach((entry, index) => {
          const item = document.createElement("tr");
          item.className = "file-row";
          item.dataset.id = String(entry.id);
          item.draggable = !state.busy;
          item.tabIndex = 0;
          item.setAttribute("aria-label", `ลำดับ ${index + 1}: ${entry.file.name}`);

          const checkCell = document.createElement("td");
          checkCell.className = "check-cell";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = entry.checked;
          checkbox.disabled = state.busy || entry.validation !== "ready";
          checkbox.dataset.checkId = String(entry.id);
          checkbox.setAttribute("aria-label", "รวม " + entry.file.name);
          checkCell.append(checkbox);

          const number = document.createElement("td");
          number.className = "order-number";
          number.textContent = String(index + 1);

          const details = document.createElement("td");
          details.className = "file-details";

          const name = document.createElement("p");
          name.className = "file-name";
          name.textContent = entry.file.name;
          name.title = entry.file.name;

          const countLabel = document.createElement("p");
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
          }

          const size = document.createElement("td");
          size.className = "file-size";
          size.textContent = formatBytes(entry.file.size);

          const actions = document.createElement("td");
          actions.className = "actions-cell";
          const actionGroup = document.createElement("div");
          actionGroup.className = "row-actions";

          const remove = createRowButton("×", `ลบ ${entry.file.name}`, "remove", entry.id, false);
          remove.classList.add("remove");
          const view = createRowButton("ดู", "ดู " + entry.file.name, "preview", entry.id, false);
          actionGroup.append(view, remove);
          actions.append(actionGroup);

          item.append(checkCell, number, details, size, actions);
          fragment.append(item);
        });

        fileList.append(fragment);
        state.files.forEach(refreshPageRow);
        updateSelection();
        const count = state.files.length;
        const totalSize = state.files.reduce((sum, entry) => sum + entry.file.size, 0);
        listSection.classList.toggle("is-visible", count > 0);
        listTitle.textContent = `ไฟล์ที่เลือก (${count.toLocaleString("th-TH")})`;
        sizeSummary.textContent = count ? `ขนาดรวม ${formatBytes(totalSize)}` : "";
        sizeWarning.classList.toggle("is-visible", totalSize >= LARGE_FILE_WARNING_BYTES);
        updateCheckedSummary();

        if (focusId != null) {
          const row = fileList.querySelector(`.file-row[data-id="${focusId}"]`);
          const target = focusAction && row ? row.querySelector(`[data-action="${focusAction}"]`) : row;
          if (target && !target.disabled) target.focus();
          else if (row) row.focus();
        }
      }

      function updateSortHeaders() {
        document.querySelectorAll(".sort-button").forEach((button) => {
          const active = button.dataset.sort === state.sortKey;
          button.setAttribute("aria-pressed", String(active));
          const indicator = button.querySelector(".sort-indicator");
          if (indicator) indicator.textContent = active ? (state.sortDirection > 0 ? "▲" : "▼") : "↕";
        });
      }

      function sortFiles(key) {
        if (state.busy) return;
        state.sortDirection = state.sortKey === key ? state.sortDirection * -1 : 1;
        state.sortKey = key;
        const direction = state.sortDirection;
        state.files.sort((left, right) => {
          if (key === "name") return left.file.name.localeCompare(right.file.name, "th", { numeric: true, sensitivity: "base" }) * direction;
          if (key === "size") return (left.file.size - right.file.size) * direction;
          return (left.id - right.id) * direction;
        });
        invalidateResult();
        clearStatus();
        updateSortHeaders();
        renderList();
      }

      function createRowButton(symbol, label, action, id, boundary) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon-button";
        button.textContent = symbol;
        button.dataset.action = action;
        button.dataset.id = String(id);
        button.dataset.boundary = String(boundary);
        button.setAttribute("aria-label", label);
        button.title = label;
        button.disabled = state.busy || boundary;
        return button;
      }

      function moveEntry(id, offset) {
        if (state.busy) return;
        const index = state.files.findIndex((entry) => entry.id === id);
        const nextIndex = index + offset;
        if (index < 0 || nextIndex < 0 || nextIndex >= state.files.length) return;
        state.selectedId = id;
        const fromToolbar = document.activeElement === moveUpButton || document.activeElement === moveDownButton;
        const [entry] = state.files.splice(index, 1);
        state.files.splice(nextIndex, 0, entry);
        state.sortKey = null;
        updateSortHeaders();
        invalidateResult();
        clearStatus();
        renderList(fromToolbar ? null : id);
        const selectedRow = fileList.querySelector(`.file-row[data-id="${id}"]`);
        if (selectedRow) {
          const wrap = selectedRow.closest(".table-wrap");
          const bounds = selectedRow.getBoundingClientRect();
          const viewport = wrap.getBoundingClientRect();
          const headerHeight = wrap.querySelector("thead").getBoundingClientRect().height;
          if (bounds.top < viewport.top + headerHeight) wrap.scrollTop -= viewport.top + headerHeight - bounds.top;
          else if (bounds.bottom > viewport.bottom) wrap.scrollTop += bounds.bottom - viewport.bottom;
        }
      }

      function removeEntry(id) {
        if (state.busy) return;
        const index = state.files.findIndex((entry) => entry.id === id);
        if (index < 0) return;
        if (previewId === id) resetPreview();
        rememberDeletion([{ entry: state.files[index], index }]);
        state.files.splice(index, 1);
        invalidateResult();
        clearStatus();
        const nearby = state.files[Math.min(index, state.files.length - 1)];
        renderList(nearby ? nearby.id : null, nearby ? "remove" : null);
        if (!nearby) fileInput.focus();
      }

      function clearDropMarkers() {
        fileList.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
          row.classList.remove("drop-before", "drop-after");
        });
      }

      function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }

      async function hasPdfHeader(file) {
        const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
        const signature = [0x25, 0x50, 0x44, 0x46, 0x2D];
        for (let start = 0; start <= prefix.length - signature.length; start += 1) {
          if (signature.every((value, index) => prefix[start + index] === value)) return true;
        }
        return false;
      }

      function friendlyError(error, filename) {
        const message = String(error && error.message ? error.message : error || "");
        if ((error && error.name === "EncryptedPDFError") || /encrypted|password/i.test(message)) {
          return `ไม่สามารถรวม “${filename}” ได้ เนื่องจากไฟล์มีรหัสผ่าน กรุณาปลดรหัสก่อนแล้วลองอีกครั้ง`;
        }
        if (/memory|allocation|array buffer|out of memory/i.test(message)) {
          return "หน่วยความจำของเบราว์เซอร์ไม่เพียงพอ กรุณาลองรวมไฟล์จำนวนน้อยลงหรือปิดโปรแกรมอื่นก่อน";
        }
        return `ไม่สามารถอ่าน “${filename}” ได้ ไฟล์อาจเสียหายหรือเป็นรูปแบบ PDF ที่ไม่รองรับ`;
      }

      async function mergePdfs() {
        if (state.busy) return;
        if (state.files.some((entry) => entry.checked && entry.rangeError)) {
          announce("กรุณาแก้ไขช่วงหน้าที่เลือกให้ถูกต้องก่อนรวม", "error");
          return;
        }
        const filesToMerge = state.files.filter((entry) => entry.checked && entry.validation === "ready");
        if (!filesToMerge.length) {
          announce("กรุณาติ๊กเลือกไฟล์ PDF อย่างน้อย 1 ไฟล์", "error");
          fileInput.focus();
          return;
        }
        if (!window.PDFLib || !window.PDFLib.PDFDocument) {
          announce("ไม่พบส่วนประกอบสำหรับรวม PDF กรุณาดาวน์โหลดไฟล์ HTML ใหม่แล้วลองอีกครั้ง", "error");
          return;
        }

        clearStatus();
        invalidateResult();
        setBusy(true);
        progressWrap.classList.add("is-visible");
        progressBar.max = filesToMerge.length;
        progressBar.value = 0;
        progressLabel.textContent = "กำลังเตรียมการรวมไฟล์…";

        let currentName = "";
        try {
          const mergedPdf = await window.PDFLib.PDFDocument.create();
          let totalPages = 0;

          for (let index = 0; index < filesToMerge.length; index += 1) {
            const entry = filesToMerge[index];
            currentName = entry.file.name;
            progressLabel.textContent = `กำลังรวมไฟล์ ${index + 1} จาก ${filesToMerge.length}: ${entry.file.name}`;
            await new Promise((resolve) => window.setTimeout(resolve, 0));

            if (!entry.file.size || !(await hasPdfHeader(entry.file))) {
              throw new Error("INVALID_PDF_HEADER");
            }

            const bytes = await entry.file.arrayBuffer();
            if (qualityMode.value === "original") {
              const sourcePdf = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
              const copiedPages = await mergedPdf.copyPages(sourcePdf, pageNumbers(entry).map((number) => number - 1));
              copiedPages.forEach((page) => mergedPdf.addPage(page));
              totalPages += copiedPages.length;
            } else {
              totalPages += await appendRasterPages(mergedPdf, bytes, entry.file.name, pageNumbers(entry));
            }
            progressBar.value = index + 1;
          }

          if (!totalPages) throw new Error("NO_PAGES");

          progressLabel.textContent = "กำลังสร้างไฟล์สำหรับดาวน์โหลด…";
          await new Promise((resolve) => window.setTimeout(resolve, 0));
          const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
          const resultName = safeOutputName(outputName.value);
          const resultBlob = new Blob([mergedBytes], { type: "application/pdf" });

          state.resultBlob = resultBlob;
          state.resultName = resultName;
          outputName.value = resultName;
          triggerDownload(resultBlob, resultName);
          announce(`รวมสำเร็จ ${totalPages.toLocaleString("th-TH")} หน้า ดาวน์โหลด “${resultName}” เริ่มแล้ว`, "success");
          previewResult.disabled = false;
          downloadAgain.disabled = false;
          downloadAgain.classList.add("is-visible");
        } catch (error) {
          console.error("PDF merge failed", error);
          announce(friendlyError(error, currentName || "ไฟล์ที่เลือก"), "error");
        } finally {
          progressWrap.classList.remove("is-visible");
          setBusy(false);
        }
      }

      function pageNumbers(entry) {
        return entry.selectedPages ?? Array.from({ length: entry.pageCount }, (_, index) => index + 1);
      }

      function parsePageRange(raw, count) {
        const text = raw.replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50)).replace(/[–—]/g, "-").trim();
        if (!text) return null;
        const selected = new Set();
        const parts = text.split(",");
        if (parts.length > 1000) throw Error("ระบุช่วงหน้ามากเกินไป");
        for (const part of parts) {
          const match = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
          if (!match) throw Error("ใช้รูปแบบ 1-3, 7 หรือเว้นว่างเพื่อรวมทุกหน้า");
          const first = Number(match[1]), last = Number(match[2] || match[1]);
          if (first < 1 || last > count || first > last) throw Error(`เลือกได้ตั้งแต่หน้า 1 ถึง ${count} และช่วงหน้าต้องเรียงจากน้อยไปมาก`);
          for (let number = first; number <= last; number++) selected.add(number);
        }
        return [...selected].sort((left, right) => left - right);
      }

      function compactPages(pages) {
        const groups = [];
        for (let index = 0; index < pages.length; index++) {
          const start = pages[index];
          let end = start;
          while (pages[index + 1] === end + 1) end = pages[++index];
          groups.push(start === end ? String(start) : `${start}-${end}`);
        }
        return groups.join(", ");
      }

      function refreshPageRow(entry) {
        const row = fileList.querySelector(`.file-row[data-id="${entry.id}"]`);
        if (!row) return;
        const input = row.querySelector(".page-range");
        const error = row.querySelector(".range-error");
        const count = row.querySelector(".page-count");
        if (input) {
          if (input.value !== entry.rangeText) input.value = entry.rangeText;
          input.setAttribute("aria-invalid", String(!!entry.rangeError));
        }
        if (error) { error.textContent = entry.rangeError; error.hidden = !entry.rangeError; }
        if (count) count.textContent = entry.validation === "ready"
          ? `${entry.pageCount} หน้า · เลือก ${entry.rangeError ? "—" : pageNumbers(entry).length} หน้า`
          : entry.validation === "checking" ? "กำลังตรวจไฟล์…" : entry.validationMessage;
      }

      function setPageRange(entry, raw) {
        entry.rangeText = raw;
        try { entry.selectedPages = parsePageRange(raw, entry.pageCount); entry.rangeError = ""; }
        catch (error) { entry.rangeError = error.message; }
        invalidateResult();
        clearStatus();
        refreshPageRow(entry);
        updateCheckedSummary();
        updatePreviewPageSelection();
      }

      function updateCheckedSummary() {
        const ready = state.files.filter((entry) => entry.validation === "ready");
        const checked = ready.filter((entry) => entry.checked);
        const totalPages = ready.reduce((sum, entry) => sum + entry.pageCount, 0);
        const selectedPages = checked.reduce((sum, entry) => sum + (entry.rangeError ? 0 : pageNumbers(entry).length), 0);
        const invalidRanges = checked.some((entry) => entry.rangeError);
        const unreadable = state.files.filter((entry) => entry.validation === "error").length;
        checkedSummary.textContent = `ติ๊กเพื่อรวม ${checked.length} / ${state.files.length} ไฟล์ · ${selectedPages} / ${totalPages} หน้า`;
        checkAll.checked = ready.length > 0 && checked.length === ready.length;
        checkAll.indeterminate = checked.length > 0 && checked.length < ready.length;
        checkAll.disabled = state.busy || ready.length === 0;
        mergeButton.disabled = state.busy || selectedPages === 0 || invalidRanges;
        validationSummary.textContent = unreadable ? `${unreadable} ไฟล์อ่านไม่ได้และจะถูกข้าม — ดูสาเหตุใต้ชื่อไฟล์` : "";
        validationSummary.hidden = unreadable === 0;
        undoDelete.disabled = state.busy || state.deleted.length === 0;
        historyNote.textContent = state.deleted.length ? `กู้ได้ ${state.deleted.length} ครั้งล่าสุดในหน้านี้` : "กู้ไฟล์ที่ลบหรือล้างรายการได้ จนกว่าจะปิดหรือรีเฟรชหน้า";
      }

      function updatePreviewPageSelection() {
        const entry = state.files.find((entry) => entry.id === previewId);
        const editable = !!previewDoc && entry?.validation === "ready";
        previewSelection.hidden = !editable;
        if (!editable) return;
        previewPageCheck.disabled = state.busy || !!entry.rangeError;
        previewPageCheck.checked = !entry.rangeError && pageNumbers(entry).includes(pageNumber);
        previewSelectionCount.textContent = `เลือก ${entry.rangeError ? "—" : pageNumbers(entry).length} / ${entry.pageCount} หน้า${entry.checked ? "" : " · ยังไม่ติ๊กไฟล์นี้เพื่อรวม"}`;
        selectAllPages.disabled = state.busy;
      }

      function rememberDeletion(items) {
        state.deleted.push({ items, selectedId: state.selectedId });
        if (state.deleted.length > 20) state.deleted.shift();
      }

      undoDelete.addEventListener("click", () => {
        if (state.busy) return;
        const action = state.deleted.pop();
        if (!action) return;
        for (const { entry, index } of action.items) {
          state.files.splice(Math.min(index, state.files.length), 0, entry);
        }
        state.selectedId = action.selectedId;
        state.sortKey = null;
        updateSortHeaders();
        invalidateResult();
        renderList();
        announce(`กู้กลับ ${action.items.length} ไฟล์ พร้อมหน้าที่เลือกไว้แล้ว`, "success");
      });

      previewPageCheck.addEventListener("change", () => {
        const entry = state.files.find((entry) => entry.id === previewId);
        if (!entry || state.busy || entry.rangeError) return;
        const pages = new Set(pageNumbers(entry));
        if (previewPageCheck.checked) pages.add(pageNumber);
        else pages.delete(pageNumber);
        if (!pages.size) {
          previewPageCheck.checked = true;
          announce("ต้องเลือกอย่างน้อย 1 หน้า หากไม่ต้องการรวมไฟล์นี้ ให้เอาติ๊กหน้าไฟล์ในรายการออก", "error");
          return;
        }
        const sorted = [...pages].sort((left, right) => left - right);
        setPageRange(entry, sorted.length === entry.pageCount ? "" : compactPages(sorted));
      });
      selectAllPages.addEventListener("click", () => {
        const entry = state.files.find((entry) => entry.id === previewId);
        if (entry && !state.busy) setPageRange(entry, "");
      });
      fileList.addEventListener("input", (event) => {
        const input = event.target.closest("input[data-range-id]");
        if (!input || state.busy) return;
        const entry = state.files.find((entry) => entry.id === Number(input.dataset.rangeId));
        if (entry?.validation === "ready") setPageRange(entry, input.value);
      });

      function askDuplicate(file, original) {
        return new Promise((resolve) => {
          duplicateName.textContent = file.name;
          duplicateOriginal.textContent = original.file.name;
          duplicateDialog.returnValue = "skip";
          duplicateDialog.addEventListener("close", () => resolve(duplicateDialog.returnValue === "add"), { once: true });
          duplicateDialog.showModal();
          document.getElementById("skipDuplicate").focus();
        });
      }

      async function findDuplicate(bytes, digest) {
        for (const entry of state.files) {
          if (entry.file.size !== bytes.byteLength) continue;
          if (digest && entry.digest) { if (digest === entry.digest) return entry; continue; }
          const existing = new Uint8Array(await entry.file.arrayBuffer());
          const incoming = new Uint8Array(bytes);
          if (existing.every((byte, index) => byte === incoming[index])) return entry;
        }
        return null;
      }

      async function inspectEntry(entry, bytes) {
        let task;
        try {
          if (!entry.file.size || !(await hasPdfHeader(entry.file))) throw Error("INVALID_PDF_HEADER");
          const source = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
          const count = source.getPages().length;
          if (!count) throw Error("NO_PAGES");
          // Check page trees with the same reader used for previews and raster quality modes.
          task = loadPdf(bytes.slice(0));
          const rendered = await task.promise;
          if (rendered.numPages !== count) throw Error("PAGE_COUNT_MISMATCH");
          for (let index = 1; index <= count; index++) {
            const page = await rendered.getPage(index);
            page.getViewport({ scale: 1 });
            page.cleanup();
          }
          entry.pageCount = count;
          entry.validation = "ready";
          entry.validationMessage = "";
        } catch (error) {
          entry.validation = "error";
          entry.checked = false;
          entry.validationMessage = /encrypted|password/i.test(String(error))
            ? "มีรหัสผ่าน — ปลดรหัสแล้วเพิ่มไฟล์ใหม่"
            : "ไฟล์เสียหายหรืออ่านไม่ได้ — ข้ามไฟล์นี้";
        } finally {
          if (task) await task.destroy().catch(() => {});
        }
      }

      async function addFiles(fileCollection) {
        if (state.busy) return;
        const files = Array.from(fileCollection || []);
        fileInput.value = "";
        const accepted = files.filter(isProbablyPdf);
        const rejected = files.length - accepted.length;
        let added = 0, skipped = 0;
        clearStatus();
        setBusy(true);
        try {
          for (const file of accepted) {
            announce(`กำลังตรวจไฟล์: ${file.name}`, "success");
            let bytes, digest;
            try {
              bytes = await file.arrayBuffer();
              digest = window.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("") : null;
              const duplicate = await findDuplicate(bytes, digest);
              if (duplicate && !(await askDuplicate(file, duplicate))) { skipped++; continue; }
            } catch (error) {
              if (!bytes) bytes = new ArrayBuffer(0);
            }
            const entry = { id: state.nextId++, file, checked: true, digest, pageCount: 0,
              selectedPages: null, rangeText: "", rangeError: "", validation: "checking", validationMessage: "" };
            state.files.push(entry);
            added++;
            invalidateResult();
            renderList();
            await inspectEntry(entry, bytes);
            renderList();
          }
          if (added) { state.sortKey = null; updateSortHeaders(); }
          const invalid = state.files.filter((entry) => entry.validation === "error").length;
          announce(`เพิ่ม ${added} ไฟล์${skipped ? ` · ข้ามไฟล์ซ้ำ ${skipped} ไฟล์` : ""}${rejected ? ` · ข้ามไฟล์ที่ไม่ใช่ PDF ${rejected} ไฟล์` : ""}${invalid ? ` · มี ${invalid} ไฟล์อ่านไม่ได้และจะถูกข้าม` : ""}`, invalid || rejected ? "error" : "success");
        } catch (error) {
          announce("เพิ่มไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
        } finally {
          setBusy(false);
          renderList();
        }
      }

      function loadPdf(data) {
        if (!window.pdfjsLib) throw new Error("PDF_RENDERER_UNAVAILABLE");
        return window.pdfjsLib.getDocument({
          data: new Uint8Array(data), isEvalSupported: false,
          useSystemFonts: true, useWasm: false, isOffscreenCanvasSupported: false,
          stopAtErrors: true
        });
      }

      async function appendRasterPages(target, data, filename, pages) {
        const task = loadPdf(data);
        let source;
        try {
          source = await task.promise;
          const high = qualityMode.value === "high";
          for (const pageIndex of pages) {
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
          return pages.length;
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
        previewSelection.hidden = true;
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
        updatePreviewPageSelection();
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


      checkAll.addEventListener("change", () => {
        if (state.busy) return;
        state.files.forEach((entry) => { entry.checked = entry.validation === "ready" && checkAll.checked; });
        invalidateResult();
        clearStatus();
        renderList();
      });
      fileList.addEventListener("change", (event) => {
        if (state.busy || !event.target.matches("input[data-check-id]")) return;
        const entry = state.files.find((entry) => entry.id === Number(event.target.dataset.checkId));
        if (!entry) return;
        entry.checked = entry.validation === "ready" && event.target.checked;
        invalidateResult();
        clearStatus();
        updateCheckedSummary();
        updatePreviewPageSelection();
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
      previewResult.addEventListener("click", () => { if (state.resultBlob) openPreview(state.resultBlob, safeOutputName(outputName.value), "result"); });
      let previewResize;
      window.addEventListener("resize", () => { window.clearTimeout(previewResize); previewResize = window.setTimeout(() => renderPreview(), 150); });
      window.addEventListener("pagehide", () => { resetPreview(); });

      fileInput.addEventListener("change", (event) => addFiles(event.target.files));

      ["dragenter", "dragover"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
          if (state.busy || state.draggedId != null) return;
          event.preventDefault();
          dropZone.classList.add("is-over");
        });
      });

      ["dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
          if (state.draggedId != null) return;
          event.preventDefault();
          dropZone.classList.remove("is-over");
        });
      });

      dropZone.addEventListener("drop", (event) => {
        if (!state.busy && state.draggedId == null) addFiles(event.dataTransfer.files);
      });

      document.querySelector(".file-table thead").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-sort]");
        if (button) sortFiles(button.dataset.sort);
      });

      moveUpButton.addEventListener("click", () => moveEntry(state.selectedId, -1));
      moveDownButton.addEventListener("click", () => moveEntry(state.selectedId, 1));

      fileList.addEventListener("focusin", (event) => {
        const row = event.target.closest(".file-row");
        if (!row || state.busy) return;
        state.selectedId = Number(row.dataset.id);
        updateSelection();
      });

      fileList.addEventListener("click", (event) => {
        if (state.busy) return;
        const row = event.target.closest(".file-row");
        if (row) {
          state.selectedId = Number(row.dataset.id);
          updateSelection();
        }
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = Number(button.dataset.id);
        if (button.dataset.action === "up") moveEntry(id, -1);
        else if (button.dataset.action === "down") moveEntry(id, 1);
        else if (button.dataset.action === "remove") removeEntry(id);
        else if (button.dataset.action === "preview") {
          const entry = state.files.find((entry) => entry.id === id);
          if (entry) openPreview(entry.file, entry.file.name, id);
        }
      });

      fileList.addEventListener("keydown", (event) => {
        if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
        const row = event.target.closest(".file-row");
        if (!row) return;
        event.preventDefault();
        moveEntry(Number(row.dataset.id), event.key === "ArrowUp" ? -1 : 1);
      });

      fileList.addEventListener("dragstart", (event) => {
        if (state.busy) return;
        const row = event.target.closest(".file-row");
        if (!row) return;
        state.draggedId = Number(row.dataset.id);
        row.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.id);
      });

      fileList.addEventListener("dragover", (event) => {
        if (state.draggedId == null) return;
        const row = event.target.closest(".file-row");
        if (!row || Number(row.dataset.id) === state.draggedId) return;
        event.preventDefault();
        clearDropMarkers();
        const rect = row.getBoundingClientRect();
        row.classList.add(event.clientY < rect.top + rect.height / 2 ? "drop-before" : "drop-after");
      });

      fileList.addEventListener("drop", (event) => {
        if (state.draggedId == null) return;
        const row = event.target.closest(".file-row");
        if (!row) return;
        event.preventDefault();
        const targetId = Number(row.dataset.id);
        if (targetId !== state.draggedId) {
          const insertAfter = row.classList.contains("drop-after");
          const fromIndex = state.files.findIndex((entry) => entry.id === state.draggedId);
          const [moved] = state.files.splice(fromIndex, 1);
          let targetIndex = state.files.findIndex((entry) => entry.id === targetId);
          if (insertAfter) targetIndex += 1;
          state.files.splice(targetIndex, 0, moved);
          state.sortKey = null;
          updateSortHeaders();
          invalidateResult();
          clearStatus();
        }
        const movedId = state.draggedId;
        state.draggedId = null;
        renderList(movedId);
      });

      fileList.addEventListener("dragend", (event) => {
        const row = event.target.closest(".file-row");
        if (row) row.classList.remove("is-dragging");
        clearDropMarkers();
        state.draggedId = null;
      });

      clearButton.addEventListener("click", () => {
        if (state.busy) return;
        resetPreview();
        if (state.files.length) rememberDeletion(state.files.map((entry, index) => ({ entry, index })));
        state.files = [];
        state.sortKey = null;
        updateSortHeaders();
        invalidateResult();
        clearStatus();
        renderList();
        fileInput.focus();
      });

      mergeButton.addEventListener("click", mergePdfs);

      downloadAgain.addEventListener("click", () => {
        if (state.resultBlob) {
          state.resultName = safeOutputName(outputName.value);
          outputName.value = state.resultName;
          triggerDownload(state.resultBlob, state.resultName);
        }
      });

      outputName.addEventListener("change", () => {
        outputName.value = safeOutputName(outputName.value);
        if (state.resultBlob) state.resultName = outputName.value;
      });

      window.addEventListener("dragover", (event) => {
        if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) event.preventDefault();
      });

      window.addEventListener("drop", (event) => {
        if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files") && !dropZone.contains(event.target)) {
          event.preventDefault();
          if (!state.busy) addFiles(event.dataTransfer.files);
        }
      });

      updateSortHeaders();
      renderList();
    })();
  