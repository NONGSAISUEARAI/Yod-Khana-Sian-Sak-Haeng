import {SNAP_MODES,SUPPRESS,DEFAULT_OSMODE,parseOsmode,snapEnabled} from './osnap.js';

export function setupObjectSnap(changed){
 const key='facade-studio-osmode-v1',toggle=document.querySelector('#snap-toggle');
 let mode=DEFAULT_OSMODE;
 try{const saved=localStorage.getItem(key);if(saved!==null)mode=parseOsmode(saved)}catch{}
 toggle.parentElement.lastChild.textContent='Object Snap · F3';
 const panel=document.createElement('details');panel.id='osnap-settings';
 panel.innerHTML='<summary>Object Snap settings · OSMODE</summary>'+SNAP_MODES.map(m=>`<label class="check"><input type="checkbox" data-osmode="${m.bit}">${m.name} · ${m.bit}</label>`).join('')+'<p class="helper" id="osmode-value"></p><p class="helper">จับขอบ Area และช่องเปิด · Perpendicular ใช้จุดฐานจากคำสั่ง Move / Distance · Geometric Center จับจุดศูนย์กลางรูปปิด</p>';
 toggle.parentElement.after(panel);
 const feedback=document.createElement('p');feedback.id='osnap-feedback';feedback.className='helper';panel.after(feedback);
 function render(){
  toggle.checked=snapEnabled(mode);
  for(const input of panel.querySelectorAll('[data-osmode]'))input.checked=!!(mode&Number(input.dataset.osmode));
  document.querySelector('#osmode-value').textContent='OSMODE = '+mode+((mode&SUPPRESS)?' · Suspended':'');
 }
 function set(value){mode=parseOsmode(value);try{localStorage.setItem(key,String(mode))}catch{}render();feedback.textContent='';changed()}
 function setEnabled(value){set(value?((mode&~SUPPRESS)||DEFAULT_OSMODE):(mode|SUPPRESS))}
 for(const input of panel.querySelectorAll('[data-osmode]'))input.onchange=()=>set(Array.from(panel.querySelectorAll('[data-osmode]:checked')).reduce((n,input)=>n|Number(input.dataset.osmode),mode&SUPPRESS));
 toggle.addEventListener('change',()=>setEnabled(toggle.checked));render();
 return {get:()=>mode,set,setEnabled,enabled:()=>snapEnabled(mode),feedback:type=>feedback.textContent=type?'OSNAP · '+type:''};
}
