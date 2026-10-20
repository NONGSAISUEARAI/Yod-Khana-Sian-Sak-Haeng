import {objectSnap,DEFAULT_OSMODE} from './osnap.js';
import {add,sub,mul,dot,cross,length,worldPoint,localPoint} from './geometry.js';

export function readPoint(text,{area,local=false,reference=null}={}){
  const relative=text.startsWith('@'),raw=relative?text.slice(1):text;
  const parts=raw.trim().split(',').map(s=>s.trim());
  if(parts.length<2||parts.length>3||parts.some(s=>!s||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(s)))throw Error('ระบุพิกัด X,Y หรือ X,Y,Z เช่น 1000,0,0 หรือ @1000,0,0');
  const p=parts.map(Number);if(p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9))throw Error('ค่าพิกัดไม่ถูกต้อง');if(p.length===2)p.push(0);
  if(relative&&!reference)throw Error('ยังไม่มีจุดอ้างอิงสำหรับ @');
  if(local){if(!area)throw Error('เลือก Area ก่อนใช้ Local coordinates');const offset=add(add(mul(area.u,p[0]),mul(area.v,p[1])),mul(cross(area.u,area.v),p[2]));return add(relative?reference:area.base,offset)}
  return relative?add(reference,p):p;
}

export function createCommandLine(api){
  const host=document.createElement('section');host.className='command-console';host.setAttribute('aria-label','CAD command line');
  host.innerHTML=`<div class="command-top"><b>COMMAND LINE</b><div><button id="cmd-ucs" type="button" title="Switch World / Area Local coordinates">WORLD</button><button id="cmd-snap" type="button">OSNAP · F3</button><button id="cmd-ortho" type="button">ORTHO · F8</button><button id="cmd-help" type="button">? Help</button></div></div><div id="command-log" role="log" aria-live="polite"></div><form id="command-form" autocomplete="off"><label id="command-prompt" for="command-input">Command:</label><input id="command-input" spellcheck="false" aria-label="Command or coordinates" placeholder="HELP · SELECT · M · ORIGIN · DI · RO · Z"><button type="submit" aria-label="Execute command">↵</button></form><div id="command-hint">Enter to execute / repeat · Esc to cancel · Shift + Middle-drag to orbit · Middle-drag to pan</div>`;
  document.querySelector('main').insertBefore(host,document.querySelector('main footer'));
  const $=s=>host.querySelector(s),input=$('#command-input'),log=$('#command-log');
  let state=null,lastCommand='',local=false,ortho=false,lastPoint=null,hoverPoint=null,commandHistory=[],historyIndex=0;
  const aliases={M:'MOVE',O:'ORIGIN',DI:'DIST',RO:'ROTATE',U:'UNDO',Z:'ZOOM',S:'SELECT',I:'IMPORT',A:'AREA',CW:'CURTAIN','?':'HELP'};
  const known=['MOVE','ORIGIN','DIST','ROTATE','SELECT','UNDO','ZOOM','IMPORT','AREA','ALIGN','SAVE','EXPORT','DXF','CURTAIN','UCS','OSNAP','OSMODE','ORTHO','HELP'];
  const pretty=p=>p.map(n=>Number(n.toFixed(3))).join(', ');
  function write(text,error=false){const line=document.createElement('div');line.textContent=text;if(error)line.className='command-error';log.append(line);while(log.children.length>70)log.firstChild.remove();log.scrollTop=log.scrollHeight}
  function refresh(){
    let prompt='Command:';
    if(state){if(state.step==='select')prompt='Select area [number / name / click]:';
      if(state.step==='base')prompt=state.type==='ROTATE'?'Specify pivot [Enter = area base]:':'Specify base point [Enter = area base]:';
      if(state.step==='target')prompt='Specify second point:';
      if(state.step==='origin')prompt='Specify pattern origin [Local X,Y]:';
      if(state.step==='first')prompt='Specify first point:';
      if(state.step==='second')prompt='Specify second point:';
      if(state.step==='angle')prompt='Specify rotation angle [world Z, degrees]:';
      if(state.step==='zoom')prompt='ZOOM [Extents / Selected]:';
      if(state.step==='osmode')prompt='OSMODE <'+api.osmode()+'>:';
      if(state.step==='ucs')prompt='UCS [World / Local]:';
    }
    $('#command-prompt').textContent=prompt;input.placeholder=state?'Type coordinates or pick a point in the viewport':'HELP · SELECT · M · ORIGIN · DI · RO · Z';
    $('#cmd-ucs').textContent=state?.type==='ORIGIN'?'AREA LOCAL':local?'AREA LOCAL':'WORLD';
    $('#cmd-snap').classList.toggle('active',api.snap());$('#cmd-ortho').classList.toggle('active',ortho);
    if(!state)$('#command-hint').textContent='Enter to execute / repeat · Esc to cancel · Shift + Middle-drag to orbit · Middle-drag to pan';
    host.classList.toggle('command-running',!!state);api.changed(!!state);
  }
  function cancel(message=true){if(state&&message)write('*Cancel*');state=null;hoverPoint=null;input.value='';api.marker(null);refresh()}
  function complete(message){if(message)write(message);state=null;hoverPoint=null;api.marker(null);refresh()}
  function pointArea(){return state?.areaId?api.areas().find(a=>a.id===state.areaId):api.selected()}
  function requireArea(type){const a=api.selected();state={type,step:type==='SELECT'?'select':a?'base':'select',areaId:a?.id};if(a&&type!=='SELECT')advanceSelection(a);else refresh()}
  function advanceSelection(a){state.areaId=a.id;state.step=state.type==='SELECT'?'select':state.type==='ORIGIN'?'origin':'base';if(state.type==='SELECT')complete(`Selected: ${a.name}`);else refresh()}
  function acceptPoint(p,typed=false){
    if(!state)return;const a=pointArea();lastPoint=p;
    if(state.step==='base'){state.base=p;state.step=state.type==='ROTATE'?'angle':'target';write('Base: '+pretty(p));refresh();return}
    if(state.step==='first'){state.base=p;state.step='second';write('First point: '+pretty(p));refresh();return}
    if(state.step==='second'){const delta=sub(p,state.base);complete(`Distance = ${length(delta).toFixed(3)} mm | ΔX ${delta[0].toFixed(3)} · ΔY ${delta[1].toFixed(3)} · ΔZ ${delta[2].toFixed(3)}`);return}
    if(!a){cancel(false);write('Area no longer exists',true);return}
    if(state.step==='target'){const delta=sub(p,state.base);if(api.commit(a.id,area=>area.base=add(area.base,delta),'Area moved'))complete(`Moved ${a.name} by ${pretty(delta)} mm`);return}
    if(state.step==='origin'){const normal=cross(a.u,a.v);if(Math.abs(dot(sub(p,a.base),normal))>.05){write('Origin ต้องอยู่บนระนาบ Area (Local Z = 0)',true);return}const q=localPoint(a,p);if(api.commit(a.id,area=>area.pattern.origin=q,'Pattern origin updated'))complete(`Origin: ${pretty(q)} mm · ${a.name}`)}
  }
  function selectValue(value){const all=api.areas();const a=/^\d+$/.test(value)?all[Number(value)-1]:all.find(a=>a.name.toLowerCase()===value.toLowerCase());if(!a)throw Error('ไม่พบ Area — ใช้เลขลำดับในรายการ หรือคลิกผิว');api.select(a.id);if(state)advanceSelection(a)}
  function run(text){
    const [head,...rest]=text.trim().split(/\s+/),cmd=aliases[head.toUpperCase()]||head.toUpperCase(),args=rest.join(' ');
    if(!known.includes(cmd))throw Error('Unknown command: '+head+' · พิมพ์ HELP เพื่อดูคำสั่ง');
    cancel(false);api.cancelPick();lastCommand=cmd;write('Command: '+text);
    if(['MOVE','ORIGIN','ROTATE','SELECT'].includes(cmd)){requireArea(cmd);if(args){if(state?.step==='select')selectValue(args);else submit(args)}return}
    if(cmd==='DIST'){state={type:cmd,step:'first',areaId:api.selected()?.id};refresh();return}
    if(cmd==='UCS'){state={type:cmd,step:'ucs'};refresh();if(args)submit(args);return}
    if(cmd==='ZOOM'){state={type:cmd,step:'zoom'};refresh();if(args)submit(args);return}
    if(cmd==='OSMODE'){state={type:cmd,step:'osmode'};refresh();if(args)submit(args);return}
    if(cmd==='OSNAP'){api.setSnap(!api.snap());complete('OSNAP '+(api.snap()?'ON':'OFF'));return}
    if(cmd==='ORTHO'){ortho=!ortho;complete('ORTHO '+(ortho?'ON':'OFF'));return}
    if(cmd==='UNDO'){api.action('undo');complete('Undo');return}
    if(cmd==='HELP'){write('SELECT / S → เลือก Area ด้วยเลข ชื่อ หรือคลิก');write('MOVE / M → จุดฐาน → จุดปลาย | ORIGIN / O → Local X,Y');write('ROTATE / RO → จุดหมุน → มุมรอบ World Z | DIST / DI → วัดระยะ');write('UCS WORLD / LOCAL · พิกัด X,Y,Z · @X,Y,Z = ระยะจากจุดก่อนหน้า');write('AREA / A · IMPORT / I · CURTAIN / CW · ALIGN · SAVE · EXPORT / DXF · UNDO / U · ZOOM / Z → E / S');write('OSMODE [value] · 1 END / 2 MID / 128 PER / 512 NEA / 1024 GCEN · รวมค่าเพื่อเลือกหลายโหมด');write('F3 = เปิด/พัก OSNAP · F8 = ORTHO (เมื่อคลิกจุด) · ↑/↓ ประวัติคำสั่ง');complete();return}
    api.action({AREA:'add-area',IMPORT:'import-dxf',ALIGN:'align-edge',SAVE:'save-project',EXPORT:'export-dxf',DXF:'export-dxf',CURTAIN:'curtain-wall'}[cmd]);complete();
  }
  function submit(text){try{
    text=text.trim();if(!state){if(text)run(text);else if(lastCommand)run(lastCommand);return}
    const word=text.split(/\s/)[0].toUpperCase();if(text&&!text.includes(',')&&(known.includes(aliases[word]||word))){run(text);return}
    if(state.step==='osmode'){if(text)api.setOsmode(text);complete('OSMODE = '+api.osmode());return}
    if(state.step==='select'){if(!text)throw Error('เลือก Area ด้วยเลข ชื่อ หรือคลิก');selectValue(text);return}
    if(state.step==='ucs'){if(!/^(W|WORLD|L|LOCAL)$/i.test(text))throw Error('ใช้ WORLD หรือ LOCAL');if(/^L/i.test(text)&&!api.selected())throw Error('เลือก Area ก่อนใช้ Local coordinates');local=/^L/i.test(text);complete('Coordinates: '+(local?'AREA LOCAL':'WORLD'));return}
    if(state.step==='zoom'){if(/^(E|EXTENTS)$/i.test(text)){api.action('fit-all');complete('Zoom extents')}else if(/^(S|SELECTED)$/i.test(text)){api.action('fit-selected');complete('Zoom selected')}else throw Error('ใช้ E = Extents หรือ S = Selected');return}
    const a=pointArea();if(state.step==='angle'){if(!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text))throw Error('ระบุมุมเป็นตัวเลข');const angle=Number(text)*Math.PI/180,pivot=state.base,c=Math.cos(angle),s=Math.sin(angle),rotate=v=>[v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]];if(api.commit(a.id,area=>{area.base=add(pivot,rotate(sub(area.base,pivot)));area.u=rotate(area.u);area.v=rotate(area.v)},'Area rotated'))complete('Rotated '+text+'° around world Z');return}
    if(!text&&state.step==='base'){acceptPoint([...a.base],true);return}
    const reference=state.step==='origin'?worldPoint(a,a.pattern.origin):(state.base||lastPoint);
    const p=readPoint(text,{area:a,local:state.type==='ORIGIN'||local,reference});write('Point: '+text);acceptPoint(p,true);
  }catch(e){write(e.message,true);api.message(e.message);refresh()}}
  function pointFromRay(ray,hits,tolerance){
    const a=pointArea();const reference=state?.base||a?.base||lastPoint||[0,0,0];const n=a?cross(a.u,a.v):[0,0,1];const denom=dot(ray.direction,n);let p;
    if(state?.step==='origin'){p=hits.find(h=>h.areaId===a?.id)?.point;if(!p)return null}
    else if(Math.abs(denom)>1e-9){const distance=dot(sub(reference,ray.origin),n)/denom;if(distance<0)return null;p=add(ray.origin,mul(ray.direction,distance))}
    else p=hits[0]?.point;
    if(!p)return null;
    let snapped=false;
    if(a&&api.snap()){
      const q=localPoint(a,p),result=objectSnap(q,a,tolerance,api.osmode?.()??DEFAULT_OSMODE,state?.base?localPoint(a,state.base):null),candidate=worldPoint(a,result.point);
      if(length(sub(candidate,p))<=tolerance){snapped=result.type||false;p=candidate}
    }
    if(ortho&&state?.base&&!snapped){const delta=sub(p,state.base),axes=local&&a?[a.u,a.v,cross(a.u,a.v)]:[[1,0,0],[0,1,0],[0,0,1]];const axis=axes.reduce((best,axis)=>Math.abs(dot(delta,axis))>Math.abs(dot(delta,best))?axis:best,axes[0]);p=add(state.base,mul(axis,dot(delta,axis)))}
    return {p,snapped};
  }
  function handleRay(ray,hits,tolerance,click=false){if(!state||['angle','ucs','zoom','osmode'].includes(state.step))return !!state;
    if(state.step==='select'){if(click&&hits[0]){api.select(hits[0].areaId);if(state)advanceSelection(api.selected())}return true}
    const result=pointFromRay(ray,hits,tolerance);if(!result){api.marker(null);return true}hoverPoint=result.p;api.marker(result.p,result.snapped,tolerance);
    $('#command-hint').textContent=(state.type==='ORIGIN'?'LOCAL '+pretty(localPoint(pointArea(),result.p)):'WORLD '+pretty(result.p))+' mm'+(result.snapped?' · '+result.snapped:'')+' · Esc to cancel';
    if(click){acceptPoint(result.p);input.focus({preventScroll:true})}return true;
  }
  $('#command-form').onsubmit=e=>{e.preventDefault();const text=input.value;input.value='';if(text){commandHistory.push(text);historyIndex=commandHistory.length}submit(text)};
  input.onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();historyIndex=Math.max(0,Math.min(commandHistory.length,historyIndex+(e.key==='ArrowUp'?-1:1)));input.value=commandHistory[historyIndex]||''}};
  $('#cmd-ucs').onclick=()=>{if(!local&&!api.selected()){write('เลือก Area ก่อนใช้ Local coordinates',true);return}local=!local;write('Coordinates: '+(local?'AREA LOCAL':'WORLD'));refresh()};
  $('#cmd-snap').onclick=()=>{api.setSnap(!api.snap());refresh()};$('#cmd-ortho').onclick=()=>{ortho=!ortho;refresh()};$('#cmd-help').onclick=()=>submit('HELP');
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]')||e.isComposing)return;
    const target=e.target,editing=target.matches('input,textarea,select,[contenteditable=true]');
    if(e.key==='Escape'){if(state||target===input){e.preventDefault();cancel();input.blur()}return}
    if((e.key==='F3'||e.key==='F8')&&(!editing||target===input)){e.preventDefault();if(e.key==='F3')api.setSnap(!api.snap());else ortho=!ortho;refresh();return}
    if(editing||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Enter'&&target.closest('button,a,[role="button"]'))return;
    if(e.key==='Enter'){e.preventDefault();input.focus();submit('');return}
    if(e.key.length===1&&/^[a-zA-Z0-9@?.+,-]$/.test(e.key)){e.preventDefault();input.focus();input.value+=e.key}
  });
  write('Facade Studio command line · HELP for commands');refresh();
  return {get active(){return !!state},handleRay,cancel,selectionChanged(id){if(!state)return;if(state.step==='select')advanceSelection(api.selected());else if(state.areaId&&state.areaId!==id)cancel()},externalChange(){if(state)cancel()},refresh};
}




