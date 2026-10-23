const fs=require('fs');
let html=fs.readFileSync('PDF_MERGER.html','utf8');
function change(from,to){if(!html.includes(from))throw Error('Missing '+from.slice(0,80));html=html.replace(from,()=>to);}
change('      <div class="preview-head">','      <div class="preview-toolbar" aria-label="เครื่องมือพรีวิว PDF">\n      <div class="preview-head">');
change('      <div class="preview-body" id="previewBody">','      </div>\n      <div class="preview-body" id="previewBody">');
change('  </style>',`
    .page-shell { padding-top: 8px; }
    .masthead { gap: 8px; margin-bottom: 8px; align-items: center; }
    .brand-mark { width: 26px; height: 30px; border-radius: 6px; box-shadow: none; }
    .brand-mark::before { bottom: 4px; font-size: 8px; }
    .brand-mark::after { width: 9px; height: 9px; border-radius: 0 6px 0 4px; }
    .masthead > div:last-child { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .masthead h1 { flex: 0 0 auto; margin: 0; font-size: 20px; line-height: 1.3; white-space: nowrap; }
    .masthead .subtitle { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .preview-panel { display: flex; flex-direction: column; height: calc(100dvh - 64px); }
    .preview-toolbar { display: flex; flex-wrap: nowrap; align-items: center; flex: 0 0 auto; min-width: 0; gap: 6px; margin-bottom: 8px; padding-bottom: 2px; overflow-x: auto; white-space: nowrap; scrollbar-width: thin; }
    .preview-toolbar .preview-head, .preview-toolbar .preview-controls, .preview-toolbar .preview-selection { display: contents; }
    .preview-toolbar h2 { order: 0; flex-shrink: 0; font-size: 13px; }
    .preview-toolbar .preview-name { order: 1; flex: 1 1 130px; min-width: 50px; max-width: 180px; margin: 0; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .preview-controls > * { order: 2; flex-shrink: 0; }
    .preview-toolbar .preview-page { margin: 0; font-size: 12px; }
    .preview-toolbar .button { min-height: 28px; padding: 4px 7px; font-size: 11px; border-radius: 7px; }
    .preview-selection > * { order: 3; flex-shrink: 0; font-size: 11px; }
    .preview-toolbar .preview-selection > span { margin: 0; }
    .preview-toolbar #closePreview { order: 4; flex-shrink: 0; margin-left: auto; padding: 4px 6px; font-size: 11px; }
    .preview-body { flex: 1 1 auto; height: auto; min-height: 0; }
    .table-wrap { height: min(42vh, 380px); min-height: 180px; max-height: none; overflow-y: scroll; overflow-x: auto; scrollbar-gutter: stable; scrollbar-width: auto; scrollbar-color: #889bb5 #edf2f8; }
    .table-wrap::-webkit-scrollbar { width: 12px; height: 10px; }
    .table-wrap::-webkit-scrollbar-track { background: #edf2f8; }
    .table-wrap::-webkit-scrollbar-thumb { border: 2px solid #edf2f8; border-radius: 8px; background: #889bb5; }
    @media (max-width: 1000px) { .preview-panel { height: 75vh; min-height: 360px; } }
  </style>`);
for(const file of ['PDF_MERGER.html','PDF_MERGER/index.html'])fs.writeFileSync(file,html);
