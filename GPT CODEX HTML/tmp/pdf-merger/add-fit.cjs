const fs = require('fs');
let html = fs.readFileSync('PDF_MERGER.html','utf8');
function change(from,to) { if(!html.includes(from))throw Error('Missing '+from.slice(0,80));html=html.replace(from,()=>to); }
change('        <button class="button button-secondary" id="zoomOut"', `        <button class="button button-secondary" id="fitWidth" type="button" aria-label="ปรับพรีวิวให้พอดีความกว้าง" aria-pressed="true">Fit to Width</button>
        <button class="button button-secondary" id="fitPage" type="button" aria-label="ปรับพรีวิวให้เห็นเต็มหน้า" aria-pressed="false">Fit to Page</button>
        <button class="button button-secondary" id="zoomOut"`);
change('  </style>', `    .preview-body { scrollbar-gutter: stable; }
    .preview-controls button[aria-pressed="true"] { color: var(--blue-dark); border-color: var(--blue); background: var(--blue-soft); }
  </style>`);
change('      let previewId = null, pageNumber = 1, previewZoom = 1;', `      let previewId = null, pageNumber = 1, previewZoom = 1;
      let previewFit = "width";
      const fitWidth = document.getElementById("fitWidth");
      const fitPage = document.getElementById("fitPage");`);
change('        previewZoom = 1;', '        previewZoom = 1;\n        previewFit = "width";');
change('        previewPage.textContent = `หน้า ${pageNumber} / ${doc.numPages} · ${Math.round(previewZoom * 100)}%`;', `        previewPage.textContent = "หน้า " + pageNumber + " / " + doc.numPages;
        fitWidth.setAttribute("aria-pressed", String(previewFit === "width"));
        fitPage.setAttribute("aria-pressed", String(previewFit === "page"));`);
change(`          const fit = Math.max(160, previewBody.clientWidth - 30) / natural.width;
          const scale = Math.min(fit * previewZoom * Math.min(window.devicePixelRatio || 1, 2), Math.sqrt(16000000 / (natural.width * natural.height)));`, `          const style = getComputedStyle(previewBody);
          const availableWidth = Math.max(1, previewBody.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2);
          const availableHeight = Math.max(1, previewBody.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2);
          const widthScale = availableWidth / natural.width;
          if (previewFit === "width") previewZoom = widthScale;
          else if (previewFit === "page") previewZoom = Math.min(widthScale, availableHeight / natural.height);
          previewPage.textContent = "หน้า " + pageNumber + " / " + doc.numPages + " · " + Math.round(previewZoom * 100) + "%";
          const scale = Math.min(previewZoom * Math.min(window.devicePixelRatio || 1, 2), Math.sqrt(16000000 / (natural.width * natural.height)));`);
change('canvas.style.width = `${natural.width * fit * previewZoom}px`;', 'canvas.style.width = `${Math.floor(natural.width * previewZoom)}px`;');
change('canvas.style.height = `${natural.height * fit * previewZoom}px`;', 'canvas.style.height = `${Math.floor(natural.height * previewZoom)}px`;');
change('          previewBody.replaceChildren(canvas);', `          previewBody.replaceChildren(canvas);
          if (previewFit !== "custom") { previewBody.scrollTop = 0; previewBody.scrollLeft = 0; }`);
change(`      document.getElementById("zoomIn").addEventListener("click", () => { previewZoom = Math.min(3, previewZoom + .25); renderPreview(); });
      document.getElementById("zoomOut").addEventListener("click", () => { previewZoom = Math.max(.5, previewZoom - .25); renderPreview(); });`, `      fitWidth.addEventListener("click", () => { previewFit = "width"; renderPreview(); });
      fitPage.addEventListener("click", () => { previewFit = "page"; renderPreview(); });
      document.getElementById("zoomIn").addEventListener("click", () => { previewFit = "custom"; previewZoom = Math.min(10, previewZoom * 1.25); renderPreview(); });
      document.getElementById("zoomOut").addEventListener("click", () => { previewFit = "custom"; previewZoom = Math.max(.05, previewZoom / 1.25); renderPreview(); });`);
for(const file of ['PDF_MERGER.html','PDF_MERGER/index.html'])fs.writeFileSync(file,html);
