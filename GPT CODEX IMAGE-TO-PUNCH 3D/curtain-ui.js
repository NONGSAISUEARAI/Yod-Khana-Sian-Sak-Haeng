import {curtainSettings,curtainOrigin} from './curtain-settings.js';
import {cross,mul} from './geometry.js';

export function mountCurtainProperties(){
 const container=document.createElement('div');
 container.innerHTML=`<section id="curtain-section"><div class="section-title"><span>05</span><h2>Curtain Wall</h2></div><label class="check"><input id="cw-enabled" type="checkbox">Enable on this area</label><div class="curtain-subheading">CURTAIN ORIGIN</div><div class="fields"><label>Local X · mm<input id="cw-originX" data-cw="originX" type="number" step="1"></label><label>Local Y · mm<input id="cw-originY" data-cw="originY" type="number" step="1"></label></div><label>Curtain axis angle · degrees<input id="cw-angle" data-cw="angle" type="number" step="1"></label><button id="cw-pick-origin" class="accent full">⌖ Pick curtain origin</button><button id="cw-use-pattern" class="full">Use Pattern Origin</button><p id="cw-origin-info" class="helper"></p><div class="fields"><label>Grid X · mm<input id="cw-spacingX" data-cw="spacingX" type="number" min="50" step="50"></label><label>Grid Y · mm<input id="cw-spacingY" data-cw="spacingY" type="number" min="50" step="50"></label></div><div class="fields"><label>Panel gap · mm<input id="cw-gap" data-cw="gap" type="number" min="0" step="1"></label><label>Panel thickness<input id="cw-panelThickness" data-cw="panelThickness" type="number" min="0.1" step="1"></label></div><label class="check"><input id="cw-gapAtBoundary" data-cw="gapAtBoundary" type="checkbox">Offset gap at Area boundary</label><p class="helper">เปิด: เว้นขอบ Area ครึ่งหนึ่งของ gap (gap 12 → ขอบ 6 mm)<br>ปิด: แผ่นถึงขอบ Area แต่ยังเว้นรอยต่อระหว่างแผ่น</p><div class="fields"><label>Panel type<select id="cw-panelType" data-cw="panelType"><option value="solid">Solid panel</option><option value="glass">Glass</option><option value="open">Open bay</option></select></label><label>Panel color<input id="cw-panelColor" data-cw="panelColor" type="color"></label></div><label class="check"><input id="cw-showPanels" data-cw="showPanels" type="checkbox">Show panels</label><label class="check"><input id="cw-showGrid" data-cw="showGrid" type="checkbox">Show curtain grid</label><div class="curtain-subheading">MULLIONS</div><label class="check"><input id="cw-showMullions" data-cw="showMullions" type="checkbox">Show mullions</label><div class="fields"><label>Width · mm<input id="cw-mullionWidth" data-cw="mullionWidth" type="number" min="1" step="5"></label><label>Depth · mm<input id="cw-mullionDepth" data-cw="mullionDepth" type="number" min="1" step="5"></label></div><label>Center offset from surface · mm<input id="cw-mullionOffset" data-cw="mullionOffset" type="number" step="5"></label><label class="check"><input id="cw-flipMullionSide" data-cw="flipMullionSide" type="checkbox">Flip offset side</label><p id="cw-offset-info" class="helper"></p><label class="check"><input id="cw-boundary" data-cw="boundary" type="checkbox">Frame outer boundary</label><label class="check"><input id="cw-openings" data-cw="openings" type="checkbox">Frame openings</label><div class="curtain-subheading">ADDITIONAL GRID LINES</div><label>Extra X positions · mm<input id="cw-customX" data-cw="customX" placeholder="e.g. 800, 2500"></label><label>Extra Y positions · mm<input id="cw-customY" data-cw="customY" placeholder="e.g. 2100"></label><p class="helper">ระยะจาก Origin บนแกนกริด เพิ่มแนวแบ่งจาก spacing ปกติได้</p><div id="cw-stats" class="curtain-stats"></div><p id="cw-error" class="helper curtain-error" role="status"></p></section><section id="curtain-panel-section"><div class="section-title"><span>06</span><h2>Selected panel</h2></div><p id="cw-selected-info" class="helper">คลิกช่อง Panel ในฉากเพื่อปรับชนิดเฉพาะช่อง</p><label>Panel override<select id="cw-panel-override" disabled><option value="inherit">Use area default</option><option value="solid">Solid panel</option><option value="glass">Glass</option><option value="open">Open bay</option></select></label><button id="cw-reset-overrides" class="full">Reset panel overrides</button></section>`;
 const before=document.querySelector('#inspector > .danger-zone');for(const section of [...container.children])before.before(section);
}
export function updateCurtainProperties(a,layout,panelKey,selection={areas:[a],layouts:[layout]}){
 const group=selection.areas.length?selection.areas:[a],multi=group.length>1,settings=group.map(curtainSettings),enabled=settings.some(c=>c.enabled),c=curtainSettings(a),f=curtainOrigin(a),enableBox=document.querySelector('#cw-enabled');enableBox.checked=settings.every(c=>c.enabled);enableBox.indeterminate=enabled&&!enableBox.checked;
 for(const input of document.querySelectorAll('[data-cw]')){
  const key=input.dataset.cw,values=group.map(a=>{const c=curtainSettings(a),f=curtainOrigin(a);return key==='originX'?f.origin[0]:key==='originY'?f.origin[1]:key==='angle'?f.angle:c[key]}),value=values[0],mixed=values.some(v=>JSON.stringify(v)!==JSON.stringify(value));input.dataset.mixed=String(mixed);input.title=mixed?'Mixed values — edit to apply to every selected Area':'';
  if(input.type==='checkbox'){input.checked=values.every(Boolean);input.indeterminate=mixed}
  else if(input.tagName==='SELECT'){let option=input.querySelector('option[value="__mixed"]');if(mixed&&!option){option=document.createElement('option');option.value='__mixed';option.textContent='Mixed';option.disabled=true;input.prepend(option)}input.value=mixed?'__mixed':value}
  else if(input!==document.activeElement){input.value=mixed&&input.type!=='color'?'':Array.isArray(value)?value.join(', '):value;input.placeholder=mixed?'Mixed':''}
  input.disabled=!enabled;
 }
 const layouts=selection.layouts.filter(Boolean),panels=layouts.flatMap(l=>l.panels);document.querySelector('#cw-stats').textContent=layouts.length?`${multi?group.length+' selected areas · ':''}${panels.length} panels · ${panels.filter(p=>p.type==='open').length} open bays\n${layouts.reduce((s,l)=>s+l.panelArea,0).toFixed(2)} m² panel area · ${layouts.reduce((s,l)=>s+l.mullionLength,0).toFixed(2)} m mullion centerlines`:'Enable to generate panels and framing';
 const panel=!multi&&layout?.panels.find(p=>p.key===panelKey),select=document.querySelector('#cw-panel-override');select.disabled=!panel;select.value=panel?c.overrides[panel.key]||'inherit':'inherit';
 document.querySelector('#cw-selected-info').textContent=panel?`${panel.name} · ${panel.type}\n${panel.width.toFixed(1)} × ${panel.height.toFixed(1)} mm cell\n${panel.area.toFixed(3)} m² net panel`:multi?'เลือก Area เดียวเพื่อปรับชนิดเฉพาะ Panel':'คลิกช่อง Panel ในฉากเพื่อปรับชนิดเฉพาะช่อง';
 document.querySelector('#cw-reset-overrides').disabled=!enabled||!settings.some(c=>Object.keys(c.overrides).length);
 document.querySelector('#cw-pick-origin').disabled=!enabled;document.querySelector('#cw-pick-origin').textContent=multi?'⌖ Pick shared curtain origin':'⌖ Pick curtain origin';document.querySelector('#cw-pick-origin').title=multi?'คลิกจุดบน Area ที่เลือก เพื่อฉาย Origin ร่วมลงบนแต่ละระนาบ':'';document.querySelector('#cw-use-pattern').disabled=!enabled;document.querySelector('#cw-use-pattern').textContent=multi?'Use each Area’s Pattern Origin':'Use Pattern Origin';
 document.querySelector('#cw-origin-info').textContent=multi?'Pick shared origin: คลิกจุดเดียวเพื่อฉายลงแต่ละ Area · ช่อง X/Y เป็นพิกัด Local ของแต่ละด้าน':c.origin===null?'Using Pattern Origin until a separate Curtain Origin is set.':'Independent Curtain Origin · Local X/Y on this Area';
 const displacement=mul(cross(a.u,a.v),c.mullionOffset*(c.flipMullionSide?-1:1)).map(n=>Number(n.toFixed(2)));
 document.querySelector('#cw-offset-info').textContent=multi?'ค่า Offset ใช้ร่วมกัน แต่รักษา Flip ของแต่ละ Area ไว้ · หากโครงอยู่ผิดฝั่ง ให้เลือกด้านนั้นด้านเดียวแล้ว Flip':`เลื่อนตาม Normal ของ Area${c.flipMullionSide?' (กลับฝั่งแล้ว)':''} · World ΔX/Y/Z: ${displacement.join(' / ')} mm`;
}
export function bindCurtainProperties(api){
 let timer,pending=null;
 const error=text=>document.querySelector('#cw-error').textContent=text;
 function apply(input,selectionToken){
  if(api.selectionToken()!==selectionToken)return;
  try{
   let value=input.type==='checkbox'?input.checked:input.value;
   if(input.type==='number'){if(value==='')throw Error('กรอกค่าตัวเลข');value=Number(value)}
   if(['customX','customY'].includes(input.dataset.cw)){value=value.trim()?value.split(/[\s,;]+/).filter(Boolean).map(Number):[]}
   const key=input.id==='cw-enabled'?'enabled':input.dataset.cw;
   const ok=api.commit(a=>{const c=curtainSettings(a),f=curtainOrigin(a);if(key==='originX'||key==='originY'){c.origin=[...f.origin];c.origin[key==='originX'?0:1]=value;c.angle=f.angle}else if(key==='angle'){c.origin=[...f.origin];c.angle=value}else c[key]=value;a.curtain=c},'Curtain Wall updated');if(ok)error('');
  }catch(e){error(e.message)}
 }
 function flush(){clearTimeout(timer);const item=pending;pending=null;if(item)apply(item.input,item.token)}
 document.querySelector('#cw-enabled').onchange=e=>{flush();apply(e.target,api.selectionToken())};
 for(const input of document.querySelectorAll('[data-cw]')){
  const delayed=input.type==='number'||input.type==='color'||input.tagName==='INPUT'&&input.type==='text';
  input.addEventListener(delayed?'input':'change',()=>{if(pending&&pending.input!==input)flush();clearTimeout(timer);const token=api.selectionToken();if(delayed){pending={input,token};timer=setTimeout(flush,220)}else apply(input,token)});
  if(delayed){input.addEventListener('change',()=>{if(pending?.input===input)flush()});input.addEventListener('blur',()=>{if(pending?.input===input)flush()});input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(pending?.input===input)flush()}})}
 }
 document.querySelector('#cw-panel-override').onchange=e=>{const key=api.panelKey();if(!key)return;api.commitPanel(a=>{a.curtain=curtainSettings(a);if(e.target.value==='inherit')delete a.curtain.overrides[key];else a.curtain.overrides[key]=e.target.value},'Panel type updated')};
 document.querySelector('#cw-reset-overrides').onclick=()=>api.commit(a=>{a.curtain=curtainSettings(a);a.curtain.overrides={}},'Panel overrides reset');
 document.querySelector('#cw-pick-origin').onclick=()=>api.pickOrigin();
 document.querySelector('#cw-use-pattern').onclick=()=>api.commit(a=>{a.curtain={...curtainSettings(a),origin:[...a.pattern.origin],angle:a.pattern.angle}},'Pattern Origin copied to Curtain Wall');
 return {error};
}



