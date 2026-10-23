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
